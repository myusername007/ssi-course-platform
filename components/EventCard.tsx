"use client";

import Link from "next/link";
import { useNowSec } from "../hooks/useNowSec";
import { EventView, averageRating, formatEth, formatEventDate } from "../lib/events";
import { EventChain } from "../lib/readChain";

interface Props {
  event: EventView;
  chain?: EventChain;
}

const badge = "rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-muted";

export default function EventCard({ event, chain }: Props) {
  const nowSec = useNowSec();
  const rating = chain ? averageRating(chain.ratingSum, chain.ratingCount) : null;

  let availability: string | null = null;
  if (chain) {
    if (nowSec >= chain.startsAt) availability = "Продаж завершено";
    else if (chain.sold >= chain.capacity) availability = "Розпродано";
    else availability = `Залишилось ${chain.capacity - chain.sold} з ${chain.capacity}`;
  }

  return (
    <Link
      href={`/events/${event.id}`}
      className="flex flex-col gap-4 rounded-3xl bg-surface p-6 shadow-sm ring-1 ring-border transition-shadow hover:shadow-md"
    >
      <div className="flex flex-wrap gap-2">
        <span className={badge}>{event.category}</span>
        <span className={badge}>{event.format}</span>
        {chain && chain.ticketId > 0 && (
          <span className="rounded-full bg-success-bg px-3 py-1 text-xs font-medium text-success">
            Квиток придбано
          </span>
        )}
      </div>

      <div className="flex-grow">
        <h2 className="text-lg font-semibold text-foreground">{event.title}</h2>
        <p className="mt-2 text-sm text-muted">{event.description}</p>
      </div>

      <div className="space-y-1 text-xs text-muted">
        <p>{formatEventDate(event.startsAt)}</p>
        <p>{event.location ?? "Онлайн-трансляція"}</p>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-foreground">
            {formatEth(chain ? chain.price : event.priceWei)}
          </p>
          {availability && <p className="text-xs text-muted">{availability}</p>}
        </div>
        {rating && <p className="text-xs text-muted">Оцінка {rating} ({chain?.ratingCount})</p>}
      </div>
    </Link>
  );
}
