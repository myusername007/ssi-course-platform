"use client";

import { useEffect, useState } from "react";
import { TicketChain, readTicketInfos } from "../lib/readChain";

// Owner / used status of tickets, read from the contract.
export function useTicketInfos(ticketIds: number[]) {
  const [data, setData] = useState<Record<number, TicketChain>>({});
  const [loading, setLoading] = useState(false);
  const key = ticketIds.join(",");

  useEffect(() => {
    let ignore = false;

    async function load() {
      if (!ignore) setLoading(true);
      let next: Record<number, TicketChain> = {};
      try {
        next = await readTicketInfos(ticketIds);
      } catch (err) {
        console.warn("Не вдалося прочитати стан квитків:", err);
      }
      if (ignore) return;
      setData(next);
      setLoading(false);
    }

    load();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { data, loading };
}
