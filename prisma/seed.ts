// Temporary demo course data — placeholders to exercise the catalog UI and
// registration flow while real course content is not yet decided. Replace
// or extend via `npx prisma db seed` once real courses are ready; upsert
// makes this safe to re-run.
import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DEMO_COURSES = [
  {
    title: "Вступ до Self-Sovereign Identity",
    description:
      "Огляд концепції SSI, стандартів W3C DID та Verifiable Credentials, порівняння з традиційними моделями автентифікації.",
    schedule: "Щочетверга, 18:00",
  },
  {
    title: "Смарт-контракти на Solidity: від основ до практики",
    description:
      "Практичний курс з розробки та тестування смарт-контрактів на Ethereum за допомогою Hardhat.",
    schedule: "Щовівторка та щоп'ятниці, 19:00",
  },
  {
    title: "Децентралізовані ідентифікатори в освіті",
    description:
      "Як заклади освіти можуть використовувати DID/VC для верифікації студентів без централізованих баз даних.",
    schedule: "Разовий вебінар, дата уточнюється",
  },
];

async function main() {
  for (const course of DEMO_COURSES) {
    const existing = await prisma.course.findFirst({ where: { title: course.title } });
    if (existing) {
      await prisma.course.update({ where: { id: existing.id }, data: course });
    } else {
      await prisma.course.create({ data: course });
    }
  }

  const all = await prisma.course.findMany({ orderBy: { id: "asc" } });
  console.log(`Seeded ${all.length} course(s):`);
  for (const c of all) console.log(`  #${c.id} ${c.title}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
