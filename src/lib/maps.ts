export function isAppleMapsDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  if (navigator.platform === "MacIntel" && (navigator.maxTouchPoints || 0) > 1) return true;
  return false;
}

function searchQuery(input: { name: string; city?: string; address?: string }) {
  const city = (input.city || "").trim();
  const usableCity = city && !/^nearby$/i.test(city) ? city : "";
  const address = (input.address || "").trim();
  return [input.name.trim(), address, usableCity].filter(Boolean).join(" ");
}

export function mapsButtonLabel() {
  return isAppleMapsDevice() ? "Apple Maps" : "Google Maps";
}

/** Opens the live business listing (photos, hours, reviews) — not a dropped pin. */
export function nativeMapsUrl(input: { lat: number; lng: number; name: string; city?: string; address?: string }) {
  const q = searchQuery(input);
  const ll = `${input.lat},${input.lng}`;
  if (isAppleMapsDevice()) {
    const params = new URLSearchParams({
      q: q || ll,
      ll,
      sll: ll,
      z: "16",
    });
    if (input.address?.trim()) params.set("address", input.address.trim());
    return `https://maps.apple.com/?${params.toString()}`;
  }
  const query = q || ll;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

import { openExternal } from "@/lib/open-external";

export function openNativeMaps(input: { lat: number; lng: number; name: string; city?: string; address?: string }) {
  openExternal(nativeMapsUrl(input));
}
