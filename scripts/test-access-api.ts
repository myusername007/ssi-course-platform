// Integration test of the join-link endpoint and of the "no link leaks" rule.
// Needs a running server (npm run dev) with the seeded database, and reads the
// real TicketRegistry on Sepolia. Run: npx tsx scripts/test-access-api.ts [baseUrl]
import { ethers } from "ethers";
import { accessMessage } from "../lib/access";

const base = process.argv[2] ?? "http://localhost:3000";
let failed = 0;
const expect = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "OK  " : "FAIL"} ${name} ${detail}`);
  if (!ok) failed++;
};

async function access(eventId: number, body: unknown) {
  const res = await fetch(`${base}/api/events/${eventId}/access`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null), cache: res.headers.get("cache-control") };
}

(async () => {
  const wallet = ethers.Wallet.createRandom();
  const now = Math.floor(Date.now() / 1000);
  const sign = (eventId: number, signedAt: number) => wallet.signMessage(accessMessage({ eventId, signedAt }));

  // --- the secret link must not appear in any public response
  const events = await (await fetch(`${base}/api/events`)).text();
  expect("/api/events has no meetingUrl and no link", !/meetingUrl|meet\.jit\.si/.test(events));
  for (const path of ["/", "/events/1", "/events/12"]) {
    const html = await (await fetch(base + path)).text();
    expect(`page ${path} has no link`, !/meetingUrl|meet\.jit\.si/.test(html));
  }
  const tickets = await fetch(`${base}/api/tickets?address=${ethers.constants.AddressZero}`);
  expect("/api/tickets answers without a link", tickets.status === 200 && !/meetingUrl|meet\.jit\.si/.test(await tickets.text()));

  // --- the access endpoint refuses everyone who is not a joined holder
  const good = await access(1, { signedAt: now, signature: await sign(1, now) });
  expect("wallet without a ticket: 403 no-ticket", good.status === 403 && good.json?.error === "no-ticket", JSON.stringify(good.json));
  expect("response is not cacheable", good.cache === "no-store");

  const stale = await access(1, { signedAt: now - 300, signature: await sign(1, now - 300) });
  expect("old signature: 401 expired", stale.status === 401 && stale.json?.error === "expired");
  const future = await access(1, { signedAt: now + 600, signature: await sign(1, now + 600) });
  expect("future timestamp: 401", future.status === 401 && future.json?.error === "from-the-future");
  const wrongEvent = await access(2, { signedAt: now, signature: await sign(1, now) });
  expect("signature for another event does not help: 403", wrongEvent.status === 403);
  const garbage = await access(1, { signedAt: now, signature: "0x1234" });
  expect("garbage signature: 401", garbage.status === 401 && garbage.json?.error === "bad-signature");
  expect("missing fields: 400", (await access(1, { signedAt: now })).status === 400);
  expect("non-numeric signedAt: 400", (await access(1, { signedAt: "now", signature: "0x" })).status === 400);
  expect("not JSON: 400", (await access(1, "nope")).status === 400);
  expect("bad event id: 400", (await access(NaN, { signedAt: now, signature: "0x" })).status === 400);
  const missing = await access(999, { signedAt: now, signature: await sign(999, now) });
  expect("unknown event: 404", missing.status === 404 && missing.json?.error === "event-not-found", JSON.stringify(missing.json));
  expect("no link in any refusal", ![good, stale, future, wrongEvent, garbage, missing].some((r) => /meet\.jit\.si/.test(JSON.stringify(r.json))));

  console.log(failed ? `\n${failed} FAILED` : "\nALL ACCESS API CHECKS PASSED");
  process.exitCode = failed ? 1 : 0;
})();
