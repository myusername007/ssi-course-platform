// Checks that every event row in the database (DATABASE_URL) matches what the
// TicketRegistry contract holds on-chain: price, capacity, start and end.
// Read-only. Run: npx tsx scripts/verify-events.ts
import "dotenv/config";
import { ethers } from "ethers";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const TICKET_REGISTRY = "0x14F749672AB73F16EAaEffAAc91c864B3Acc4852";
const RPC = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const iface = new ethers.utils.Interface([
  "function eventInfo(uint256 eventId) view returns (uint256 price, uint32 capacity, uint32 sold, uint64 startsAt, uint64 endsAt, bool exists)",
]);

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function readEvent(id: number) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to: TICKET_REGISTRY, data: iface.encodeFunctionData("eventInfo", [id]) }, "latest"],
    }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return iface.decodeFunctionResult("eventInfo", json.result);
}

async function main() {
  const rows = await prisma.event.findMany({ orderBy: { id: "asc" } });
  console.log(`${rows.length} event(s) in the database; checking each against the contract`);
  let bad = 0;
  for (const row of rows) {
    const c = await readEvent(row.id);
    const problems: string[] = [];
    if (!c.exists) problems.push("not on-chain");
    else {
      if (c.price.toString() !== row.priceWei) problems.push(`price db=${row.priceWei} chain=${c.price}`);
      if (c.capacity !== row.capacity) problems.push(`capacity db=${row.capacity} chain=${c.capacity}`);
      if (c.startsAt.toNumber() !== Math.floor(row.startsAt.getTime() / 1000)) problems.push("startsAt differs");
      if (c.endsAt.toNumber() !== Math.floor(row.endsAt.getTime() / 1000)) problems.push("endsAt differs");
    }
    if (problems.length) bad++;
    console.log(`  ${problems.length ? "FAIL" : "OK  "} #${row.id} ${problems.join("; ")}`);
  }
  console.log(bad ? `\n${bad} MISMATCH(ES)` : "\nDATABASE MATCHES CHAIN");
  if (bad) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
