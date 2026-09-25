export type MenuRow = {
  key: string;
  id?: string;
  name: string;
  style: string;
  serviceType: string;
  description: string;
  durationMin: number;
  priceCents: number;
};

export function emptyService(style = "boxing"): MenuRow {
  return {
    key: `new-${Math.random().toString(36).slice(2, 10)}`,
    name: "",
    style,
    serviceType: "one-on-one",
    description: "",
    durationMin: 60,
    priceCents: 6000,
  };
}
