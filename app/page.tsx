import { prisma } from "../lib/prisma";
import { toEventView } from "../lib/events";
import Catalog from "../components/Catalog";

export const dynamic = "force-dynamic";

export default async function Home() {
  const events = await prisma.event.findMany({ orderBy: { startsAt: "asc" }, omit: { meetingUrl: true } });
  return <Catalog events={events.map(toEventView)} />;
}
