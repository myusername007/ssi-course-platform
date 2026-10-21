import { notFound } from "next/navigation";
import { prisma } from "../../../lib/prisma";
import { toEventView } from "../../../lib/events";
import EventDetail from "../../../components/EventDetail";

export const dynamic = "force-dynamic";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const eventId = Number(id);
  if (!Number.isInteger(eventId)) notFound();

  const event = await prisma.event.findUnique({ where: { id: eventId }, omit: { meetingUrl: true } });
  if (!event) notFound();

  return <EventDetail event={toEventView(event)} />;
}
