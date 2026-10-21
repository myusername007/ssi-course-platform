import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { prisma } from "../../../../../lib/prisma";
import { TICKET_REGISTRY_ABI, TICKET_REGISTRY_ADDRESS } from "../../../../../lib/contracts";
import { contractCall } from "../../../../../lib/chain";
import { decideAccess, verifyAccessProof, type AccessDecision } from "../../../../../lib/access";

export const dynamic = "force-dynamic";

const iface = new ethers.utils.Interface(TICKET_REGISTRY_ABI);

const NO_STORE = { "Cache-Control": "no-store" };
const fail = (status: number, error: string) => NextResponse.json({ error }, { status, headers: NO_STORE });

// POST /api/events/[id]/access — body { signedAt, signature }. The only place
// that returns an event's secret join link. It never trusts the client: the
// signature proves who is asking, and the contract (not the database) says
// whether that wallet holds a ticket, has joined, and the event is running.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const eventId = Number((await params).id);
  if (!Number.isInteger(eventId) || eventId < 0) return fail(400, "bad-request");

  let body: { signedAt?: unknown; signature?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail(400, "bad-request");
  }
  const { signedAt, signature } = body;
  if (typeof signedAt !== "number" || !Number.isInteger(signedAt) || typeof signature !== "string") {
    return fail(400, "bad-request");
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const proof = verifyAccessProof({ eventId, signedAt }, signature, nowSec);
  if (!proof.ok) return fail(401, proof.problem);

  let decision: AccessDecision;
  try {
    const ticketId = (await contractCall(iface, TICKET_REGISTRY_ADDRESS, "ticketOf", [proof.signer, eventId]))[0] as ethers.BigNumber;
    const [info, ev] = await Promise.all([
      ticketId.isZero() ? null : contractCall(iface, TICKET_REGISTRY_ADDRESS, "ticketInfo", [ticketId]),
      contractCall(iface, TICKET_REGISTRY_ADDRESS, "eventInfo", [eventId]),
    ]);
    if (!ev.exists) return fail(404, "event-not-found");
    decision = decideAccess({
      ticketId: ticketId.toNumber(),
      used: info ? (info.used as boolean) : false,
      startsAt: (ev.startsAt as ethers.BigNumber).toNumber(),
      endsAt: (ev.endsAt as ethers.BigNumber).toNumber(),
      nowSec,
    });
  } catch (err) {
    console.error("Помилка перевірки квитка в контракті:", err);
    return fail(502, "chain-unavailable");
  }
  if (decision !== "granted") return fail(403, decision);

  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { meetingUrl: true } });
  if (!event?.meetingUrl) return fail(404, "no-link");
  return NextResponse.json({ meetingUrl: event.meetingUrl }, { headers: NO_STORE });
}
