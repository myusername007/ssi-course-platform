import { ethers } from "ethers";
import { TICKET_REGISTRY_ABI } from "./contracts";

const iface = new ethers.utils.Interface(TICKET_REGISTRY_ABI);

const CONTRACT_ERRORS: Record<string, string> = {
  NotVerified: "Цей гаманець не має підтвердженої ідентичності.",
  AlreadyHasTicket: "У вас уже є квиток на цю подію.",
  SoldOut: "Квитки розпродано.",
  SaleClosed: "Продаж квитків на цю подію завершено.",
  WrongPayment: "Неправильна сума оплати.",
  EventNotFound: "Такої події немає в контракті.",
  NotOwner: "Ця дія доступна лише організатору.",
  TicketNotFound: "Квиток не знайдено.",
  AlreadyUsed: "Ви вже приєдналися до цієї події.",
  NotTicketHolder: "Цей квиток належить іншому акаунту.",
  CheckInNotOpen: "Приєднатися можна не раніше ніж за 15 хвилин до початку.",
  EventEnded: "Подія вже завершилась.",
  NoTicket: "У вас немає квитка на цю подію.",
  EventNotFinished: "Подія ще не завершилась.",
  NotAttended: "Оцінити подію можуть лише ті, хто приєднався до неї.",
  AlreadyRated: "Ви вже оцінили цю подію.",
  InvalidScore: "Оцінка має бути від 1 до 5.",
};

// MetaMask and ethers nest the revert data at different depths; look for it.
function findRevertData(value: unknown, depth = 0): string | null {
  if (depth > 5 || value === null || typeof value !== "object") return null;
  for (const v of Object.values(value as Record<string, unknown>)) {
    if (typeof v === "string" && /^0x[0-9a-fA-F]{8}([0-9a-fA-F]{2})*$/.test(v) && v.length < 600) {
      try {
        iface.parseError(v);
        return v;
      } catch {
        // not one of our errors
      }
    }
    const nested = findRevertData(v, depth + 1);
    if (nested) return nested;
  }
  return null;
}

export function describeError(e: unknown, fallback: string): string {
  const err = e as { code?: unknown; message?: string; reason?: string };
  if (err?.code === 4001 || err?.code === "ACTION_REJECTED") return "Транзакцію скасовано.";
  if (err?.code === "INSUFFICIENT_FUNDS" || /insufficient funds/i.test(err?.message ?? "")) {
    return "Недостатньо коштів на гаманці для оплати та комісії.";
  }
  const data = findRevertData(e);
  if (data) {
    const name = iface.parseError(data).name;
    return CONTRACT_ERRORS[name] ?? `Контракт відхилив операцію (${name}).`;
  }
  return fallback;
}
