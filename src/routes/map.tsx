import { useEffect, useMemo, useRef, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Navigation, Users } from "lucide-react";
import { GymMap } from "@/components/map/gym-map";
import { PlaceThumb } from "@/components/map/place-thumb";
import { CitySearch } from "@/components/location/city-search";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { DISTANCE_OPTIONS, GYM_TYPES, gymTypeLabel } from "@/lib/catalog";
import { mapsButtonLabel, openNativeMaps } from "@/lib/maps";
import { useOrigin } from "@/lib/origin";
import { listGyms } from "@/lib/server/queries";
import { cn, formatMiles } from "@/lib/utils";
import { useDebouncedCallback } from "@/lib/use-debounced-callback";
import { useNearbyGymsRefresh } from "@/lib/use-nearby-gyms-refresh";

/** The map and list show at most this many gyms (nearest first). */
const MAP_LIMIT = 150;
/** Sidebar rows rendered up front; more on demand. */
const LIST_PAGE = 30;

type MapSearch = { gymType?: string; maxMiles?: number; q?: string };

function parseMiles(v: unknown): number | undefined {
  if (v === 0 || v === "0" || v === "any") return 0;
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export const Route = createFileRoute("/map")({
  validateSearch: (s: Record<string, unknown>): MapSearch => ({
    gymType: typeof s.gymType === "string" && s.gymType ? s.gymType : undefined,
    maxMiles: parseMiles(s.maxMiles),
    q: typeof s.q === "string" && s.q ? s.q : undefined,
  }),
  component: MapPage,
});

function MapPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const origin = useOrigin();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const range = search.maxMiles;
  const maxMiles = range === 0 ? undefined : (range ?? (origin.hasPlace ? 25 : undefined));
  const anyDistance = range === 0 || (!origin.hasPlace && range == null);

  const radius = origin.hasPlace && !anyDistance ? (maxMiles ?? 25) : undefined;
  const { importing } = useNearbyGymsRefresh(origin, radius ?? 25);
  const [text, setText] = useState(search.q ?? "");
  const committed = useRef(search.q ?? "");
  useEffect(() => {
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
  const [shown, setShown] = useState(LIST_PAGE);

  const query = useQuery({
    queryKey: ["gyms-map", search.gymType, search.q, origin.lat, origin.lng, origin.hasPlace, radius],
    enabled: origin.hydrated,
    // Keep showing the current gyms while a new filter/city loads.
    placeholderData: (prev) => prev,
    queryFn: () =>
      listGyms({
        data: {
          gymType: search.gymType,
          lat: origin.lat,
          lng: origin.lng,
          q: search.q,
          hasPlace: origin.hasPlace,
          maxMiles: radius,
          limit: MAP_LIMIT,
        },
      }),
  });

  const gyms = useMemo(() => query.data ?? [], [query.data]);
  useEffect(() => setShown(LIST_PAGE), [query.data]);
  const loadingFirst = !origin.hydrated || (query.isPending && gyms.length === 0);
  const fallback =
    Boolean(origin.hasPlace && maxMiles != null && gyms.length > 0 && gyms.every((g) => g.miles > maxMiles + 0.25));
  const active = useMemo(() => gyms.find((g) => g.id === activeId) ?? gyms[0], [gyms, activeId]);

  function patch(next: Partial<MapSearch>, replace = false) {
    void navigate({ replace, search: (prev) => ({ ...prev, ...next }) });
  }

  return (
    <div className="space-y-3">
      <div>
        <h1 className="font-display text-3xl tracking-wide">Gym map</h1>
        <p className="text-sm text-muted">
          {origin.hasPlace
            ? `Gyms near ${origin.label}${maxMiles ? ` · ${maxMiles} mi` : ""}`
            : "Pick a city to filter by distance, or browse gyms worldwide."}
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <CitySearch
          className="flex-1"
          value={origin.hasPlace ? origin.label : ""}
          onSelect={(p) => {
            origin.setPlace(p);
            if (search.maxMiles == null) patch({ maxMiles: 25 });
          }}
          placeholder="Search any city in the world"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Chip onClick={() => origin.locate()}>
            <Navigation className="size-3.5" />
            {origin.locating ? "Locating…" : "My location"}
          </Chip>
          {origin.hasPlace && (
            <Chip
              onClick={() => {
                origin.clearPlace();
                patch({ maxMiles: 0 });
              }}
            >
              Anywhere
            </Chip>
          )}
        </div>
      </div>
      <Input
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          commitText(e.target.value);
        }}
        placeholder="Gym name"
        className="h-9 max-w-xs rounded-full"
      />

      <div className="chip-row">
        <Chip active={!search.gymType} onClick={() => patch({ gymType: undefined })}>
          All gyms
        </Chip>
        {GYM_TYPES.map((g) => (
          <Chip
            key={g.id}
            active={search.gymType === g.id}
            onClick={() => patch({ gymType: search.gymType === g.id ? undefined : g.id })}
          >
            {g.label}
          </Chip>
        ))}
      </div>

      <div className="chip-row">
        <Chip active={range === 0 || (!origin.hasPlace && range == null)} onClick={() => patch({ maxMiles: 0 })}>
          Any distance
        </Chip>
        {DISTANCE_OPTIONS.map((d) => (
          <Chip key={d} active={maxMiles === d} onClick={() => patch({ maxMiles: d })}>
            {d} miles
          </Chip>
        ))}
      </div>

      {fallback && (
        <p className="rounded-lg bg-elevated px-3 py-2 text-sm text-muted">
          No gyms within {maxMiles} mi of {origin.label}. Showing the nearest instead — widen the range to include
          more.
        </p>
      )}

      <div className="-mx-4 flex min-h-[70dvh] flex-col overflow-hidden border-y border-border md:mx-0 md:flex-row md:rounded-xl md:border">
        <div className="relative h-[42vh] md:h-auto md:min-h-[640px] md:flex-1">
          {mounted ? (
            <GymMap
              gyms={gyms}
              activeId={active?.id ?? null}
              onSelect={setActiveId}
              origin={origin}
              maxMiles={maxMiles}
            />
          ) : (
            <Skeleton className="size-full rounded-none" />
          )}
          {(query.isFetching || importing) && (
            <div className="pointer-events-none absolute right-3 top-3 z-[500] rounded-full bg-bg/80 px-3 py-1 text-xs text-muted">
              {importing ? "Finding more gyms…" : "Loading gyms…"}
            </div>
          )}
        </div>
        <aside className="max-h-[40vh] overflow-y-auto border-t border-border md:max-h-[640px] md:w-[340px] md:border-l md:border-t-0">
          {loadingFirst ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          ) : gyms.length === 0 ? (
            <p className="p-5 text-sm text-muted">
              {origin.hasPlace
                ? "No gyms in that range. Widen the distance or pick another city."
                : "Pick a city above to see gyms near you."}
            </p>
          ) : (
            <>
              <p className="px-3 pt-3 text-xs uppercase tracking-wide text-muted">
                {gyms.length >= MAP_LIMIT
                  ? `Closest ${gyms.length} gyms${maxMiles && !fallback ? ` within ${maxMiles} mi` : ""}`
                  : `${gyms.length} gyms${maxMiles && !fallback ? ` within ${maxMiles} mi` : ""}`}
              </p>
              {gyms.slice(0, shown).map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  setActiveId(g.id);
                }}
                className={cn(
                  "flex w-full gap-3 border-b border-border p-3 text-left",
                  g.id === active?.id ? "bg-elevated" : "hover:bg-elevated/60",
                )}
              >
                <PlaceThumb lat={g.lat} lng={g.lng} gymType={g.gymType} className="size-16 shrink-0 rounded-md" />
                <div className="min-w-0">
                  <p className="truncate font-medium">{g.name}</p>
                  <p className="text-xs text-muted">
                    {gymTypeLabel(g.gymType)}
                    {g.rating ? ` · ${g.rating.toFixed(1)} ★` : ""}
                    {g.reviewCount ? ` (${g.reviewCount})` : ""}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-subtle">
                    <MapPin className="size-3" />
                    {g.city || g.address}
                    {origin.hasPlace && (
                      <>
                        <span>·</span>
                        {formatMiles(g.miles)}
                      </>
                    )}
                    <span>·</span>
                    <Users className="size-3" />
                    {g.trainerCount}
                  </p>
                </div>
              </button>
              ))}
              {gyms.length > shown && (
                <button
                  type="button"
                  onClick={() => setShown((n) => n + LIST_PAGE)}
                  className="w-full p-3 text-center text-sm text-primary"
                >
                  Show more ({gyms.length - shown} left)
                </button>
              )}
            </>
          )}
          {active && (
            <div className="flex flex-wrap gap-3 p-3">
              <button
                type="button"
                className="text-sm text-primary"
                onClick={() =>
                  openNativeMaps({
                    lat: active.lat,
                    lng: active.lng,
                    name: active.name,
                    city: active.city,
                  })
                }
              >
                Open in {mapsButtonLabel()}
              </button>
              <Link to="/gyms/$id" params={{ id: active.id }} className="text-sm text-muted">
                Mittwork page
              </Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
