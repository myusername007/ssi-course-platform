import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/events — the public event catalog (descriptive data only; price,
// capacity and times are authoritative on-chain, availability is read from
// the contract by the client). priceWei is a string: it does not fit in a
// JavaScript number. meetingUrl is the secret join link and is deliberately
// left out: it is only served by /api/events/[id]/access.
export async function GET() {
  const events = await prisma.event.findMany({ orderBy: { startsAt: "asc" }, omit: { meetingUrl: true } });
  return NextResponse.json({ events });
}
