import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Search as SearchIcon, Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BrowseRow } from "@/components/trainers/browse-row";
import { CitySearch } from "@/components/location/city-search";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { DISTANCE_OPTIONS, STYLES } from "@/lib/catalog";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useOrigin } from "@/lib/origin";
import { listGyms, listTrainers } from "@/lib/server/queries";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedCallback } from "@/lib/use-debounced-callback";
import { useNearbyGymsRefresh } from "@/lib/use-nearby-gyms-refresh";

type Search = {
  q?: string;
  style?: string;
  serviceType?: string;
  city?: string;
  maxMiles?: number;
  availableNow?: boolean;
  minPrice?: number;
  maxPrice?: number;
};

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length ? v : undefined;
}
function num(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

export const Route = createFileRoute("/search")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    q: str(s.q),
    style: str(s.style),
    serviceType: str(s.serviceType),
    city: str(s.city),
    maxMiles: num(s.maxMiles),
    availableNow: s.availableNow === true || s.availableNow === "true" || s.availableNow === "1" ? true : undefined,
    minPrice: num(s.minPrice),
    maxPrice: num(s.maxPrice),
  }),
  component: SearchPage,
});

function SearchPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const origin = useOrigin();
  const { user } = useCurrentUserState();
  const [locOpen, setLocOpen] = useState(false);
  // Typing updates local state instantly; the URL (and the queries keyed on it)
  // follow 300 ms after the last keystroke, replacing the history entry.
  const [text, setText] = useState(search.q ?? "");
  const committed = useRef(search.q ?? "");
  useEffect(() => {
    // Only adopt URL changes we didn't make ourselves (e.g. Back button).
    const q = search.q ?? "";
    if (q !== committed.current) {
      committed.current = q;
      setText(q);
    }
  }, [search.q]);
  const commitText = useDebouncedCallback((value: string) => {
    committed.current = value.trim();
    patch({ q: value.trim() || undefined }, true);
  }, 300);

  const trainers = useQuery({
    queryKey: ["trainers", search, origin.lat, origin.lng, origin.hasPlace],
    enabled: origin.hydrated,
    placeholderData: (prev) => prev,
    queryFn: () =>
      listTrainers({
        data: {
          q: search.q,
          style: search.style,
          availableNow: search.availableNow,
          maxPrice: search.maxPrice,
          lat: origin.lat,
          lng: origin.lng,
          maxMiles: search.maxMiles === 0 ? undefined : (search.maxMiles ?? (origin.hasPlace ? 100 : undefined)),
          hasPlace: origin.hasPlace,
        },
      }),
  });
  const gymMiles = search.maxMiles === 0 ? undefined : origin.hasPlace ? (search.maxMiles ?? 25) : undefined;
  useNearbyGymsRefresh(origin, gymMiles ?? 25);
  const gyms = useQuery({
    queryKey: ["gyms-browse", origin.lat, origin.lng, origin.hasPlace, search.q, gymMiles],
    enabled: origin.hydrated,
    placeholderData: (prev) => prev,
    queryFn: () =>
      listGyms({
        data: {
          q: search.q,
          lat: origin.lat,
          lng: origin.lng,
          hasPlace: origin.hasPlace,
          maxMiles: gymMiles,
          limit: 16,
        },
      }),
  });

  function patch(next: Partial<Search>, replace = false) {
    void navigate({
      replace,
      search: (prev) => {
        const merged = { ...prev, ...next };
        return Object.fromEntries(
          Object.entries(merged).filter(([, v]) => v !== undefined && v !== "" && v !== false),
        ) as Search;
      },
    });
  }

  const list = trainers.data ?? [];
  const shops = (gyms.data ?? []).slice(0, 16);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <Input
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              commitText(e.target.value);
            }}
            placeholder="Search trainers, gyms, or services"
            className="pl-11"
            aria-label="Search"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          setLocOpen((v) => !v);
          if (!origin.hasPlace) origin.locate();
        }}
        className="flex h-12 w-full items-center gap-3 rounded-full bg-elevated px-4 text-left text-sm shadow-[var(--shadow-border)]"
      >
        <MapPin className="size-4 text-subtle" />
        <span className={origin.hasPlace ? "text-fg" : "text-subtle"}>
          {origin.locating ? "Finding you…" : origin.hasPlace ? origin.label : "Current Location"}
        </span>
      </button>
      {locOpen && (
        <CitySearch
          value={origin.hasPlace ? origin.label : ""}
          onSelect={(p) => {
            origin.setPlace(p);
            setLocOpen(false);
          }}
          placeholder="Any city in the world"
        />
      )}

      <div className="chip-row">
        <Chip active={search.maxMiles == null} onClick={() => patch({ maxMiles: undefined })}>
          Nearby
        </Chip>
        {DISTANCE_OPTIONS.filter((d) => d > 0).map((d) => (
          <Chip key={d} active={search.maxMiles === d} onClick={() => patch({ maxMiles: d })}>
            {d} mi
          </Chip>
        ))}
        <Chip active={search.maxMiles === 0} onClick={() => patch({ maxMiles: 0 })}>
          Any
        </Chip>
        <Chip active={search.maxPrice === 80} onClick={() => patch({ maxPrice: search.maxPrice === 80 ? undefined : 80 })}>
          Price
        </Chip>
        <Chip active={!!search.availableNow} onClick={() => patch({ availableNow: search.availableNow ? undefined : true })}>
          Available
        </Chip>
        {STYLES.slice(0, 6).map((s) => (
          <Chip key={s.id} active={search.style === s.id} onClick={() => patch({ style: search.style === s.id ? undefined : s.id })}>
            {s.label}
          </Chip>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em]">Gyms</h2>
        {(!origin.hydrated || gyms.isPending) && shops.length === 0 ? (
          <div className="flex gap-3 overflow-hidden" aria-label="Loading gyms">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-36 w-36 shrink-0 rounded-xl" />
            ))}
          </div>
        ) : shops.length === 0 ? (
          <p className="text-sm text-muted">No gyms in range yet. Set your city above, or check the map tab.</p>
        ) : (
          <div className="flex min-w-0 gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {shops.map((g) => (
              <Link
                key={g.id}
                to="/gyms/$id"
                params={{ id: g.id }}
                className="w-36 shrink-0"
              >
                <div className="relative overflow-hidden rounded-xl bg-elevated">
                  <img
                    src={g.gallery[0] || g.photoUrl}
                    alt=""
                    width={144}
                    height={144}
                    loading="lazy"
                    decoding="async"
                    className="h-36 w-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                    <p className="line-clamp-2 text-[13px] font-semibold leading-tight">{g.name}</p>
                  </div>
                </div>
                <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-cta px-1.5 py-0.5 text-[11px] font-semibold text-cta-fg">
                  <Star className="size-3 fill-current" />
                  {(g.rating ?? 5).toFixed(1)} ({g.reviewCount || g.trainerCount})
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em]">Trainers</h2>
        {(!origin.hydrated || trainers.isPending) && list.length === 0 ? (
          <div className="mt-3 space-y-3" aria-label="Loading trainers">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No trainers match. Clear a filter or pick a closer city.</p>
        ) : (
          <ul className="divide-y divide-border">
            {list.slice(0, 40).map((t) => (
              <li key={t.id}>
                <BrowseRow trainer={t} showDistance={origin.hasPlace} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {!user && <div className="h-16 md:hidden" aria-hidden="true" />}
      {!user && (
        <div
          className="fixed inset-x-0 z-30 px-4 md:hidden"
          style={{ bottom: "calc(var(--app-nav-h, 4.5rem) + env(safe-area-inset-bottom, 0px))" }}
        >
          <a
            href="/login?redirect=/search"
            className="flex h-14 items-center justify-center rounded-full bg-cta text-[15px] font-semibold tracking-[0.16em] text-cta-fg shadow-lg"
          >
            LOGIN / SIGNUP
          </a>
        </div>
      )}
    </div>
  );
}
