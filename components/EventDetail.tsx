"use client";

import Link from "next/link";
import { useWallet } from "../contexts/WalletContext";
import { useEventsChain } from "../hooks/useEventsChain";
import { useNowSec } from "../hooks/useNowSec";
import { useTicketPurchase } from "../hooks/useTicketPurchase";
import { EventView, averageRating, formatEth, formatEventDate } from "../lib/events";
import WalletBar from "./WalletBar";

const badge = "rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-muted";

export default function EventDetail({ event }: { event: EventView }) {
  const { address, verified } = useWallet();
  const { data, loading, failed, patch } = useEventsChain([event.id], address);
  const { state, error, buy } = useTicketPurchase(event.id);
  const chain = data[event.id];

  const nowSec = useNowSec();
  const saleClosed = chain ? nowSec >= chain.startsAt : false;
  const soldOut = chain ? chain.sold >= chain.capacity : false;
  const hasTicket = chain ? chain.ticketId > 0 : false;
  const rating = chain ? averageRating(chain.ratingSum, chain.ratingCount) : null;
  const busy = state === "signing" || state === "confirming" || state === "saving";

  let blocker: string | null = null;
  if (!chain) blocker = loading ? "Завантаження даних контракту..." : "Дані контракту тимчасово недоступні.";
  else if (!address) blocker = "Підключіть гаманець, щоб купити квиток.";
  else if (verified !== true) blocker = "Для купівлі потрібна підтверджена SSI-ідентичність.";
  else if (hasTicket) blocker = null;
  else if (saleClosed) blocker = "Продаж квитків завершено.";
  else if (soldOut) blocker = "Квитки розпродано.";

  const onBuy = async () => {
    if (!chain) return;
    const ticketId = await buy(chain.price);
    if (ticketId) patch(event.id, { ticketId, sold: chain.sold + 1 });
  };

  let label = chain ? `Купити за ${formatEth(chain.price)}` : "Купити квиток";
  if (state === "signing") label = "Підтвердіть у гаманці...";
  else if (state === "confirming") label = "Очікуємо підтвердження в мережі...";
  else if (state === "saving") label = "Зберігаємо квиток...";

  return (
    <main className="page-enter mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <WalletBar />
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm font-medium text-accent hover:opacity-80">
          ← Усі заходи
        </Link>

        <div className="mt-6 rounded-3xl bg-surface p-8 shadow-sm ring-1 ring-border">
          <div className="flex flex-wrap gap-2">
            <span className={badge}>{event.category}</span>
            <span className={badge}>{event.format}</span>
          </div>

          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">{event.title}</h1>
          <p className="mt-3 text-base leading-7 text-muted">{event.longDescription}</p>

          <dl className="mt-6 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="font-medium text-foreground">Початок</dt>
            <dd className="text-muted">{formatEventDate(event.startsAt)}</dd>
            <dt className="font-medium text-foreground">Завершення</dt>
            <dd className="text-muted">{formatEventDate(event.endsAt)}</dd>
            <dt className="font-medium text-foreground">Місце</dt>
            <dd className="text-muted">{event.location ?? "Онлайн-трансляція"}</dd>
            <dt className="font-medium text-foreground">Ціна</dt>
            <dd className="text-muted">{formatEth(chain ? chain.price : event.priceWei)}</dd>
            {chain && (
              <>
                <dt className="font-medium text-foreground">Квитки</dt>
                <dd className="text-muted">
                  {saleClosed
                    ? "Продаж завершено"
                    : soldOut
                    ? "Розпродано"
                    : `Залишилось ${chain.capacity - chain.sold} з ${chain.capacity}`}
                </dd>
                {rating && (
                  <>
                    <dt className="font-medium text-foreground">Оцінка відвідувачів</dt>
                    <dd className="text-muted">
                      {rating} з 5 ({chain.ratingCount})
                    </dd>
                  </>
                )}
              </>
            )}
          </dl>

          <div className="mt-8">
            {hasTicket ? (
              <p className="rounded-2xl bg-success-bg px-5 py-4 text-sm font-medium text-success">
                У вас є квиток на цю подію (№{chain?.ticketId}).
              </p>
            ) : (
              <button
                onClick={onBuy}
                disabled={blocker !== null || busy}
                className="w-full rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30 sm:w-auto"
              >
                {label}
              </button>
            )}
            {blocker && !hasTicket && <p className="mt-3 text-sm text-muted">{blocker}</p>}
            {failed && !chain && !loading && (
              <p className="mt-3 text-sm text-muted">Спробуйте оновити сторінку через кілька секунд.</p>
            )}
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            <p className="mt-4 text-xs text-muted">Оплата в тестових монетах мережі Sepolia.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
