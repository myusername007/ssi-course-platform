import { prisma } from "../../lib/prisma";
import { toEventView } from "../../lib/events";
import MyTickets from "../../components/MyTickets";

export const dynamic = "force-dynamic";

export default async function TicketsPage() {
  const events = await prisma.event.findMany({ orderBy: { startsAt: "asc" } });
  return <MyTickets events={events.map(toEventView)} />;
}
