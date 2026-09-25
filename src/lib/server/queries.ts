import { createServerFn } from "@tanstack/react-start";
import { getSql, type Sql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { STYLE_PHOTOS } from "@/lib/catalog";
import { parseGallery, type MediaItem } from "@/lib/media";
import { parsePlaces, placeLabel, placeLabelForTrainer, placeNeedsWhere, type SessionPlaceId } from "@/lib/locations";
import { SEED_GYMS, SEED_TRAINERS } from "@/lib/seed-data";
import { canCancelFree } from "@/lib/policy";
import { isRealCoord } from "@/lib/geo";
import { geocodeCity } from "@/lib/places";
import { upsertNearbyGyms, collapseDuplicateGyms, normGymName } from "@/lib/server/nearby-gyms";
import { placeThumbUrl } from "@/lib/place-photo";
import { safeAppOrigin } from "@/lib/app-origin";
import { slotsForDay, validateBookingStart, type AvailabilityWindow } from "@/lib/booking-rules";
import {
  DEFAULT_ORIGIN,
  clampDuration,
  formatWhen,
  laMinutesNow,
  laWallDate,
  laWeekday,
  milesBetween,
  priceForDuration,
  stripeGrossCharge,
} from "@/lib/utils";

export type TrainerCard = {
  id: string;
  gymId: string;
  gymName: string;
  gymType: string;
  name: string;
  headline: string;
  photoUrl: string;
  specialties: string[];
  yearsExp: number;
  rating: number;
  reviewCount: number;
  priceFrom: number;
  city: string;
  lat: number;
  lng: number;
  verified: boolean;
  miles: number;
  availableNow: boolean;
  gallery: string[];
  openDays: number[];
};

export type ServiceRow = {
  id: string;
  trainerId: string;
  name: string;
  style: string;
  serviceType: string;
  description: string;
  durationMin: number;
  priceCents: number;
};

export type ReviewRow = {
  id: string;
  authorName: string;
  rating: number;
  body: string;
  createdAt: string;
};

export type GymCard = {
  id: string;
  name: string;
  gymType: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  photoUrl: string;
  gallery: string[];
  description: string;
  amenities: string[];
  hours: string;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviewCount: number;
  yelpUrl: string | null;
  wikiExtract: string | null;
  miles: number;
  trainerCount: number;
};

export type Slot = { startAt: string; label: string };

export type BookingRow = {
  id: string;
  trainerId: string;
  trainerName: string;
  trainerPhoto: string;
  serviceName: string;
  gymName: string;
  gymAddress: string;
  startAt: string;
  status: string;
  amountCents: number;
  feeCents: number;
  notes: string | null;
  durationMin: number;
  locationType: string | null;
  locationLabel: string | null;
  locationNote: string | null;
  canReview: boolean;
  canCancelFree: boolean;
  canNoShow: boolean;
  hoursUntil: number;
};

export type TrainerSession = {
  id: string;
  startAt: string;
  status: string;
  serviceName: string;
  gymName: string;
  gymAddress: string;
  durationMin: number;
  amountCents: number;
  notes: string | null;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  clientPhoto: string | null;
  locationType: string | null;
  locationLabel: string;
  locationNote: string | null;
  canCancelFree: boolean;
};

async function notifyBooking(sql: Sql, bookingId: string) {
  const [row] = await sql<{
    id: string;
    user_id: string;
    start_at: string;
    notes: string | null;
    client_name: string | null;
    duration_min: number | null;
    amount_cents: number;
    location_type: string | null;
    location_note: string | null;
    service_name: string;
    gym_name: string;
    trainer_name: string;
    trainer_user_id: string | null;
    client_email: string | null;
    trainer_email: string | null;
  }>`
    select b.id, b.user_id, b.start_at, b.notes, b.client_name, b.duration_min, b.amount_cents,
           b.location_type, b.location_note, s.name as service_name, g.name as gym_name,
           t.name as trainer_name, t.user_id as trainer_user_id,
           cu.email as client_email, tu.email as trainer_email
    from bookings b
    join services s on s.id = b.service_id
    join gyms g on g.id = b.gym_id
    join trainers t on t.id = b.trainer_id
    left join "user" cu on cu.id = b.user_id
    left join "user" tu on tu.id = t.user_id
    where b.id = ${bookingId}
  `;
  if (!row) return;
  const when = formatWhen(String(row.start_at));
  await sql`
    insert into notifications (id, user_id, title, body, href)
    values (
      ${`nt_${crypto.randomUUID()}`}, ${row.user_id}, ${"Session confirmed"},
      ${`${row.service_name} with ${row.trainer_name} · ${when}`}, ${"/bookings"}
    )
  `;
  if (row.trainer_user_id && row.trainer_user_id !== row.user_id) {
    await sql`
      insert into notifications (id, user_id, title, body, href)
      values (
        ${`nt_${crypto.randomUUID()}`}, ${row.trainer_user_id}, ${"New booking"},
        ${`${row.client_name || "A client"} booked ${row.service_name} · ${when}`}, ${"/bookings"}
      )
    `;
  }
  try {
    const { sendBookingEmails } = await import("@/lib/server/mail");
    await sendBookingEmails({
      serviceName: row.service_name,
      startAt: String(row.start_at),
      durationMin: num(row.duration_min, 60),
      amountCents: num(row.amount_cents),
      locationType: row.location_type,
      locationNote: row.location_note,
      gymName: row.gym_name,
      notes: row.notes,
      clientName: row.client_name || "Client",
      clientEmail: row.client_email,
      trainerName: row.trainer_name,
      trainerEmail: row.trainer_email,
    });
  } catch (err) {
    console.error("booking email", err);
  }
}

let seedPromise: Promise<void> | null = null;

async function ensureSeed(sql: Sql) {
  if (!seedPromise) {
    seedPromise = (async () => {
        const rows = await sql<{ n: number }>`select count(*)::int as n from gyms`;
      const empty = (rows[0]?.n ?? 0) === 0;
      if (!empty) return;

      for (const g of SEED_GYMS) {
        await sql`
          insert into gyms (id, name, gym_type, address, city, lat, lng, photo_url, description, amenities, hours, phone)
          values (
            ${g.id}, ${g.name}, ${g.gymType}, ${g.address}, ${g.city}, ${g.lat}, ${g.lng},
            ${g.photoUrl}, ${g.description}, ${JSON.stringify(g.amenities)}, ${g.hours}, ${g.phone}
          )
          on conflict (id) do update set
            name = excluded.name,
            gym_type = excluded.gym_type,
            address = excluded.address,
            city = excluded.city,
            lat = excluded.lat,
            lng = excluded.lng,
            photo_url = case
              when gyms.photo_url like '/api/media%' then gyms.photo_url
              when gyms.photo_url like '/uploads%' then gyms.photo_url
              when gyms.owner_user_id is not null then gyms.photo_url
              else excluded.photo_url
            end,
            description = case
              when gyms.owner_user_id is not null then gyms.description
              else excluded.description
            end,
            amenities = excluded.amenities,
            hours = case
              when gyms.owner_user_id is not null then gyms.hours
              else excluded.hours
            end,
            phone = coalesce(gyms.phone, excluded.phone)
        `;
      }

      for (const t of SEED_TRAINERS) {
        await sql`
          insert into trainers (
            id, gym_id, name, headline, bio, photo_url, specialties, years_exp,
            rating, review_count, price_from, city, lat, lng, verified, gallery
          ) values (
            ${t.id}, ${t.gymId}, ${t.name}, ${t.headline}, ${t.bio}, ${t.photoUrl},
            ${JSON.stringify(t.specialties)}, ${t.yearsExp}, ${t.rating}, ${t.reviewCount},
            ${t.priceFrom}, ${t.city}, ${t.lat}, ${t.lng}, ${t.verified}, ${JSON.stringify(t.gallery)}
          )
          on conflict (id) do update set
            gym_id = excluded.gym_id,
            name = excluded.name,
            headline = excluded.headline,
            bio = excluded.bio,
            city = excluded.city,
            lat = excluded.lat,
            lng = excluded.lng
        `;
        if (!empty) continue;
        for (const s of t.services) {
          await sql`
            insert into services (id, trainer_id, name, style, service_type, description, duration_min, price_cents)
            values (${s.id}, ${t.id}, ${s.name}, ${s.style}, ${s.serviceType}, ${s.description}, ${s.durationMin}, ${s.priceCents})
            on conflict (id) do nothing
          `;
        }
        for (const a of t.availability) {
          await sql`
            insert into availability (trainer_id, weekday, start_min, end_min)
            values (${t.id}, ${a.weekday}, ${a.startMin}, ${a.endMin})
          `;
        }
        for (const r of t.reviews) {
          const created = new Date(Date.now() - r.daysAgo * 86400000).toISOString();
          await sql`
            insert into reviews (id, trainer_id, author_name, rating, body, created_at)
            values (${r.id}, ${t.id}, ${r.authorName}, ${r.rating}, ${r.body}, ${created})
            on conflict (id) do nothing
          `;
        }
      }
    })().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  await seedPromise;
}

function cityCore(s: string) {
  return (s || "")
    .toLowerCase()
    .split(",")[0]
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function expireStaleHolds(sql: Sql) {
  await sql`
    update bookings
    set status = 'cancelled', cancelled_at = now(), cancel_kind = 'expired'
    where status = 'pending_payment'
      and created_at < now() - interval '30 minutes'
  `;
}

async function refundPaidCheckout(stripeSessionId: string | null | undefined) {
  if (!stripeSessionId) return;
  const { getStripe } = await import("@/lib/server/stripe");
  const stripe = await getStripe();
  if (!stripe) return;
  const session = await stripe.checkout.sessions.retrieve(stripeSessionId);
  const pi = session.payment_intent;
  const intentId = typeof pi === "string" ? pi : pi && typeof pi === "object" && "id" in pi ? String(pi.id) : "";
  if (!intentId) return;
  await stripe.refunds.create({
    payment_intent: intentId,
    refund_application_fee: true,
    reverse_transfer: true,
  });
}

const SLOT_TAKEN = "That slot was just taken. Pick another time.";

function isUniqueViolation(err: unknown) {
  return Boolean(err && typeof err === "object" && "code" in err && (err as { code?: unknown }).code === "23505");
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  return fallback;
}

function parseList(v: unknown): string[] {
  if (Array.isArray(v)) return v as string[];
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

type TrainerDb = {
  id: string;
  gym_id: string;
  gym_name: string;
  gym_type: string;
  name: string;
  headline: string;
  photo_url: string;
  specialties: unknown;
  years_exp: number;
  rating: unknown;
  review_count: number;
  price_from: number;
  city: string;
  lat: number;
  lng: number;
  verified: boolean;
  gallery?: unknown;
};

function livePhoto(url: string | null | undefined, lat: number, lng: number) {
  const u = (url || "").trim();
  if (
    u.startsWith("data:") ||
    u.startsWith("/api/media") ||
    u.startsWith("/uploads") ||
    u.startsWith("http://") ||
    u.startsWith("https://") ||
    (u.startsWith("/photos/") && !u.includes("World_Imagery"))
  ) {
    return u;
  }
  return placeThumbUrl(lat, lng);
}

/**
 * Older uploads are stored inline as base64 `data:` URLs. Public list/detail
 * responses swap those for a small, cacheable `/api/photo/...` URL so a page of
 * trainers doesn't ship megabytes of base64 JSON. Editing endpoints
 * (getMyProfile, getMyGym) still return the raw values.
 */
function photoVersion(u: string) {
  let h = 2166136261;
  for (let i = 0; i < u.length; i += 1) {
    h ^= u.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${(h >>> 0).toString(36)}${u.length.toString(36)}`;
}

function publicPhoto(url: string | null | undefined, kind: "t" | "g", id: string, slot: string): string {
  const u = url || "";
  // Older rows point at the original stock JPEGs; every one now has a smaller WebP twin.
  if (/^\/photos\/(gyms|styles|trainers)\/[a-z0-9-]+\.jpg$/.test(u)) return u.slice(0, -4) + ".webp";
  if (!u.startsWith("data:image/")) return u;
  return `/api/photo/${kind}/${encodeURIComponent(id)}/${slot}?v=${photoVersion(u)}`;
}

/** Photo URLs only (no videos), capped, with inline images swapped out. */
function publicGallery(raw: unknown, kind: "t" | "g", id: string, max: number): string[] {
  const out: string[] = [];
  parseGallery(raw).forEach((g, i) => {
    if (out.length >= max || g.kind !== "photo" || !g.url) return;
    out.push(publicPhoto(g.url, kind, id, `g${i}`));
  });
  return out;
}

/** Full media list for a detail page, with inline images/posters swapped out. */
function publicMedia(raw: unknown, kind: "t" | "g", id: string): MediaItem[] {
  return parseGallery(raw).map((g, i) => ({
    url: g.kind === "photo" ? publicPhoto(g.url, kind, id, `g${i}`) : g.url,
    kind: g.kind,
    poster: g.poster ? publicPhoto(g.poster, kind, id, `p${i}`) : undefined,
  }));
}

function toCard(
  row: TrainerDb,
  origin: { lat: number; lng: number },
  availableNow: boolean,
  openDays: number[] = [],
): TrainerCard {
  return {
    id: row.id,
    gymId: row.gym_id,
    gymName: row.gym_name,
    gymType: row.gym_type,
    name: row.name,
    headline: row.headline,
    photoUrl: publicPhoto(row.photo_url, "t", row.id, "main"),
    specialties: parseList(row.specialties),
    yearsExp: num(row.years_exp),
    rating: num(row.rating),
    reviewCount: num(row.review_count),
    priceFrom: num(row.price_from),
    city: row.city,
    lat: num(row.lat),
    lng: num(row.lng),
    verified: Boolean(row.verified),
    miles: milesBetween(origin.lat, origin.lng, num(row.lat), num(row.lng)),
    availableNow,
    gallery: publicGallery(row.gallery, "t", row.id, 3),
    openDays,
  };
}

async function trainerWindows(sql: Sql, trainerId: string): Promise<AvailabilityWindow[]> {
  const rows = await sql<{ weekday: number; start_min: number; end_min: number }>`
    select weekday, start_min, end_min from availability where trainer_id = ${trainerId}
  `;
  return rows.map((r) => ({ weekday: num(r.weekday), startMin: num(r.start_min), endMin: num(r.end_min) }));
}

async function availableNowSet(sql: Sql): Promise<Set<string>> {
  const weekday = laWeekday();
  const minutes = laMinutesNow();
  const rows = await sql<{ trainer_id: string }>`
    select distinct trainer_id from availability
    where weekday = ${weekday}
      and start_min <= ${minutes}
      and end_min >= ${minutes + 30}
  `;
  return new Set(rows.map((r) => r.trainer_id));
}

export type TrainerQuery = {
  q?: string;
  style?: string;
  serviceType?: string;
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  availableNow?: boolean;
  lat?: number;
  lng?: number;
  maxMiles?: number;
  hasPlace?: boolean;
};

export const listTrainers = createServerFn({ method: "GET" })
  .validator((input: TrainerQuery) => input)
  .handler(async ({ data }) => {
    try {
    const sql = await getSql();
    await ensureSeed(sql);
    const origin = {
      lat: data.lat ?? DEFAULT_ORIGIN.lat,
      lng: data.lng ?? DEFAULT_ORIGIN.lng,
    };
    const rows = await sql<TrainerDb>`
      select t.id, t.gym_id, g.name as gym_name, g.gym_type, t.name, t.headline, t.photo_url,
             t.specialties, t.years_exp, t.rating, t.review_count, t.price_from, t.city,
             t.lat, t.lng, t.verified, t.gallery
      from trainers t
      join gyms g on g.id = t.gym_id
      order by t.rating desc, t.review_count desc
    `;
    const now = await availableNowSet(sql);
    const days = await sql<{ trainer_id: string; weekday: number }>`
      select trainer_id, weekday from availability
    `;
    const byTrainer = new Map<string, number[]>();
    for (const d of days) {
      const list = byTrainer.get(d.trainer_id) ?? [];
      if (!list.includes(d.weekday)) list.push(d.weekday);
      byTrainer.set(d.trainer_id, list);
    }
    let list = rows.map((r) => toCard(r, origin, now.has(r.id), byTrainer.get(r.id) ?? []));

    if (data.q) {
      const q = data.q.toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.headline.toLowerCase().includes(q) ||
          t.city.toLowerCase().includes(q) ||
          t.gymName.toLowerCase().includes(q) ||
          t.specialties.some((s) => s.includes(q)),
      );
    }
    if (data.style) {
      list = list.filter((t) => t.specialties.includes(data.style!));
    }
    if (data.city) {
      list = list.filter((t) => t.city === data.city);
    }
    if (data.minPrice != null) list = list.filter((t) => t.priceFrom >= data.minPrice! * 100);
    if (data.maxPrice != null) list = list.filter((t) => t.priceFrom <= data.maxPrice! * 100);
    if (data.availableNow) list = list.filter((t) => t.availableNow);
    if (data.maxMiles != null && data.hasPlace === true) list = list.filter((t) => t.miles <= data.maxMiles!);

    if (data.serviceType) {
      const svc = await sql<{ trainer_id: string }>`
        select distinct trainer_id from services where service_type = ${data.serviceType}
      `;
      const ids = new Set(svc.map((s) => s.trainer_id));
      list = list.filter((t) => ids.has(t.id));
    }

    if (data.hasPlace) list.sort((a, b) => a.miles - b.miles);
    else list.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
    list = list.filter((t) => isRealCoord(t.lat, t.lng));
    return list;
    } catch (err) {
      console.error("listTrainers", err);
      return [];
    }
  });

export const getTrainer = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const sql = await getSql();
    await ensureSeed(sql);
    const trainers = await sql<
      TrainerDb & {
        bio: string;
        gallery: unknown;
        gym_address: string;
        gym_photo: string;
        gym_hours: string;
        location_options: unknown;
        stripe_onboarded: boolean | null;
      }
    >`
      select t.id, t.gym_id, g.name as gym_name, g.gym_type, g.address as gym_address,
             g.photo_url as gym_photo, g.hours as gym_hours,
             t.name, t.headline, t.bio, t.photo_url, t.specialties, t.years_exp, t.rating,
             t.review_count, t.price_from, t.city, t.lat, t.lng, t.verified, t.gallery, t.location_options,
             t.stripe_onboarded
      from trainers t
      join gyms g on g.id = t.gym_id
      where t.id = ${id}
    `;
    const t = trainers[0];
    if (!t) return null;
    const services = await sql<ServiceRow & { trainer_id: string; service_type: string; duration_min: number; price_cents: number }>`
      select id, trainer_id, name, style, service_type, description, duration_min, price_cents
      from services where trainer_id = ${id} order by price_cents
    `;
    const reviews = await sql<{
      id: string;
      author_name: string;
      rating: number;
      body: string;
      created_at: string;
    }>`
      select id, author_name, rating, body, created_at
      from reviews where trainer_id = ${id} order by created_at desc
    `;
    const now = await availableNowSet(sql);
    const origin = DEFAULT_ORIGIN;
    return {
      ...toCard(t, origin, now.has(t.id)),
      bio: t.bio,
      gallery: publicMedia(t.gallery, "t", t.id),
      places: parsePlaces(t.location_options),
      gymAddress: t.gym_address,
      gymPhoto: t.gym_photo,
      gymHours: t.gym_hours,
      acceptsPayments: Boolean(t.stripe_onboarded),
      services: services.map((s) => ({
        id: s.id,
        trainerId: s.trainer_id,
        name: s.name,
        style: s.style,
        serviceType: s.service_type,
        description: s.description,
        durationMin: num(s.duration_min),
        priceCents: num(s.price_cents),
      })),
      reviews: reviews.map((r) => ({
        id: r.id,
        authorName: r.author_name,
        rating: num(r.rating),
        body: r.body,
        createdAt: String(r.created_at),
      })),
    };
  });

export type GymQuery = {
  gymType?: string;
  lat?: number;
  lng?: number;
  maxMiles?: number;
  q?: string;
  hasPlace?: boolean;
  /** Max gyms to return (default 150, hard cap 300). */
  limit?: number;
};

type GymDbRow = {
  id: string;
  name: string;
  gym_type: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  photo_url: string;
  gallery: unknown;
  description: string;
  amenities: unknown;
  hours: string;
  phone: string | null;
  website: string | null;
  rating: number | null;
  review_count: number;
  yelp_url: string | null;
  wiki_extract: string | null;
  trainer_count: number;
};

function gymCardFrom(g: GymDbRow, origin: { lat: number; lng: number }): GymCard {
  const lat = num(g.lat);
  const lng = num(g.lng);
  return {
    id: g.id,
    name: g.name,
    gymType: g.gym_type,
    address: g.address,
    city: g.city,
    lat,
    lng,
    photoUrl: publicPhoto(livePhoto(g.photo_url, lat, lng), "g", g.id, "main"),
    gallery: publicGallery(g.gallery, "g", g.id, 3),
    description: g.description,
    amenities: parseList(g.amenities),
    hours: g.hours,
    phone: g.phone,
    website: g.website ?? null,
    rating: g.rating != null ? num(g.rating) : null,
    reviewCount: num(g.review_count),
    yelpUrl: g.yelp_url ?? null,
    wikiExtract: g.wiki_extract ?? null,
    miles: milesBetween(origin.lat, origin.lng, lat, lng),
    trainerCount: num(g.trainer_count),
  };
}

/**
 * Gyms from the database only — never waits on OpenStreetMap. Filtering,
 * distance ordering, and the result cap all happen in SQL so the response stays
 * small no matter how many gyms have been imported. New areas are imported by
 * `refreshNearbyGyms`, which the client calls in the background.
 */
export const listGyms = createServerFn({ method: "GET" })
  .validator((input: GymQuery) => input)
  .handler(async ({ data }) => {
    try {
      const sql = await getSql();
      await ensureSeed(sql);
      const origin = {
        lat: Number(data.lat ?? DEFAULT_ORIGIN.lat),
        lng: Number(data.lng ?? DEFAULT_ORIGIN.lng),
      };
      const hasPlace =
        (data.hasPlace === true || String(data.hasPlace) === "true") && isRealCoord(origin.lat, origin.lng);
      const maxMilesRaw = data.maxMiles == null ? NaN : Number(data.maxMiles);
      const maxMiles = Number.isFinite(maxMilesRaw) && maxMilesRaw > 0 ? maxMilesRaw : undefined;
      const limit = Math.min(300, Math.max(1, Math.floor(Number(data.limit) || 150)));
      const fetchN = Math.ceil(limit * 1.5) + 10;
      const q = data.q?.trim().toLowerCase() || null;
      const like = q ? `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%` : null;
      const gymType = data.gymType || null;

      const select = (where: string, order: string, params: unknown[]) =>
        sql.query<GymDbRow>(
          `select g.id, g.name, g.gym_type, g.address, g.city, g.lat, g.lng, g.photo_url, g.gallery, g.description,
                  g.amenities, g.hours, g.phone, g.website, g.rating, g.review_count, g.yelp_url, g.wiki_extract,
                  coalesce(tc.n, 0)::int as trainer_count
           from gyms g
           left join (select gym_id, count(*)::int as n from trainers group by gym_id) tc on tc.gym_id = g.id
           where ${where}
           order by ${order}
           limit ${fetchN}`,
          params,
        );

      const filters: string[] = [];
      const params: unknown[] = [];
      const p = (v: unknown) => {
        params.push(v);
        return `$${params.length}`;
      };
      if (gymType) filters.push(`g.gym_type = ${p(gymType)}`);
      if (like) {
        const l = p(like);
        filters.push(`(lower(g.name) like ${l} or lower(g.city) like ${l} or lower(g.address) like ${l})`);
      }

      let rows: GymDbRow[];
      let order: string;
      if (hasPlace) {
        const la = p(origin.lat);
        const ln = p(origin.lng);
        const cosLat = Math.max(0.2, Math.cos((origin.lat * Math.PI) / 180));
        order = `power(g.lat - ${la}, 2) + power((g.lng - ${ln}) * ${cosLat}, 2)`;
        const base = [...filters];
        const baseParams = [...params];
        if (maxMiles) {
          const dLat = (maxMiles + 0.25) / 69;
          const dLng = (maxMiles + 0.25) / (cosLat * 69.17);
          const box = [...base];
          const boxParams = [...baseParams];
          const bp = (v: unknown) => {
            boxParams.push(v);
            return `$${boxParams.length}`;
          };
          box.push(`g.lat between ${bp(origin.lat - dLat)} and ${bp(origin.lat + dLat)}`);
          if (origin.lng - dLng > -180 && origin.lng + dLng < 180) {
            box.push(`g.lng between ${bp(origin.lng - dLng)} and ${bp(origin.lng + dLng)}`);
          }
          rows = await select(box.join(" and ") || "true", order, boxParams);
          const inRange = rows.filter(
            (g) => milesBetween(origin.lat, origin.lng, num(g.lat), num(g.lng)) <= maxMiles + 0.25,
          );
          // Nothing in range: fall back to the nearest 20 (the map explains this).
          rows = inRange.length ? inRange : (await select(base.join(" and ") || "true", order, baseParams)).slice(0, 20);
        } else {
          rows = await select(base.join(" and ") || "true", order, baseParams);
        }
      } else {
        order = "trainer_count desc, g.name asc";
        rows = await select(filters.join(" and ") || "true", order, params);
      }

      let list = rows.map((g) => gymCardFrom(g, origin));
      list = collapseDuplicateGyms(list).filter((g) => isRealCoord(g.lat, g.lng));
      if (hasPlace) list.sort((a, b) => a.miles - b.miles);
      else list.sort((a, b) => b.trainerCount - a.trainerCount || a.name.localeCompare(b.name));
      return list.slice(0, limit);
    } catch (err) {
      console.error("listGyms", err);
      return [];
    }
  });

/** Recently refreshed areas, so repeat visits don't re-import. */
const refreshedAreas = new Map<string, number>();
const REFRESH_TTL = 30 * 60_000;

/**
 * Import OpenStreetMap gyms around a point into the database. Called by the
 * client in the background after the user picks a place; the client refetches
 * the gym list when this resolves.
 */
export const refreshNearbyGyms = createServerFn({ method: "POST" })
  .validator((input: { lat: number; lng: number; miles?: number }) => input)
  .handler(async ({ data }) => {
    const lat = Number(data.lat);
    const lng = Number(data.lng);
    if (!isRealCoord(lat, lng)) return { added: 0, skipped: true };
    const miles = Math.min(Math.max(Number(data.miles) || 25, 5), 50);
    const key = `${lat.toFixed(2)}|${lng.toFixed(2)}|${Math.round(miles)}`;
    const at = refreshedAreas.get(key);
    if (at && Date.now() - at < REFRESH_TTL) return { added: 0, skipped: true };
    refreshedAreas.set(key, Date.now());
    try {
      const sql = await getSql();
      await ensureSeed(sql);
      const added = await upsertNearbyGyms(sql, lat, lng, miles);
      return { added, skipped: false };
    } catch (err) {
      refreshedAreas.delete(key);
      console.error("refreshNearbyGyms", err);
      return { added: 0, skipped: false };
    }
  });

export const getGym = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const sql = await getSql();
    await ensureSeed(sql);
    const [g] = await sql<{
      id: string;
      name: string;
      gym_type: string;
      address: string;
      city: string;
      lat: number;
      lng: number;
      photo_url: string;
      gallery: unknown;
      description: string;
      amenities: unknown;
      hours: string;
      phone: string | null;
      website: string | null;
      rating: number | null;
      review_count: number;
      yelp_url: string | null;
      wiki_extract: string | null;
    }>`
      select id, name, gym_type, address, city, lat, lng, photo_url, gallery, description,
             amenities, hours, phone, website, rating, review_count, yelp_url, wiki_extract
      from gyms where id = ${id}
    `;
    if (!g) return null;
    const lat = num(g.lat);
    const lng = num(g.lng);
    const gym: GymCard = {
      id: g.id,
      name: g.name,
      gymType: g.gym_type,
      address: g.address,
      city: g.city,
      lat,
      lng,
      photoUrl: publicPhoto(livePhoto(g.photo_url, lat, lng), "g", g.id, "main"),
      gallery: publicGallery(g.gallery, "g", g.id, 12),
      description: g.description,
      amenities: parseList(g.amenities),
      hours: g.hours,
      phone: g.phone,
      website: g.website ?? null,
      rating: g.rating != null ? num(g.rating) : null,
      reviewCount: num(g.review_count),
      yelpUrl: g.yelp_url ?? null,
      wikiExtract: g.wiki_extract ?? null,
      miles: 0,
      trainerCount: 0,
    };
    const trainerRows = await sql<TrainerDb>`
      select t.id, t.gym_id, g.name as gym_name, g.gym_type, t.name, t.headline, t.photo_url,
             t.specialties, t.years_exp, t.rating, t.review_count, t.price_from, t.city,
             t.lat, t.lng, t.verified, t.gallery
      from trainers t
      join gyms g on g.id = t.gym_id
      where t.gym_id = ${id}
    `;
    const now = await availableNowSet(sql);
    const here = trainerRows.map((r) => toCard(r, DEFAULT_ORIGIN, now.has(r.id)));
    gym.trainerCount = here.length;
    const reviews = await sql<{
      id: string;
      author_name: string;
      rating: number;
      body: string;
      source: string;
      created_at: string;
    }>`
      select id, author_name, rating, body, source, created_at
      from gym_reviews where gym_id = ${id}
      order by created_at desc
      limit 20
    `;
    return {
      gym,
      trainers: here,
      reviews: reviews.map((r) => ({
        id: r.id,
        authorName: r.author_name,
        rating: num(r.rating),
        body: r.body,
        source: r.source,
        createdAt: String(r.created_at),
      })),
    };
  });


export const listSlots = createServerFn({ method: "GET" })
  .validator((input: { trainerId: string; serviceId: string; date: string; durationMin?: number }) => input)
  .handler(async ({ data }) => {
    const sql = await getSql();
    await ensureSeed(sql);
    await expireStaleHolds(sql);
    const [svc] = await sql<{ duration_min: number }>`
      select duration_min from services where id = ${data.serviceId} and trainer_id = ${data.trainerId}
    `;
    if (!svc) return [] as Slot[];
    const duration = clampDuration(data.durationMin ?? num(svc.duration_min, 60));
    const [y, m, d] = data.date.split("-").map(Number);
    if (!y || !m || !d) return [] as Slot[];
    const dayStart = laWallDate(y, m, d, 0, 0);
    const windows = await trainerWindows(sql, data.trainerId);
    // Only bookings that could overlap this LA day (plus max session length).
    const booked = await sql<{ start_at: string; duration_min: number | null }>`
      select start_at, duration_min from bookings
      where trainer_id = ${data.trainerId}
        and status not in ('cancelled')
        and not (status = 'pending_payment' and created_at < now() - interval '30 minutes')
        and start_at >= ${new Date(dayStart.getTime() - 4 * 3600_000).toISOString()}
        and start_at < ${new Date(dayStart.getTime() + 28 * 3600_000).toISOString()}
    `;
    const occupied = booked.map((b) => {
      const start = new Date(b.start_at).getTime();
      return { start, end: start + num(b.duration_min, 60) * 60_000 };
    });
    return slotsForDay(data.date, windows, duration, occupied, Date.now()) as Slot[];
  });

export const listMyBookings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    try {
      const sql = await getSql();
      const rows = await sql<{
        id: string;
        trainer_id: string;
        trainer_name: string;
        trainer_photo: string | null;
        service_name: string | null;
        gym_name: string | null;
        gym_address: string | null;
        start_at: string;
        status: string;
        amount_cents: number | null;
        fee_cents: number | null;
        notes: string | null;
        duration_min: number | null;
        location_type: string | null;
        location_note: string | null;
      }>`
        select b.id, b.trainer_id, coalesce(t.name, 'Trainer') as trainer_name, t.photo_url as trainer_photo,
               coalesce(s.name, 'Session') as service_name, g.name as gym_name, g.address as gym_address,
               b.start_at, b.status, b.amount_cents, b.fee_cents, b.notes,
               coalesce(b.duration_min, s.duration_min, 60) as duration_min,
               b.location_type, b.location_note
        from bookings b
        left join trainers t on t.id = b.trainer_id
        left join services s on s.id = b.service_id
        left join gyms g on g.id = b.gym_id
        where b.user_id = ${context.userId}
        order by b.start_at desc
      `;
      let reviewedIds = new Set<string>();
      try {
        const reviewed = await sql<{ booking_id: string }>`
          select booking_id from reviews where user_id = ${context.userId} and booking_id is not null
        `;
        reviewedIds = new Set(reviewed.map((r) => r.booking_id));
      } catch {
        /* reviews table may be empty */
      }
      const now = Date.now();
      return rows.map((r) => {
        const start = new Date(r.start_at).getTime();
        const startOk = Number.isFinite(start);
        return {
          id: r.id,
          trainerId: r.trainer_id,
          trainerName: r.trainer_name || "Trainer",
          trainerPhoto: publicPhoto(r.trainer_photo, "t", r.trainer_id, "main"),
          serviceName: r.service_name || "Session",
          gymName: r.gym_name || "",
          gymAddress: r.gym_address || "",
          startAt: String(r.start_at || ""),
          status: r.status || "confirmed",
          amountCents: num(r.amount_cents),
          feeCents: num(r.fee_cents),
          notes: r.notes,
          durationMin: num(r.duration_min, 60),
          locationType: r.location_type,
          locationLabel: r.location_type ? placeLabel(r.location_type) : null,
          locationNote: r.location_note,
          canReview: r.status === "confirmed" && startOk && start < now && !reviewedIds.has(r.id),
          canCancelFree: r.status === "confirmed" && startOk && start > now && canCancelFree(String(r.start_at)),
          canNoShow: r.status === "confirmed" && startOk && start <= now + 15 * 60_000,
          hoursUntil: startOk ? (start - now) / 36e5 : 0,
        } satisfies BookingRow;
      });
    } catch {
      return [] as BookingRow[];
    }
  });

export const listTrainerSessions = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    try {
      const sql = await getSql();
      const [trainer] = await sql<{ id: string }>`
        select id from trainers where user_id = ${context.userId} limit 1
      `;
      if (!trainer) return { isTrainer: false, sessions: [] as TrainerSession[] };
      try {
        const rows = await sql<{
        id: string;
        start_at: string;
        status: string;
        amount_cents: number | null;
        notes: string | null;
        duration_min: number | null;
        location_type: string | null;
        location_note: string | null;
        client_name: string | null;
        service_name: string | null;
        gym_name: string | null;
        gym_address: string | null;
        client_email: string | null;
        client_phone: string | null;
        client_photo: string | null;
      }>`
        select b.id, b.start_at, b.status, b.amount_cents, b.notes,
               coalesce(b.duration_min, s.duration_min, 60) as duration_min,
               b.location_type, b.location_note, b.client_name,
               coalesce(s.name, 'Session') as service_name, g.name as gym_name, g.address as gym_address,
               u.email as client_email, p.phone as client_phone, p.photo_url as client_photo
        from bookings b
        left join services s on s.id = b.service_id
        left join gyms g on g.id = b.gym_id
        left join "user" u on u.id = b.user_id
        left join profiles p on p.user_id = b.user_id
        where b.trainer_id = ${trainer.id}
        order by b.start_at
      `;
      return {
        isTrainer: true,
        sessions: rows.map(
          (r) =>
            ({
              id: r.id,
              startAt: String(r.start_at || ""),
              status: r.status || "confirmed",
              serviceName: r.service_name || "Session",
              gymName: r.gym_name || "",
              gymAddress: r.gym_address || "",
              durationMin: num(r.duration_min, 60),
              amountCents: num(r.amount_cents),
              notes: r.notes,
              clientName: r.client_name || "Client",
              clientEmail: r.client_email,
              clientPhone: r.client_phone,
              clientPhoto: r.client_photo,
              locationType: r.location_type,
              locationLabel: placeLabelForTrainer(r.location_type || "trainer_gym"),
              locationNote: r.location_note,
              canCancelFree:
                (r.status || "confirmed") === "confirmed" &&
                Number.isFinite(new Date(String(r.start_at || "")).getTime()) &&
                new Date(String(r.start_at)).getTime() > Date.now() &&
                canCancelFree(String(r.start_at)),
            }) satisfies TrainerSession,
        ),
      };
      } catch {
        return { isTrainer: true, sessions: [] as TrainerSession[] };
      }
    } catch {
      return { isTrainer: false, sessions: [] as TrainerSession[] };
    }
  });

export const cancelBooking = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    const [bk] = await sql<{
      id: string;
      user_id: string;
      trainer_id: string;
      start_at: string;
      status: string;
      stripe_session_id: string | null;
    }>`
      select b.id, b.user_id, b.trainer_id, b.start_at, b.status, b.stripe_session_id
      from bookings b where b.id = ${id}
    `;
    if (!bk || (bk.status !== "confirmed" && bk.status !== "pending_payment")) throw new Error("Booking not found");
    const [tr] = await sql<{ user_id: string | null }>`
      select user_id from trainers where id = ${bk.trainer_id}
    `;
    const allowed = bk.user_id === context.userId || tr?.user_id === context.userId;
    if (!allowed) throw new Error("Unauthorized");
    if (bk.status === "confirmed" && !canCancelFree(String(bk.start_at))) {
      throw new Error(
        "Cancellations need 24 hours’ notice. This session is still paid in full — mark a no-show if they didn’t show.",
      );
    }
    if (bk.status === "confirmed") {
      try {
        await refundPaidCheckout(bk.stripe_session_id);
      } catch (err) {
        console.error("stripe refund", err);
        throw new Error("Could not refund this payment. Try again or contact Mittwork.");
      }
    }
    await sql`
      update bookings set status = 'cancelled', cancelled_at = now(), cancel_kind = 'free'
      where id = ${id}
    `;
    return { ok: true };
  });

export const reportNoShow = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    const [bk] = await sql<{
      id: string;
      user_id: string;
      trainer_id: string;
      start_at: string;
      status: string;
    }>`
      select id, user_id, trainer_id, start_at, status from bookings where id = ${id}
    `;
    if (!bk || (bk.status !== "confirmed" && bk.status !== "no_show")) throw new Error("Booking not found");
    const [tr] = await sql<{ user_id: string | null }>`
      select user_id from trainers where id = ${bk.trainer_id}
    `;
    const allowed = bk.user_id === context.userId || tr?.user_id === context.userId;
    if (!allowed) throw new Error("Unauthorized");
    const start = new Date(bk.start_at).getTime();
    if (Date.now() < start - 15 * 60_000) {
      throw new Error("You can mark a no-show from 15 minutes before the session.");
    }
    await sql`
      update bookings set status = 'no_show', no_show_by = ${context.userId}
      where id = ${id}
    `;
    const other = bk.user_id === context.userId ? tr?.user_id : bk.user_id;
    if (other) {
      await sql`
        insert into notifications (id, user_id, title, body, href)
        values (
          ${`nt_${crypto.randomUUID().slice(0, 10)}`}, ${other},
          ${"No-show recorded"},
          ${"The session was marked a no-show. The trainer is still paid in full."},
          ${"/bookings"}
        )
      `;
    }
    return { ok: true, paidInFull: true };
  });

export const addReview = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { bookingId: string; rating: number; body: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const [bk] = await sql<{ trainer_id: string; client_name: string | null; status: string; start_at: string }>`
      select trainer_id, client_name, status, start_at from bookings
      where id = ${data.bookingId} and user_id = ${context.userId}
    `;
    if (!bk) throw new Error("Booking not found");
    if (bk.status !== "confirmed" || new Date(bk.start_at).getTime() > Date.now()) {
      throw new Error("You can review a session after it happens.");
    }
    const [already] = await sql<{ id: string }>`
      select id from reviews where booking_id = ${data.bookingId} and user_id = ${context.userId} limit 1
    `;
    if (already) throw new Error("You already reviewed this session.");
    const rating = Math.min(5, Math.max(1, Math.round(data.rating)));
    const id = `rv_${crypto.randomUUID()}`;
    await sql`
      insert into reviews (id, booking_id, trainer_id, user_id, author_name, rating, body)
      values (
        ${id}, ${data.bookingId}, ${bk.trainer_id}, ${context.userId},
        ${bk.client_name || "Client"}, ${rating}, ${data.body.trim()}
      )
    `;
    // Fold the new rating into the listed average instead of recounting the
    // reviews table (catalog trainers list more reviews than rows exist).
    await sql`
      update trainers set
        rating = round(((rating * review_count) + ${rating}) / (review_count + 1)::numeric, 2),
        review_count = review_count + 1
      where id = ${bk.trainer_id}
    `;
    return { ok: true };
  });

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    return sql<{
      id: string;
      title: string;
      body: string;
      href: string | null;
      read: boolean;
      created_at: string;
    }>`
      select id, title, body, href, read, created_at
      from notifications where user_id = ${context.userId}
      order by created_at desc
      limit 20
    `;
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await sql`update notifications set read = true where user_id = ${context.userId}`;
    return { ok: true };
  });

export type Profile = {
  userId: string;
  role: "client" | "trainer";
  displayName: string | null;
  city: string | null;
  phone: string | null;
  bio: string | null;
  photoUrl: string | null;
  trainerId: string | null;
  trainer: {
    id: string;
    name: string;
    headline: string;
    bio: string;
    photoUrl: string;
    specialties: string[];
    yearsExp: number;
    gymId: string;
    gymName: string;
    gallery: MediaItem[];
    services: ServiceRow[];
    places: SessionPlaceId[];
    stripeOnboarded: boolean;
    lat: number;
    lng: number;
    city: string;
  } | null;
};

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await repairTrainerPins(sql, context.userId);
    const existing = await sql<{ user_id: string }>`
      select user_id from profiles where user_id = ${context.userId}
    `;
    if (!existing[0]) {
      await sql`
        insert into profiles (user_id, role) values (${context.userId}, 'client')
        on conflict (user_id) do nothing
      `;
    }
    const [p] = await sql<{
      user_id: string;
      role: string;
      display_name: string | null;
      city: string | null;
      phone: string | null;
      bio: string | null;
      photo_url: string | null;
    }>`
      select user_id, role, display_name, city, phone, bio, photo_url
      from profiles where user_id = ${context.userId}
    `;
    let oauthPhoto: string | null = null;
    if (!p?.photo_url) {
      const [u] = await sql<{ image: string | null }>`
        select image from "user" where id = ${context.userId}
      `;
      oauthPhoto = u?.image ?? null;
    }
    const [tr] = await sql<{
      id: string;
      name: string;
      headline: string;
      bio: string;
      photo_url: string;
      specialties: unknown;
      years_exp: number;
      gym_id: string;
      gym_name: string | null;
      gallery: unknown;
      location_options: unknown;
      stripe_onboarded: boolean;
      stripe_account_id: string | null;
      lat: number;
      lng: number;
      city: string;
    }>`
      select t.id, t.name, t.headline, t.bio, t.photo_url, t.specialties, t.years_exp, t.gym_id, t.gallery,
             t.location_options, t.stripe_onboarded, t.stripe_account_id, t.lat, t.lng, t.city, g.name as gym_name
      from trainers t
      left join gyms g on g.id = t.gym_id
      where t.user_id = ${context.userId} limit 1
    `;
    const services = tr
      ? await sql<{
          id: string;
          trainer_id: string;
          name: string;
          style: string;
          service_type: string;
          description: string;
          duration_min: number;
          price_cents: number;
        }>`
          select id, trainer_id, name, style, service_type, description, duration_min, price_cents
          from services where trainer_id = ${tr.id} order by price_cents
        `
      : [];
    return {
      userId: context.userId,
      role: (p?.role === "trainer" || tr ? "trainer" : "client") as "client" | "trainer",
      displayName: p?.display_name ?? tr?.name ?? null,
      city: p?.city ?? tr?.city ?? null,
      phone: p?.phone ?? null,
      bio: p?.bio ?? null,
      photoUrl: p?.photo_url ?? tr?.photo_url ?? oauthPhoto,
      trainerId: tr?.id ?? null,
      trainer: tr
        ? {
            id: tr.id,
            name: tr.name,
            headline: tr.headline,
            bio: tr.bio,
            photoUrl: tr.photo_url,
            specialties: parseList(tr.specialties),
            yearsExp: num(tr.years_exp),
            gymId: tr.gym_id,
            gymName: tr.gym_name || "",
            gallery: parseGallery(tr.gallery),
            places: parsePlaces(tr.location_options),
            stripeOnboarded: Boolean(tr.stripe_onboarded),
            lat: num(tr.lat),
            lng: num(tr.lng),
            city: tr.city || "",
            services: services.map((s) => ({
              id: s.id,
              trainerId: s.trainer_id,
              name: s.name,
              style: s.style,
              serviceType: s.service_type,
              description: s.description,
              durationMin: num(s.duration_min),
              priceCents: num(s.price_cents),
            })),
          }
        : null,
    } satisfies Profile;
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      displayName?: string;
      city?: string;
      phone?: string;
      bio?: string;
      photoUrl?: string;
      role?: "client" | "trainer";
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      insert into profiles (user_id, role, display_name, city, phone, bio, photo_url)
      values (
        ${context.userId},
        ${data.role ?? "client"},
        ${data.displayName ?? null},
        ${data.city ?? null},
        ${data.phone ?? null},
        ${data.bio ?? null},
        ${data.photoUrl ?? null}
      )
      on conflict (user_id) do update set
        role = coalesce(${data.role ?? null}, profiles.role),
        display_name = coalesce(${data.displayName ?? null}, profiles.display_name),
        city = coalesce(${data.city ?? null}, profiles.city),
        phone = coalesce(${data.phone ?? null}, profiles.phone),
        bio = coalesce(${data.bio ?? null}, profiles.bio),
        photo_url = coalesce(${data.photoUrl ?? null}, profiles.photo_url)
    `;
    return { ok: true };
  });

export const saveMyPhoto = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { photoUrl: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const url = data.photoUrl.trim();
    if (!url) throw new Error("Pick a photo first.");
    await sql`
      insert into profiles (user_id, role, photo_url)
      values (${context.userId}, 'client', ${url})
      on conflict (user_id) do update set photo_url = ${url}
    `;
    await sql`
      update trainers set photo_url = ${url} where user_id = ${context.userId}
    `;
    return { ok: true, photoUrl: url };
  });

const UPLOAD_MIMES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const putMediaPart = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; index: number; total: number; chunk: string; mime: string }) => input)
  .handler(async ({ context, data }) => {
    const { savePart } = await import("@/lib/server/media-store");
    const id = data.id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24);
    if (!id) throw new Error("Bad upload.");
    const mime = (data.mime || "video/mp4").split(";")[0]!.trim().toLowerCase();
    if (!UPLOAD_MIMES.has(mime)) throw new Error("Use a photo (JPG/PNG/WebP) or a video.");
    const index = Math.max(0, Math.floor(Number(data.index)));
    const total = Math.max(1, Math.floor(Number(data.total)));
    if (index >= total || total > 800) throw new Error("Bad upload.");
    await savePart({
      userId: context.userId,
      id,
      index,
      total,
      mime,
      chunkBase64: data.chunk,
    });
    return { ok: true as const };
  });

export const finishMediaParts = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; total: number; mime: string }) => input)
  .handler(async ({ context, data }) => {
    const { partsComplete } = await import("@/lib/server/media-store");
    const id = data.id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24);
    const total = Math.max(1, Math.floor(Number(data.total)));
    const mime = (data.mime || "video/mp4").split(";")[0]!.trim().toLowerCase();
    const url = await partsComplete(context.userId, id, mime, total);
    return { url };
  });

export const saveTrainerGallery = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { gallery: MediaItem[] }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const [tr] = await sql<{ id: string }>`select id from trainers where user_id = ${context.userId}`;
    if (!tr) throw new Error("Create a trainer profile first.");
    await sql`
      update trainers set gallery = ${JSON.stringify(data.gallery)}
      where id = ${tr.id} and user_id = ${context.userId}
    `;
    return { ok: true };
  });

export const saveMyServices = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      services: {
        id?: string;
        name: string;
        style: string;
        serviceType: string;
        description: string;
        durationMin: number;
        priceCents: number;
      }[];
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const [tr] = await sql<{ id: string }>`select id from trainers where user_id = ${context.userId}`;
    if (!tr) throw new Error("Create a trainer profile first.");
    const cleaned = data.services
      .map((s) => ({
        id: s.id?.startsWith("svc_") ? s.id : undefined,
        name: s.name.trim(),
        style: s.style || "fitness",
        serviceType: s.serviceType || "one-on-one",
        description: s.description.trim(),
        durationMin: clampDuration(s.durationMin || 60),
        priceCents: Math.max(500, Math.round(s.priceCents)),
      }))
      .filter((s) => s.name);
    if (!cleaned.length) throw new Error("Add at least one service.");
    const existing = await sql<{ id: string }>`select id from services where trainer_id = ${tr.id}`;
    const keep = new Set(cleaned.map((s) => s.id).filter(Boolean) as string[]);
    const booked = await sql<{ service_id: string }>`
      select distinct service_id from bookings where trainer_id = ${tr.id} and status != 'cancelled'
    `;
    const bookedIds = new Set(booked.map((b) => b.service_id));
    for (const row of existing) {
      if (!keep.has(row.id) && !bookedIds.has(row.id)) {
        await sql`delete from services where id = ${row.id} and trainer_id = ${tr.id}`;
      }
    }
    for (const s of cleaned) {
      if (s.id && existing.some((e) => e.id === s.id)) {
        await sql`
          update services set
            name = ${s.name},
            style = ${s.style},
            service_type = ${s.serviceType},
            description = ${s.description},
            duration_min = ${s.durationMin},
            price_cents = ${s.priceCents}
          where id = ${s.id} and trainer_id = ${tr.id}
        `;
      } else {
        await sql`
          insert into services (id, trainer_id, name, style, service_type, description, duration_min, price_cents)
          values (
            ${`svc_${crypto.randomUUID().slice(0, 8)}`}, ${tr.id}, ${s.name}, ${s.style},
            ${s.serviceType}, ${s.description || s.name}, ${s.durationMin}, ${s.priceCents}
          )
        `;
      }
    }
    const minPrice = Math.min(...cleaned.map((s) => s.priceCents));
    await sql`update trainers set price_from = ${minPrice} where id = ${tr.id}`;
    return { ok: true };
  });

async function resolveHometown(
  city?: string | null,
  lat?: number,
  lng?: number,
): Promise<{ city: string; lat: number; lng: number }> {
  const label = (city || "").trim();
  if (isRealCoord(lat, lng)) {
    return { city: label || "Hometown", lat: Number(lat), lng: Number(lng) };
  }
  const hit = label ? await geocodeCity(label) : null;
  if (hit) return { city: hit.label, lat: hit.lat, lng: hit.lng };
  throw new Error("Pick a hometown from the city list so we can place you on the map.");
}

/** Re-geocode the signed-in trainer's pin if it's missing (was: every trainer, on every profile load). */
async function repairTrainerPins(sql: Sql, userId: string) {
  const rows = await sql<{ id: string; city: string; lat: number; lng: number; gym_id: string }>`
    select id, city, lat, lng, gym_id from trainers where user_id = ${userId}
  `;
  for (const t of rows) {
    if (isRealCoord(num(t.lat), num(t.lng))) continue;
    const hit = await geocodeCity(t.city || "");
    if (!hit) continue;
    await sql`update trainers set lat = ${hit.lat}, lng = ${hit.lng}, city = ${hit.label} where id = ${t.id}`;
  }
}

async function findOrCreateGym(
  sql: Sql,
  input: { gymId?: string; gymName?: string; city?: string; lat?: number; lng?: number },
) {
  if (input.gymId) {
    const [row] = await sql<{ id: string; city: string; lat: number; lng: number }>`
      select id, city, lat, lng from gyms where id = ${input.gymId}
    `;
    if (
      row &&
      isRealCoord(num(row.lat), num(row.lng)) &&
      (!isRealCoord(input.lat, input.lng) || milesBetween(num(row.lat), num(row.lng), Number(input.lat), Number(input.lng)) < 25)
    ) {
      return row;
    }
  }
  const name = (input.gymName || "").trim();
  if (!name) throw new Error("Type the name of your home gym.");
  const pin = await resolveHometown(input.city, input.lat, input.lng);
  try {
    await upsertNearbyGyms(sql, pin.lat, pin.lng, 10);
  } catch {
    /* catalog match below still runs */
  }
  const existing = await sql<{ id: string; name: string; city: string; lat: number; lng: number }>`
    select id, name, city, lat, lng from gyms
  `;
  const want = normGymName(name);
  const pinCity = cityCore(pin.city);
  const scored = existing
    .filter((g) => isRealCoord(num(g.lat), num(g.lng)))
    .map((g) => {
      const d = milesBetween(pin.lat, pin.lng, num(g.lat), num(g.lng));
      const sameName =
        g.name.toLowerCase() === name.toLowerCase() || Boolean(want && normGymName(g.name) === want);
      const sameCity = pinCity && cityCore(g.city) === pinCity;
      const tokenHit =
        Boolean(want) &&
        want.split(" ")[0].length >= 3 &&
        normGymName(g.name).split(" ")[0] === want.split(" ")[0];
      let score = 0;
      if (sameName && d <= 10) score = 3;
      else if (sameName && sameCity && d <= 12) score = 2;
      else if (tokenHit && d <= 1.5) score = 1;
      return { g, d, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.d - b.d);
  if (scored[0]) return scored[0].g;
  const id = `gym_${crypto.randomUUID().slice(0, 10)}`;
  const photo = STYLE_PHOTOS.fitness;
  await sql`
    insert into gyms (
      id, name, gym_type, address, city, lat, lng, photo_url, description, amenities, hours, phone
    ) values (
      ${id}, ${name}, ${"fitness"}, ${pin.city}, ${pin.city}, ${pin.lat}, ${pin.lng},
      ${photo}, ${`${name} in ${pin.city}. Added by a Mittwork trainer.`}, ${"[]"}, ${""}, ${null}
    )
    on conflict (id) do nothing
  `;
  return { id, city: pin.city, lat: pin.lat, lng: pin.lng };
}

export const updateTrainerProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      name: string;
      headline: string;
      bio: string;
      photoUrl: string;
      specialties: string[];
      yearsExp: number;
      gymId?: string;
      gymName?: string;
      city?: string;
      lat?: number;
      lng?: number;
      gallery: MediaItem[];
      locationOptions?: string[];
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const gym = await findOrCreateGym(sql, {
      gymId: data.gymId,
      gymName: data.gymName,
      city: data.city,
      lat: data.lat,
      lng: data.lng,
    });
    const [existing] = await sql<{ id: string }>`
      select id from trainers where user_id = ${context.userId}
    `;
    if (!existing) throw new Error("Create a trainer profile first.");
    await sql`
      update trainers set
        gym_id = ${gym.id},
        name = ${data.name},
        headline = ${data.headline},
        bio = ${data.bio},
        photo_url = ${data.photoUrl},
        specialties = ${JSON.stringify(data.specialties)},
        years_exp = ${data.yearsExp},
        city = ${gym.city},
        lat = ${gym.lat},
        lng = ${gym.lng},
        gallery = ${JSON.stringify(data.gallery)},
        location_options = ${JSON.stringify(parsePlaces(data.locationOptions))}
      where id = ${existing.id} and user_id = ${context.userId}
    `;
    await sql`
      insert into profiles (user_id, role, display_name, photo_url, bio)
      values (${context.userId}, 'trainer', ${data.name}, ${data.photoUrl}, ${data.bio})
      on conflict (user_id) do update set
        role = 'trainer',
        display_name = ${data.name},
        photo_url = ${data.photoUrl},
        bio = ${data.bio}
    `;
    return { ok: true };
  });

export const becomeTrainer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      name: string;
      headline: string;
      bio: string;
      gymId?: string;
      gymName?: string;
      city?: string;
      lat?: number;
      lng?: number;
      specialties: string[];
      serviceName?: string;
      serviceStyle?: string;
      durationMin?: number;
      priceCents?: number;
      photoUrl?: string;
      services?: {
        name: string;
        style: string;
        serviceType: string;
        description: string;
        durationMin: number;
        priceCents: number;
      }[];
      locationOptions?: string[];
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const gym = await findOrCreateGym(sql, {
      gymId: data.gymId,
      gymName: data.gymName,
      city: data.city,
      lat: data.lat,
      lng: data.lng,
    });
    const existing = await sql<{ id: string }>`select id from trainers where user_id = ${context.userId}`;
    const id = existing[0]?.id ?? `tr_${crypto.randomUUID().slice(0, 8)}`;
    const photo = data.photoUrl || "/photos/gyms/training.webp";
    const places = JSON.stringify(parsePlaces(data.locationOptions));
    const offerings = (data.services ?? [])
      .map((s) => ({
        name: s.name.trim(),
        style: s.style || "fitness",
        serviceType: s.serviceType || "one-on-one",
        description: s.description.trim(),
        durationMin: clampDuration(s.durationMin || 60),
        priceCents: Math.max(500, Math.round(s.priceCents)),
      }))
      .filter((s) => s.name);
    if (!offerings.length && data.serviceName?.trim()) {
      offerings.push({
        name: data.serviceName.trim(),
        style: data.serviceStyle || "fitness",
        serviceType: "one-on-one",
        description: data.headline,
        durationMin: clampDuration(data.durationMin || 60),
        priceCents: Math.max(500, Math.round(data.priceCents || 6000)),
      });
    }
    if (!offerings.length) throw new Error("Add at least one service.");
    const from = Math.min(...offerings.map((s) => s.priceCents));
    if (!existing[0]) {
      await sql`
        insert into trainers (
          id, user_id, gym_id, name, headline, bio, photo_url, specialties, years_exp,
          rating, review_count, price_from, city, lat, lng, verified, gallery, location_options
        ) values (
          ${id}, ${context.userId}, ${gym.id}, ${data.name}, ${data.headline}, ${data.bio},
          ${photo}, ${JSON.stringify(data.specialties)}, ${1},
          ${5}, ${0}, ${from}, ${gym.city}, ${gym.lat}, ${gym.lng}, ${false}, ${"[]"}, ${places}
        )
      `;
      for (const d of [1, 2, 3, 4, 5]) {
        await sql`
          insert into availability (trainer_id, weekday, start_min, end_min)
          values (${id}, ${d}, ${16 * 60}, ${20 * 60})
        `;
      }
    } else {
      await sql`
        update trainers set
          gym_id = ${gym.id},
          name = ${data.name},
          headline = ${data.headline},
          bio = ${data.bio},
          photo_url = ${photo},
          specialties = ${JSON.stringify(data.specialties)},
          price_from = ${from},
          city = ${gym.city},
          lat = ${gym.lat},
          lng = ${gym.lng},
          location_options = ${places}
        where id = ${id} and user_id = ${context.userId}
      `;
    }
    const have = await sql<{ id: string }>`select id from services where trainer_id = ${id}`;
    if (!have.length) {
      for (const s of offerings) {
        await sql`
          insert into services (id, trainer_id, name, style, service_type, description, duration_min, price_cents)
          values (
            ${`svc_${crypto.randomUUID().slice(0, 8)}`}, ${id}, ${s.name}, ${s.style},
            ${s.serviceType}, ${s.description || s.name}, ${s.durationMin}, ${s.priceCents}
          )
        `;
      }
    }
    await sql`
      insert into profiles (user_id, role, display_name)
      values (${context.userId}, 'trainer', ${data.name})
      on conflict (user_id) do update set role = 'trainer', display_name = ${data.name}
    `;
    return { trainerId: id };
  });

export const trainerDashboard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const [trainer] = await sql<{ id: string; name: string; photo_url: string }>`
      select id, name, photo_url from trainers where user_id = ${context.userId}
    `;
    if (!trainer) return null;
    const bookings = await sql<{
      id: string;
      start_at: string;
      status: string;
      amount_cents: number;
      fee_cents: number;
      client_name: string | null;
      service_name: string;
    }>`
      select b.id, b.start_at, b.status, b.amount_cents, b.fee_cents, b.client_name, s.name as service_name
      from bookings b
      join services s on s.id = b.service_id
      where b.trainer_id = ${trainer.id}
      order by b.start_at desc
    `;
    const earned = bookings
      .filter((b) => b.status === "confirmed")
      .reduce((sum, b) => sum + (num(b.amount_cents) - num(b.fee_cents)), 0);
    return {
      trainer,
      bookings: bookings.map((b) => ({
        id: b.id,
        startAt: String(b.start_at),
        status: b.status,
        amountCents: num(b.amount_cents),
        feeCents: num(b.fee_cents),
        clientName: b.client_name,
        serviceName: b.service_name,
        payoutCents: num(b.amount_cents) - num(b.fee_cents),
      })),
      earnedCents: earned,
      upcoming: bookings.filter(
        (b) => b.status === "confirmed" && new Date(b.start_at).getTime() > Date.now(),
      ).length,
    };
  });

export const sendBookingMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { bookingId: string; body: string }) => input)
  .handler(async ({ context, data }) => {
    const text = (data.body || "").trim();
    if (!text) throw new Error("Type a message first.");
    const sql = await getSql();
    const [bk] = await sql<{ id: string; user_id: string; trainer_id: string }>`
      select b.id, b.user_id, b.trainer_id from bookings b
      where b.id = ${data.bookingId}
    `;
    if (!bk) throw new Error("Booking not found");
    const [tr] = await sql<{ user_id: string | null }>`
      select user_id from trainers where id = ${bk.trainer_id}
    `;
    const allowed = bk.user_id === context.userId || tr?.user_id === context.userId;
    if (!allowed) throw new Error("Unauthorized");
    const id = `msg_${crypto.randomUUID()}`;
    await sql`
      insert into trainer_messages (id, booking_id, sender_user_id, body)
      values (${id}, ${data.bookingId}, ${context.userId}, ${text})
    `;
    const other = bk.user_id === context.userId ? tr?.user_id : bk.user_id;
    if (other) {
      await sql`
        insert into notifications (id, user_id, title, body, href)
        values (
          ${`nt_${crypto.randomUUID().slice(0, 10)}`}, ${other},
          ${"New message"}, ${text.slice(0, 140)},
          ${`/inbox/${data.bookingId}`}
        )
      `;
    }
    return { id };
  });

export const listBookingMessages = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((bookingId: string) => bookingId)
  .handler(async ({ context, data: bookingId }) => {
    const sql = await getSql();
    const [bk] = await sql<{ user_id: string; trainer_id: string }>`
      select user_id, trainer_id from bookings where id = ${bookingId}
    `;
    if (!bk) return [];
    const [tr] = await sql<{ user_id: string | null }>`
      select user_id from trainers where id = ${bk.trainer_id}
    `;
    if (bk.user_id !== context.userId && tr?.user_id !== context.userId) return [];
    return sql<{ id: string; sender_user_id: string; body: string; created_at: string }>`
      select id, sender_user_id, body, created_at
      from trainer_messages where booking_id = ${bookingId}
      order by created_at asc
    `;
  });

export const listInbox = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const [mine] = await sql<{ id: string | null }>`
      select id from trainers where user_id = ${context.userId} limit 1
    `;
    const rows = await sql<{
      id: string;
      start_at: string;
      status: string;
      service_name: string;
      trainer_name: string;
      trainer_photo: string;
      trainer_id: string;
      client_name: string | null;
      client_photo: string | null;
      user_id: string;
      trainer_user_id: string | null;
      last_body: string | null;
      last_at: string | null;
    }>`
      select b.id, b.start_at, b.status, coalesce(s.name, 'Session') as service_name,
             t.name as trainer_name, t.photo_url as trainer_photo, t.id as trainer_id,
             b.client_name, p.photo_url as client_photo, b.user_id, t.user_id as trainer_user_id,
             (select m.body from trainer_messages m where m.booking_id = b.id order by m.created_at desc limit 1) as last_body,
             (select m.created_at from trainer_messages m where m.booking_id = b.id order by m.created_at desc limit 1) as last_at
      from bookings b
      left join services s on s.id = b.service_id
      join trainers t on t.id = b.trainer_id
      left join profiles p on p.user_id = b.user_id
      where b.user_id = ${context.userId} or t.user_id = ${context.userId}
      order by coalesce(
        (select m.created_at from trainer_messages m where m.booking_id = b.id order by m.created_at desc limit 1),
        b.created_at
      ) desc
      limit 40
    `;
    return rows.map((r) => {
      const iAmTrainer = mine?.id && r.trainer_user_id === context.userId;
      return {
        bookingId: r.id,
        startAt: String(r.start_at),
        status: r.status,
        serviceName: r.service_name,
        otherName: iAmTrainer ? r.client_name || "Client" : r.trainer_name,
        otherPhoto: iAmTrainer ? r.client_photo : publicPhoto(r.trainer_photo, "t", r.trainer_id, "main"),
        lastBody: r.last_body,
        lastAt: r.last_at ? String(r.last_at) : null,
      };
    });
  });

export const getMyAvailability = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const [tr] = await sql<{ id: string }>`select id from trainers where user_id = ${context.userId} limit 1`;
    if (!tr) return [] as { weekday: number; startMin: number; endMin: number }[];
    try {
      const rows = await sql<{ weekday: number; start_min: number; end_min: number }>`
        select weekday, start_min, end_min from availability where trainer_id = ${tr.id} order by weekday, start_min
      `;
      return rows.map((r) => ({ weekday: num(r.weekday), startMin: num(r.start_min), endMin: num(r.end_min) }));
    } catch {
      return [] as { weekday: number; startMin: number; endMin: number }[];
    }
  });

export const saveMyAvailability = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { days: { weekday: number; startMin: number; endMin: number }[] }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const [tr] = await sql<{ id: string }>`select id from trainers where user_id = ${context.userId} limit 1`;
    if (!tr) throw new Error("Create a trainer profile first.");
    await sql`delete from availability where trainer_id = ${tr.id}`;
    for (const d of data.days) {
      if (d.weekday < 0 || d.weekday > 6) continue;
      const start = Math.max(0, Math.min(23 * 60, Math.round(d.startMin)));
      const end = Math.max(start + 30, Math.min(24 * 60, Math.round(d.endMin)));
      await sql`
        insert into availability (trainer_id, weekday, start_min, end_min)
        values (${tr.id}, ${d.weekday}, ${start}, ${end})
      `;
    }
    return { ok: true };
  });

export const claimGym = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { gymId?: string; gymName?: string; description?: string; hours?: string; phone?: string; photoUrl?: string; gallery?: string[] }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const [tr] = await sql<{ gym_id: string }>`select gym_id from trainers where user_id = ${context.userId} limit 1`;
    if (!tr) throw new Error("Publish your trainer profile first, then claim the gym you train out of.");
    const gymId = data.gymId || tr.gym_id;
    if (!gymId) throw new Error("Pick a gym to claim.");
    if (gymId !== tr.gym_id) {
      throw new Error("You can only claim the gym on your trainer profile. Save your profile first.");
    }
    const [g] = await sql<{ id: string; owner_user_id: string | null }>`
      select id, owner_user_id from gyms where id = ${gymId}
    `;
    if (!g) throw new Error("Gym not found.");
    if (g.owner_user_id && g.owner_user_id !== context.userId) {
      throw new Error("Someone else already manages this gym.");
    }
    await sql`
      update gyms set
        owner_user_id = ${context.userId},
        description = coalesce(${data.description?.trim() || null}, description),
        hours = coalesce(${data.hours?.trim() || null}, hours),
        phone = coalesce(${data.phone?.trim() || null}, phone),
        photo_url = coalesce(${data.photoUrl || null}, photo_url),
        gallery = coalesce(${data.gallery ? JSON.stringify(data.gallery) : null}, gallery),
        name = coalesce(${data.gymName?.trim() || null}, name)
      where id = ${gymId}
    `;
    return { ok: true, gymId };
  });

export const getMyGym = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const [g] = await sql<{
      id: string;
      name: string;
      description: string;
      hours: string;
      phone: string | null;
      photo_url: string;
      gallery: unknown;
      city: string;
    }>`
      select id, name, description, hours, phone, photo_url, gallery, city
      from gyms where owner_user_id = ${context.userId} limit 1
    `;
    if (!g) return null;
    const gallery = parseGallery(g.gallery).map((x) => x.url);
    return {
      id: g.id,
      name: g.name,
      description: g.description,
      hours: g.hours,
      phone: g.phone,
      photoUrl: g.photo_url,
      gallery,
      city: g.city,
    };
  });

export const addGymReview = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { gymId: string; rating: number; body: string; authorName?: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rating = Math.min(5, Math.max(1, Math.round(data.rating)));
    const body = data.body.trim();
    if (body.length < 8) throw new Error("Write a bit more about the gym.");
    const name = data.authorName?.trim() || "Mittwork athlete";
    const [gym] = await sql<{ id: string }>`select id from gyms where id = ${data.gymId}`;
    if (!gym) throw new Error("Gym not found.");
    // One review per person per gym: posting again updates your review.
    const [mine] = await sql<{ id: string }>`
      select id from gym_reviews
      where gym_id = ${data.gymId} and user_id = ${context.userId} and source = 'mittwork'
      order by created_at desc limit 1
    `;
    let id = mine?.id ?? `gr_${crypto.randomUUID().slice(0, 10)}`;
    if (mine) {
      await sql`
        update gym_reviews set rating = ${rating}, body = ${body}, author_name = ${name}, created_at = now()
        where id = ${mine.id}
      `;
    } else {
      try {
        await sql`
          insert into gym_reviews (id, gym_id, user_id, author_name, rating, body, source)
          values (${id}, ${data.gymId}, ${context.userId}, ${name}, ${rating}, ${body}, ${"mittwork"})
        `;
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
        const [row] = await sql<{ id: string }>`
          update gym_reviews set rating = ${rating}, body = ${body}, author_name = ${name}, created_at = now()
          where gym_id = ${data.gymId} and user_id = ${context.userId} and source = 'mittwork'
          returning id
        `;
        id = row?.id ?? id;
      }
    }
    const stats = await sql<{ avg: number; n: number }>`
      select avg(rating)::float as avg, count(*)::int as n from gym_reviews where gym_id = ${data.gymId}
    `;
    await sql`
      update gyms set rating = ${stats[0]?.avg ?? rating}, review_count = ${stats[0]?.n ?? 1}
      where id = ${data.gymId}
    `;
    return { id, updated: Boolean(mine) };
  });

export const getEarnings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const empty = {
      stripeEnabled: true,
      trainer: null as null | {
        id: string;
        name: string;
        stripeAccountId: string | null;
        onboarded: boolean;
        email: string | null;
      },
      grossCents: 0,
      feeCents: 0,
      netCents: 0,
      paidOutCents: 0,
      pendingCents: 0,
      platformFeeCents: 0,
      bookings: [] as {
        id: string;
        startAt: string;
        status: string;
        amountCents: number;
        feeCents: number;
        payoutStatus: string;
        clientName: string | null;
        serviceName: string;
        netCents: number;
      }[],
    };
    try {
      const sql = await getSql();
      const [trainer] = await sql<{
        id: string;
        name: string;
        stripe_account_id: string | null;
        stripe_onboarded: boolean;
      }>`
        select id, name, stripe_account_id, stripe_onboarded from trainers where user_id = ${context.userId}
      `;
      const rows = trainer
        ? await sql<{
            id: string;
            start_at: string;
            status: string;
            amount_cents: number;
            fee_cents: number;
            payout_status: string;
            client_name: string | null;
            service_name: string;
          }>`
            select b.id, b.start_at, b.status,
                   coalesce(b.amount_cents, 0)::int as amount_cents,
                   coalesce(b.fee_cents, 0)::int as fee_cents,
                   coalesce(b.payout_status, 'pending') as payout_status,
                   b.client_name, coalesce(s.name, 'Session') as service_name
            from bookings b
            left join services s on s.id = b.service_id
            where b.trainer_id = ${trainer.id}
            order by b.start_at desc
            limit 80
          `
        : [];
      const active = rows.filter((b) => b.status !== "cancelled" && b.status !== "pending_payment");
      const gross = active.reduce((s, b) => s + num(b.amount_cents), 0);
      const fees = active.reduce((s, b) => s + num(b.fee_cents), 0);
      const net = gross - fees;
      const paidOut = active
        .filter((b) => b.payout_status === "paid")
        .reduce((s, b) => s + (num(b.amount_cents) - num(b.fee_cents)), 0);
      return {
        ...empty,
        trainer: trainer
          ? {
              id: trainer.id,
              name: trainer.name,
              stripeAccountId: trainer.stripe_account_id,
              onboarded: Boolean(trainer.stripe_onboarded),
              email: null,
            }
          : null,
        grossCents: gross,
        feeCents: fees,
        netCents: net,
        paidOutCents: paidOut,
        pendingCents: net - paidOut,
        platformFeeCents: fees,
        bookings: rows.map((b) => ({
          id: b.id,
          startAt: String(b.start_at),
          status: b.status,
          amountCents: num(b.amount_cents),
          feeCents: num(b.fee_cents),
          payoutStatus: b.payout_status,
          clientName: b.client_name,
          serviceName: b.service_name,
          netCents: num(b.amount_cents) - num(b.fee_cents),
        })),
      };
    } catch {
      return empty;
    }
  });

export const createStripeCheckout = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      trainerId: string;
      serviceId: string;
      startAt: string;
      notes?: string;
      clientName?: string;
      origin: string;
      durationMin?: number;
      locationType?: string;
      locationNote?: string;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await expireStaleHolds(sql);
    const { getStripe, splitAmount, stripeEnabled } = await import("@/lib/server/stripe");
    const [svc] = await sql<{ id: string; name: string; price_cents: number; trainer_id: string; duration_min: number }>`
      select id, name, price_cents, trainer_id, duration_min from services where id = ${data.serviceId}
    `;
    if (!svc || svc.trainer_id !== data.trainerId) throw new Error("Service not found");
    const [trainer] = await sql<{
      name: string;
      gym_id: string;
      stripe_account_id: string | null;
      stripe_onboarded: boolean;
      location_options: unknown;
    }>`
      select name, gym_id, stripe_account_id, stripe_onboarded, location_options from trainers where id = ${data.trainerId}
    `;
    if (!trainer) throw new Error("Trainer not found");
    const duration = clampDuration(data.durationMin ?? num(svc.duration_min, 60));
    const windows = await trainerWindows(sql, data.trainerId);
    const invalid = validateBookingStart(data.startAt, duration, windows, Date.now());
    if (invalid) throw new Error(invalid);
    const startMs = new Date(data.startAt).getTime();
    const endMs = startMs + duration * 60_000;
    const clashRows = await sql<{ start_at: string; duration_min: number | null; status: string; created_at: string }>`
      select start_at, duration_min, status, created_at from bookings
      where trainer_id = ${data.trainerId} and status != 'cancelled'
        and start_at >= ${new Date(startMs - 4 * 3600_000).toISOString()}
        and start_at < ${new Date(endMs).toISOString()}
    `;
    const holdCutoff = Date.now() - 30 * 60_000;
    const clash = clashRows.some((b) => {
      if (b.status === "pending_payment" && new Date(b.created_at).getTime() < holdCutoff) return false;
      const a = new Date(b.start_at).getTime();
      const z = a + num(b.duration_min, 60) * 60_000;
      return startMs < z && endMs > a;
    });
    if (clash) throw new Error(SLOT_TAKEN);
    const amount = priceForDuration(num(svc.price_cents), num(svc.duration_min, 60), duration);
    const { feeCents, trainerCents } = splitAmount(amount);
    const chargeCents = stripeGrossCharge(amount);
    const id = `bk_${crypto.randomUUID()}`;
    const name = data.clientName?.trim() || "Client";
    const loc = data.locationType || "trainer_gym";
    const offered = parsePlaces(trainer.location_options);
    if (offered.length && !offered.includes(loc as SessionPlaceId)) {
      throw new Error("That trainer doesn’t offer that location.");
    }
    const locNote = data.locationNote?.trim() || null;
    if (placeNeedsWhere(loc) && !locNote) {
      throw new Error("Add the gym, address, or park for this session.");
    }

    // Never confirm a booking without payment. If Stripe isn't configured the
    // site can't take bookings yet.
    if (!(await stripeEnabled())) {
      throw new Error("Bookings aren’t open yet — payments are still being set up. Please check back soon.");
    }

    const stripe = await getStripe();
    if (!stripe) throw new Error("Stripe is not connected.");
    if (!trainer.stripe_account_id) {
      throw new Error("This coach isn’t taking payments yet.");
    }
    let destination = trainer.stripe_account_id;
    try {
      const acct = await stripe.accounts.retrieve(trainer.stripe_account_id);
      if (!acct.charges_enabled) {
        throw new Error("This coach isn’t taking payments yet.");
      }
      destination = trainer.stripe_account_id;
      await sql`
        update trainers
        set stripe_onboarded = ${Boolean(acct.charges_enabled && acct.payouts_enabled)}
        where id = ${data.trainerId}
      `;
    } catch (err) {
      if (err instanceof Error && err.message.includes("isn’t taking payments")) throw err;
      throw new Error("This coach isn’t taking payments yet.");
    }

    try {
      await sql`
        insert into bookings (
          id, user_id, trainer_id, service_id, gym_id, start_at, status,
          amount_cents, fee_cents, notes, client_name, payout_status, duration_min, location_type, location_note
        ) values (
          ${id}, ${context.userId}, ${data.trainerId}, ${data.serviceId}, ${trainer.gym_id},
          ${new Date(startMs).toISOString()}, 'pending_payment', ${amount}, ${feeCents}, ${data.notes ?? null}, ${name}, ${"pending"}, ${duration}, ${loc}, ${locNote}
        )
      `;
    } catch (err) {
      // bookings_trainer_slot_active_uidx (migration 0010) rejects a second
      // active booking for the same trainer + start time.
      if (isUniqueViolation(err)) throw new Error(SLOT_TAKEN);
      throw err;
    }

    const origin = safeAppOrigin(data.origin);
    const params: Record<string, unknown> = {
      mode: "payment",
      payment_method_types: ["card"],
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      success_url: `${origin}/bookings?paid=${id}`,
      cancel_url: `${origin}/trainers/${data.trainerId}?canceled=1`,
      client_reference_id: id,
      metadata: { bookingId: id, trainerId: data.trainerId, destination },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: chargeCents,
            product_data: {
              name: `${svc.name} (${duration} min) with ${trainer.name}`,
              description: "Session + card processing. 92% to trainer, 8% Mittwork.",
            },
          },
        },
      ],
      payment_intent_data: {
        application_fee_amount: chargeCents - trainerCents,
        transfer_data: { destination },
        metadata: { bookingId: id },
      },
    };
    try {
      const session = await stripe.checkout.sessions.create(params as never);
      await sql`update bookings set stripe_session_id = ${session.id} where id = ${id}`;
      return { mode: "stripe" as const, bookingId: id, url: session.url, split: true };
    } catch (err) {
      await sql`
        update bookings set status = 'cancelled', cancelled_at = now(), cancel_kind = 'checkout_failed'
        where id = ${id} and status = 'pending_payment'
      `;
      console.error("checkout session", err);
      throw new Error("Could not start checkout. Try another time slot.");
    }
  });

export async function notifyBookingConfirmed(bookingId: string) {
  const sql = await getSql();
  await notifyBooking(sql, bookingId);
}

export const confirmPaidBooking = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((bookingId: string) => bookingId)
  .handler(async ({ context, data: bookingId }) => {
    const sql = await getSql();
    const [b] = await sql<{
      id: string;
      user_id: string;
      status: string;
      stripe_session_id: string | null;
    }>`
      select id, user_id, status, stripe_session_id from bookings where id = ${bookingId}
    `;
    if (!b || b.user_id !== context.userId) return { ok: false };
    if (!b.stripe_session_id) return { ok: false };
    const { getStripe } = await import("@/lib/server/stripe");
    const stripe = await getStripe();
    const session = await stripe?.checkout.sessions.retrieve(b.stripe_session_id);
    if (!session || session.payment_status !== "paid") return { ok: false };
    if (b.status === "pending_payment") {
      await sql`update bookings set status = 'confirmed', payout_status = 'pending' where id = ${bookingId}`;
      await notifyBooking(sql, bookingId);
    }
    return { ok: true };
  });

export const startTrainerPayouts = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { origin: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { getStripe, stripeEnabled, stripeErrorMessage } = await import("@/lib/server/stripe");
    if (!(await stripeEnabled())) {
      throw new Error("Mittwork payments aren’t live yet.");
    }
    const [trainer] = await sql<{
      id: string;
      name: string;
      stripe_account_id: string | null;
      stripe_onboarded: boolean;
    }>`
      select id, name, stripe_account_id, stripe_onboarded from trainers where user_id = ${context.userId}
    `;
    if (!trainer) throw new Error("Create a trainer profile first, then tap Sign in with Stripe.");
    const stripe = await getStripe();
    if (!stripe) throw new Error("Stripe is not connected.");

    let email: string | undefined;
    try {
      const [row] = await sql.query<{ email: string | null }>(
        `select email from "user" where id = $1`,
        [context.userId],
      );
      email = row?.email?.trim() || undefined;
    } catch {
      /* email is optional */
    }

    let accountId = trainer.stripe_account_id;
    if (!accountId) {
      try {
        const account = await stripe.accounts.create({
          type: "express",
          email,
          metadata: { trainerId: trainer.id, userId: context.userId },
          capabilities: { transfers: { requested: true }, card_payments: { requested: true } },
          business_profile: {
            name: trainer.name,
            product_description: "Personal combat-sports training on Mittwork",
          },
        });
        accountId = account.id;
        await sql`update trainers set stripe_account_id = ${accountId} where id = ${trainer.id}`;
      } catch (err) {
        throw new Error(stripeErrorMessage(err));
      }
    }

    const origin = safeAppOrigin(data.origin);
    const refresh = `${origin}/earnings?refresh=1`;
    const ret = `${origin}/earnings?connected=1`;

    try {
      const acct = await stripe.accounts.retrieve(accountId);
      const ready = Boolean(acct.charges_enabled && acct.payouts_enabled);
      await sql`update trainers set stripe_onboarded = ${ready} where id = ${trainer.id}`;
      if (ready) {
        const login = await stripe.accounts.createLoginLink(accountId);
        return { url: login.url };
      }
    } catch {
      /* still needs onboarding */
    }

    try {
      const link = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: refresh,
        return_url: ret,
        type: "account_onboarding",
        collection_options: { fields: "eventually_due" },
      });
      if (!link.url) throw new Error("Stripe did not return an onboarding link.");
      return { url: link.url };
    } catch (err) {
      throw new Error(stripeErrorMessage(err));
    }
  });
