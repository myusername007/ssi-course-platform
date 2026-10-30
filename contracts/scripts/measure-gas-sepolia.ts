import { ethers } from "hardhat";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import deployments from "../deployments.json";
import { loadTestIdentity } from "./test-identity";

// Same call sequence as measure-gas-local.ts, on a FRESH TicketRegistry
// instance on Sepolia (real identity registry, two throwaway identities with
// consistent records), so first-use costs are comparable. Also records, for
// every transaction, how long it took from sending to its receipt and the
// effective gas price. Results go to results/gas-sepolia.json.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const [organizer] = await ethers.getSigners();
  const a = loadTestIdentity(1);
  const b = loadTestIdentity(2);
  const gas: Record<string, number> = {};
  const txs: { op: string; gas: number; gasPriceWei: string; confirmMs: number; block: number }[] = [];

  type Receipt = { gasUsed: bigint; gasPrice: bigint; blockNumber: number };
  const track = async (op: string, send: () => Promise<{ wait(): Promise<Receipt | null> }>) => {
    const t0 = Date.now();
    const tx = await send();
    const rc = (await tx.wait())!;
    const ms = Date.now() - t0;
    gas[op] = Number(rc.gasUsed);
    txs.push({ op, gas: Number(rc.gasUsed), gasPriceWei: String(rc.gasPrice), confirmMs: ms, block: rc.blockNumber });
    console.log(`${op.padEnd(36)} gas ${rc.gasUsed}  ${ms} ms  block ${rc.blockNumber}`);
    return rc;
  };

  const Factory = await ethers.getContractFactory("TicketRegistry", organizer);
  const t0 = Date.now();
  const tickets = await Factory.deploy(deployments.sepolia.identityRegistry);
  const depRc = await tickets.deploymentTransaction()!.wait();
  gas.deploy = Number(depRc!.gasUsed);
  txs.push({ op: "deploy", gas: gas.deploy, gasPriceWei: String(depRc!.gasPrice), confirmMs: Date.now() - t0, block: depRc!.blockNumber });
  console.log(`deploy gas ${gas.deploy} at ${await tickets.getAddress()}`);

  const price = ethers.parseEther("0.0001");
  const now = (await ethers.provider.getBlock("latest"))!.timestamp;
  const startsAt = now + 420, endsAt = startsAt + 150;
  const asA = tickets.connect(a) as typeof tickets, asB = tickets.connect(b) as typeof tickets;

  await track("createEvent (first)", () => tickets.createEvent(1, price, 100, startsAt, endsAt));
  await track("createEvent (next)", () => tickets.createEvent(2, price, 100, startsAt, endsAt));
  await track("buyTicket (first ever)", () => asA.buyTicket(1, { value: price }));
  await track("buyTicket (next, same event)", () => asB.buyTicket(1, { value: price }));
  await track("buyTicket (other event)", () => asA.buyTicket(2, { value: price }));
  await track("checkIn", () => asA.checkIn(1));
  await track("checkIn (second holder)", () => asB.checkIn(2));

  console.log("waiting for the events to end...");
  while ((await ethers.provider.getBlock("latest"))!.timestamp <= endsAt) await sleep(6000);

  await track("rateEvent (first rating of event)", () => asA.rateEvent(1, 5));
  await track("rateEvent (second rating of event)", () => asB.rateEvent(1, 4));
  await track("withdraw", () => tickets.withdraw());
  // a few cheap repeat transactions just to enlarge the confirmation-time sample
  for (let i = 1; i <= 6; i++) await track(`withdraw (sample ${i})`, () => tickets.withdraw());

  const code = (await ethers.provider.getCode(await tickets.getAddress())).length / 2 - 1;
  writeFileSync(join(__dirname, "..", "results", "gas-sepolia.json"), JSON.stringify({ network: "sepolia (Glamsterdam rules, EIP-8037)", contract: await tickets.getAddress(), runtimeBytes: code, gas, txs }, null, 2) + "\n");
  console.log("saved results/gas-sepolia.json");
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
