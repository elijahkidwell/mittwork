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

/** Construct a Date for a wall-clock time in America/Los_Angeles (PDT in season). */
export function laWallDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  // Sept 2026 is PDT (UTC-7). Booking windows are the next two weeks.
  return new Date(
    `${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}:00-07:00`,
  );
}

export function laParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "0";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    weekday: get("weekday"),
  };
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function laWeekday(date = new Date()): number {
  return WEEKDAY_INDEX[laParts(date).weekday] ?? 0;
}

export function laMinutesNow(date = new Date()): number {
  const p = laParts(date);
  return p.hour * 60 + p.minute;
}

export function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(d);
}

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

export const LA_TZ = "America/Los_Angeles";
