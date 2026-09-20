import type { Sql } from "@/lib/db";
import { milesBetween } from "@/lib/utils";
import { aerialPhoto, isStockGymPhoto } from "@/lib/place-photo";

export { aerialPhoto, isStockGymPhoto, placeThumbUrl, tileXY } from "@/lib/place-photo";

export type OsmGym = {
  id: string;
  name: string;
  gymType: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  photoUrl: string;
  description: string;
  amenities: string;
  hours: string;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviewCount: number;
  yelpUrl: string | null;
  source: string;
  wikiExtract: string | null;
};

const cache = new Map<string, { at: number; gyms: OsmGym[] }>();
const wikiCache = new Map<string, { photo?: string; extract?: string }>();
const TTL = 20 * 60 * 1000;

function gymTypeFrom(name: string, tags: Record<string, string>): string {
  const s = `${name} ${tags.sport ?? ""} ${tags.leisure ?? ""} ${tags.amenity ?? ""}`.toLowerCase();
  if (/box/.test(s)) return "boxing";
  if (/\bmma\b|mixed martial|cage/.test(s)) return "mma";
  if (/muay|kickbox/.test(s)) return "muay-thai";
  if (/jiu|bjj|grappling|judo/.test(s)) return "bjj";
  if (/wrestl/.test(s)) return "wrestling";
  if (/karate|taekwondo|tkd|kung|dojo/.test(s)) return "karate";
  if (/yoga|pilates|mobility/.test(s)) return "yoga";
  if (/crossfit|powerlifting|strength|iron|bodybuild/.test(s)) return "strength";
  return "fitness";
}

function bbox(lat: number, lng: number, miles: number) {
  const dlat = miles / 69;
  const dlng = miles / (Math.max(0.2, Math.cos((lat * Math.PI) / 180)) * 69.17);
  return { s: lat - dlat, n: lat + dlat, w: lng - dlng, e: lng + dlng };
}

export function normGymName(name: string) {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|gym|llc|inc|club|academy|studio|center|centre|fitness)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type OverpassEl = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

async function overpass(lat: number, lng: number, miles: number): Promise<OverpassEl[] | null> {
  const { s, n, w, e } = bbox(lat, lng, Math.min(Math.max(miles, 3), 100));
  const box = `${s},${w},${n},${e}`;
  const query = `[out:json][timeout:22];
(
  nwr["leisure"="fitness_centre"](${box});
  nwr["amenity"="gym"](${box});
  nwr["amenity"="dojo"](${box});
  nwr["leisure"="sports_centre"]["sport"~"boxing|martial_arts|wrestling|fitness|kickboxing|judo"](${box});
  nwr["sport"="boxing"](${box});
  nwr["sport"="martial_arts"](${box});
  nwr["sport"="wrestling"](${box});
);
out center tags;`;
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          Accept: "application/json",
          "User-Agent": "Mittwork/1.0 (live gym map)",
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(24000),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { elements?: OverpassEl[] };
      if (Array.isArray(data.elements)) return data.elements;
    } catch {
      /* next mirror */
    }
  }
  return null;
}

function commonsUrl(value: string) {
  const file = value.replace(/^File:/i, "").trim();
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=1200`;
}

async function wikiInfo(name: string, city: string): Promise<{ photo?: string; extract?: string }> {
  const key = `wiki:${name}|${city}`.toLowerCase();
  const hit = wikiCache.get(key);
  if (hit) return hit;

  try {
    const searchUrl =
      "https://en.wikipedia.org/w/api.php?" +
      new URLSearchParams({
        action: "query",
        list: "search",
        srsearch: `${name} ${city} gym`,
        srlimit: "1",
        format: "json",
        origin: "*",
      }).toString();
    const searchRes = await fetch(searchUrl, {
      headers: { "User-Agent": "Mittwork/1.0 (gym photos)", Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (searchRes.ok) {
      const search = (await searchRes.json()) as { query?: { search?: { title: string }[] } };
      const title = search.query?.search?.[0]?.title;
      if (title) {
        const pageUrl =
          "https://en.wikipedia.org/w/api.php?" +
          new URLSearchParams({
            action: "query",
            titles: title,
            prop: "pageimages|extracts",
            pithumbsize: "1200",
            exintro: "1",
            explaintext: "1",
            format: "json",
            origin: "*",
          }).toString();
        const pageRes = await fetch(pageUrl, {
          headers: { "User-Agent": "Mittwork/1.0 (gym photos)", Accept: "application/json" },
          signal: AbortSignal.timeout(5000),
        });
        if (pageRes.ok) {
          const page = (await pageRes.json()) as {
            query?: { pages?: Record<string, { thumbnail?: { source?: string }; extract?: string }> };
          };
          const first = Object.values(page.query?.pages ?? {})[0];
          if (first?.thumbnail?.source || first?.extract) {
            const info = { photo: first.thumbnail?.source, extract: first.extract?.slice(0, 700) };
            wikiCache.set(key, info);
            return info;
          }
        }
      }
    }
  } catch {
    /* fall through */
  }

  const titles = [name, `${name} ${city}`];
  for (const title of titles) {
    try {
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
      const res = await fetch(url, {
        headers: { "User-Agent": "Mittwork/1.0 (gym photos)", Accept: "application/json" },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        type?: string;
        extract?: string;
        thumbnail?: { source?: string };
        originalimage?: { source?: string };
      };
      if (data.type === "disambiguation") continue;
      const photo = data.originalimage?.source || data.thumbnail?.source;
      const extract = data.extract?.slice(0, 700);
      if (photo || extract) {
        const info = { photo, extract };
        wikiCache.set(key, info);
        return info;
      }
    } catch {
      /* next */
    }
  }
  wikiCache.set(key, {});
  return {};
}

async function commonsPhoto(name: string, city: string): Promise<string | undefined> {
  const key = `commons:${name}|${city}`.toLowerCase();
  const hit = wikiCache.get(key);
  if (hit) return hit.photo;
  try {
    const url =
      "https://commons.wikimedia.org/w/api.php?" +
      new URLSearchParams({
        action: "query",
        format: "json",
        origin: "*",
        generator: "search",
        gsrsearch: `${name} ${city} gym`,
        gsrnamespace: "6",
        gsrlimit: "1",
        prop: "imageinfo",
        iiprop: "url",
        iiurlwidth: "1400",
      }).toString();
    const res = await fetch(url, {
      headers: { "User-Agent": "Mittwork/1.0 (gym photos)", Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      wikiCache.set(key, {});
      return undefined;
    }
    const data = (await res.json()) as {
      query?: { pages?: Record<string, { imageinfo?: { thumburl?: string; url?: string }[] }> };
    };
    const first = Object.values(data.query?.pages ?? {})[0];
    const photo = first?.imageinfo?.[0]?.thumburl || first?.imageinfo?.[0]?.url;
    wikiCache.set(key, photo ? { photo } : {});
    return photo;
  } catch {
    wikiCache.set(key, {});
    return undefined;
  }
}

async function websiteOgImage(website: string | null | undefined): Promise<string | undefined> {
  if (!website || !/^https?:\/\//i.test(website)) return undefined;
  const key = `og:${website}`;
  const hit = wikiCache.get(key);
  if (hit) return hit.photo;
  try {
    const res = await fetch(website, {
      headers: {
        "User-Agent": "Mittwork/1.0 (gym photos)",
        Accept: "text/html",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(4500),
    });
    if (!res.ok) {
      wikiCache.set(key, {});
      return undefined;
    }
    const html = (await res.text()).slice(0, 80000);
    const match =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)/i);
    let photo = match?.[1]?.trim();
    if (photo?.startsWith("//")) photo = `https:${photo}`;
    else if (photo?.startsWith("/")) {
      const origin = new URL(website).origin;
      photo = origin + photo;
    }
    if (photo && /^https?:\/\//i.test(photo)) {
      wikiCache.set(key, { photo });
      return photo;
    }
  } catch {
    /* ignore */
  }
  wikiCache.set(key, {});
  return undefined;
}

export async function enrichGym(
  name: string,
  city: string,
  currentPhoto: string,
  website?: string | null,
  lat?: number,
  lng?: number,
) {
  if (currentPhoto.startsWith("http") && !isStockGymPhoto(currentPhoto) && !/arcgisonline/i.test(currentPhoto)) {
    return { photo: currentPhoto, extract: null as string | null };
  }
  const og = await websiteOgImage(website);
  if (og) return { photo: og, extract: null };
  if (currentPhoto.startsWith("http") && !isStockGymPhoto(currentPhoto)) {
    return { photo: currentPhoto, extract: null };
  }
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { photo: aerialPhoto(Number(lat), Number(lng)), extract: null };
  }
  return { photo: currentPhoto, extract: null };
}

function yelpSearchUrl(name: string, city: string) {
  return `https://www.yelp.com/search?find_desc=${encodeURIComponent(name)}&find_loc=${encodeURIComponent(city)}`;
}

function toGym(el: OverpassEl): OsmGym | null {
  const tags = el.tags ?? {};
  const name = (tags.name || tags["name:en"] || "").trim();
  if (!name) return null;
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const city =
    tags["addr:city"] || tags["addr:town"] || tags["addr:suburb"] || tags["addr:village"] || "";
  const street = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
  const region = tags["addr:state"] || tags["addr:province"] || "";
  const postcode = tags["addr:postcode"] || "";
  const address = [street, city, region, postcode].filter(Boolean).join(", ") || name;
  const gymType = gymTypeFrom(name, tags);
  const website = tags.website || tags["contact:website"] || null;
  const phone = tags.phone || tags["contact:phone"] || null;
  const hours = tags.opening_hours || "";
  const yelp =
    tags["contact:yelp"] || (website && /yelp\.com/i.test(website) ? website : yelpSearchUrl(name, city));
  const photo = tags.image || (tags.wikimedia_commons ? commonsUrl(tags.wikimedia_commons) : "");
  const extract = tags.description || tags.note || "";
  const amenities = [
    tags.sport,
    tags.leisure === "fitness_centre" ? "Fitness centre" : "",
    hours ? "Hours listed" : "",
    phone ? "Phone listed" : "",
    website ? "Website" : "",
  ].filter(Boolean);
  const stars = Number(tags.stars);
  return {
    id: `osm_${el.type}_${el.id}`,
    name,
    gymType,
    address,
    city,
    lat: lat as number,
    lng: lng as number,
    photoUrl: photo || aerialPhoto(lat as number, lng as number),
    description:
      extract || `${name}${city ? ` in ${city}` : ""}. Live listing from OpenStreetMap.`,
    amenities: JSON.stringify(amenities.slice(0, 6)),
    hours,
    phone,
    website,
    rating: Number.isFinite(stars) && stars > 0 ? stars : null,
    reviewCount: 0,
    yelpUrl: yelp,
    source: "osm",
    wikiExtract: extract || null,
  };
}

function dedupeLive(gyms: OsmGym[]): OsmGym[] {
  const out: OsmGym[] = [];
  for (const g of gyms) {
    const key = normGymName(g.name);
    const twin = out.find(
      (o) =>
        (key && normGymName(o.name) === key && milesBetween(o.lat, o.lng, g.lat, g.lng) < 0.18) ||
        milesBetween(o.lat, o.lng, g.lat, g.lng) < 0.05,
    );
    if (!twin) {
      out.push(g);
      continue;
    }
    const richer =
      (g.photoUrl.startsWith("http") ? 2 : 0) + (g.hours ? 1 : 0) + (g.phone ? 1 : 0) + (g.website ? 1 : 0);
    const old =
      (twin.photoUrl.startsWith("http") ? 2 : 0) +
      (twin.hours ? 1 : 0) +
      (twin.phone ? 1 : 0) +
      (twin.website ? 1 : 0);
    if (richer > old) out.splice(out.indexOf(twin), 1, { ...g, id: twin.id });
  }
  return out;
}

export async function searchNearbyGyms(lat: number, lng: number, miles: number): Promise<OsmGym[]> {
  const key = `${lat.toFixed(3)}|${lng.toFixed(3)}|${Math.round(miles)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.gyms;

  const elements = await overpass(lat, lng, miles);
  if (!elements) {
    const stale = cache.get(key);
    return stale?.gyms ?? [];
  }
  const mapped: OsmGym[] = [];
  for (const el of elements) {
    if (!el.tags?.name) continue;
    const g = toGym(el);
    if (g) mapped.push(g);
  }
  const out = dedupeLive(mapped).filter((g) => milesBetween(lat, lng, g.lat, g.lng) <= miles + 0.5);
  cache.set(key, { at: Date.now(), gyms: out });
  return out;
}

export async function upsertNearbyGyms(sql: Sql, lat: number, lng: number, miles: number) {
  let gyms: OsmGym[] = [];
  try {
    gyms = await searchNearbyGyms(lat, lng, miles);
  } catch {
    return;
  }
  const existing = await sql<{ id: string; name: string; lat: number; lng: number }>`
    select id, name, lat, lng from gyms
  `;

  for (const g of gyms) {
    const twin = existing.find((e) => {
      const d = milesBetween(Number(e.lat), Number(e.lng), g.lat, g.lng);
      if (d < 0.08) return true;
      return (
        d < 0.2 &&
        (normGymName(e.name) === normGymName(g.name) || e.name.toLowerCase() === g.name.toLowerCase())
      );
    });
    const id = twin?.id ?? g.id;
    await sql`
      insert into gyms (
        id, name, gym_type, address, city, lat, lng, photo_url, description, amenities, hours, phone,
        website, rating, review_count, yelp_url, source, wiki_extract
      ) values (
        ${id}, ${g.name}, ${g.gymType}, ${g.address}, ${g.city}, ${g.lat}, ${g.lng},
        ${g.photoUrl}, ${g.description}, ${g.amenities}, ${g.hours}, ${g.phone},
        ${g.website}, ${g.rating}, ${g.reviewCount}, ${g.yelpUrl}, ${"osm"}, ${g.wikiExtract}
      )
      on conflict (id) do update set
        address = case when gyms.owner_user_id is not null then gyms.address else excluded.address end,
        city = case when gyms.owner_user_id is not null then gyms.city else excluded.city end,
        photo_url = case
          when gyms.owner_user_id is not null then gyms.photo_url
          when gyms.photo_url like '/api/media%' then gyms.photo_url
          when gyms.photo_url like '/uploads%' then gyms.photo_url
          when gyms.photo_url like '/photos/%' then gyms.photo_url
          when gyms.photo_url like 'data:%' then gyms.photo_url
          when gyms.photo_url like 'http%'
            and gyms.photo_url not like '%World_Imagery%'
            then gyms.photo_url
          when excluded.photo_url like 'http%' then excluded.photo_url
          else gyms.photo_url
        end,
        description = case when gyms.owner_user_id is not null then gyms.description else excluded.description end,
        hours = case
          when gyms.owner_user_id is not null then gyms.hours
          else coalesce(nullif(excluded.hours, ''), gyms.hours)
        end,
        phone = case when gyms.owner_user_id is not null then gyms.phone else coalesce(excluded.phone, gyms.phone) end,
        website = case when gyms.owner_user_id is not null then gyms.website else coalesce(excluded.website, gyms.website) end,
        yelp_url = coalesce(excluded.yelp_url, gyms.yelp_url),
        wiki_extract = coalesce(excluded.wiki_extract, gyms.wiki_extract),
        source = gyms.source
    `;
  }
}

export function collapseDuplicateGyms<
  T extends { id: string; name: string; lat: number; lng: number; trainerCount?: number; photoUrl?: string },
>(list: T[]): T[] {
  const out: T[] = [];
  for (const g of list) {
    const key = normGymName(g.name);
    const twin = out.find(
      (o) =>
        milesBetween(o.lat, o.lng, g.lat, g.lng) < 0.16 &&
        (normGymName(o.name) === key || o.name.toLowerCase() === g.name.toLowerCase()),
    );
    if (!twin) {
      out.push(g);
      continue;
    }
    const preferNew =
      (g.trainerCount ?? 0) > (twin.trainerCount ?? 0) ||
      ((g.photoUrl ?? "").startsWith("http") && !(twin.photoUrl ?? "").startsWith("http"));
    if (preferNew) {
      out.splice(out.indexOf(twin), 1, {
        ...g,
        id: twin.id,
        trainerCount: (twin.trainerCount ?? 0) + (g.trainerCount ?? 0),
      });
    } else {
      twin.trainerCount = (twin.trainerCount ?? 0) + (g.trainerCount ?? 0);
    }
  }
  return out;
}
