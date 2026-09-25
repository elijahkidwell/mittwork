import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { parseGallery } from "@/lib/media";

/**
 * Serves images that older uploads stored inline as base64 `data:` URLs, so list
 * responses can reference them by URL instead of embedding them. URLs carry a
 * content hash (`?v=`), so they are safe to cache forever.
 *   /api/photo/t/<trainerId>/main   trainer photo
 *   /api/photo/g/<gymId>/g3         gallery item 3 (p3 = its video poster)
 */
function decodeDataUrl(u: string): { mime: string; bytes: Buffer } | null {
  // Raster formats only — never serve SVG/HTML from our origin.
  const m = /^data:(image\/(?:jpeg|jpg|png|webp|gif));base64,(.*)$/is.exec(u);
  if (!m) return null;
  return { mime: m[1]!.toLowerCase(), bytes: Buffer.from(m[2]!, "base64") };
}

export const Route = createFileRoute("/api/photo/$kind/$id/$slot")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const notFound = () => new Response("Not found", { status: 404 });
        const { kind, id, slot } = params;
        if ((kind !== "t" && kind !== "g") || !id || !/^(main|[gp]\d{1,3})$/.test(slot)) return notFound();
        try {
          const sql = await getSql();
          const rows =
            kind === "t"
              ? await sql<{ photo_url: string | null; gallery: unknown }>`
                  select photo_url, gallery from trainers where id = ${id}`
              : await sql<{ photo_url: string | null; gallery: unknown }>`
                  select photo_url, gallery from gyms where id = ${id}`;
          const row = rows[0];
          if (!row) return notFound();
          let src: string | undefined;
          if (slot === "main") src = row.photo_url ?? undefined;
          else {
            const item = parseGallery(row.gallery)[Number(slot.slice(1))];
            src = slot.startsWith("g") ? item?.url : item?.poster;
          }
          const img = src ? decodeDataUrl(src) : null;
          if (!img) return notFound();
          return new Response(new Uint8Array(img.bytes), {
            headers: {
              "Content-Type": img.mime,
              "Content-Length": String(img.bytes.length),
              "Cache-Control": "public, max-age=31536000, immutable",
              "X-Content-Type-Options": "nosniff",
              "Content-Security-Policy": "default-src 'none'; sandbox",
            },
          });
        } catch {
          return notFound();
        }
      },
    },
  },
});
