import { formatLocality } from "@/lib/geo";

export type Place = { label: string; lat: number; lng: number; city: string };

export const FEATURED_CITIES: Place[] = [
  { label: "New York, NY", city: "New York", lat: 40.7128, lng: -74.006 },
  { label: "Los Angeles, CA", city: "Los Angeles", lat: 34.0522, lng: -118.2437 },
  { label: "London, UK", city: "London", lat: 51.5074, lng: -0.1278 },
  { label: "Miami, FL", city: "Miami", lat: 25.7617, lng: -80.1918 },
  { label: "Tokyo, Japan", city: "Tokyo", lat: 35.6762, lng: 139.6503 },
  { label: "Mexico City, Mexico", city: "Mexico City", lat: 19.4326, lng: -99.1332 },
  { label: "Sydney, Australia", city: "Sydney", lat: -33.8688, lng: 151.2093 },
  { label: "Toronto, Canada", city: "Toronto", lat: 43.6532, lng: -79.3832 },
];

/** Instant matches while the worldwide geocoder runs. */
export const MAJOR_CITIES: Place[] = [
  ...FEATURED_CITIES,
  { label: "Temecula, CA", city: "Temecula", lat: 33.4936, lng: -117.1484 },
  { label: "La Jolla, CA", city: "La Jolla", lat: 32.8473, lng: -117.2742 },
  { label: "San Diego, CA", city: "San Diego", lat: 32.7157, lng: -117.1611 },
  { label: "Escondido, CA", city: "Escondido", lat: 33.1192, lng: -117.0864 },
  { label: "Oceanside, CA", city: "Oceanside", lat: 33.1959, lng: -117.3795 },
  { label: "Carlsbad, CA", city: "Carlsbad", lat: 33.1581, lng: -117.3506 },
  { label: "Riverside, CA", city: "Riverside", lat: 33.9806, lng: -117.3755 },
  { label: "Murrieta, CA", city: "Murrieta", lat: 33.5539, lng: -117.2139 },
  { label: "Menifee, CA", city: "Menifee", lat: 33.6784, lng: -117.1668 },
  { label: "Wildomar, CA", city: "Wildomar", lat: 33.5989, lng: -117.2028 },
  { label: "Winchester, CA", city: "Winchester", lat: 33.7069, lng: -117.0845 },
  { label: "Chicago, IL", city: "Chicago", lat: 41.8781, lng: -87.6298 },
  { label: "Houston, TX", city: "Houston", lat: 29.7604, lng: -95.3698 },
  { label: "Austin, TX", city: "Austin", lat: 30.2672, lng: -97.7431 },
  { label: "Las Vegas, NV", city: "Las Vegas", lat: 36.1699, lng: -115.1398 },
  { label: "San Francisco, CA", city: "San Francisco", lat: 37.7749, lng: -122.4194 },
  { label: "Seattle, WA", city: "Seattle", lat: 47.6062, lng: -122.3321 },
  { label: "Boston, MA", city: "Boston", lat: 42.3601, lng: -71.0589 },
  { label: "Philadelphia, PA", city: "Philadelphia", lat: 39.9526, lng: -75.1652 },
  { label: "Phoenix, AZ", city: "Phoenix", lat: 33.4484, lng: -112.074 },
  { label: "Denver, CO", city: "Denver", lat: 39.7392, lng: -104.9903 },
  { label: "Atlanta, GA", city: "Atlanta", lat: 33.749, lng: -84.388 },
  { label: "Dallas, TX", city: "Dallas", lat: 32.7767, lng: -96.797 },
  { label: "Paris, France", city: "Paris", lat: 48.8566, lng: 2.3522 },
  { label: "Berlin, Germany", city: "Berlin", lat: 52.52, lng: 13.405 },
  { label: "Madrid, Spain", city: "Madrid", lat: 40.4168, lng: -3.7038 },
  { label: "Barcelona, Spain", city: "Barcelona", lat: 41.3874, lng: 2.1686 },
  { label: "Rome, Italy", city: "Rome", lat: 41.9028, lng: 12.4964 },
  { label: "Amsterdam, Netherlands", city: "Amsterdam", lat: 52.3676, lng: 4.9041 },
  { label: "Dublin, Ireland", city: "Dublin", lat: 53.3498, lng: -6.2603 },
  { label: "Lisbon, Portugal", city: "Lisbon", lat: 38.7223, lng: -9.1393 },
  { label: "Stockholm, Sweden", city: "Stockholm", lat: 59.3293, lng: 18.0686 },
  { label: "Warsaw, Poland", city: "Warsaw", lat: 52.2297, lng: 21.0122 },
  { label: "Istanbul, Türkiye", city: "Istanbul", lat: 41.0082, lng: 28.9784 },
  { label: "Moscow, Russia", city: "Moscow", lat: 55.7558, lng: 37.6173 },
  { label: "Dubai, UAE", city: "Dubai", lat: 25.2048, lng: 55.2708 },
  { label: "Tel Aviv, Israel", city: "Tel Aviv", lat: 32.0853, lng: 34.7818 },
  { label: "Cairo, Egypt", city: "Cairo", lat: 30.0444, lng: 31.2357 },
  { label: "Lagos, Nigeria", city: "Lagos", lat: 6.5244, lng: 3.3792 },
  { label: "Johannesburg, South Africa", city: "Johannesburg", lat: -26.2041, lng: 28.0473 },
  { label: "Mumbai, India", city: "Mumbai", lat: 19.076, lng: 72.8777 },
  { label: "Delhi, India", city: "Delhi", lat: 28.7041, lng: 77.1025 },
  { label: "Bangkok, Thailand", city: "Bangkok", lat: 13.7563, lng: 100.5018 },
  { label: "Phuket, Thailand", city: "Phuket", lat: 7.8804, lng: 98.3923 },
  { label: "Singapore", city: "Singapore", lat: 1.3521, lng: 103.8198 },
  { label: "Hong Kong", city: "Hong Kong", lat: 22.3193, lng: 114.1694 },
  { label: "Seoul, South Korea", city: "Seoul", lat: 37.5665, lng: 126.978 },
  { label: "Osaka, Japan", city: "Osaka", lat: 34.6937, lng: 135.5023 },
  { label: "Shanghai, China", city: "Shanghai", lat: 31.2304, lng: 121.4737 },
  { label: "Beijing, China", city: "Beijing", lat: 39.9042, lng: 116.4074 },
  { label: "Manila, Philippines", city: "Manila", lat: 14.5995, lng: 120.9842 },
  { label: "Jakarta, Indonesia", city: "Jakarta", lat: -6.2088, lng: 106.8456 },
  { label: "São Paulo, Brazil", city: "São Paulo", lat: -23.5558, lng: -46.6396 },
  { label: "Rio de Janeiro, Brazil", city: "Rio de Janeiro", lat: -22.9068, lng: -43.1729 },
  { label: "Buenos Aires, Argentina", city: "Buenos Aires", lat: -34.6037, lng: -58.3816 },
  { label: "Bogotá, Colombia", city: "Bogotá", lat: 4.711, lng: -74.0721 },
  { label: "Lima, Peru", city: "Lima", lat: -12.0464, lng: -77.0428 },
  { label: "Vancouver, Canada", city: "Vancouver", lat: 49.2827, lng: -123.1207 },
  { label: "Montreal, Canada", city: "Montreal", lat: 45.5019, lng: -73.5674 },
  { label: "Melbourne, Australia", city: "Melbourne", lat: -37.8136, lng: 144.9631 },
  { label: "Auckland, New Zealand", city: "Auckland", lat: -36.8509, lng: 174.7645 },
  { label: "Honolulu, HI", city: "Honolulu", lat: 21.3069, lng: -157.8583 },
];

export function filterMajorCities(q: string): Place[] {
  const n = q.trim().toLowerCase();
  if (!n) return FEATURED_CITIES;
  return MAJOR_CITIES.filter(
    (c) => c.label.toLowerCase().includes(n) || c.city.toLowerCase().includes(n),
  );
}

function isLocality(osmValue?: string) {
  return (
    !osmValue ||
    ["city", "town", "village", "hamlet", "municipality", "suburb", "neighbourhood", "county", "state", "district"].includes(
      osmValue,
    )
  );
}

function toPlace(
  lat: number,
  lng: number,
  p: { name?: string; city?: string; state?: string; country?: string; county?: string },
): Place {
  const label = formatLocality(p);
  const city = p.city || p.name || label.split(",")[0];
  return { label, lat, lng, city };
}

export async function searchPlaces(q: string): Promise<Place[]> {
  const query = q.trim();
  if (query.length < 2) return filterMajorCities(query);
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=8&lang=en`;
    const res = await fetch(url);
    if (!res.ok) return filterMajorCities(query);
    const data = (await res.json()) as {
      features?: {
        geometry: { coordinates: [number, number] };
        properties: {
          name?: string;
          city?: string;
          state?: string;
          country?: string;
          county?: string;
          osm_value?: string;
        };
      }[];
    };
    const remote: Place[] = [];
    for (const f of data.features ?? []) {
      if (!isLocality(f.properties.osm_value)) continue;
      const [lng, lat] = f.geometry.coordinates;
      remote.push(toPlace(lat, lng, f.properties));
    }
    const local = filterMajorCities(query);
    const seen = new Set<string>();
    const out: Place[] = [];
    for (const p of [...local, ...remote]) {
      const key = `${p.lat.toFixed(2)}|${p.lng.toFixed(2)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(p);
    }
    return out.slice(0, 8);
  } catch {
    return filterMajorCities(query);
  }
}

export async function reversePlace(lat: number, lng: number): Promise<Place | null> {
  try {
    const url = `https://photon.komoot.io/reverse?lon=${lng}&lat=${lat}&lang=en`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: {
        properties: { name?: string; city?: string; state?: string; country?: string; county?: string };
      }[];
    };
    const p = data.features?.[0]?.properties;
    if (!p) return null;
    return toPlace(lat, lng, { ...p, name: p.city || p.name });
  } catch {
    return null;
  }
}

export async function geocodeCity(q: string): Promise<Place | null> {
  const query = q.trim();
  if (!query) return null;
  const local = filterMajorCities(query);
  const exact = local.find(
    (c) =>
      c.city.toLowerCase() === query.toLowerCase() ||
      c.label.toLowerCase() === query.toLowerCase() ||
      query.toLowerCase().startsWith(c.city.toLowerCase()),
  );
  if (exact) return exact;
  if (local[0] && query.length >= 3) return local[0];
  const hits = await searchPlaces(query);
  return hits[0] ?? null;
}
