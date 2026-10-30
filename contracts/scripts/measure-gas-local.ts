import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

// Gas of every state-changing function of TicketRegistry on the local Hardhat
// network (deterministic; gas rules before EIP-8037). The same call sequence
// is run on Sepolia by measure-gas-sepolia.ts. Results go to
// results/gas-local.json.
async function main() {
  const [, a, b] = await ethers.getSigners();
  const Mock = await ethers.getContractFactory("MockIdentityRegistry");
  const mock = await Mock.deploy();
  const Tickets = await ethers.getContractFactory("TicketRegistry");
  const tickets = await Tickets.deploy(await mock.getAddress());
  const depRc = await tickets.deploymentTransaction()!.wait();
  for (const s of [a, b]) await mock.setVerified(s.address, 1_700_000_000);

  const now = await time.latest();
  const startsAt = now + 3600, endsAt = now + 7200;
  const price = ethers.parseEther("0.0005");
  const gas: Record<string, number> = { deploy: Number(depRc!.gasUsed) };
  const run = async (label: string, tx: Promise<{ wait(): Promise<{ gasUsed: bigint } | null> }>) => { gas[label] = Number((await (await tx).wait())!.gasUsed); };

  await run("createEvent (first)", tickets.createEvent(1, price, 100, startsAt, endsAt));
  await run("createEvent (next)", tickets.createEvent(2, price, 100, startsAt, endsAt));
  await run("buyTicket (first ever)", tickets.connect(a).buyTicket(1, { value: price }));
  await run("buyTicket (next, same event)", tickets.connect(b).buyTicket(1, { value: price }));
  await run("buyTicket (other event)", tickets.connect(a).buyTicket(2, { value: price }));
  await time.increaseTo(startsAt - 600);
  await run("checkIn", tickets.connect(a).checkIn(1));
  await tickets.connect(b).checkIn(2);
  await time.increaseTo(endsAt + 1);
  await run("rateEvent (first rating of event)", tickets.connect(a).rateEvent(1, 5));
  await run("rateEvent (second rating of event)", tickets.connect(b).rateEvent(1, 4));
  await run("withdraw", tickets.withdraw());
  const to = await tickets.getAddress();
  gas["isVerified (view, gas estimate)"] = Number(await ethers.provider.estimateGas({ to, data: tickets.interface.encodeFunctionData("isVerified", [a.address]) }));
  const code = (await ethers.provider.getCode(to)).length / 2 - 1;
  const out = { network: "hardhat (pre-EIP-8037 rules)", runtimeBytes: code, gas };
  writeFileSync(join(__dirname, "..", "results", "gas-local.json"), JSON.stringify(out, null, 2) + "\n");
  for (const [k, v] of Object.entries(gas)) console.log(`${k.padEnd(40)} ${v}`);
  console.log("runtime bytes", code);
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
