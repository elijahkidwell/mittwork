import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";
import { verifyUploadTicket } from "@/lib/server/upload-ticket";

const MAX_VIDEO = 200 * 1024 * 1024;
const IMAGE = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif", "image/jpg"]);

function isVideo(type: string, name: string) {
  return (
    type.startsWith("video/") ||
    type === "application/octet-stream" ||
    /\.(mp4|webm|mov|m4v|mpeg|3gp)$/i.test(name)
  );
}

export const Route = createFileRoute("/api/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const url = new URL(request.url);
          let userId =
            verifyUploadTicket(request.headers.get("authorization")) ||
            verifyUploadTicket(url.searchParams.get("ticket"));
          if (!userId) {
            const session = await auth.api.getSession({ headers: request.headers });
            userId = session?.user?.id ?? null;
          }
          if (!userId) {
            return Response.json({ error: "Sign in to upload." }, { status: 401 });
          }

          const ticketName = url.searchParams.get("name") || "clip.mp4";
          const ticketMime = url.searchParams.get("mime") || request.headers.get("content-type") || "";
          let filenameSrc = ticketName;
          let mime = ticketMime;
          let blob: Blob;

          const ctype = request.headers.get("content-type") || "";
          if (ctype.includes("multipart/form-data")) {
            const form = await request.formData();
            const file = form.get("file");
            if (!(file instanceof File)) return Response.json({ error: "No file" }, { status: 400 });
            blob = file;
            filenameSrc = file.name || ticketName;
            mime = file.type || ticketMime;
          } else {
            blob = await request.blob();
          }

          if (blob.size < 32) return Response.json({ error: "Empty file." }, { status: 400 });
          if (blob.size > MAX_VIDEO) {
            return Response.json({ error: "Clip is too large after prepare. Try a shorter take." }, { status: 400 });
          }

          const video = isVideo(mime, filenameSrc);
          const image = IMAGE.has(mime) || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(filenameSrc);
          if (!video && !image) {
            return Response.json({ error: "Use a photo or a video." }, { status: 400 });
          }

          const ext = video
            ? (filenameSrc.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "") || "mp4"
            : mime.includes("png")
              ? "png"
              : "jpg";
          const id = crypto.randomUUID().slice(0, 12);
          const dir = path.join(process.cwd(), "data", "uploads");
          await mkdir(dir, { recursive: true });
          const filename = `${userId.slice(0, 12)}_${id}.${ext}`;
          const dest = path.join(dir, filename);
          await pipeline(Readable.fromWeb(blob.stream() as never), createWriteStream(dest));
          return Response.json({
            url: `/api/media/${filename}`,
            kind: video ? "video" : "photo",
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Upload failed.";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});
