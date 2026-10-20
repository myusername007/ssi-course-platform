"use client";

import { useCallback, useEffect, useState } from "react";
import { EventChain, readEventsChain } from "../lib/readChain";

// Last result per (events, address), kept while the app stays open. Coming
// back to a page shows it at once while fresh data loads in the background
// (stale-while-revalidate), so moving between pages never starts from blank.
const cache = new Map<string, Record<number, EventChain>>();

// Availability, price, rating and "do I hold a ticket" for a list of events,
// read from the contract. The database only describes events; the contract
// is the source of truth for everything that matters when buying.
export function useEventsChain(ids: number[], address: string | null) {
  const cacheKey = `${ids.join(",")}|${address ?? ""}`;
  const [data, setData] = useState<Record<number, EventChain>>(() => cache.get(cacheKey) ?? {});
  const [loading, setLoading] = useState(() => !cache.has(cacheKey));
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  const key = `${cacheKey}|${version}`;

  useEffect(() => {
    let ignore = false;

    async function load() {
      const cached = cache.get(cacheKey);
      if (cached) {
        if (!ignore) setData(cached);
      } else if (!ignore) {
        setLoading(true);
      }

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
      // keep showing the previous data if the refresh failed entirely
      if (Object.keys(next).length > 0 || !cached) {
        cache.set(cacheKey, next);
        setData(next);
      }
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
  const patch = useCallback(
    (id: number, changes: Partial<EventChain>) => {
      setData((prev) => {
        if (!prev[id]) return prev;
        const next = { ...prev, [id]: { ...prev[id], ...changes } };
        cache.set(cacheKey, next);
        return next;
      });
    },
    [cacheKey]
  );

  return { data, loading, failed, reload, patch };
}
