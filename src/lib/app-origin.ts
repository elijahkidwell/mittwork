const STATIC_ORIGINS = [
  "https://mitt-work.online",
  "https://www.mitt-work.online",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://[::1]:8080",
];

function fallbackOrigin() {
  const fromEnv =
    (typeof process !== "undefined" && process.env.BETTER_AUTH_URL?.trim().replace(/\/$/, "")) || "";
  if (fromEnv) {
    try {
      return new URL(fromEnv).origin;
    } catch {
      /* ignore */
    }
  }
  return "https://mitt-work.online";
}

/** Checkout / Connect return URLs — never trust a raw client origin. */
export function safeAppOrigin(raw?: string | null): string {
  const fallback = fallbackOrigin();
  if (!raw) return fallback;
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return fallback;
    if (STATIC_ORIGINS.includes(u.origin)) return u.origin;
    const host = u.hostname.toLowerCase();
    if (host.endsWith(".grok-sandbox.com")) return u.origin;
    if (host.endsWith(".vercel.app")) return u.origin;
    if (host === "mitt-work.online" || host === "www.mitt-work.online") return u.origin;
  } catch {
    /* ignore */
  }
  return fallback;
}
