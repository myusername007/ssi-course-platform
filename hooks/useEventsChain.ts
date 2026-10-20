"use client";

import { useCallback, useEffect, useState } from "react";
import { EventChain, readEventsChain } from "../lib/readChain";

// Availability, price, rating and "do I hold a ticket" for a list of events,
// read from the contract. The database only describes events; the contract
// is the source of truth for everything that matters when buying.
export function useEventsChain(ids: number[], address: string | null) {
  const [data, setData] = useState<Record<number, EventChain>>({});
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  const key = `${ids.join(",")}|${address ?? ""}|${version}`;

  useEffect(() => {
    let ignore = false;

    async function load() {
      if (!ignore) setLoading(true);
      let next: Record<number, EventChain> = {};
      let anyFailed = false;
      try {
        next = await readEventsChain(ids, address);
        anyFailed = ids.some((id) => !next[id]);
      } catch (err) {
        console.warn("Не вдалося прочитати дані контракту:", err);
        anyFailed = true;
      }
      if (ignore) return;
      setData(next);
      setFailed(anyFailed);
      setLoading(false);
    }

    load();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  // Apply a known change immediately (e.g. right after a purchase), because a
  // public node may still serve the previous block for a few seconds.
  const patch = useCallback((id: number, changes: Partial<EventChain>) => {
    setData((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], ...changes } } : prev));
  }, []);

  return { data, loading, failed, reload, patch };
}
