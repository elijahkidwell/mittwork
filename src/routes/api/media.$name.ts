import { createFileRoute } from "@tanstack/react-router";
import { mimeFromName, readMedia } from "@/lib/server/media-store";

export const Route = createFileRoute("/api/media/$name")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const name = params.name.replace(/[^a-zA-Z0-9._-]/g, "");
        if (!name || name !== params.name) {
          return new Response("Not found", { status: 404 });
        }
        try {
          const media = await readMedia(name);
          if (!media) return new Response("Not found", { status: 404 });
          const bytes = media.bytes;
          const mime = media.mime || mimeFromName(name);
          const range = request.headers.get("range");
          const match = range ? /bytes=(\d+)-(\d*)/.exec(range) : null;
          if (match) {
            const start = Number(match[1]);
            const last = Math.max(bytes.length - 1, 0);
            const requestedEnd = match[2] === "" ? Math.min(start + 1024 * 1024, last) : Number(match[2]);
            const end = Math.min(requestedEnd, last);
            if (!Number.isFinite(start) || start < 0 || start >= bytes.length || start > end) {
              return new Response(null, {
                status: 416,
                headers: { "Content-Range": `bytes */${bytes.length}` },
              });
            }
            const slice = bytes.subarray(start, end + 1);
            return new Response(new Uint8Array(slice), {
              status: 206,
              headers: {
                "Content-Type": mime,
                "Content-Length": String(slice.length),
                "Content-Range": `bytes ${start}-${end}/${bytes.length}`,
                "Accept-Ranges": "bytes",
                "Cache-Control": "public, max-age=31536000, immutable",
              },
            });
          }
          return new Response(new Uint8Array(bytes), {
            headers: {
              "Content-Type": mime,
              "Content-Length": String(bytes.length),
              "Cache-Control": "public, max-age=31536000, immutable",
              "Accept-Ranges": "bytes",
            },
          });
        } catch {
          return new Response("Not found", { status: 404 });
        }
      },
    },
  },
});