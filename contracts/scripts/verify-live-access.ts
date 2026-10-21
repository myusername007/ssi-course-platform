import { ethers } from "hardhat";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import deployments from "../deployments.json";

// End-to-end check of the join-link endpoint against a running server and the
// live contract, on a demo event created by create-demo-event.ts and present
// in the server's database. The organizer wallet (verified in the identity
// registry) buys a ticket, and the endpoint must refuse a link until the
// holder checks in, and hand it out right after.
//
//   DEMO_ID=100 BASE_URL=http://localhost:3000 npx hardhat run scripts/verify-live-access.ts --network sepolia
const id = Number(process.env.DEMO_ID ?? 100);
const base = process.env.BASE_URL ?? "http://localhost:3000";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let failed = false;

// public nodes behind a load balancer can lag a block behind a confirmed tx
async function retry<T>(read: () => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await read();
    } catch (e) {
      if (i >= 8) throw e;
      await sleep(3000);
    }
  }
}
const expect = (name: string, ok: boolean, detail = "") => {
  console.log(`  ${ok ? "OK  " : "FAIL"} ${name} ${detail}`);
  if (!ok) failed = true;
};

async function access(signer: { signMessage(m: string): Promise<string> }) {
  const signedAt = Math.floor(Date.now() / 1000);
  const signature = await signer.signMessage(`SSI Tickets: доступ до події\nПодія: ${id}\nЧас: ${signedAt}`);
  const res = await fetch(`${base}/api/events/${id}/access`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signedAt, signature }),
  });
  return { status: res.status, json: await res.json() };
}

async function main() {
  const demo = (JSON.parse(readFileSync(join(__dirname, "..", "..", "data", "demo-events.json"), "utf-8")) as { id: number; meetingUrl: string }[]).find(
    (e) => e.id === id
  );
  if (!demo) throw new Error(`Event ${id} is not in data/demo-events.json`);

  const [organizer] = await ethers.getSigners();
  const tickets = await ethers.getContractAt("TicketRegistry", deployments.sepolia.ticketRegistry, organizer);
  const info = await tickets.eventInfo(id);
  const price = info.price;

  let ticketId = await tickets.ticketOf(organizer.address, id);
  if (ticketId === 0n) {
    console.log(`[1] buyTicket for event ${id}`);
    await (await tickets.buyTicket(id, { value: price })).wait();
    // public nodes can lag a block behind a just-confirmed transaction
    for (let i = 0; i < 10 && ticketId === 0n; i++) {
      await sleep(3000);
      ticketId = await tickets.ticketOf(organizer.address, id);
    }
  }
  const isUsed = async () => (await retry(() => tickets.ticketInfo(ticketId))).used;
  console.log(`    ticket ${ticketId}, used=${await isUsed()}`);

  // the server's node may lag a block behind
  let r = await access(organizer);
  for (let i = 0; i < 6 && r.json?.error === "no-ticket"; i++) {
    await sleep(3000);
    r = await access(organizer);
  }

  if (!(await isUsed())) {
    console.log("[2] before check-in");
    expect("holder who has not checked in is refused", r.status === 403 && r.json.error === "not-checked-in", JSON.stringify(r.json));
    const stranger = ethers.Wallet.createRandom();
    const s = await access(stranger);
    expect("wallet without a ticket is refused", s.status === 403 && s.json.error === "no-ticket", JSON.stringify(s.json));

    console.log("[3] checkIn");
    await (await tickets.checkIn(ticketId)).wait();
    r = await access(organizer);
    for (let i = 0; i < 6 && r.json?.error === "not-checked-in"; i++) {
      await sleep(3000);
      r = await access(organizer);
    }
  }

  console.log("[4] after check-in");
  expect("joined holder receives the link", r.status === 200 && r.json.meetingUrl === demo.meetingUrl, r.status === 200 ? "(link matches the database)" : JSON.stringify(r.json));

  console.log(failed ? "\nSOME CHECKS FAILED" : "\nJOIN FLOW VERIFIED");
  process.exitCode = failed ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
