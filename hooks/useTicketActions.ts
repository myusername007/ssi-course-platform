"use client";

import { useState } from "react";
import { ethers } from "ethers";
import { TICKET_REGISTRY_ABI, TICKET_REGISTRY_ADDRESS } from "../lib/contracts";
import { accessMessage } from "../lib/access";
import { describeError } from "../lib/errors";

export type JoinStep = "idle" | "check-in" | "confirming" | "signing" | "verifying";

const ACCESS_ERRORS: Record<string, string> = {
  "no-ticket": "За цим акаунтом немає квитка на цю подію.",
  "too-early": "Приєднатися можна не раніше ніж за 15 хвилин до початку.",
  ended: "Подія вже завершилась.",
  "not-checked-in": "Відмітку про приєднання ще не видно в мережі. Спробуйте за кілька секунд.",
  expired: "Підпис застарів. Спробуйте ще раз.",
  "from-the-future": "Годинник вашого пристрою відстає або поспішає. Перевірте дату й час.",
  "chain-unavailable": "Не вдалося перевірити квиток у мережі. Спробуйте ще раз.",
  "no-link": "Для цієї події ще не додано посилання.",
};

class AccessError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Only ever open https links: the link comes from our own server, but this is
// the last line before the browser navigates.
const isSafeLink = (url: unknown): url is string => typeof url === "string" && /^https:\/\//i.test(url);

async function requestLink(
  signer: ethers.providers.JsonRpcSigner,
  eventId: number,
  justCheckedIn: boolean,
  onSigned: () => void
) {
  const signedAt = Math.floor(Date.now() / 1000);
  const signature = await signer.signMessage(accessMessage({ eventId, signedAt }));
  onSigned();
  // A node behind the server can lag a block behind the one the check-in was
  // just confirmed on, so right after checking in retry a few times.
  const attempts = justCheckedIn ? 4 : 1;
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(`/api/events/${eventId}/access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signedAt, signature }),
    });
    const json = await res.json().catch(() => null);
    if (res.ok && isSafeLink(json?.meetingUrl)) return json.meetingUrl as string;
    const code = json?.error as string | undefined;
    if (code === "not-checked-in" && i < attempts - 1) {
      await sleep(2500);
      continue;
    }
    throw new AccessError(ACCESS_ERRORS[code ?? ""] ?? "Не вдалося отримати посилання.");
  }
  throw new AccessError(ACCESS_ERRORS["not-checked-in"]);
}

export function useTicketActions(owner: string) {
  const [step, setStep] = useState<JoinStep>("idle");
  const [rating, setRating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);

  /**
   * Joins an event: checks the ticket in on-chain when that has not been done
   * yet, then signs a request and fetches the join link from the server.
   * `onCheckedIn` is called as soon as the check-in is confirmed.
   */
  const join = async (ticketId: number, eventId: number, alreadyCheckedIn: boolean, onCheckedIn: () => void) => {
    if (!window.ethereum) return;
    setError(null);
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      if ((await signer.getAddress()).toLowerCase() !== owner.toLowerCase()) {
        setError("Активний акаунт у гаманці не є власником цього квитка.");
        return;
      }
      if (!alreadyCheckedIn) {
        setStep("check-in");
        const contract = new ethers.Contract(TICKET_REGISTRY_ADDRESS, TICKET_REGISTRY_ABI, signer);
        const tx = await contract.checkIn(ticketId);
        setStep("confirming");
        await tx.wait();
        onCheckedIn();
      }
      setStep("signing");
      const url = await requestLink(signer, eventId, !alreadyCheckedIn, () => setStep("verifying"));
      setLink(url);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("Помилка приєднання до події:", err);
      setError(err instanceof AccessError ? err.message : describeError(err, "Не вдалося приєднатися до події."));
    } finally {
      setStep("idle");
    }
  };

  /** Rates the event 1..5; resolves true when the rating is on-chain. */
  const rate = async (eventId: number, score: number): Promise<boolean> => {
    if (!window.ethereum) return false;
    setError(null);
    setRating(true);
    try {
      const signer = new ethers.providers.Web3Provider(window.ethereum).getSigner();
      const contract = new ethers.Contract(TICKET_REGISTRY_ADDRESS, TICKET_REGISTRY_ABI, signer);
      const tx = await contract.rateEvent(eventId, score);
      await tx.wait();
      return true;
    } catch (err) {
      console.error("Помилка оцінювання події:", err);
      setError(describeError(err, "Не вдалося зберегти оцінку."));
      return false;
    } finally {
      setRating(false);
    }
  };

  return { step, rating, error, link, join, rate };
}
