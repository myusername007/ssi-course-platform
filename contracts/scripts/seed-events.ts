import { ethers } from "hardhat";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import deployments from "../deployments.json";

// Creates on-chain every event listed in ../data/events.json (the same file
// the database is seeded from), skipping ones that already exist, then reads
// each one back and checks it matches the file exactly.
interface EventSeed {
  id: number;
  title: string;
  priceEth: string;
  capacity: number;
  startsAt: string;
  endsAt: string;
}

const unix = (iso: string) => Math.floor(Date.parse(iso) / 1000);

async function main() {
  const events: EventSeed[] = JSON.parse(
    readFileSync(join(__dirname, "..", "..", "data", "events.json"), "utf-8")
  );
  const [organizer] = await ethers.getSigners();
  const tickets = await ethers.getContractAt("TicketRegistry", deployments.sepolia.ticketRegistry, organizer);

  if ((await tickets.owner()) !== organizer.address) {
    throw new Error(`Signer ${organizer.address} is not the contract owner`);
  }
  console.log(`Organizer ${organizer.address}, balance ${ethers.formatEther(await ethers.provider.getBalance(organizer.address))} ETH`);

  let totalGas = 0n;
  let created = 0;
  for (const e of events) {
    const existing = await tickets.eventInfo(e.id);
    if (existing.exists) {
      console.log(`  #${e.id} already on-chain, skipping creation`);
      continue;
    }
    const receipt = await (await tickets.createEvent(e.id, ethers.parseEther(e.priceEth), e.capacity, unix(e.startsAt), unix(e.endsAt))).wait();
    totalGas += receipt!.gasUsed;
    created++;
    console.log(`  #${e.id} created (gas ${receipt!.gasUsed}) ${e.title}`);
  }
  console.log(`\nCreated ${created} event(s), total gas ${totalGas}`);

  console.log("\nVerifying chain state against data/events.json...");
  let bad = 0;
  for (const e of events) {
    // public nodes can lag a block behind a just-confirmed transaction
    let info = await tickets.eventInfo(e.id);
    for (let i = 0; i < 10 && !info.exists; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      info = await tickets.eventInfo(e.id);
    }
    const ok =
      info.exists &&
      info.price === ethers.parseEther(e.priceEth) &&
      Number(info.capacity) === e.capacity &&
      Number(info.startsAt) === unix(e.startsAt) &&
      Number(info.endsAt) === unix(e.endsAt);
    if (!ok) bad++;
    console.log(`  ${ok ? "OK  " : "FAIL"} #${e.id} price=${ethers.formatEther(info.price)} capacity=${info.capacity} sold=${info.sold}`);
  }
  console.log(bad ? `\n${bad} MISMATCH(ES)` : "\nALL EVENTS MATCH");
  if (bad) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
