// Access to an online event. The join link is secret, so the server hands it
// out only to a ticket holder who has joined the event. Two independent things
// are checked: that the requester controls the wallet that owns the ticket
// (a signed message, no gas), and that the chain says the ticket is used
// (the holder called checkIn) inside the event's time window.
import { ethers } from "ethers";

export const ACCESS_MAX_AGE_SEC = 120;
const MAX_FUTURE_SKEW_SEC = 30;
/** Same as TicketRegistry.CHECK_IN_OPENS_BEFORE. */
export const CHECK_IN_OPENS_BEFORE_SEC = 15 * 60;

export interface AccessRequest {
  eventId: number;
  /** unix seconds when the message was signed */
  signedAt: number;
}

export function accessMessage({ eventId, signedAt }: AccessRequest): string {
  return `SSI Tickets: доступ до події\nПодія: ${eventId}\nЧас: ${signedAt}`;
}

export type ProofProblem = "expired" | "from-the-future" | "bad-signature";

export type ProofCheck = { ok: true; signer: string } | { ok: false; problem: ProofProblem };

/**
 * Checks freshness and recovers who signed the access message. It does NOT
 * look at the chain: the caller must compare `signer` with the ticket owner.
 */
export function verifyAccessProof(request: AccessRequest, signature: string, nowSec: number): ProofCheck {
  const ageSec = nowSec - request.signedAt;
  if (ageSec > ACCESS_MAX_AGE_SEC) return { ok: false, problem: "expired" };
  if (ageSec < -MAX_FUTURE_SKEW_SEC) return { ok: false, problem: "from-the-future" };
  try {
    return { ok: true, signer: ethers.utils.verifyMessage(accessMessage(request), signature) };
  } catch {
    return { ok: false, problem: "bad-signature" };
  }
}

export type AccessDecision = "granted" | "no-ticket" | "too-early" | "ended" | "not-checked-in";

/** What the chain says about the requester and the event, all in unix seconds. */
export interface AccessFacts {
  /** the signer's ticket id for this event, 0 if none */
  ticketId: number;
  used: boolean;
  startsAt: number;
  endsAt: number;
  nowSec: number;
}

export function decideAccess(f: AccessFacts): AccessDecision {
  if (f.ticketId === 0) return "no-ticket";
  if (f.nowSec >= f.endsAt) return "ended";
  if (f.nowSec + CHECK_IN_OPENS_BEFORE_SEC < f.startsAt) return "too-early";
  if (!f.used) return "not-checked-in";
  return "granted";
}
