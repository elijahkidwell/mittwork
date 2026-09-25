import { laParts, laWallDate, laWeekday } from "./la-time.ts";

export type AvailabilityWindow = { weekday: number; startMin: number; endMin: number };
export type BusyRange = { start: number; end: number };
export type SlotOption = { startAt: string; label: string };

/** Slots start every 30 minutes inside a trainer's availability window. */
export const SLOT_STEP_MIN = 30;
/** Earliest bookable slot is 30 minutes from now. */
export const BOOKING_LEAD_MS = 30 * 60_000;
/** Bookings can be made up to 60 days ahead. */
export const MAX_DAYS_AHEAD = 60;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function slotLabel(minOfDay: number) {
  const hour = Math.floor(minOfDay / 60);
  const minute = minOfDay % 60;
  return `${hour % 12 || 12}:${pad(minute)} ${hour < 12 ? "AM" : "PM"}`;
}

/** Bookable starts for one LA calendar day ("YYYY-MM-DD"). */
export function slotsForDay(
  dateIso: string,
  windows: AvailabilityWindow[],
  durationMin: number,
  busy: BusyRange[],
  nowMs: number,
): SlotOption[] {
  const [y, m, d] = dateIso.split("-").map(Number);
  if (!y || !m || !d) return [];
  const weekday = laWeekday(laWallDate(y, m, d, 12, 0));
  const out: SlotOption[] = [];
  for (const w of windows) {
    if (w.weekday !== weekday) continue;
    for (let min = w.startMin; min + durationMin <= w.endMin; min += SLOT_STEP_MIN) {
      const start = laWallDate(y, m, d, Math.floor(min / 60), min % 60);
      const t0 = start.getTime();
      const t1 = t0 + durationMin * 60_000;
      if (t0 < nowMs + BOOKING_LEAD_MS) continue;
      if (busy.some((b) => t0 < b.end && t1 > b.start)) continue;
      out.push({ startAt: start.toISOString(), label: slotLabel(min) });
    }
  }
  return out.sort((a, b) => a.startAt.localeCompare(b.startAt));
}

/**
 * Server-side check that a requested start is a real, future slot on the
 * trainer's schedule. Returns an error message, or null when it's valid.
 * (Overlap with other bookings is checked separately.)
 */
export function validateBookingStart(
  startAt: string,
  durationMin: number,
  windows: AvailabilityWindow[],
  nowMs: number,
): string | null {
  const t0 = new Date(startAt).getTime();
  if (!Number.isFinite(t0)) return "Pick a valid time.";
  if (t0 < nowMs + BOOKING_LEAD_MS) return "That time has already passed. Pick another slot.";
  if (t0 > nowMs + MAX_DAYS_AHEAD * 86_400_000) return "That date is too far out. Pick a closer day.";
  const p = laParts(new Date(t0));
  const dateIso = `${p.year}-${pad(p.month)}-${pad(p.day)}`;
  const ok = slotsForDay(dateIso, windows, durationMin, [], nowMs).some(
    (s) => new Date(s.startAt).getTime() === t0,
  );
  return ok ? null : "That time isn’t on this trainer’s schedule. Pick another slot.";
}
