import Stripe from "stripe";
import { env } from "@/lib/env.server";
import { PLATFORM_FEE } from "@/lib/utils";

type StoredKeys = { secret?: string; publishable?: string; ownerUserId?: string };

let cached: { at: number; keys: StoredKeys } | null = null;

async function storedKeys(): Promise<StoredKeys> {
  if (cached && Date.now() - cached.at < 15_000) return cached.keys;
  try {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql.query(`
      create table if not exists platform_settings (
        id text primary key,
        stripe_secret_key text,
        stripe_publishable_key text,
        owner_user_id text,
        updated_at timestamptz not null default now()
      )
    `);
    const rows = await sql.query<{
      stripe_secret_key: string | null;
      stripe_publishable_key: string | null;
      owner_user_id: string | null;
    }>(`select stripe_secret_key, stripe_publishable_key, owner_user_id from platform_settings where id = 'default'`);
    const row = rows[0];
    const keys: StoredKeys = {
      secret: row?.stripe_secret_key?.trim() || undefined,
      publishable: row?.stripe_publishable_key?.trim() || undefined,
      ownerUserId: row?.owner_user_id || undefined,
    };
    cached = { at: Date.now(), keys };
    return keys;
  } catch {
    return {};
  }
}

export function clearStripeCache() {
  cached = null;
}

export async function stripeSecret() {
  const fromEnv = env("STRIPE_SECRET_KEY");
  if (fromEnv) return fromEnv;
  const stored = (await storedKeys()).secret;
  if (stored) return stored;
  return "";
}

export async function stripePublishable() {
  return (
    env("VITE_STRIPE_PUBLISHABLE_KEY") ||
    env("STRIPE_PUBLISHABLE_KEY") ||
    (await storedKeys()).publishable ||
    ""
  );
}

export async function stripeEnabled() {
  return Boolean(await stripeSecret());
}

export async function getStripe() {
  const key = await stripeSecret();
  if (!key) return null;
  return new Stripe(key);
}

export async function stripeOwnerUserId() {
  return (await storedKeys()).ownerUserId;
}

export function maskKey(key: string) {
  if (key.length < 10) return "••••";
  return `${key.slice(0, 7)}…${key.slice(-4)}`;
}

export function splitAmount(amountCents: number) {
  const feeCents = Math.round(amountCents * PLATFORM_FEE);
  return { amountCents, feeCents, trainerCents: amountCents - feeCents };
}

export function stripeErrorMessage(err: unknown) {
  if (err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  return "Stripe could not start payouts.";
}
