// Server-side reads from Sepolia. ethers' JsonRpcProvider consistently failed
// with "could not detect network" inside Next.js's server runtime (see
// app/api/enroll/route.ts), so calls are encoded/decoded with ethers' pure
// ABI Interface and sent with plain fetch.
import { ethers } from "ethers";

export class RpcError extends Error {
  constructor(message: string, public data?: string) {
    super(message);
  }
}

// The configured node (SEPOLIA_RPC_URL) first, then a fallback. Public nodes
// prune history: publicnode silently answers `null` for a transaction receipt
// that is only a day old, while Tenderly's gateway still serves it.
const FALLBACK_RPC_URL = "https://sepolia.gateway.tenderly.co";

/**
 * Sends a JSON-RPC request, trying the next node when one is unreachable,
 * rate-limited, or (with `nullIsMiss`) does not know the requested object.
 * A real contract revert is final and is not retried elsewhere.
 */
export async function rpcRequest<T>(
  method: string,
  params: unknown[],
  opts: { nullIsMiss?: boolean } = {}
): Promise<T> {
  const urls = [process.env.SEPOLIA_RPC_URL, FALLBACK_RPC_URL].filter((u): u is string => !!u);
  let lastError: unknown = new RpcError("No RPC node available");
  let sawNull = false;

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        cache: "no-store",
      });
      const json = await res.json();
      if (json.error) {
        const err = new RpcError(json.error.message || "RPC error", json.error.data);
        if (typeof err.data === "string" && err.data.startsWith("0x")) throw err; // genuine revert
        lastError = err;
        continue;
      }
      if (opts.nullIsMiss && json.result === null) {
        sawNull = true;
        continue;
      }
      return json.result as T;
    } catch (e) {
      if (e instanceof RpcError && e.data) throw e;
      lastError = e;
    }
  }
  if (sawNull) return null as T;
  throw lastError;
}

export async function contractCall(
  iface: ethers.utils.Interface,
  to: string,
  fn: string,
  args: unknown[]
): Promise<ethers.utils.Result> {
  const result = await rpcRequest<string>("eth_call", [
    { to, data: iface.encodeFunctionData(fn, args) },
    "latest",
  ]);
  return iface.decodeFunctionResult(fn, result);
}

/** Name of the contract's custom error behind a reverted call, if it can be decoded. */
export function revertName(iface: ethers.utils.Interface, e: unknown): string | null {
  if (e instanceof RpcError && typeof e.data === "string" && e.data.startsWith("0x")) {
    try {
      return iface.parseError(e.data).name;
    } catch {
      return null;
    }
  }
  return null;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
