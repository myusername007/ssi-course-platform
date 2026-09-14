import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

// GET /api/courses — public course catalog, per PLAN.md item 4. The
// /courses page itself queries Prisma directly (idiomatic for a Next.js App
// Router Server Component, avoids an unnecessary internal HTTP round trip);
// this route exists for any client-side or external consumer that needs the
// same data as JSON (e.g. a future client-side refresh without a full page
// reload).
export async function GET() {
  const courses = await prisma.course.findMany({ orderBy: { id: "asc" } });
  return NextResponse.json({ courses });
}
