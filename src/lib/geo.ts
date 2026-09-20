import { DEFAULT_ORIGIN } from "@/lib/utils";

export function isRealCoord(lat?: number | null, lng?: number | null) {
  if (lat == null || lng == null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (Math.abs(lat) < 0.05 && Math.abs(lng) < 0.05) return false;
  if (Math.abs(lat - DEFAULT_ORIGIN.lat) < 0.2 && Math.abs(lng - DEFAULT_ORIGIN.lng) < 0.2) return false;
  if (lat < -85 || lat > 85 || lng < -180 || lng > 180) return false;
  return true;
}

const US_STATES: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
  "district of columbia": "DC",
};

function isUsa(country?: string) {
  return /united states|usa|u\.s\.a?\.?$/i.test(country || "");
}

export function stateAbbr(state?: string) {
  const s = (state || "").trim();
  if (!s) return "";
  if (/^[A-Z]{2}$/i.test(s)) return s.toUpperCase();
  return US_STATES[s.toLowerCase()] || s;
}

export function formatLocality(p: {
  name?: string;
  city?: string;
  state?: string;
  country?: string;
  county?: string;
}) {
  const city = (p.city || p.name || p.county || "").trim();
  const country = (p.country || "").trim();
  const state = (p.state || "").trim();
  if ((isUsa(country) || US_STATES[state.toLowerCase()] || /^[A-Z]{2}$/i.test(state)) && city) {
    const abbr = stateAbbr(state) || "USA";
    return `${city}, ${abbr}`;
  }
  if (city && state && country && state !== country) return `${city}, ${state}`;
  if (city && country && city !== country) return `${city}, ${country}`;
  return city || country || "Unknown";
}
