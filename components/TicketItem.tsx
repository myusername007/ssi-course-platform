"use client";

import { useState } from "react";
import { useNowSec } from "../hooks/useNowSec";
import { JoinStep, useTicketActions } from "../hooks/useTicketActions";
import { CHECK_IN_OPENS_BEFORE_SEC } from "../lib/access";
import { EventView, formatEventDate } from "../lib/events";
import { EventChain, TicketChain } from "../lib/readChain";
import { renderTicketPng } from "../lib/ticketImage";

interface Props {
  event: EventView;
  ticketId: number;
  owner: string;
  info?: TicketChain;
  chain?: EventChain;
  onRated: (score: number) => void;
}

const button =
  "rounded-full px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40";

const STEP_LABEL: Record<JoinStep, string> = {
  idle: "",
  "check-in": "Підтвердьте відмітку в гаманці...",
  confirming: "Очікуємо підтвердження в мережі...",
  signing: "Підпишіть запит у гаманці...",
  verifying: "Перевіряємо квиток...",
};

export default function TicketItem({ event, ticketId, owner, info, chain, onRated }: Props) {
  const nowSec = useNowSec();
  const { step, rating, error: actionError, link, join, rate } = useTicketActions(owner);
  const [checkedIn, setCheckedIn] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // the contract is the source of truth for the times; the database copy is a fallback
  const startsAt = chain?.startsAt ?? Math.floor(Date.parse(event.startsAt) / 1000);
  const endsAt = chain?.endsAt ?? Math.floor(Date.parse(event.endsAt) / 1000);
  const joined = checkedIn || info?.used === true;
  const ended = nowSec >= endsAt;
  const joinOpen = nowSec + CHECK_IN_OPENS_BEFORE_SEC >= startsAt;
  const busy = step !== "idle";
  const myRating = chain?.myRating ?? 0;

  const download = async () => {
    setDownloadError(null);
    try {
      const blob = await renderTicketPng({
        ticketId,
        eventId: event.id,
        title: event.title,
        when: formatEventDate(event.startsAt),
        where: "Онлайн-подія",
        owner,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ticket-${ticketId}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Помилка створення зображення квитка:", err);
      setDownloadError("Не вдалося створити зображення квитка.");
    }
  };

  const onRate = async (score: number) => {
    if (await rate(event.id, score)) onRated(score);
  };

  let status: { text: string; className: string };
  if (ended) status = { text: joined ? "Подія завершилась" : "Не відвідано", className: "bg-surface-muted text-muted" };
  else if (joined) status = { text: "Ви приєдналися", className: "bg-surface-muted text-muted" };
  else status = { text: "Дійсний", className: "bg-success-bg text-success" };

  const error = actionError ?? downloadError;

  return (
    <div className="rounded-3xl bg-surface p-6 shadow-sm ring-1 ring-border">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted">Квиток №{ticketId}</p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">{event.title}</h2>
          <p className="mt-1 text-sm text-muted">{formatEventDate(event.startsAt)}</p>
        </div>
        {(info || chain) && (
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${status.className}`}>{status.text}</span>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button onClick={download} className={`${button} bg-surface-muted text-foreground`}>
          Завантажити квиток
        </button>
        {!ended && joinOpen && link && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className={`${button} bg-success text-white`}
          >
            Відкрити трансляцію ↗
          </a>
        )}
        {!ended && joinOpen && !link && (
          <button
            onClick={() => join(ticketId, event.id, joined, () => setCheckedIn(true))}
            disabled={busy}
            className={`${button} bg-foreground text-background`}
          >
            {busy ? STEP_LABEL[step] : joined ? "Приєднатися до трансляції" : "Приєднатися до події"}
          </button>
        )}
        {!ended && !joinOpen && (
          <p className="text-sm text-muted">Приєднатися можна за 15 хвилин до початку.</p>
        )}
      </div>

      {ended && joined && (
        <div className="mt-5 rounded-2xl bg-surface-muted p-4">
          {myRating > 0 ? (
            <p className="text-sm font-medium text-foreground">Ваша оцінка: {myRating} з 5</p>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground">Оцініть подію</p>
              <div className="mt-3 flex gap-2">
                {[1, 2, 3, 4, 5].map((score) => (
                  <button
                    key={score}
                    onClick={() => onRate(score)}
                    disabled={rating}
                    className={`${button} h-10 w-10 bg-surface p-0 text-foreground ring-1 ring-border`}
                  >
                    {score}
                  </button>
                ))}
              </div>
              {rating && <p className="mt-3 text-sm text-muted">Очікуємо підтвердження в мережі...</p>}
            </>
          )}
        </div>
      )}
      {ended && !joined && (info || chain) && (
        <p className="mt-4 text-sm text-muted">Оцінити подію можуть лише ті, хто приєднався до неї.</p>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
