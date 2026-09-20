import { createHmac, timingSafeEqual } from "node:crypto";

function secret() {
  return process.env.BETTER_AUTH_SECRET || process.env.GROK_AUTH_SECRET || "mittwork-upload-key";
}

export function signUploadTicket(userId: string) {
  const exp = Date.now() + 60 * 60 * 1000;
  const payload = `${userId}.${exp}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifyUploadTicket(token: string | null | undefined): string | null {
  if (!token) return null;
  const raw = token.startsWith("Bearer ") ? token.slice(7).trim() : token.trim();
  const i = raw.lastIndexOf(".");
  if (i <= 0) return null;
  const payload = raw.slice(0, i);
  const sig = raw.slice(i + 1);
  const expect = createHmac("sha256", secret()).update(payload).digest("hex");
  try {
    if (sig.length !== expect.length) return null;
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  } catch {
    return null;
  }
  const dot = payload.lastIndexOf(".");
  const userId = payload.slice(0, dot);
  const exp = Number(payload.slice(dot + 1));
  if (!userId || !Number.isFinite(exp) || Date.now() > exp) return null;
  return userId;
}
