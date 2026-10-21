// Read-only access to TicketRegistry from the browser. Uses public nodes
// directly (not the wallet), so the catalog works without MetaMask and shows
// the same availability to everyone. Public nodes prune history and
// rate-limit, so all reads for a page are combined into ONE eth_call through
// Multicall3 (one request instead of dozens), and a second node is tried if
// the first fails.
import { ethers } from "ethers";
import { TICKET_REGISTRY_ABI, TICKET_REGISTRY_ADDRESS } from "./contracts";

const RPC_URLS = ["https://sepolia.gateway.tenderly.co", "https://ethereum-sepolia-rpc.publicnode.com"];
const SEPOLIA_CHAIN_ID = 11155111;
const TIMEOUT_MS = 10000;
// Multicall3 is deployed at the same address on every major chain.
const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11";

const providers = RPC_URLS.map((url) => new ethers.providers.StaticJsonRpcProvider(url, SEPOLIA_CHAIN_ID));
const ticketIface = new ethers.utils.Interface(TICKET_REGISTRY_ABI);
const multicallIface = new ethers.utils.Interface([
  "function aggregate3((address target, bool allowFailure, bytes callData)[] calls) payable returns ((bool success, bytes returnData)[] returnData)",
]);

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("RPC timeout")), TIMEOUT_MS);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

async function rawCall(to: string, data: string): Promise<string> {
  let lastError: unknown;
  for (const provider of providers) {
    try {
      return await withTimeout(provider.call({ to, data }));
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

export interface EventChain {
  price: ethers.BigNumber;
  capacity: number;
  sold: number;
  startsAt: number; // unix seconds
  endsAt: number;
  exists: boolean;
  ratingSum: number;
  ratingCount: number;
  /** ticket id held by the connected address for this event, 0 if none */
  ticketId: number;
  /** score the connected address gave to this event, 0 if not rated */
  myRating: number;
}

/**
 * Reads eventInfo, getRating and (if an address is given) ticketOf and ratingOf
 * for every event in a single request. Events whose reads fail are left out of the result.
 */
export async function readEventsChain(
  eventIds: number[],
  address: string | null
): Promise<Record<number, EventChain>> {
  const perEvent = address ? 4 : 2;
  const calls = eventIds.flatMap((id) => {
    const list = [
      { target: TICKET_REGISTRY_ADDRESS, allowFailure: true, callData: ticketIface.encodeFunctionData("eventInfo", [id]) },
      { target: TICKET_REGISTRY_ADDRESS, allowFailure: true, callData: ticketIface.encodeFunctionData("getRating", [id]) },
    ];
    if (address) {
      list.push(
        {
          target: TICKET_REGISTRY_ADDRESS,
          allowFailure: true,
          callData: ticketIface.encodeFunctionData("ticketOf", [address, id]),
        },
        {
          target: TICKET_REGISTRY_ADDRESS,
          allowFailure: true,
          callData: ticketIface.encodeFunctionData("ratingOf", [id, address]),
        }
      );
    }
    return list;
  });

  const raw = await rawCall(MULTICALL3, multicallIface.encodeFunctionData("aggregate3", [calls]));
  const results = multicallIface.decodeFunctionResult("aggregate3", raw)[0] as { success: boolean; returnData: string }[];

  const out: Record<number, EventChain> = {};
  eventIds.forEach((id, i) => {
    const [infoRes, ratingRes, ticketRes, myRatingRes] = results.slice(i * perEvent, i * perEvent + perEvent);
    if (!infoRes.success || !ratingRes.success || (address && (!ticketRes.success || !myRatingRes.success))) return;
    const info = ticketIface.decodeFunctionResult("eventInfo", infoRes.returnData);
    const rating = ticketIface.decodeFunctionResult("getRating", ratingRes.returnData);
    const ticketId = address ? ticketIface.decodeFunctionResult("ticketOf", ticketRes.returnData)[0] : 0;
    const myRating = address ? ticketIface.decodeFunctionResult("ratingOf", myRatingRes.returnData)[0] : 0;
    out[id] = {
      price: info.price,
      capacity: Number(info.capacity),
      sold: Number(info.sold),
      startsAt: Number(info.startsAt),
      endsAt: Number(info.endsAt),
      exists: info.exists,
      ratingSum: Number(rating.sum),
      ratingCount: Number(rating.count),
      ticketId: Number(ticketId),
      myRating: Number(myRating),
    };
  });
  return out;
}

export interface TicketChain {
  owner: string;
  eventId: number;
  used: boolean;
}

/** Owner, event and "used" flag of the given tickets, in one request. */
export async function readTicketInfos(ticketIds: number[]): Promise<Record<number, TicketChain>> {
  if (ticketIds.length === 0) return {};
  const calls = ticketIds.map((id) => ({
    target: TICKET_REGISTRY_ADDRESS,
    allowFailure: true,
    callData: ticketIface.encodeFunctionData("ticketInfo", [id]),
  }));
  const raw = await rawCall(MULTICALL3, multicallIface.encodeFunctionData("aggregate3", [calls]));
  const results = multicallIface.decodeFunctionResult("aggregate3", raw)[0] as { success: boolean; returnData: string }[];

  const out: Record<number, TicketChain> = {};
  ticketIds.forEach((id, i) => {
    if (!results[i].success) return;
    const t = ticketIface.decodeFunctionResult("ticketInfo", results[i].returnData);
    out[id] = { owner: t.ticketOwner, eventId: Number(t.eventId), used: t.used };
  });
  return out;
}
