import { createFileRoute } from "@tanstack/react-router";
import { mimeFromName, readMediaMeta, readMediaRange } from "@/lib/server/media-store";

const CACHE = "public, max-age=31536000, immutable";
const SAFE = {
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; sandbox",
};
/** Serve at most this much per open-ended range request. */
const RANGE_CAP = 1024 * 1024;
/** Stream full responses in slices so no single DB read loads a whole clip. */
const STREAM_SLICE = 2 * 1024 * 1024;

export const Route = createFileRoute("/api/media/$name")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const name = params.name.replace(/[^a-zA-Z0-9._-]/g, "");
        if (!name || name !== params.name) {
          return new Response("Not found", { status: 404 });
        }
        try {
          const meta = await readMediaMeta(name);
          if (!meta || meta.size === 0) return new Response("Not found", { status: 404 });
          // Content type comes from the (server-built) file extension, never from
          // the uploader, so user bytes can't be served as HTML/SVG.
          const mime = mimeFromName(name);
          const { size } = meta;
          const last = size - 1;
          const range = request.headers.get("range");
          const match = range ? /bytes=(\d*)-(\d*)/.exec(range) : null;
          if (match && (match[1] !== "" || match[2] !== "")) {
            let start: number;
            let end: number;
            if (match[1] === "") {
              // Suffix range: last N bytes.
              const n = Number(match[2]);
              start = Math.max(0, size - n);
              end = last;
            } else {
              start = Number(match[1]);
              end = match[2] === "" ? Math.min(start + RANGE_CAP - 1, last) : Math.min(Number(match[2]), last);
            }
            if (!Number.isFinite(start) || start < 0 || start > last || start > end) {
              return new Response(null, {
                status: 416,
                headers: { "Content-Range": `bytes */${size}` },
              });
            }
            const slice = await readMediaRange(name, meta, start, end);
            return new Response(new Uint8Array(slice), {
              status: 206,
              headers: {
                "Content-Type": mime,
                "Content-Length": String(slice.length),
                "Content-Range": `bytes ${start}-${end}/${size}`,
                "Accept-Ranges": "bytes",
                "Cache-Control": CACHE,
                ...SAFE,
              },
            });
          }
          if (size <= STREAM_SLICE) {
            const bytes = await readMediaRange(name, meta, 0, last);
            return new Response(new Uint8Array(bytes), {
              headers: {
                "Content-Type": mime,
                "Content-Length": String(bytes.length),
                "Cache-Control": CACHE,
                ...SAFE,
                "Accept-Ranges": "bytes",
              },
            });
          }
          let offset = 0;
          const stream = new ReadableStream<Uint8Array>({
            async pull(controller) {
              if (offset > last) {
                controller.close();
                return;
              }
              const end = Math.min(offset + STREAM_SLICE - 1, last);
              const chunk = await readMediaRange(name, meta, offset, end);
              offset = end + 1;
              controller.enqueue(new Uint8Array(chunk));
            },
          });
          return new Response(stream, {
            headers: {
              "Content-Type": mime,
              "Content-Length": String(size),
              "Cache-Control": CACHE,
                ...SAFE,
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
