import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { prisma } from "../../../lib/prisma";
import { TICKET_REGISTRY_ABI, TICKET_REGISTRY_ADDRESS } from "../../../lib/contracts";
import { contractCall, revertName, rpcRequest, sleep } from "../../../lib/chain";

export const dynamic = "force-dynamic";

const iface = new ethers.utils.Interface(TICKET_REGISTRY_ABI);
const ATTEMPTS = 4;
const RETRY_DELAY_MS = 2500;

// A public RPC node can lag a block behind the wallet's node, so a ticket
// the buyer has just paid for may not be visible yet. Retry a few times
// before giving up.
async function withRetry<T>(read: () => Promise<T | null>): Promise<T | null> {
  for (let i = 0; i < ATTEMPTS; i++) {
    const value = await read();
    if (value !== null) return value;
    if (i < ATTEMPTS - 1) await sleep(RETRY_DELAY_MS);
  }
  return null;
}

async function readTicket(ticketId: number) {
  try {
    const t = await contractCall(iface, TICKET_REGISTRY_ADDRESS, "ticketInfo", [ticketId]);
    return { owner: t.ticketOwner as string, eventId: (t.eventId as ethers.BigNumber).toNumber() };
  } catch (e) {
    if (revertName(iface, e) === "TicketNotFound") return null;
    throw e;
  }
}

interface Receipt {
  status: string;
  to: string | null;
  logs: { address: string; topics: string[]; data: string }[];
}

// POST /api/tickets — records a purchased ticket in the database cache.
// Never trusts the client: the ticket must exist in the contract, belong to
// the claimed address, and the transaction must really be the purchase of
// that ticket. Only then is the row written.
export async function POST(request: NextRequest) {
  let body: { ticketId?: number; walletAddress?: string; txHash?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { ticketId, walletAddress, txHash } = body;
  if (
    typeof ticketId !== "number" ||
    !Number.isInteger(ticketId) ||
    ticketId < 1 ||
    typeof walletAddress !== "string" ||
    !ethers.utils.isAddress(walletAddress) ||
    typeof txHash !== "string" ||
    !/^0x[0-9a-fA-F]{64}$/.test(txHash)
  ) {
    return NextResponse.json(
      { error: "ticketId (positive integer), walletAddress and txHash (0x…64 hex) are required" },
      { status: 400 }
    );
  }
  const owner = ethers.utils.getAddress(walletAddress);

  let ticket;
  try {
    ticket = await withRetry(() => readTicket(ticketId));
  } catch (err) {
    console.error("Помилка читання ticketInfo():", err);
    return NextResponse.json({ error: "Failed to verify ticket on-chain" }, { status: 502 });
  }
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found on-chain" }, { status: 404 });
  }
  if (ethers.utils.getAddress(ticket.owner) !== owner) {
    return NextResponse.json({ error: "Ticket belongs to a different address" }, { status: 409 });
  }

  const event = await prisma.event.findUnique({ where: { id: ticket.eventId } });
  if (!event) {
    return NextResponse.json({ error: "Unknown event" }, { status: 404 });
  }

  let receipt: Receipt | null;
  try {
    receipt = await withRetry(() => rpcRequest<Receipt | null>("eth_getTransactionReceipt", [txHash], { nullIsMiss: true }));
  } catch (err) {
    console.error("Помилка читання receipt:", err);
    return NextResponse.json({ error: "Failed to verify transaction on-chain" }, { status: 502 });
  }
  const purchased =
    receipt &&
    receipt.status === "0x1" &&
    receipt.logs.some((log) => {
      if (log.address.toLowerCase() !== TICKET_REGISTRY_ADDRESS.toLowerCase()) return false;
      try {
        const parsed = iface.parseLog(log);
        return (
          parsed.name === "TicketPurchased" &&
          (parsed.args.ticketId as ethers.BigNumber).toNumber() === ticketId &&
          ethers.utils.getAddress(parsed.args.buyer) === owner
        );
      } catch {
        return false;
      }
    });
  if (!purchased) {
    return NextResponse.json(
      { error: "Transaction is not the purchase of this ticket" },
      { status: 409 }
    );
  }

  const saved = await prisma.ticket.upsert({
    where: { id: ticketId },
    update: {},
    create: { id: ticketId, eventId: ticket.eventId, ownerAddress: owner, txHash },
  });
  return NextResponse.json({ ticket: saved }, { status: 200 });
}

// GET /api/tickets?address=0x… — cached tickets of an address, with their
// events (without the secret join link). Addresses are public on-chain; no
// personal data is involved.
export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");
  if (!address || !ethers.utils.isAddress(address)) {
    return NextResponse.json({ error: "A valid address query parameter is required" }, { status: 400 });
  }
  const tickets = await prisma.ticket.findMany({
    where: { ownerAddress: ethers.utils.getAddress(address) },
    include: { event: { omit: { meetingUrl: true } } },
    orderBy: { event: { startsAt: "asc" } },
  });
  return NextResponse.json({ tickets });
}
