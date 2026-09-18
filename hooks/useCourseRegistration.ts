"use client";

import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { COURSE_REGISTRY_ADDRESS, COURSE_REGISTRY_ABI } from "../lib/contracts";
import { useWallet } from "../contexts/WalletContext";

type RegisterState = "idle" | "pending" | "error";

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object") {
    const withReason = err as { reason?: unknown; message?: unknown };
    if (typeof withReason.reason === "string") return withReason.reason;
    if (typeof withReason.message === "string") return withReason.message;
  }
  return fallback;
}

// Shared by the catalog card and the course detail page — both need the
// same "am I registered for this course, and can I register" logic against
// the same on-chain source of truth.
export function useCourseRegistration(courseId: number) {
  const { address, verified } = useWallet();
  const [registered, setRegistered] = useState(false);
  const [checking, setChecking] = useState(false);
  const [state, setState] = useState<RegisterState>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function check() {
      if (!address || !verified || !window.ethereum) {
        if (!ignore) setRegistered(false);
        return;
      }
      if (!ignore) setChecking(true);
      try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const contract = new ethers.Contract(COURSE_REGISTRY_ADDRESS, COURSE_REGISTRY_ABI, provider);
        const timestamp = await contract.getCourseRegistration(address, courseId);
        if (!ignore) setRegistered(!timestamp.isZero());
      } catch (err) {
        console.error("Помилка перевірки реєстрації на курс:", err);
      } finally {
        if (!ignore) setChecking(false);
      }
    }

    check();
    return () => {
      ignore = true;
    };
  }, [address, verified, courseId]);

  const register = async () => {
    if (!address || !window.ethereum) return;
    setState("pending");
    setError(null);
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(COURSE_REGISTRY_ADDRESS, COURSE_REGISTRY_ABI, signer);

      const tx = await contract.registerForCourse(courseId);
      const receipt = await tx.wait();

      // Never trust our own read of the just-sent tx as the final word — the
      // backend independently re-verifies via its own RPC before writing
      // the Enrollment cache row (see app/api/enroll/route.ts).
      const res = await fetch("/api/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, walletAddress: address, txHash: receipt.transactionHash }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Backend verification failed (${res.status})`);
      }

      setState("idle");
      setRegistered(true);
    } catch (err) {
      console.error("Помилка реєстрації на курс:", err);
      setState("error");
      setError(extractErrorMessage(err, "Не вдалося записатися на курс."));
    }
  };

  return { registered, checking, state, error, register, canRegister: verified === true };
}
