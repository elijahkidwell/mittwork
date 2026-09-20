import { create } from "zustand";
import { reversePlace, type Place } from "@/lib/places";
import { isRealCoord } from "@/lib/geo";
import { DEFAULT_ORIGIN } from "@/lib/utils";

export type Origin = { lat: number; lng: number; label: string; hasPlace: boolean };

type OriginState = Origin & {
  hydrated: boolean;
  locating: boolean;
  setOrigin: (o: Origin) => void;
  setPlace: (p: Place) => void;
  hydrate: () => void;
  locate: () => void;
  clearPlace: () => void;
};

function persist(o: Origin) {
  try {
    localStorage.setItem("mittwork-origin", JSON.stringify(o));
  } catch {
    /* ignore */
  }
}

export const useOrigin = create<OriginState>((set) => ({
  lat: DEFAULT_ORIGIN.lat,
  lng: DEFAULT_ORIGIN.lng,
  label: DEFAULT_ORIGIN.label,
  hasPlace: false,
  hydrated: false,
  locating: false,
  setOrigin: (o) => {
    persist(o);
    set({ ...o, locating: false });
  },
  setPlace: (p) => {
    const o: Origin = { lat: p.lat, lng: p.lng, label: p.label, hasPlace: true };
    persist(o);
    set({ ...o, locating: false });
  },
  clearPlace: () => {
    persist(DEFAULT_ORIGIN);
    set({ ...DEFAULT_ORIGIN, locating: false });
  },
  hydrate: () => {
    try {
      const raw = localStorage.getItem("mittwork-origin");
      if (raw) {
        const o = JSON.parse(raw) as Origin;
        if (typeof o.lat === "number" && typeof o.lng === "number") {
          const real = isRealCoord(o.lat, o.lng);
          set({
            lat: real ? o.lat : DEFAULT_ORIGIN.lat,
            lng: real ? o.lng : DEFAULT_ORIGIN.lng,
            label: real ? o.label || DEFAULT_ORIGIN.label : DEFAULT_ORIGIN.label,
            hasPlace: Boolean(o.hasPlace) && real,
            hydrated: true,
          });
          return;
        }
      }
    } catch {
      /* ignore */
    }
    set({ hydrated: true });
  },
  locate: () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    set({ locating: true });
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          void reversePlace(lat, lng).then((place) => {
            const o: Origin = {
              lat,
              lng,
              label: place?.label || "Your location",
              hasPlace: true,
            };
            persist(o);
            set({ ...o, locating: false, hydrated: true });
          });
        },
        () => set({ locating: false }),
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 30_000 },
      );
    } catch {
      set({ locating: false });
    }
  },
}));
