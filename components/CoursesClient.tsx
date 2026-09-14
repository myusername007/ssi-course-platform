"use client";

import { useState } from "react";
import { ethers } from "ethers";

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
  const [error, setError] = useState<string | null>(null);

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
    } catch (err) {
      console.error("Помилка підключення MetaMask:", err);
      setError("Не вдалося підключити гаманець.");
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Каталог курсів</h1>
        {address ? (
          <span className="px-4 py-2 rounded bg-neutral-800 text-white text-sm font-mono">
            {address.slice(0, 6)}...{address.slice(-4)}
          </span>
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
              disabled={!address}
              title={address ? undefined : "Спершу підключіть MetaMask"}
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
