import { createFileRoute } from "@tanstack/react-router";
import { readFile } from "node:fs/promises";
import { tileXY } from "@/lib/place-photo";

async function fallbackThumb() {
  try {
    const bytes = await readFile("public/photos/gyms/gym-dark.jpg");
    return new Response(bytes, {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=3600" },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}

export const Route = createFileRoute("/api/place-thumb")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const lat = Number(url.searchParams.get("lat"));
        const lng = Number(url.searchParams.get("lng"));
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return fallbackThumb();
        const { z, x, y } = tileXY(lat, lng, 18);
        const src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
        try {
          const res = await fetch(src, {
            headers: { "User-Agent": "Mittwork/1.0 (place thumbs)" },
            signal: AbortSignal.timeout(8000),
          });
          if (!res.ok) return fallbackThumb();
          const bytes = Buffer.from(await res.arrayBuffer());
          return new Response(bytes, {
            headers: {
              "Content-Type": res.headers.get("content-type") || "image/jpeg",
              "Cache-Control": "public, max-age=86400",
            },
          });
        } catch {
          return fallbackThumb();
        }
      },
    },
  },
});
