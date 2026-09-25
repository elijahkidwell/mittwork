export const STYLES = [
  { id: "boxing", label: "Boxing", group: "Striking" },
  { id: "mma", label: "MMA", group: "Striking" },
  { id: "muay-thai", label: "Muay Thai", group: "Striking" },
  { id: "karate", label: "Karate", group: "Striking" },
  { id: "bjj", label: "Brazilian Jiu-Jitsu", group: "Grappling" },
  { id: "wrestling", label: "Wrestling", group: "Grappling" },
  { id: "grappling", label: "Submission Grappling", group: "Grappling" },
  { id: "bodybuilding", label: "Bodybuilding", group: "Strength" },
  { id: "strength", label: "Strength", group: "Strength" },
  { id: "yoga", label: "Yoga / Mobility", group: "Fitness" },
  { id: "fitness", label: "General Fitness", group: "Fitness" },
] as const;

export type StyleId = (typeof STYLES)[number]["id"];

export const GYM_TYPES = [
  { id: "boxing", label: "Boxing gym" },
  { id: "mma", label: "MMA gym" },
  { id: "bjj", label: "Jiu-Jitsu academy" },
  { id: "wrestling", label: "Wrestling room" },
  { id: "muay-thai", label: "Muay Thai" },
  { id: "karate", label: "Karate / traditional" },
  { id: "strength", label: "Strength & bodybuilding" },
  { id: "fitness", label: "Mobility / general" },
] as const;

export type GymTypeId = (typeof GYM_TYPES)[number]["id"];

export const SERVICE_TYPES = [
  { id: "one-on-one", label: "One-on-one" },
  { id: "group", label: "Group class" },
  { id: "mittwork", label: "Mitt work" },
  { id: "grappling-drills", label: "Grappling drills" },
  { id: "strength", label: "Strength training" },
  { id: "sparring", label: "Technical sparring" },
] as const;

export const DISTANCE_OPTIONS = [5, 10, 25, 50, 100] as const;


export const STYLE_PHOTOS: Record<string, string> = {
  boxing: "/photos/gyms/boxing-ring.webp",
  mma: "/photos/gyms/mma-cage.webp",
  "muay-thai": "/photos/styles/muay-thai.webp",
  karate: "/photos/gyms/martial-arts.webp",
  bjj: "/photos/styles/bjj.webp",
  wrestling: "/photos/gyms/wrestling.webp",
  grappling: "/photos/styles/grappling.webp",
  bodybuilding: "/photos/styles/bodybuilding-lift.webp",
  strength: "/photos/styles/strength.webp",
  yoga: "/photos/styles/yoga.webp",
  fitness: "/photos/styles/fitness.webp",
};

export function styleLabel(id: string): string {
  return STYLES.find((s) => s.id === id)?.label ?? id;
}

export function gymTypeLabel(id: string): string {
  return GYM_TYPES.find((s) => s.id === id)?.label ?? id;
}

export function serviceTypeLabel(id: string): string {
  return SERVICE_TYPES.find((s) => s.id === id)?.label ?? id;
}
