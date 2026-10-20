import { ethers } from "ethers";

/** Event as passed from server to client components (plain, serializable). */
export interface EventView {
  id: number;
  title: string;
  description: string;
  longDescription: string;
  category: string;
  format: string;
  location: string | null;
  startsAt: string; // ISO
  endsAt: string; // ISO
  priceWei: string;
  capacity: number;
}

interface EventRow {
  id: number;
  title: string;
  description: string;
  longDescription: string;
  category: string;
  format: string;
  location: string | null;
  startsAt: Date;
  endsAt: Date;
  priceWei: string;
  capacity: number;
}

export function toEventView(e: EventRow): EventView {
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    longDescription: e.longDescription,
    category: e.category,
    format: e.format,
    location: e.location,
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt.toISOString(),
    priceWei: e.priceWei,
    capacity: e.capacity,
  };
}

const dateFormat = new Intl.DateTimeFormat("uk-UA", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Kyiv",
});

export function formatEventDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

export function formatEth(wei: ethers.BigNumberish): string {
  return `${ethers.utils.formatEther(wei)} ETH`;
}

export function averageRating(sum: number, count: number): string | null {
  return count > 0 ? (sum / count).toFixed(1) : null;
}
