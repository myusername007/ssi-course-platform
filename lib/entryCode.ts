// Entry code: proof that the person showing a ticket controls the wallet that
// owns it. The holder signs a short message naming the ticket, event and
// current time; the checker recovers the signer from the signature and
// compares it with the owner stored in the contract. A copied ticket image
// proves nothing, because the code needs the owner's wallet and expires in
// minutes. The signature is a personal_sign message (no transaction, no gas).
import { ethers } from "ethers";

const PREFIX = "SSITKT1.";
export const MAX_AGE_SEC = 120;
const MAX_FUTURE_SKEW_SEC = 30;

export interface EntryPayload {
  ticketId: number;
  eventId: number;
  /** unix seconds when the code was signed */
  signedAt: number;
}

export function entryMessage({ ticketId, eventId, signedAt }: EntryPayload): string {
  return `SSI Tickets: вхід на подію\nКвиток: ${ticketId}\nПодія: ${eventId}\nЧас: ${signedAt}`;
}

function toBase64Url(text: string): string {
  return btoa(unescape(encodeURIComponent(text))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): string {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4);
  return decodeURIComponent(escape(atob(padded)));
}

export function encodeEntryCode(payload: EntryPayload, signature: string): string {
  return PREFIX + toBase64Url(JSON.stringify({ t: payload.ticketId, e: payload.eventId, s: payload.signedAt, g: signature }));
}

export function decodeEntryCode(code: string): { payload: EntryPayload; signature: string } | null {
  try {
    const trimmed = code.trim();
    if (!trimmed.startsWith(PREFIX)) return null;
    const raw = JSON.parse(fromBase64Url(trimmed.slice(PREFIX.length)));
    if (
      !Number.isInteger(raw.t) ||
      raw.t < 1 ||
      !Number.isInteger(raw.e) ||
      raw.e < 0 ||
      !Number.isInteger(raw.s) ||
      typeof raw.g !== "string" ||
      !/^0x[0-9a-fA-F]{130}$/.test(raw.g)
    ) {
      return null;
    }
    return { payload: { ticketId: raw.t, eventId: raw.e, signedAt: raw.s }, signature: raw.g };
  } catch {
    return null;
  }
}

export type EntryCodeProblem = "malformed" | "expired" | "from-the-future" | "bad-signature";

export type EntryCodeCheck =
  | { ok: true; ticketId: number; eventId: number; signer: string; ageSec: number }
  | { ok: false; problem: EntryCodeProblem };

/**
 * Checks format, freshness and signature, and returns who signed. It does NOT
 * look at the chain: the caller must compare `signer` with the ticket's owner.
 */
export function checkEntryCode(code: string, nowSec: number): EntryCodeCheck {
  const decoded = decodeEntryCode(code);
  if (!decoded) return { ok: false, problem: "malformed" };
  const { payload, signature } = decoded;

  const ageSec = nowSec - payload.signedAt;
  if (ageSec > MAX_AGE_SEC) return { ok: false, problem: "expired" };
  if (ageSec < -MAX_FUTURE_SKEW_SEC) return { ok: false, problem: "from-the-future" };

  try {
    const signer = ethers.utils.verifyMessage(entryMessage(payload), signature);
    return { ok: true, ticketId: payload.ticketId, eventId: payload.eventId, signer, ageSec };
  } catch {
    return { ok: false, problem: "bad-signature" };
  }
}
