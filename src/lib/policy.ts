export const CANCEL_NOTICE_HOURS = 24;

export function hoursUntil(iso: string) {
  return (new Date(iso).getTime() - Date.now()) / 36e5;
}

export function canCancelFree(iso: string) {
  return hoursUntil(iso) >= CANCEL_NOTICE_HOURS;
}

export function canMarkNoShow(iso: string, durationMin = 60) {
  const start = new Date(iso).getTime();
  const end = start + durationMin * 60_000;
  return Date.now() >= start - 15 * 60_000 && Date.now() <= end + 12 * 36e5;
}

export const POLICY_COPY =
  "Cancel or reschedule at least 24 hours before your session. After that the trainer is paid in full — including no-shows.";
