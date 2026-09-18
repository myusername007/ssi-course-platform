"use client";

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { ethers } from "ethers";
import { COURSE_REGISTRY_ADDRESS, COURSE_REGISTRY_ABI } from "../lib/contracts";

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

const SSI_APP_ORIGIN = "https://bakalavr.vercel.app";

interface WalletContextValue {
  address: string | null;
  connecting: boolean;
  checkingVerification: boolean;
  verified: boolean | null;
  error: string | null;
  connectWallet: () => Promise<void>;
  openSsiVerificationPopup: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

// Shared across the whole app (see app/layout.tsx) so navigating between the
// catalog and a course's detail page keeps the same wallet connection and
// verification state instead of reconnecting from scratch on every page.
export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [checkingVerification, setCheckingVerification] = useState(false);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshVerification = useCallback(async (addr: string) => {
    if (!window.ethereum) return;
    setCheckingVerification(true);
    setError(null);
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contract = new ethers.Contract(COURSE_REGISTRY_ADDRESS, COURSE_REGISTRY_ABI, provider);
      const result: boolean = await contract.isVerified(addr);
      setVerified(result);
    } catch (err) {
      console.error("Помилка перевірки стану на контракті:", err);
      setError("Не вдалося перевірити статус верифікації.");
      setVerified(null);
    } finally {
      setCheckingVerification(false);
    }
  }, []);

  const connectWallet = useCallback(async () => {
    setError(null);
    if (!window.ethereum) {
      setError("MetaMask не знайдено. Встановіть розширення MetaMask.");
      return;
    }
    setConnecting(true);
    try {
      // Plain eth_requestAccounts silently returns the address MetaMask
      // already approved for this site on a previous visit — it does NOT
      // reopen the account picker just because the user switched their
      // active account inside the extension. wallet_requestPermissions
      // forces that picker to show every time.
      await window.ethereum.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      });
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      setAddress(accounts[0]);
      await refreshVerification(accounts[0]);
    } catch (err) {
      console.error("Помилка підключення MetaMask:", err);
      setError("Не вдалося підключити гаманець.");
    } finally {
      setConnecting(false);
    }
  }, [refreshVerification]);

  useEffect(() => {
    if (!window.ethereum?.on) return;
    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      if (accounts.length === 0) {
        setAddress(null);
        setVerified(null);
      } else {
        setAddress(accounts[0]);
        refreshVerification(accounts[0]);
      }
    };
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    return () => {
      window.ethereum?.removeListener?.("accountsChanged", handleAccountsChanged);
    };
  }, [refreshVerification]);

  // Listens for the SSI app's popup postMessage (see useRelyingPartyMode.ts
  // on that side). Only ever treated as a hint to re-check — the actual
  // verified state always comes from our own on-chain read above, never
  // from the message payload directly.
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== SSI_APP_ORIGIN) return;
      if (event.data?.type !== "ssi-auth-success") return;
      const { address: notifiedAddress } = event.data as { address?: string };
      if (!notifiedAddress || notifiedAddress.toLowerCase() !== address?.toLowerCase()) return;
      refreshVerification(notifiedAddress);
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [address, refreshVerification]);

  const openSsiVerificationPopup = useCallback(() => {
    const rpOrigin = encodeURIComponent(window.location.origin);
    // Must be called synchronously from the click handler (no await before
    // it) — otherwise most browsers' popup blockers silently swallow it.
    window.open(`${SSI_APP_ORIGIN}/?rp_origin=${rpOrigin}`, "ssi-auth", "width=500,height=700");
  }, []);

  return (
    <WalletContext.Provider
      value={{
        address,
        connecting,
        checkingVerification,
        verified,
        error,
        connectWallet,
        openSsiVerificationPopup,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within a WalletProvider");
  return ctx;
}
