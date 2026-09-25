import { getSql } from "@/lib/db";

function extOf(mime: string) {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("quicktime")) return "mov";
  return "mp4";
}

export function mediaFileName(userId: string, id: string, mime: string) {
  return `${userId.slice(0, 12)}_${id}.${extOf(mime)}`;
}

export function mimeFromName(name: string) {
  if (name.endsWith(".webm")) return "video/webm";
  if (name.endsWith(".mov")) return "video/quicktime";
  if (name.endsWith(".m4v")) return "video/x-m4v";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  return "video/mp4";
}

function toBuffer(data: unknown): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof Uint8Array) return Buffer.from(data);
  if (typeof data === "string") {
    if (data.startsWith("\\x")) return Buffer.from(data.slice(2), "hex");
    return Buffer.from(data, "base64");
  }
  if (data && typeof data === "object" && Array.isArray((data as { data?: unknown }).data)) {
    return Buffer.from((data as { data: number[] }).data);
  }
  throw new Error("Could not read media.");
}

export async function savePart(input: {
  userId: string;
  id: string;
  index: number;
  total: number;
  mime: string;
  chunkBase64: string;
}) {
  const sql = await getSql();
  const name = mediaFileName(input.userId, input.id, input.mime);
  const buf = Buffer.from(input.chunkBase64, "base64");
  if (buf.length > 250_000) throw new Error("Chunk too large.");
  await sql.query(
    `insert into media_parts (name, idx, user_id, mime, total, data)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (name, idx) do update set data = excluded.data, mime = excluded.mime, total = excluded.total`,
    [name, input.index, input.userId, input.mime, input.total, buf],
  );
  return name;
}

export async function partsComplete(userId: string, id: string, mime: string, total: number) {
  const sql = await getSql();
  const name = mediaFileName(userId, id, mime);
  const rows = await sql.query<{ n: number }>(
    `select count(*)::int as n from media_parts where name = $1 and user_id = $2`,
    [name, userId],
  );
  if (Number(rows[0]?.n) !== total) throw new Error("Upload incomplete. Try the clip again.");
  return `/api/media/${name}`;
}

type MediaMeta = { mime: string; size: number; parts: { idx: number; start: number; len: number }[] };

/** Uploaded media never changes, so part layouts can be cached per instance. */
const metaCache = new Map<string, MediaMeta>();

/** Part sizes + total length, without loading the bytes. */
export async function readMediaMeta(name: string): Promise<MediaMeta | null> {
  const hit = metaCache.get(name);
  if (hit) return hit;
  const sql = await getSql();
  const rows = await sql.query<{ idx: number; mime: string; len: number }>(
    `select idx, mime, octet_length(data)::int as len from media_parts where name = $1 order by idx`,
    [name],
  );
  if (!rows.length) return null;
  let start = 0;
  const parts = rows.map((r) => {
    const part = { idx: Number(r.idx), start, len: Number(r.len) };
    start += part.len;
    return part;
  });
  const meta = { mime: rows[0]?.mime || mimeFromName(name), size: start, parts };
  if (metaCache.size > 500) metaCache.clear();
  metaCache.set(name, meta);
  return meta;
}

/** Bytes [start, end] (inclusive), loading only the parts that cover them. */
export async function readMediaRange(name: string, meta: MediaMeta, start: number, end: number): Promise<Buffer> {
  const wanted = meta.parts.filter((p) => p.start <= end && p.start + p.len > start);
  if (!wanted.length) return Buffer.alloc(0);
  const sql = await getSql();
  const rows = await sql.query<{ idx: number; data: unknown }>(
    `select idx, data from media_parts where name = $1 and idx >= $2 and idx <= $3 order by idx`,
    [name, wanted[0]!.idx, wanted[wanted.length - 1]!.idx],
  );
  const joined = Buffer.concat(rows.map((r) => toBuffer(r.data)));
  const offset = wanted[0]!.start;
  return joined.subarray(start - offset, end - offset + 1);
}
