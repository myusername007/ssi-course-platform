// Self-contained test of lib/access.ts (no network). Run: npx tsx scripts/test-access.ts
import { ethers } from "ethers";
import {
  accessMessage,
  ACCESS_MAX_AGE_SEC,
  CHECK_IN_OPENS_BEFORE_SEC,
  decideAccess,
  verifyAccessProof,
} from "../lib/access";

let failed = 0;
const expect = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "OK  " : "FAIL"} ${name} ${detail}`);
  if (!ok) failed++;
};

(async () => {
  const holder = ethers.Wallet.createRandom();
  const now = 1_800_000_000;
  const req = { eventId: 7, signedAt: now };
  const sig = await holder.signMessage(accessMessage(req));

  // --- signature proof
  const good = verifyAccessProof(req, sig, now + 5);
  expect("valid proof: signer is the holder", good.ok && good.signer === holder.address);
  expect("accepted at the edge of validity", verifyAccessProof(req, sig, now + ACCESS_MAX_AGE_SEC).ok);
  const late = verifyAccessProof(req, sig, now + ACCESS_MAX_AGE_SEC + 1);
  expect("expired after the window", !late.ok && late.problem === "expired");
  const early = verifyAccessProof(req, sig, now - 31);
  expect("rejected if signed in the future", !early.ok && early.problem === "from-the-future");

  const otherEvent = verifyAccessProof({ ...req, eventId: 8 }, sig, now + 5);
  expect("signature for event 7 does not prove event 8", otherEvent.ok && otherEvent.signer !== holder.address);
  const otherTime = verifyAccessProof({ ...req, signedAt: now + 3 }, sig, now + 5);
  expect("changed timestamp: signer is NOT the holder", otherTime.ok && otherTime.signer !== holder.address);

  const attacker = ethers.Wallet.createRandom();
  const asAttacker = verifyAccessProof(req, await attacker.signMessage(accessMessage(req)), now + 5);
  expect("another wallet signs: signer is the attacker", asAttacker.ok && asAttacker.signer === attacker.address);

  expect("garbage signature rejected", (() => { const r = verifyAccessProof(req, "0x1234", now + 5); return !r.ok && r.problem === "bad-signature"; })());
  expect("empty signature rejected", !verifyAccessProof(req, "", now + 5).ok);

  // --- access decision (ticketId 0 = no ticket)
  const startsAt = now + 3600;
  const endsAt = startsAt + 5400;
  const facts = (over: Partial<Parameters<typeof decideAccess>[0]>) =>
    decideAccess({ ticketId: 5, used: true, startsAt, endsAt, nowSec: startsAt + 60, ...over });

  expect("joined holder during the event: granted", facts({}) === "granted");
  expect("no ticket: refused", facts({ ticketId: 0 }) === "no-ticket");
  expect("no ticket wins over time", facts({ ticketId: 0, nowSec: endsAt + 1 }) === "no-ticket");
  expect("holder who has not checked in: refused", facts({ used: false }) === "not-checked-in");
  expect("well before the window: too early", facts({ used: false, nowSec: startsAt - CHECK_IN_OPENS_BEFORE_SEC - 1 }) === "too-early");
  expect("exactly when check-in opens: window open", facts({ used: false, nowSec: startsAt - CHECK_IN_OPENS_BEFORE_SEC }) === "not-checked-in");
  expect("checked in 15 min early: granted", facts({ nowSec: startsAt - CHECK_IN_OPENS_BEFORE_SEC }) === "granted");
  expect("one second before the event ends: granted", facts({ nowSec: endsAt - 1 }) === "granted");
  expect("exactly at the end: ended", facts({ nowSec: endsAt }) === "ended");
  expect("long after the end: ended", facts({ nowSec: endsAt + 86400 }) === "ended");
  expect("used flag alone is not enough before the window", facts({ nowSec: startsAt - 3600 }) === "too-early");

  console.log(failed ? `\n${failed} FAILED` : "\nALL ACCESS CHECKS PASSED");
  process.exitCode = failed ? 1 : 0;
})();
