/**
 * Mittwork schedules every session in America/Los_Angeles wall-clock time.
 * These helpers are dependency-free so they can be unit-tested directly.
 */
export const LA_TZ = "America/Los_Angeles";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: LA_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  weekday: "short",
  hourCycle: "h23",
});

export function laParts(date = new Date()) {
  const parts = partsFormatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekday: get("weekday"),
  };
}

/** Minutes LA is offset from UTC at a given instant (-420 in PDT, -480 in PST). */
export function laOffsetMinutes(utcMs: number): number {
  const p = laParts(new Date(utcMs));
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60_000);
}

/**
 * Construct the instant for a wall-clock time in America/Los_Angeles, honoring
 * daylight saving (PDT until Nov 1 2026, PST after). Previously this was
 * hardcoded to -07:00, which shifted every post-DST slot by an hour.
 */
export function laWallDate(year: number, month: number, day: number, hour: number, minute: number): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  const first = laOffsetMinutes(naive);
  let t = naive - first * 60_000;
  const second = laOffsetMinutes(t);
  if (second !== first) t = naive - second * 60_000;
  return new Date(t);
}

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function laWeekday(date = new Date()): number {
  return WEEKDAY_INDEX[laParts(date).weekday] ?? 0;
}

export function laMinutesNow(date = new Date()): number {
  const p = laParts(date);
  return p.hour * 60 + p.minute;
}

/** "YYYY-MM-DD" for the LA calendar day `offset` days from `now`. */
export function laDayIso(offset = 0, now = new Date()): string {
  const p = laParts(now);
  const noon = laWallDate(p.year, p.month, p.day, 12, 0);
  const x = laParts(new Date(noon.getTime() + offset * 86_400_000));
  return `${x.year}-${pad(x.month)}-${pad(x.day)}`;
}

const whenFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: LA_TZ,
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

/** Session time in LA with its zone, e.g. "Fri, Sep 25, 9:00 AM PDT". */
export function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return whenFormatter.format(d);
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: LA_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(d);
}

/** Time of day in LA with zone, e.g. "9:00 AM PST". */
export function formatTimeLA(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: LA_TZ,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(d);
}

/** Long day label in LA, e.g. "Friday, Sep 25". */
export function formatDayLA(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: LA_TZ,
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(d);
}

/** LA calendar key "YYYY-MM-DD" for an instant. */
export function laDayKey(d: Date): string {
  const p = laParts(d);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}
