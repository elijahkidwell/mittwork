import { hoursUntil } from "@/lib/policy";

type NotifyCtor = {
  permission: NotificationPermission;
  requestPermission: () => Promise<NotificationPermission>;
  new (title: string, options?: NotificationOptions): Notification;
};

function notifyCtor(): NotifyCtor | null {
  if (typeof window === "undefined") return null;
  try {
    const N = (window as Window & { Notification?: NotifyCtor })["Notification"];
    if (!N || typeof N !== "function") return null;
    return N;
  } catch {
    return null;
  }
}

export async function enablePushReminders() {
  const N = notifyCtor();
  if (!N) return false;
  try {
    if (N.permission === "granted") return true;
    if (N.permission === "denied") return false;
    const res = await N.requestPermission();
    return res === "granted";
  } catch {
    return false;
  }
}

export function tickBookingReminders(
  rows: { id: string; startAt: string; serviceName: string; trainerName?: string; clientName?: string }[],
) {
  const N = notifyCtor();
  if (!N || N.permission !== "granted" || !rows.length) return;
  let seen: Set<string>;
  try {
    seen = new Set<string>(JSON.parse(sessionStorage.getItem("mitt-reminded") || "[]"));
  } catch {
    seen = new Set();
  }
  for (const b of rows) {
    const h = hoursUntil(b.startAt);
    const who = b.trainerName || b.clientName || "your session";
    let key: string | null = null;
    let title = "";
    let body = "";
    if (h > 0.75 && h < 1.25) {
      key = `${b.id}-1h`;
      title = "Session in 1 hour";
      body = `${b.serviceName} with ${who}`;
    } else if (h > 22 && h < 26) {
      key = `${b.id}-24h`;
      title = "Session tomorrow";
      body = `${b.serviceName} with ${who}. Cancel free until 24 hours before.`;
    } else if (h > 0 && h < 0.2) {
      key = `${b.id}-now`;
      title = "Session starting";
      body = `${b.serviceName} with ${who}`;
    }
    if (!key || seen.has(key)) continue;
    seen.add(key);
    try {
      new N(title, { body, tag: key });
    } catch {
      /* iOS Safari / in-app webviews often block this */
    }
  }
  try {
    sessionStorage.setItem("mitt-reminded", JSON.stringify([...seen].slice(-80)));
  } catch {
    /* private mode */
  }
}
