"use client";

import { useEffect, useState } from "react";

// Current unix time in seconds, refreshed every 30 s so "sale closed" flips
// without a reload. Kept in state so components stay pure during render.
export function useNowSec(): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 30000);
    return () => clearInterval(id);
  }, []);
  return now;
}
