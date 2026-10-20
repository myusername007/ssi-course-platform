"use client";

import { useState } from "react";
import { useWallet } from "../contexts/WalletContext";
import { useEventsChain } from "../hooks/useEventsChain";
import { EventView } from "../lib/events";
import EventCard from "./EventCard";
import WalletBar from "./WalletBar";

const FORMATS = ["Усі формати", "Онлайн", "Офлайн"];

export default function Catalog({ events }: { events: EventView[] }) {
  const { address } = useWallet();
  const { data, failed, loading } = useEventsChain(
    events.map((e) => e.id),
    address
  );
  const [category, setCategory] = useState("Усі");
  const [format, setFormat] = useState(FORMATS[0]);

  const categories = ["Усі", ...Array.from(new Set(events.map((e) => e.category)))];
  const visible = events.filter(
    (e) => (category === "Усі" || e.category === category) && (format === FORMATS[0] || e.format === format)
  );

  const chip = (active: boolean) =>
    `rounded-full px-4 py-2 text-sm font-medium transition-colors ${
      active ? "bg-foreground text-background" : "bg-surface text-muted ring-1 ring-border hover:text-foreground"
    }`;

  return (
    <main className="page-enter mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <WalletBar title="Заходи" />

      <div className="mb-6 flex flex-wrap gap-2">
        {categories.map((c) => (
          <button key={c} onClick={() => setCategory(c)} className={chip(category === c)}>
            {c}
          </button>
        ))}
        <span className="mx-2 hidden w-px bg-border sm:block" />
        {FORMATS.map((f) => (
          <button key={f} onClick={() => setFormat(f)} className={chip(format === f)}>
            {f}
          </button>
        ))}
      </div>

      {failed && (
        <p className="mb-4 text-sm text-muted">
          Дані про наявність квитків тимчасово недоступні, показано ціни з каталогу.
        </p>
      )}

      {visible.length === 0 ? (
        <p className="text-muted">За цими фільтрами заходів немає.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((event) => (
            <EventCard key={event.id} event={event} chain={data[event.id]} loading={loading} />
          ))}
        </div>
      )}
    </main>
  );
}
