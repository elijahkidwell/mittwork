import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function milesBetween(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function formatMiles(n: number): string {
  if (n < 0.1) return "< 0.1 mi";
  if (n < 10) return `${n.toFixed(1)} mi`;
  return `${Math.round(n)} mi`;
}

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function minutesToLabel(min: number): string {
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  const h = h24 % 12 || 12;
  const ampm = h24 < 12 ? "AM" : "PM";
  return `${h}:${pad2(m)} ${ampm}`;
}

export {
  LA_TZ,
  formatDateShort,
  formatWhen,
  formatDayLA,
  formatTimeLA,
  laDayIso,
  laDayKey,
  laMinutesNow,
  laParts,
  laWallDate,
  laWeekday,
} from "./la-time.ts";

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export const PLATFORM_FEE = 0.08;
/** Standard US card rate Stripe charges the platform. Passed through to the client. */
export const STRIPE_FEE_RATE = 0.029;
export const STRIPE_FEE_FIXED = 30;

export function stripeGrossCharge(netCents: number) {
  if (netCents <= 0) return 0;
  return Math.ceil((netCents + STRIPE_FEE_FIXED) / (1 - STRIPE_FEE_RATE));
}

export function stripePassThroughFee(netCents: number) {
  return Math.max(0, stripeGrossCharge(netCents) - netCents);
}
export const DEFAULT_ORIGIN = { lat: 20, lng: 0, label: "Anywhere", hasPlace: false as boolean };

export const SESSION_LENGTHS = [30, 45, 60, 75, 90, 120] as const;

export function clampDuration(min: number) {
  if (!Number.isFinite(min)) return 60;
  return Math.min(180, Math.max(15, Math.round(min)));
}

/** Price a custom length from the trainer's listed rate. */
export function priceForDuration(baseCents: number, baseMin: number, durationMin: number) {
  const listed = Math.max(15, baseMin || 60);
  const dur = clampDuration(durationMin);
  return Math.max(500, Math.round((baseCents * dur) / listed));
}

