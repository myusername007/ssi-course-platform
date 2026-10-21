"use client";

import Link from "next/link";
import { useWallet } from "../contexts/WalletContext";
import { useEventsChain } from "../hooks/useEventsChain";
import { useTicketInfos } from "../hooks/useTicketInfos";
import { EventView } from "../lib/events";
import { CardSkeleton } from "./Skeleton";
import TicketItem from "./TicketItem";
import WalletBar from "./WalletBar";

// Tickets are read from the contract (not from the database cache), so a
// ticket whose purchase was never saved to the cache still shows up.
export default function MyTickets({ events }: { events: EventView[] }) {
  const { address } = useWallet();
  const { data, loading, failed, patch } = useEventsChain(
    events.map((e) => e.id),
    address
  );

  const mine = events
    .filter((e) => (data[e.id]?.ticketId ?? 0) > 0)
    .map((event) => ({ event, ticketId: data[event.id].ticketId }));
  const { data: infos } = useTicketInfos(mine.map((m) => m.ticketId));

  return (
    <main className="page-enter mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <WalletBar title="Мої квитки" />

      {!address ? (
        <p className="text-muted">Підключіть гаманець, щоб побачити свої квитки.</p>
      ) : loading ? (
        <div className="grid gap-5 md:grid-cols-2">
          <CardSkeleton />
        </div>
      ) : failed && mine.length === 0 ? (
        <p className="text-muted">Дані контракту тимчасово недоступні. Спробуйте оновити сторінку через кілька секунд.</p>
      ) : mine.length === 0 ? (
        <p className="text-muted">
          У вас ще немає квитків.{" "}
          <Link href="/" className="font-medium text-accent hover:opacity-80">
            Переглянути заходи
          </Link>
        </p>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {mine.map(({ event, ticketId }) => (
            <TicketItem
              key={ticketId}
              event={event}
              ticketId={ticketId}
              owner={address}
              info={infos[ticketId]}
              chain={data[event.id]}
              onRated={(score) => {
                const c = data[event.id];
                if (!c) return;
                patch(event.id, { myRating: score, ratingSum: c.ratingSum + score, ratingCount: c.ratingCount + 1 });
              }}
            />
          ))}
        </div>
      )}
    </main>
  );
}
