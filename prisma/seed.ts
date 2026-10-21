// Seeds the demo events from data/events.json — the same file the on-chain
// seeding script (contracts/scripts/seed-events.ts) reads, so prices,
// capacities and times in the database always match the contract. The events
// are fictional demo content. Safe to re-run (upsert by id).
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ethers } from "ethers";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

interface EventSeed {
  id: number;
  title: string;
  description: string;
  longDescription: string;
  category: string;
  format: string;
  location: string | null;
  meetingUrl: string;
  startsAt: string;
  endsAt: string;
  priceEth: string;
  capacity: number;
}

async function main() {
  const events: EventSeed[] = JSON.parse(
    readFileSync(join(__dirname, "..", "data", "events.json"), "utf-8")
  );

  for (const e of events) {
    const data = {
      title: e.title,
      description: e.description,
      longDescription: e.longDescription,
      category: e.category,
      format: e.format,
      location: e.location,
      meetingUrl: e.meetingUrl,
      startsAt: new Date(e.startsAt),
      endsAt: new Date(e.endsAt),
      priceWei: ethers.utils.parseEther(e.priceEth).toString(),
      capacity: e.capacity,
    };
    await prisma.event.upsert({ where: { id: e.id }, update: data, create: { id: e.id, ...data } });
  }

  const all = await prisma.event.findMany({ orderBy: { id: "asc" } });
  console.log(`Seeded ${all.length} event(s):`);
  for (const e of all) {
    console.log(`  #${e.id} [${e.category}, ${e.format}] ${e.title} — ${ethers.utils.formatEther(e.priceWei)} ETH, ${e.capacity} місць`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
