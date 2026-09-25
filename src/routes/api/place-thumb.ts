import { createFileRoute } from "@tanstack/react-router";
import { tileXY } from "@/lib/place-photo";

/** Static files aren't on the serverless filesystem, so send the browser to the CDN copy. */
function fallbackThumb() {
  return new Response(null, {
    status: 302,
    headers: { Location: "/photos/gyms/gym-dark.webp", "Cache-Control": "public, max-age=3600" },
  });
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
              "Cache-Control": "public, max-age=86400, s-maxage=604800",
            },
          });
        } catch {
          return fallbackThumb();
        }
      },
    },
  },
});
