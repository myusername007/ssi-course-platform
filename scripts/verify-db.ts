// One-off verification script for Stage 3 (PLAN.md item 3) — confirms the
// Prisma 7 driver-adapter setup actually works end to end against the local
// `prisma dev` database: create a Course, create an Enrollment for it,
// exercise the unique(courseId, walletAddress) constraint, read it back,
// then clean up. Not part of the app — run manually with:
//   npx tsx scripts/verify-db.ts
import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const course = await prisma.course.create({
    data: {
      title: "Вступ до Self-Sovereign Identity",
      description: "Огляд DID, VC та практичних застосувань SSI.",
      schedule: "Щочетверга, 18:00",
    },
  });
  console.log("Created course:", course);

  const enrollment = await prisma.enrollment.create({
    data: {
      courseId: course.id,
      walletAddress: "0x709eAAb95D3AE0cC37964cc76809b23f23f992Db",
      txHash: "0xdeadbeef00000000000000000000000000000000000000000000000000000000",
    },
  });
  console.log("Created enrollment:", enrollment);

  // exercise the unique(courseId, walletAddress) constraint
  try {
    await prisma.enrollment.create({
      data: {
        courseId: course.id,
        walletAddress: enrollment.walletAddress,
        txHash: "0xanothertxhash",
      },
    });
    console.error("FAIL: duplicate enrollment was not rejected by the unique constraint");
    process.exitCode = 1;
  } catch (err) {
    console.log("OK: duplicate (courseId, walletAddress) correctly rejected");
  }

  const withEnrollments = await prisma.course.findUnique({
    where: { id: course.id },
    include: { enrollments: true },
  });
  console.log("Course with enrollments:", JSON.stringify(withEnrollments, null, 2));

  // clean up so re-running this script stays idempotent
  await prisma.enrollment.deleteMany({ where: { courseId: course.id } });
  await prisma.course.delete({ where: { id: course.id } });
  console.log("Cleaned up test data.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
