"use client";

import { useEffect, useState } from "react";
import { ethers } from "ethers";
import QRCode from "qrcode";
import { encodeEntryCode, entryMessage, MAX_AGE_SEC } from "../lib/entryCode";
import { EventView, formatEventDate } from "../lib/events";
import { TicketChain } from "../lib/readChain";
import { renderTicketPng } from "../lib/ticketImage";

interface Props {
  event: EventView;
  ticketId: number;
  owner: string;
  info?: TicketChain;
}

const button =
  "rounded-full px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40";

export default function TicketItem({ event, ticketId, owner, info }: Props) {
  const [code, setCode] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [signing, setSigning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const used = info?.used === true;

  // countdown for the entry code; the code disappears when it expires
  useEffect(() => {
    if (!code) return;
    const id = setInterval(() => {
      const left = expiresAt - Math.floor(Date.now() / 1000);
      if (left <= 0) {
        setCode(null);
        setQr(null);
        setRemaining(0);
      } else {
        setRemaining(left);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [code, expiresAt]);

  const download = async () => {
    setError(null);
    try {
      const blob = await renderTicketPng({
        ticketId,
        eventId: event.id,
        title: event.title,
        when: formatEventDate(event.startsAt),
        where: event.location ?? "Онлайн-трансляція",
        owner,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ticket-${ticketId}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Помилка створення зображення квитка:", err);
      setError("Не вдалося створити зображення квитка.");
    }
  };

  const showEntryCode = async () => {
    if (!window.ethereum) return;
    setError(null);
    setCopied(false);
    setSigning(true);
    try {
      const signer = new ethers.providers.Web3Provider(window.ethereum).getSigner();
      if ((await signer.getAddress()).toLowerCase() !== owner.toLowerCase()) {
        setError("Активний акаунт у гаманці не є власником цього квитка.");
        return;
      }
      const payload = { ticketId, eventId: event.id, signedAt: Math.floor(Date.now() / 1000) };
      const signature = await signer.signMessage(entryMessage(payload));
      const next = encodeEntryCode(payload, signature);
      setQr(await QRCode.toDataURL(next, { width: 280, margin: 1, errorCorrectionLevel: "L" }));
      setCode(next);
      setExpiresAt(payload.signedAt + MAX_AGE_SEC);
      setRemaining(MAX_AGE_SEC);
    } catch (err) {
      const e = err as { code?: unknown };
      console.error("Помилка створення коду входу:", err);
      setError(e?.code === 4001 || e?.code === "ACTION_REJECTED" ? "Підпис скасовано." : "Не вдалося створити код входу.");
    } finally {
      setSigning(false);
    }
  };

  const copy = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
  };

  return (
    <div className="rounded-3xl bg-surface p-6 shadow-sm ring-1 ring-border">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted">Квиток №{ticketId}</p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">{event.title}</h2>
          <p className="mt-1 text-sm text-muted">{formatEventDate(event.startsAt)}</p>
          <p className="text-sm text-muted">{event.location ?? "Онлайн-трансляція"}</p>
        </div>
        {info &&
          (used ? (
            <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-muted">Використано</span>
          ) : (
            <span className="rounded-full bg-success-bg px-3 py-1 text-xs font-medium text-success">Дійсний</span>
          ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button onClick={download} className={`${button} bg-surface-muted text-foreground`}>
          Завантажити квиток
        </button>
        {!used && (
          <button onClick={showEntryCode} disabled={signing} className={`${button} bg-foreground text-background`}>
            {signing ? "Підтвердіть у гаманці..." : "Показати для входу"}
          </button>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {code && qr && (
        <div className="mt-5 rounded-2xl bg-surface-muted p-5">
          <p className="text-sm font-medium text-foreground">
            Код входу дійсний ще {remaining} с. Покажіть його на вході.
          </p>
          <div className="mt-4 flex flex-wrap items-start gap-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR-код входу" width={140} height={140} className="rounded-lg bg-white" />
            <div className="min-w-0 flex-1">
              <textarea
                readOnly
                value={code}
                rows={4}
                className="w-full rounded-lg bg-surface p-2 font-mono text-xs text-muted"
              />
              <button onClick={copy} className={`${button} mt-2 bg-surface text-foreground ring-1 ring-border`}>
                {copied ? "Скопійовано" : "Копіювати код"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
