import { ethers } from "hardhat";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import deployments from "../deployments.json";

// Creates a short-lived demo event on Sepolia so the whole join flow
// (buy -> join -> link -> rating) can be tried within an hour, and records it
// in ../data/demo-events.json (git-ignored; it holds the join link) for
// scripts/add-demo-events.ts to put into the database.
//
//   DEMO_ID=100 START_IN_MIN=25 DURATION_MIN=20 npx hardhat run scripts/create-demo-event.ts --network sepolia
const id = Number(process.env.DEMO_ID ?? 100);
const startInMin = Number(process.env.START_IN_MIN ?? 25);
const durationMin = Number(process.env.DURATION_MIN ?? 20);
const PRICE = ethers.parseEther("0.0001");
const CAPACITY = 5;
const FILE = join(__dirname, "..", "..", "data", "demo-events.json");

async function main() {
  const [organizer] = await ethers.getSigners();
  const tickets = await ethers.getContractAt("TicketRegistry", deployments.sepolia.ticketRegistry, organizer);
  if (id < 100) throw new Error("Demo ids start at 100 so they never collide with data/events.json");
  if ((await tickets.eventInfo(id)).exists) throw new Error(`Event ${id} already exists on-chain`);

  const now = (await ethers.provider.getBlock("latest"))!.timestamp;
  const startsAt = now + startInMin * 60;
  const endsAt = startsAt + durationMin * 60;
  const receipt = await (await tickets.createEvent(id, PRICE, CAPACITY, startsAt, endsAt)).wait();

  const event = {
    id,
    title: `Демо-подія №${id}: перевірка приєднання`,
    description: "Коротка тестова подія для перевірки всього шляху: купівля, приєднання, посилання, оцінка.",
    longDescription:
      "Тестова подія, що починається за кілька хвилин після створення й триває недовго. Дозволяє пройти весь шлях квитка: купити, приєднатися до події, отримати посилання на трансляцію і після завершення поставити оцінку.",
    category: "Вебінар",
    format: "Онлайн",
    location: null,
    meetingUrl: `https://meet.jit.si/SSITickets-demo-${id}-${randomBytes(4).toString("hex")}`,
    startsAt: new Date(startsAt * 1000).toISOString(),
    endsAt: new Date(endsAt * 1000).toISOString(),
    priceEth: "0.0001",
    capacity: CAPACITY,
  };
  const all = existsSync(FILE) ? (JSON.parse(readFileSync(FILE, "utf-8")) as { id: number }[]).filter((e) => e.id !== id) : [];
  writeFileSync(FILE, JSON.stringify([...all, event], null, 2) + "\n");

  console.log(`Created demo event #${id} (gas ${receipt!.gasUsed})`);
  console.log(`  starts ${event.startsAt}, ends ${event.endsAt}`);
  console.log(`  sale closes and rating opens by those times; check-in is open from 15 min before the start`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
