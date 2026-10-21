// Puts the demo events recorded by contracts/scripts/create-demo-event.ts into
// the database the DATABASE_URL points at. Safe to re-run (upsert by id).
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ethers } from "ethers";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

interface DemoEvent {
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
  const events: DemoEvent[] = JSON.parse(readFileSync(join(__dirname, "..", "data", "demo-events.json"), "utf-8"));
  for (const e of events) {
    const { id, priceEth, ...rest } = e;
    const data = { ...rest, startsAt: new Date(e.startsAt), endsAt: new Date(e.endsAt), priceWei: ethers.utils.parseEther(priceEth).toString() };
    await prisma.event.upsert({ where: { id }, update: data, create: { id, ...data } });
    console.log(`  #${id} ${e.title} (${e.startsAt} → ${e.endsAt})`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
