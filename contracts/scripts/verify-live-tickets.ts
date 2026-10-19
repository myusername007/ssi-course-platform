import { ethers } from "hardhat";
import deployments from "../deployments.json";

// End-to-end live check of TicketRegistry on Sepolia, using the deployer
// wallet (organizer, and verified in the real identity registry). Uses
// freshly generated event ids so it can be re-run. Costs a small amount of
// Sepolia ETH; the paid ticket price is returned to the organizer by
// withdraw() at the end.
const TICKET_REGISTRY = deployments.sepolia.ticketRegistry;
const PRICE = ethers.parseEther("0.0001");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function chainNow(): Promise<number> {
  const block = await ethers.provider.getBlock("latest");
  return block!.timestamp;
}

// Public RPC nodes behind a load balancer can lag a block behind a just-confirmed tx.
async function eventually<T>(read: () => Promise<T>, ok: (v: T) => boolean): Promise<T> {
  let v = await read();
  for (let i = 0; i < 10 && !ok(v); i++) {
    await sleep(3000);
    v = await read();
  }
  return v;
}

async function expectRevert(label: string, fn: () => Promise<unknown>, expected: string) {
  try {
    await fn();
    console.log(`  FAIL  ${label}: did not revert`);
    process.exitCode = 1;
  } catch (e: any) {
    const name = e?.revert?.name ?? e?.shortMessage ?? String(e);
    const ok = name === expected;
    console.log(`  ${ok ? "OK  " : "FAIL"}  ${label}: reverted with ${name}`);
    if (!ok) process.exitCode = 1;
  }
}

async function main() {
  const [organizer] = await ethers.getSigners();
  const tickets = await ethers.getContractAt("TicketRegistry", TICKET_REGISTRY, organizer);
  const stranger = ethers.Wallet.createRandom().address; // no identity, no funds
  // Read-only instance on a plain provider: decodes custom errors and
  // allows a `from` override for eth_call.
  const ro = new ethers.Contract(
    TICKET_REGISTRY,
    tickets.interface,
    new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL)
  );

  console.log(`Organizer: ${organizer.address}`);
  console.log(`Contract owner: ${await tickets.owner()}`);
  console.log(`Organizer verified in real identity registry: ${await tickets.isVerified(organizer.address)}`);
  console.log(`Stranger verified: ${await tickets.isVerified(stranger)}`);

  const base = Math.floor(Date.now() / 1000);
  const PAID = BigInt(base);
  const FREE = BigInt(base + 1);
  const now = await chainNow();
  const startsAt = now + 110;
  const endsAt = now + 150;
  const gas: Record<string, bigint> = {};

  console.log(`\n[1] createEvent (paid ${PAID}, free ${FREE})`);
  let r = await (await tickets.createEvent(PAID, PRICE, 2, startsAt, endsAt)).wait();
  gas.createEvent = r!.gasUsed;
  r = await (await tickets.createEvent(FREE, 0, 1, startsAt, endsAt)).wait();
  console.log(`  gas createEvent: ${gas.createEvent}`);

  console.log(`\n[2] buyTicket (paid)`);
  const buyTx = await tickets.buyTicket(PAID, { value: PRICE });
  r = await buyTx.wait();
  gas.buyTicket = r!.gasUsed;
  const ticketId = await tickets.ticketOf(organizer.address, PAID);
  const info = await tickets.ticketInfo(ticketId);
  const ev = await tickets.eventInfo(PAID);
  console.log(`  ticketId=${ticketId} owner=${info.ticketOwner} used=${info.used} sold=${ev.sold}/${ev.capacity}`);
  console.log(`  gas buyTicket: ${gas.buyTicket}`);

  console.log(`\n[3] rejections (eth_call, no gas spent)`);
  await expectRevert("second ticket, same identity", () => ro.buyTicket.staticCall(PAID, { from: organizer.address, value: PRICE }), "AlreadyHasTicket");
  await expectRevert("wrong payment", () => ro.buyTicket.staticCall(PAID, { from: organizer.address, value: 1n }), "WrongPayment");
  await expectRevert("wallet without identity", () => ro.buyTicket.staticCall(FREE, { from: stranger, value: 0 }), "NotVerified");
  await expectRevert("markUsed by non-organizer", () => ro.markUsed.staticCall(ticketId, { from: stranger }), "NotOwner");
  await expectRevert("rate before the event ends", () => ro.rateEvent.staticCall(PAID, 5, { from: organizer.address }), "EventNotFinished");

  console.log(`\n[4] markUsed`);
  r = await (await tickets.markUsed(ticketId)).wait();
  gas.markUsed = r!.gasUsed;
  const usedNow = await eventually(() => ro.ticketInfo(ticketId), (v) => v.used);
  console.log(`  used=${usedNow.used}, gas markUsed: ${gas.markUsed}`);
  await expectRevert("markUsed twice", () => ro.markUsed.staticCall(ticketId, { from: organizer.address }), "AlreadyUsed");

  console.log(`\n[5] waiting for the event to end (chain time ${endsAt})...`);
  while ((await chainNow()) < endsAt) await sleep(6000);

  console.log(`\n[6] rateEvent`);
  r = await (await tickets.rateEvent(PAID, 5)).wait();
  gas.rateEvent = r!.gasUsed;
  const rating = await eventually(() => ro.getRating(PAID), (v) => v.count > 0n);
  console.log(`  rating sum=${rating.sum} count=${rating.count}, gas rateEvent: ${gas.rateEvent}`);
  await expectRevert("rate twice", () => ro.rateEvent.staticCall(PAID, 4, { from: organizer.address }), "AlreadyRated");

  console.log(`\n[7] withdraw`);
  const before = await ethers.provider.getBalance(TICKET_REGISTRY);
  r = await (await tickets.withdraw()).wait();
  gas.withdraw = r!.gasUsed;
  const after = await eventually(() => ethers.provider.getBalance(TICKET_REGISTRY), (v) => v === 0n);
  console.log(`  contract balance ${ethers.formatEther(before)} -> ${ethers.formatEther(after)} ETH, gas withdraw: ${gas.withdraw}`);

  console.log(`\nGas summary (Sepolia):`);
  for (const [k, v] of Object.entries(gas)) console.log(`  ${k.padEnd(12)} ${v}`);
  console.log(process.exitCode ? "\nSOME CHECKS FAILED" : "\nALL LIVE CHECKS PASSED");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
