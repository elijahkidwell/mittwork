export const SESSION_PLACES = [
  { id: "trainer_gym", label: "Trainer’s gym", needsWhere: false },
  { id: "client_gym", label: "Your gym", needsWhere: true },
  { id: "trainer_home", label: "Trainer’s home", needsWhere: false },
  { id: "client_home", label: "Your home", needsWhere: true },
  { id: "park", label: "Park or outdoor spot", needsWhere: true },
] as const;

export type SessionPlaceId = (typeof SESSION_PLACES)[number]["id"];

export const ALL_PLACE_IDS: SessionPlaceId[] = SESSION_PLACES.map((p) => p.id);

export function placeLabel(id: string) {
  return SESSION_PLACES.find((p) => p.id === id)?.label ?? id;
}

export function placeNeedsWhere(id: string) {
  return SESSION_PLACES.find((p) => p.id === id)?.needsWhere ?? true;
}

export function placeLabelForTrainer(id: string) {
  switch (id) {
    case "trainer_gym":
      return "Your gym";
    case "client_gym":
      return "Client’s gym";
    case "trainer_home":
      return "Your home";
    case "client_home":
      return "Client’s home";
    case "park":
      return "Park or outdoor spot";
    default:
      return placeLabel(id);
  }
}

export function parsePlaces(v: unknown): SessionPlaceId[] {
  let arr: unknown[] = [];
  if (Array.isArray(v)) arr = v;
  else if (typeof v === "string" && v.trim()) {
    try {
      const p = JSON.parse(v);
      if (Array.isArray(p)) arr = p;
    } catch {
      arr = v.split(",").map((s) => s.trim());
    }
  }
  const ids = arr.filter((x): x is SessionPlaceId => ALL_PLACE_IDS.includes(x as SessionPlaceId));
  if (v == null || v === "") return [...ALL_PLACE_IDS];
  return ids;
}
