// Self-contained test of lib/entryCode.ts (no network). Run: npx tsx scripts/test-entry-code.ts
import { ethers } from "ethers";
import { checkEntryCode, encodeEntryCode, entryMessage, MAX_AGE_SEC } from "../lib/entryCode";

let failed = 0;
const expect = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "OK  " : "FAIL"} ${name} ${detail}`);
  if (!ok) failed++;
};

(async () => {
  const holder = ethers.Wallet.createRandom();
  const now = 1_800_000_000;
  const payload = { ticketId: 3, eventId: 1, signedAt: now };
  const sig = await holder.signMessage(entryMessage(payload));
  const code = encodeEntryCode(payload, sig);

  const good = checkEntryCode(code, now + 10);
  expect("valid code: signer is the holder", good.ok && good.signer === holder.address && good.ticketId === 3 && good.eventId === 1);
  expect("accepted at the edge of validity", checkEntryCode(code, now + MAX_AGE_SEC).ok);
  const late = checkEntryCode(code, now + MAX_AGE_SEC + 1);
  expect("expired after the window", !late.ok && late.problem === "expired");
  const early = checkEntryCode(code, now - 31);
  expect("rejected if signed in the future", !early.ok && early.problem === "from-the-future");

  // tampering: change the ticket number inside an otherwise valid code
  const forgedPayload = { ticketId: 4, eventId: 1, signedAt: now };
  const forged = checkEntryCode(encodeEntryCode(forgedPayload, sig), now + 10);
  expect("changed ticket id: signer is NOT the holder", forged.ok && forged.signer !== holder.address);
  const forgedEvent = checkEntryCode(encodeEntryCode({ ...payload, eventId: 2 }, sig), now + 10);
  expect("changed event id: signer is NOT the holder", forgedEvent.ok && forgedEvent.signer !== holder.address);
  const forgedTime = checkEntryCode(encodeEntryCode({ ...payload, signedAt: now + 5 }, sig), now + 10);
  expect("changed timestamp: signer is NOT the holder", forgedTime.ok && forgedTime.signer !== holder.address);

  // someone else signing for the holder's ticket
  const attacker = ethers.Wallet.createRandom();
  const attackerSig = await attacker.signMessage(entryMessage(payload));
  const byAttacker = checkEntryCode(encodeEntryCode(payload, attackerSig), now + 10);
  expect("another wallet signs: signer is the attacker, not the owner", byAttacker.ok && byAttacker.signer === attacker.address && byAttacker.signer !== holder.address);

  for (const [name, bad] of [
    ["empty string", ""],
    ["wrong prefix", "XXX." + code.slice(8)],
    ["not base64", "SSITKT1.%%%"],
    ["truncated", code.slice(0, 40)],
    ["json without fields", "SSITKT1." + Buffer.from("{}").toString("base64url")],
    ["bad signature text", encodeEntryCode(payload, "0x1234")],
    ["ticket id as text", "SSITKT1." + Buffer.from(JSON.stringify({ t: "3", e: 1, s: now, g: sig })).toString("base64url")],
  ] as const) {
    const r = checkEntryCode(bad, now + 10);
    expect(`malformed rejected: ${name}`, !r.ok);
  }
  expect("code has surrounding whitespace trimmed", checkEntryCode("  " + code + "\n", now + 10).ok);
  expect("code length is reasonable", code.length < 400, `(${code.length} chars)`);

  console.log(failed ? `\n${failed} FAILED` : "\nALL ENTRY CODE CHECKS PASSED");
  process.exitCode = failed ? 1 : 0;
})();
