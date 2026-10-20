"use client";

import { useState } from "react";
import { ethers } from "ethers";
import { TICKET_REGISTRY_ABI, TICKET_REGISTRY_ADDRESS } from "../lib/contracts";
import { describeError } from "../lib/errors";
import { useWallet } from "../contexts/WalletContext";

const iface = new ethers.utils.Interface(TICKET_REGISTRY_ABI);

export type PurchaseState = "idle" | "signing" | "confirming" | "saving" | "done" | "error";

export function useTicketPurchase(eventId: number) {
  const { address } = useWallet();
  const [state, setState] = useState<PurchaseState>("idle");
  const [error, setError] = useState<string | null>(null);

  /** Buys a ticket; resolves to the new ticket id, or null on failure. */
  const buy = async (price: ethers.BigNumber): Promise<number | null> => {
    if (!address || !window.ethereum) return null;
    setError(null);
    setState("signing");
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contract = new ethers.Contract(TICKET_REGISTRY_ADDRESS, TICKET_REGISTRY_ABI, provider.getSigner());

      const tx = await contract.buyTicket(eventId, { value: price });
      setState("confirming");
      const receipt = await tx.wait();

      const purchased = receipt.logs
        .filter((log: ethers.providers.Log) => log.address.toLowerCase() === TICKET_REGISTRY_ADDRESS.toLowerCase())
        .map((log: ethers.providers.Log) => {
          try {
            return iface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((p: ethers.utils.LogDescription | null) => p?.name === "TicketPurchased");
      if (!purchased) throw new Error("TicketPurchased event not found in the receipt");
      const ticketId = (purchased.args.ticketId as ethers.BigNumber).toNumber();

      // The ticket already exists on-chain at this point. The database copy
      // is only a cache (the backend re-verifies the purchase on the chain
      // before writing it), so a failure here must not look like a failed
      // purchase.
      setState("saving");
      try {
        await fetch("/api/tickets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticketId, walletAddress: address, txHash: receipt.transactionHash }),
        });
      } catch (err) {
        console.warn("Не вдалося зберегти квиток у кеші:", err);
      }

      setState("done");
      return ticketId;
    } catch (err) {
      console.error("Помилка купівлі квитка:", err);
      setState("error");
      setError(describeError(err, "Не вдалося придбати квиток."));
      return null;
    }
  };

  return { state, error, buy };
}
