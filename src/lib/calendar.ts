import { isAppleMapsDevice } from "@/lib/maps";
import { openExternal } from "@/lib/open-external";

export type CalendarEvent = {
  id: string;
  title: string;
  startAt: string;
  durationMin: number;
  location?: string;
  description?: string;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function icsStamp(d: Date) {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function fold(line: string) {
  return line.replace(/[,;\\]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
}

export function icsForEvent(e: CalendarEvent) {
  const start = new Date(e.startAt);
  const end = new Date(start.getTime() + Math.max(15, e.durationMin) * 60_000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Mittwork//Bookings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.id}@mittwork`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${fold(e.title)}`,
    e.location ? `LOCATION:${fold(e.location)}` : "",
    e.description ? `DESCRIPTION:${fold(e.description)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.join("\r\n");
}

function googleCalUrl(e: CalendarEvent) {
  const start = new Date(e.startAt);
  const end = new Date(start.getTime() + Math.max(15, e.durationMin) * 60_000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${icsStamp(start)}/${icsStamp(end)}`,
    details: e.description || "Mittwork session",
    location: e.location || "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function downloadIcs(e: CalendarEvent) {
  const blob = new Blob([icsForEvent(e)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mittwork-${e.id}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function addToDeviceCalendar(e: CalendarEvent) {
  if (isAppleMapsDevice()) {
    downloadIcs(e);
    return "apple";
  }
  openExternal(googleCalUrl(e));
  return "google";
}
