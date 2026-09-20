import { useEffect, useRef, useState } from "react";
import type { GymCard } from "@/lib/server/queries";
import type { Origin } from "@/lib/origin";

type Props = {
  gyms: GymCard[];
  activeId: string | null;
  onSelect: (id: string) => void;
  origin: Origin;
  maxMiles: number | undefined;
};

export function GymMap({ gyms, activeId, onSelect, origin, maxMiles }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    let cancelled = false;
    let ro: ResizeObserver | null = null;

    (async () => {
      const leaflet = await import("leaflet");
      const L = (leaflet.default ?? leaflet) as typeof import("leaflet");
      if (cancelled || !elRef.current) return;

      const map = L.map(elRef.current, {
        zoomControl: true,
        attributionControl: true,
        scrollWheelZoom: true,
        maxZoom: 16,
      }).setView(origin.hasPlace ? [origin.lat, origin.lng] : [20, 0], origin.hasPlace ? 10 : 2);

      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
        {
          attribution:
            'Tiles &copy; <a href="https://www.esri.com/">Esri</a> — Esri, HERE, Garmin, FAO, NOAA, USGS',
          maxZoom: 16,
        },
      ).addTo(map);
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
        {
          attribution: "",
          maxZoom: 16,
        },
      ).addTo(map);

      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      ro = new ResizeObserver(() => map.invalidateSize());
      ro.observe(elRef.current);
      setTimeout(() => map.invalidateSize(), 80);
      setReady(true);
    })();

    return () => {
      cancelled = true;
      ro?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!ready || !map || !layer) return;
    let cancelled = false;

    (async () => {
      const leaflet = await import("leaflet");
      const L = (leaflet.default ?? leaflet) as typeof import("leaflet");
      if (cancelled) return;

      layer.clearLayers();

      const userIcon = L.divIcon({
        className: "mitt-pin",
        html: `<div class="user-pin-dot"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      let rangeCircle: import("leaflet").Circle | null = null;
      if (origin.hasPlace) {
        L.marker([origin.lat, origin.lng], { icon: userIcon, zIndexOffset: 400 }).addTo(layer);
        if (maxMiles != null) {
          rangeCircle = L.circle([origin.lat, origin.lng], {
            radius: maxMiles * 1609.34,
            color: "#e11d2e",
            weight: 1.5,
            fillColor: "#e11d2e",
            fillOpacity: 0.08,
            interactive: false,
          }).addTo(layer);
        }
      }

      const bounds = origin.hasPlace
        ? L.latLngBounds([[origin.lat, origin.lng]])
        : gyms[0]
          ? L.latLngBounds([[gyms[0].lat, gyms[0].lng]])
          : L.latLngBounds([[20, 0]]);
      for (const gym of gyms) {
        const active = gym.id === activeId;
        const icon = L.divIcon({
          className: "mitt-pin",
          html: `<div class="mitt-pin-dot${active ? " is-active" : ""}${gym.trainerCount ? "" : " is-place"}">${gym.trainerCount || ""}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
        const marker = L.marker([gym.lat, gym.lng], { icon, zIndexOffset: active ? 500 : 0 });
        marker.on("click", () => onSelectRef.current(gym.id));
        marker.addTo(layer);
        bounds.extend([gym.lat, gym.lng]);
      }

      map.invalidateSize();
      if (rangeCircle) {
        map.fitBounds(rangeCircle.getBounds().pad(0.08), { animate: false, maxZoom: 13 });
      } else if (gyms.length > 0) {
        map.fitBounds(bounds.pad(0.18), { maxZoom: origin.hasPlace ? 12 : 4, animate: false });
      } else if (origin.hasPlace) {
        map.setView([origin.lat, origin.lng], 11);
      } else {
        map.setView([20, 0], 2);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [gyms, activeId, origin.lat, origin.lng, origin.label, origin.hasPlace, maxMiles, ready]);

  return <div ref={elRef} className="size-full min-h-[280px]" />;
}
