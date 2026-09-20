import { getSql, type Sql } from "@/lib/db";

function extOf(mime: string) {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("png")) return "png";
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
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  return "video/mp4";
}

export async function ensureMediaTables(sql: Sql) {
  await sql.query(`
    create table if not exists media_parts (
      name text not null,
      idx int not null,
      user_id text not null,
      mime text not null,
      total int not null,
      data bytea not null,
      primary key (name, idx)
    )
  `);
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
  await ensureMediaTables(sql);
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
  await ensureMediaTables(sql);
  const name = mediaFileName(userId, id, mime);
  const rows = await sql.query<{ n: number }>(
    `select count(*)::int as n from media_parts where name = $1 and user_id = $2`,
    [name, userId],
  );
  if (Number(rows[0]?.n) !== total) throw new Error("Upload incomplete. Try the clip again.");
  return `/api/media/${name}`;
}

export async function readMedia(name: string): Promise<{ mime: string; bytes: Buffer } | null> {
  const sql = await getSql();
  await ensureMediaTables(sql);
  const rows = await sql.query<{ idx: number; mime: string; data: unknown }>(
    `select idx, mime, data from media_parts where name = $1 order by idx`,
    [name],
  );
  if (!rows.length) return null;
  const bytes = Buffer.concat(rows.map((r) => toBuffer(r.data)));
  return { mime: rows[0]?.mime || mimeFromName(name), bytes };
}
