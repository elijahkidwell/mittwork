import { useState } from "react";
import { STYLE_PHOTOS } from "@/lib/catalog";
import { placeThumbUrl } from "@/lib/place-photo";
import { cn } from "@/lib/utils";

export function PlaceThumb({
  lat,
  lng,
  gymType,
  className,
}: {
  lat: number;
  lng: number;
  gymType?: string;
  src?: string | null;
  className?: string;
}) {
  const live = placeThumbUrl(lat, lng);
  const fallback = STYLE_PHOTOS[gymType || ""] || STYLE_PHOTOS.fitness;
  const [url, setUrl] = useState(live);

  return (
    <img
      src={url}
      alt=""
      width={256}
      height={256}
      loading="lazy"
      decoding="async"
      className={cn("bg-elevated object-cover", className)}
      onError={() => {
        if (url !== fallback) setUrl(fallback);
      }}
    />
  );
}
