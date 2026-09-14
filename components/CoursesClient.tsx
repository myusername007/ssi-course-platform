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

export default function CoursesClient({ courses }: Props) {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [checkingVerification, setCheckingVerification] = useState(false);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reads isVerified(address) directly from CourseRegistry on Sepolia, using
  // whatever RPC the user's own MetaMask is connected through — no server,
  // no hardcoded test address, no .env. Anyone can open DevTools → Network
  // and watch this exact eth_call go out to verify it isn't fabricated.
  const checkVerification = useCallback(async (addr: string) => {
    if (!window.ethereum) return;
    setCheckingVerification(true);
    setError(null);
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contract = new ethers.Contract(COURSE_REGISTRY_ADDRESS, COURSE_REGISTRY_ABI, provider);
      const result: boolean = await contract.isVerified(addr);
      setVerified(result);
    } catch (err) {
      console.error("Помилка перевірки isVerified():", err);
      setError("Не вдалося перевірити статус верифікації.");
      setVerified(null);
    } finally {
      setCheckingVerification(false);
    }
  }, []);

  const connectWallet = async () => {
    setError(null);
    if (!window.ethereum) {
      setError("MetaMask не знайдено. Встановіть розширення MetaMask.");
      return;
    }
    setConnecting(true);
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      setAddress(accounts[0]);
      await checkVerification(accounts[0]);
    } catch (err) {
      console.error("Помилка підключення MetaMask:", err);
      setError("Не вдалося підключити гаманець.");
    } finally {
      setConnecting(false);
    }
  };

  // Re-check automatically when the user switches accounts inside MetaMask
  // itself — no need to reload the page to test a different address.
  useEffect(() => {
    if (!window.ethereum?.on) return;
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        setAddress(null);
        setVerified(null);
      } else {
        setAddress(accounts[0]);
        checkVerification(accounts[0]);
      }
    };
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    return () => {
      window.ethereum?.removeListener?.("accountsChanged", handleAccountsChanged);
    };
  }, [checkVerification]);

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
              onClick={() => checkVerification(address)}
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
        {courses.map((course) => (
          <div key={course.id} className="border rounded-lg p-5 flex flex-col">
            <h2 className="text-lg font-semibold mb-2">{course.title}</h2>
            <p className="text-sm text-neutral-600 flex-grow mb-3">{course.description}</p>
            {course.schedule && (
              <p className="text-xs text-neutral-500 mb-4">{course.schedule}</p>
            )}
            <button
              disabled={!verified}
              title={
                !address
                  ? "Спершу підключіть MetaMask"
                  : !verified
                  ? "Спершу зареєструйте SSI-ідентичність"
                  : undefined
              }
              className="mt-auto px-4 py-2 rounded bg-neutral-900 text-white text-sm font-semibold hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Записатися
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
