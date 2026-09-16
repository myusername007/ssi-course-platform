"use client";

import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { COURSE_REGISTRY_ADDRESS, COURSE_REGISTRY_ABI } from "../lib/contracts";

declare global {
  interface Window {
    ethereum?: any;
  }
}

export interface CourseListItem {
  id: number;
  title: string;
  description: string;
  schedule: string | null;
}

interface Props {
  courses: CourseListItem[];
}

type RegisteringState = Record<number, "idle" | "pending" | "done" | "error">;

export default function CoursesClient({ courses }: Props) {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [checkingVerification, setCheckingVerification] = useState(false);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [registeredCourseIds, setRegisteredCourseIds] = useState<Set<number>>(new Set());
  const [registering, setRegistering] = useState<RegisteringState>({});
  const [error, setError] = useState<string | null>(null);

  // Reads isVerified() and, for a verified address, getCourseRegistration()
  // for every listed course — all directly through the user's own MetaMask
  // connection, visible in DevTools → Network.
  const refreshOnChainState = useCallback(
    async (addr: string) => {
      if (!window.ethereum) return;
      setCheckingVerification(true);
      setError(null);
      try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const contract = new ethers.Contract(COURSE_REGISTRY_ADDRESS, COURSE_REGISTRY_ABI, provider);

        const isVerifiedResult: boolean = await contract.isVerified(addr);
        setVerified(isVerifiedResult);

        if (isVerifiedResult) {
          const results = await Promise.all(
            courses.map((c) => contract.getCourseRegistration(addr, c.id))
          );
          const registered = new Set<number>();
          results.forEach((timestamp, i) => {
            if (!timestamp.isZero()) registered.add(courses[i].id);
          });
          setRegisteredCourseIds(registered);
        } else {
          setRegisteredCourseIds(new Set());
        }
      } catch (err) {
        console.error("Помилка перевірки стану на контракті:", err);
        setError("Не вдалося перевірити статус верифікації.");
        setVerified(null);
      } finally {
        setCheckingVerification(false);
      }
    },
    [courses]
  );

  const connectWallet = async () => {
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
      // forces that picker to show every time, so switching wallets
      // actually works after a page reload, not just via the live
      // accountsChanged listener below.
      await window.ethereum.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      });
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      setAddress(accounts[0]);
      await refreshOnChainState(accounts[0]);
    } catch (err) {
      console.error("Помилка підключення MetaMask:", err);
      setError("Не вдалося підключити гаманець.");
    } finally {
      setConnecting(false);
    }
  };

  useEffect(() => {
    if (!window.ethereum?.on) return;
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        setAddress(null);
        setVerified(null);
        setRegisteredCourseIds(new Set());
      } else {
        setAddress(accounts[0]);
        refreshOnChainState(accounts[0]);
      }
    };
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    return () => {
      window.ethereum?.removeListener?.("accountsChanged", handleAccountsChanged);
    };
  }, [refreshOnChainState]);

  const register = async (courseId: number) => {
    if (!address || !window.ethereum) return;
    setRegistering((prev) => ({ ...prev, [courseId]: "pending" }));
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

      setRegistering((prev) => ({ ...prev, [courseId]: "done" }));
      setRegisteredCourseIds((prev) => new Set(prev).add(courseId));
    } catch (err: any) {
      console.error("Помилка реєстрації на курс:", err);
      setRegistering((prev) => ({ ...prev, [courseId]: "error" }));
      setError(err?.reason || err?.message || "Не вдалося записатися на курс.");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold">Каталог курсів</h1>
        {address ? (
          <div className="flex items-center gap-3">
            <span className="px-4 py-2 rounded bg-neutral-800 text-white text-sm font-mono">
              {address.slice(0, 6)}...{address.slice(-4)}
            </span>
            <button
              onClick={() => refreshOnChainState(address)}
              disabled={checkingVerification}
              className="text-xs underline text-neutral-500 hover:text-neutral-800 disabled:opacity-50"
            >
              {checkingVerification ? "Перевірка..." : "Перевірити ще раз"}
            </button>
          </div>
        ) : (
          <button
            onClick={connectWallet}
            disabled={connecting}
            className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {connecting ? "Підключення..." : "Увійти через MetaMask"}
          </button>
        )}
      </div>

      {address && (
        <div className="mb-8">
          {checkingVerification && (
            <p className="text-sm text-neutral-500">Перевірка isVerified() на CourseRegistry...</p>
          )}
          {!checkingVerification && verified === true && (
            <p className="text-sm text-green-700 font-semibold">
              ✅ Верифіковано — ця адреса має зареєстровану SSI-ідентичність
            </p>
          )}
          {!checkingVerification && verified === false && (
            <p className="text-sm text-amber-700 font-semibold">
              ⚠️ Не верифіковано — спершу зареєструйте SSI-ідентичність у{" "}
              <a
                href="https://bakalavr.vercel.app"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                SSI-додатку
              </a>
              , потім поверніться сюди й натисніть "Перевірити ще раз"
            </p>
          )}
        </div>
      )}

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => {
          const alreadyRegistered = registeredCourseIds.has(course.id);
          const state = registering[course.id] ?? "idle";
          const disabled = !verified || alreadyRegistered || state === "pending";

          let label = "Записатися";
          if (alreadyRegistered) label = "Ви записані ✅";
          else if (state === "pending") label = "Підтвердження транзакції...";

          return (
            <div key={course.id} className="border rounded-lg p-5 flex flex-col">
              <h2 className="text-lg font-semibold mb-2">{course.title}</h2>
              <p className="text-sm text-neutral-600 flex-grow mb-3">{course.description}</p>
              {course.schedule && (
                <p className="text-xs text-neutral-500 mb-4">{course.schedule}</p>
              )}
              <button
                onClick={() => register(course.id)}
                disabled={disabled}
                title={
                  !address
                    ? "Спершу підключіть MetaMask"
                    : !verified
                    ? "Спершу зареєструйте SSI-ідентичність"
                    : undefined
                }
                className="mt-auto px-4 py-2 rounded bg-neutral-900 text-white text-sm font-semibold hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {label}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
