import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Clock, MapPin, Share2, ShieldCheck } from "lucide-react";
import { Checkout } from "@/components/booking/checkout";
import { LazyVideo } from "@/components/media/lazy-video";
import { Stars } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { styleLabel } from "@/lib/catalog";
import { placeLabel } from "@/lib/locations";
import { isVideoUrl, type MediaItem } from "@/lib/media";
import { getTrainer, listSlots, type ServiceRow } from "@/lib/server/queries";
import { toast } from "sonner";
import { cn, formatPrice, laDayIso, laParts, laWallDate, priceForDuration, SESSION_LENGTHS } from "@/lib/utils";

export const Route = createFileRoute("/trainers/$id")({
  component: TrainerPage,
});

function TrainerPage() {
  const { id } = Route.useParams();
  const trainer = useQuery({
    queryKey: ["trainer", id],
    queryFn: () => getTrainer({ data: id }),
  });
  const t = trainer.data;

  const [serviceId, setServiceId] = useState<string | null>(null);
  const [date, setDate] = useState(() => laDayIso(0));
  const [slot, setSlot] = useState<string | null>(null);
  const [pay, setPay] = useState(false);
  const [hero, setHero] = useState<MediaItem | null>(null);
  const [durationMin, setDurationMin] = useState(60);

  const service: ServiceRow | null = useMemo(() => {
    if (!t) return null;
    return t.services.find((s) => s.id === (serviceId ?? t.services[0]?.id)) ?? null;
  }, [t, serviceId]);

  const mins = durationMin || service?.durationMin || 60;
  const livePrice = service ? priceForDuration(service.priceCents, service.durationMin, mins) : 0;

  const slots = useQuery({
    queryKey: ["slots", id, service?.id, date, mins],
    queryFn: () => listSlots({ data: { trainerId: id, serviceId: service!.id, date, durationMin: mins } }),
    enabled: !!service,
  });

  if (trainer.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24" />
      </div>
    );
  }
  if (!t) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted">That trainer is not on Mittwork.</p>
        <Link to="/search" className="mt-3 inline-block text-sm text-primary">
          Browse trainers
        </Link>
      </div>
    );
  }

  const media: MediaItem[] = t
    ? [{ url: t.photoUrl, kind: isVideoUrl(t.photoUrl) ? "video" : "photo" }, ...t.gallery.filter((g) => g.url !== t.photoUrl)]
    : [];
  const photo = hero ?? media[0] ?? { url: t.photoUrl, kind: "photo" as const };
  const trainerName = t.name;
  const days = Array.from({ length: 14 }, (_, i) => {
    const iso = laDayIso(i);
    const p = laParts(laWallDate(...isoToParts(iso), 12, 0));
    return { iso, dow: p.weekday, day: p.day };
  });

  async function share() {
    const url = window.location.href;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: `${trainerName} on Mittwork`, url });
        return;
      } catch (err) {
        // The person closed the share sheet; nothing to report.
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn’t copy the link. Copy it from the address bar.");
    }
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="space-y-5 pb-24 lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-8 lg:pb-0">
      <div className="space-y-5">
        <div className="overflow-hidden rounded-xl bg-elevated">
          {photo.kind === "video" ? (
            <LazyVideo
              src={photo.url}
              poster={photo.poster}
              controls
              className="h-56 w-full object-cover object-top sm:h-72"
            />
          ) : (
            <img src={photo.url} alt={t.name} width={720} height={480} decoding="async" className="h-56 w-full object-cover object-top sm:h-72" />
          )}
        </div>
        {media.length > 1 && (
          <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {media.map((item, i) => (
              <button key={`${i}-${item.url}`} type="button" onClick={() => setHero(item)} className="relative shrink-0">
                {item.kind === "video" ? (
                  <img
                    src={item.poster || t.photoUrl}
                    alt=""
                    width={112}
                    height={80}
                    loading="lazy"
                    decoding="async"
                    className="h-20 w-28 rounded-md object-cover object-top"
                  />
                ) : (
                  <img src={item.url} alt="" width={112} height={80} loading="lazy" decoding="async" className="h-20 w-28 rounded-md object-cover object-top" />
                )}
                {item.kind === "video" && (
                  <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 text-[10px] text-white">Video</span>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <h1 className="font-display text-3xl tracking-wide sm:text-4xl">{t.name}</h1>
            <button
              type="button"
              onClick={() => void share()}
              className="grid size-11 shrink-0 place-items-center rounded-md text-muted hover:bg-elevated hover:text-fg"
              aria-label="Share profile"
            >
              <Share2 className="size-5" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Stars value={t.rating} size="md" />
            <span className="tabular-nums">{t.rating.toFixed(1)}</span>
            <span className="text-subtle">({t.reviewCount})</span>
            {t.verified && (
              <span className="inline-flex items-center gap-1 text-primary">
                <ShieldCheck className="size-4" /> Verified
              </span>
            )}
          </div>
          <p className="text-muted">{t.headline}</p>
          {!t.acceptsPayments && (
            <p className="rounded-lg bg-elevated px-3 py-2 text-sm text-muted">
              Bookings aren’t open for this coach yet. They still need to connect payments, so no sessions can be booked
              right now.
            </p>
          )}
          <p className="flex items-center gap-1.5 text-sm text-subtle">
            <MapPin className="size-4" />
            {t.gymName} · {t.city}
          </p>
          <p className="text-xs text-subtle">
            Trains at: {(t.places ?? []).map(placeLabel).join(" · ") || "Trainer’s gym"}
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {t.specialties.map((s) => (
              <Badge key={s}>{styleLabel(s)}</Badge>
            ))}
          </div>
        </div>

        <section>
          <h2 className="font-display text-2xl tracking-wide">About</h2>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">{t.bio}</p>
          <p className="mt-2 text-xs text-subtle">{t.yearsExp} years coaching · {t.gymHours}</p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl tracking-wide">Reviews</h2>
          {t.reviews.length === 0 ? (
            <p className="text-sm text-muted">No reviews yet.</p>
          ) : (
            <ul className="space-y-3">
              {t.reviews.map((r) => (
                <li key={r.id} className="rounded-lg bg-surface p-4 shadow-[var(--shadow-border)]">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{r.authorName}</p>
                    <Stars value={r.rating} />
                  </div>
                  <p className="mt-1.5 text-sm text-muted">{r.body}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside id="book" className="scroll-mt-20 space-y-4 lg:sticky lg:top-20 lg:self-start">
        <div className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-2xl tracking-wide">Book a session</h2>
          <div className="mt-3 space-y-2">
            {t.services.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setServiceId(s.id);
                  setSlot(null);
                  setDurationMin(s.durationMin);
                }}
                className={cn(
                  "w-full rounded-lg p-3 text-left shadow-[var(--shadow-border)]",
                  (service?.id ?? t.services[0]?.id) === s.id ? "bg-elevated" : "bg-transparent hover:bg-elevated/60",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium">{s.name}</span>
                  <span className="shrink-0 tabular-nums text-sm">{formatPrice(s.priceCents)}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted">{s.description}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-subtle">
                  <Clock className="size-3" />
                  listed {s.durationMin} min · {styleLabel(s.style)}
                </p>
              </button>
            ))}
          </div>

          <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted">Length</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SESSION_LENGTHS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  setDurationMin(n);
                  setSlot(null);
                }}
                className={cn(
                  "h-9 rounded-md px-3 text-sm",
                  mins === n ? "bg-primary text-primary-fg" : "bg-elevated text-muted hover:text-fg",
                )}
              >
                {n} min
              </button>
            ))}
            <label className="flex h-9 items-center gap-1 rounded-md bg-elevated px-2 text-sm text-muted">
              Other
              <input
                type="number"
                min={15}
                max={180}
                step={5}
                value={SESSION_LENGTHS.includes(mins as (typeof SESSION_LENGTHS)[number]) ? "" : mins}
                placeholder="min"
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (n >= 15 && n <= 180) {
                    setDurationMin(n);
                    setSlot(null);
                  }
                }}
                className="w-14 bg-transparent text-base tabular-nums text-fg outline-none"
              />
            </label>
          </div>
          {service && (
            <p className="mt-2 text-sm tabular-nums">
              {mins} min · {formatPrice(livePrice)}
              <span className="text-xs text-subtle"> (from {formatPrice(service.priceCents)} / {service.durationMin} min)</span>
            </p>
          )}

          <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted">Date</p>
          <div className="mt-2 grid w-full min-w-0 grid-cols-7 gap-1.5">
            {days.map((d) => (
              <button
                key={d.iso}
                type="button"
                onClick={() => {
                  setDate(d.iso);
                  setSlot(null);
                }}
                className={cn(
                  "flex h-14 min-w-0 flex-col items-center justify-center rounded-md text-xs",
                  date === d.iso ? "bg-primary text-primary-fg" : "bg-elevated text-muted",
                )}
              >
                <span>{d.dow}</span>
                <span className="text-sm font-medium tabular-nums">{d.day}</span>
              </button>
            ))}
          </div>

          <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted">
            Time <span className="normal-case tracking-normal text-subtle">· shown in Pacific Time (PT)</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {slots.isLoading ? (
              <p className="text-sm text-subtle">Loading times…</p>
            ) : (slots.data ?? []).length === 0 ? (
              <p className="text-sm text-subtle">No openings this day.</p>
            ) : (
              (slots.data ?? []).map((s) => (
                <button
                  key={s.startAt}
                  type="button"
                  onClick={() => setSlot(s.startAt)}
                  className={cn(
                    "h-9 rounded-md px-3 text-sm",
                    slot === s.startAt ? "bg-primary text-primary-fg" : "bg-elevated text-muted hover:text-fg",
                  )}
                >
                  {s.label}
                </button>
              ))
            )}
          </div>

          <Button className="mt-4 w-full" variant="cta" disabled={!service || !slot || !t.acceptsPayments} onClick={() => setPay(true)}>
            {!t.acceptsPayments
              ? "Coach isn’t taking payments yet"
              : slot
                ? `Continue · ${formatPrice(livePrice)}`
                : "Pick a time"}
          </Button>
          <p className="mt-2 text-center text-xs text-subtle">
            {t.acceptsPayments
              ? "Free cancel up to 24 hours before. After that the trainer is paid in full, including no-shows."
              : "This coach still needs to connect Stripe to take bookings. Browse another trainer, or check back soon."}
          </p>
        </div>
      </aside>
      </div>

      {t.acceptsPayments && (
        <div
          className="fixed inset-x-0 z-40 px-4 lg:hidden"
          style={{ bottom: "calc(var(--app-nav-h, 4.5rem) + env(safe-area-inset-bottom, 0px))" }}
        >
          <a
            href="#book"
            className="flex h-12 items-center justify-center rounded-full bg-cta text-sm font-semibold tracking-[0.14em] text-cta-fg"
          >
            BOOK · {formatPrice(t.priceFrom)}
          </a>
        </div>
      )}

      <Checkout
        open={pay}
        onClose={() => setPay(false)}
        trainerName={t.name}
        trainerId={t.id}
        service={service}
        startAt={slot}
        durationMin={mins}
        places={t.places}
      />
    </div>
  );
}

function isoToParts(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, m, d];
}
