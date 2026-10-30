// Latency of the verification path, measured from this machine (a normal
// home connection; numbers depend on location and node load):
//  1. isVerified(address) as a plain eth_call on two public Sepolia nodes,
//     against a baseline eth_blockNumber call (the cost of the round trip
//     itself);
//  2. the catalog read of 12 events: one Multicall3 request vs 48 separate
//     requests sent in parallel;
//  3. the production server's access endpoint (signature check + chain reads)
//     on the "no ticket" path, which exercises the same verification work as
//     a real request without needing a ticket.
// Results go to contracts/results/latency.json. Run: npx tsx scripts/measure-latency.ts
import { ethers } from "ethers";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { TICKET_REGISTRY_ABI, TICKET_REGISTRY_ADDRESS } from "../lib/contracts";
import { accessMessage } from "../lib/access";

const NODES: Record<string, string> = {
  tenderly: "https://sepolia.gateway.tenderly.co",
  publicnode: "https://ethereum-sepolia-rpc.publicnode.com",
};
const PROD = "https://ssi-course-platform.vercel.app";
const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11";
const iface = new ethers.utils.Interface(TICKET_REGISTRY_ABI);
const mc = new ethers.utils.Interface(["function aggregate3((address target, bool allowFailure, bytes callData)[] calls) payable returns ((bool success, bytes returnData)[] returnData)"]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function stats(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)];
  return { n: s.length, min: s[0], median: q(0.5), mean: Math.round(xs.reduce((a, b) => a + b, 0) / xs.length), p95: q(0.95), max: s[s.length - 1] };
}

async function rpc(url: string, method: string, params: unknown[], retries = 4) {
  for (let attempt = 0; ; attempt++) {
    const t0 = performance.now();
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
    const json = await res.json();
    if (json.error) {
      // free public nodes rate-limit; a sample that needed a retry is measured again, not timed across the wait
      if (/rate limit/i.test(json.error.message) && attempt < retries) { await sleep(1500); continue; }
      throw new Error(json.error.message);
    }
    return { ms: performance.now() - t0, result: json.result as string };
  }
}

async function repeat(n: number, gap: number, fn: () => Promise<number>) {
  const out: number[] = [];
  for (let i = 0; i < n; i++) { try { out.push(await fn()); } catch (e) { console.warn("  failed sample:", (e as Error).message); } await sleep(gap); }
  return out;
}

(async () => {
  const buyer = "0x53EF108F97D987EA3c4b22b896C6CdbA88E1FC13"; // a test identity with a valid record
  const results: Record<string, unknown> = { measuredAt: new Date().toISOString(), node: process.version };

  for (const [name, url] of Object.entries(NODES)) {
    console.log(`[${name}] baseline eth_blockNumber`);
    results[`${name}: eth_blockNumber`] = stats(await repeat(40, 1000, async () => (await rpc(url, "eth_blockNumber", [])).ms));
    console.log(`[${name}] isVerified(address)`);
    const data = iface.encodeFunctionData("isVerified", [buyer]);
    const samples: number[] = [];
    let last = "";
    for (let i = 0; i < 40; i++) { const r = await rpc(url, "eth_call", [{ to: TICKET_REGISTRY_ADDRESS, data }, "latest"]); samples.push(r.ms); last = r.result; await sleep(1000); }
    results[`${name}: isVerified`] = stats(samples);
    results[`${name}: isVerified result`] = iface.decodeFunctionResult("isVerified", last)[0];
  }

  console.log("[tenderly] catalog read: Multicall3 vs 48 parallel calls");
  const ids = Array.from({ length: 12 }, (_, i) => i + 1);
  const calls = ids.flatMap((id) => [
    ["eventInfo", [id]], ["getRating", [id]], ["ticketOf", [buyer, id]], ["ratingOf", [id, buyer]],
  ] as [string, unknown[]][]);
  const callData = calls.map(([f, a]) => ({ target: TICKET_REGISTRY_ADDRESS, allowFailure: true, callData: iface.encodeFunctionData(f, a) }));
  const url = NODES.tenderly;
  results["catalog read, Multicall3 (1 request, 48 calls)"] = stats(await repeat(15, 1000, async () => (await rpc(url, "eth_call", [{ to: MULTICALL3, data: mc.encodeFunctionData("aggregate3", [callData]) }, "latest"])).ms));
  // 48 parallel requests: count how many the free node refuses outright (no retries here)
  const par: number[] = [];
  let refused = 0;
  for (let i = 0; i < 8; i++) {
    const t0 = performance.now();
    const rs = await Promise.allSettled(callData.map((c) => rpc(url, "eth_call", [{ to: TICKET_REGISTRY_ADDRESS, data: c.callData }, "latest"], 0)));
    par.push(performance.now() - t0);
    refused += rs.filter((r) => r.status === "rejected").length;
    await sleep(2500);
  }
  results["catalog read, 48 parallel requests"] = stats(par);
  results["catalog read, 48 parallel requests: refused (rate limit) of 384"] = refused;

  console.log("[production] POST /api/events/1/access (no-ticket path)");
  const first: number[] = [];
  const rest: number[] = [];
  for (let i = 0; i < 31; i++) {
    const w = ethers.Wallet.createRandom();
    const signedAt = Math.floor(Date.now() / 1000);
    const signature = await w.signMessage(accessMessage({ eventId: 1, signedAt }));
    const t0 = performance.now();
    const res = await fetch(`${PROD}/api/events/1/access`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signedAt, signature }) });
    const ms = performance.now() - t0;
    const body = await res.json();
    if (res.status !== 403 || body.error !== "no-ticket") console.warn("  unexpected:", res.status, body);
    (i === 0 ? first : rest).push(ms);
    await sleep(600);
  }
  results["server access endpoint, first request"] = first[0];
  results["server access endpoint, next 30"] = stats(rest);

  writeFileSync(join(__dirname, "..", "contracts", "results", "latency.json"), JSON.stringify(results, null, 2) + "\n");
  console.log(JSON.stringify(results, null, 2));
})();
