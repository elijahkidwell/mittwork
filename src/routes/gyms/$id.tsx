import { FormEvent, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, MapPin, Phone, Star } from "lucide-react";
import { toast } from "sonner";
import { BrowseRow } from "@/components/trainers/browse-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { gymTypeLabel } from "@/lib/catalog";
import { mapsButtonLabel, openNativeMaps } from "@/lib/maps";
import { addGymReview, getGym } from "@/lib/server/queries";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/gyms/$id")({ component: GymPage });

function GymPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { user } = useCurrentUserState();
  const q = useQuery({
    queryKey: ["gym", id],
    queryFn: () => getGym({ data: id }),
  });
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [hero, setHero] = useState<string | null>(null);

  if (q.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-8 w-64" />
      </div>
    );
  }
  if (!q.data) {
    return (
      <p className="py-16 text-center text-sm text-muted">
        Gym not found.{" "}
        <Link to="/search" className="text-primary">
          Browse trainers
        </Link>
      </p>
    );
  }

  const { gym, trainers, reviews } = q.data;
  const shots = [gym.photoUrl, ...(gym.gallery ?? [])].filter((u, i, a) => u && a.indexOf(u) === i);
  const cover = hero || shots[0];

  async function onReview(e: FormEvent) {
    e.preventDefault();
    if (!user) {
      toast.error("Sign in to leave a review.");
      return;
    }
    setBusy(true);
    try {
      await addGymReview({
        data: { gymId: id, rating, body, authorName: user.displayName || undefined },
      });
      setBody("");
      await qc.invalidateQueries({ queryKey: ["gym", id] });
      toast.success("Review posted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not post.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-full space-y-6 overflow-x-hidden">
      <div className="overflow-hidden rounded-xl bg-elevated">
        <img src={cover} alt="" className="h-56 w-full object-cover sm:h-72" />
      </div>
      {shots.length > 1 && (
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {shots.map((src) => (
            <button key={src.slice(0, 48)} type="button" onClick={() => setHero(src)} className="shrink-0">
              <img src={src} alt="" className="h-16 w-24 rounded-md object-cover" />
            </button>
          ))}
        </div>
      )}
      <div>
        <Badge>{gymTypeLabel(gym.gymType)}</Badge>
        <h1 className="mt-2 font-display text-3xl tracking-wide">{gym.name}</h1>
        {gym.rating ? (
          <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-cta px-2 py-0.5 text-xs font-semibold text-cta-fg">
            <Star className="size-3 fill-current" />
            {gym.rating.toFixed(1)}
            {gym.reviewCount ? ` (${gym.reviewCount})` : ""}
          </p>
        ) : null}
        <p className="mt-2 max-w-prose text-sm text-muted">{gym.wikiExtract || gym.description}</p>
        <p className="mt-3 flex items-center gap-1.5 text-sm text-subtle">
          <MapPin className="size-4 shrink-0" />
          <span>
            {gym.address}
            {gym.city && !gym.address.includes(gym.city) ? `, ${gym.city}` : ""}
          </span>
        </p>
        {gym.phone && (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-subtle">
            <Phone className="size-4" />
            <a href={`tel:${gym.phone}`}>{gym.phone}</a>
          </p>
        )}
        {gym.hours ? <p className="mt-1 text-sm text-subtle">{gym.hours}</p> : null}
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <button
            type="button"
            className="inline-flex items-center gap-1 text-primary"
            onClick={() =>
              openNativeMaps({
                lat: gym.lat,
                lng: gym.lng,
                name: gym.name,
                city: gym.city,
                address: gym.address,
              })
            }
          >
            Open in {mapsButtonLabel()} <ExternalLink className="size-3.5" />
          </button>
          {gym.website && gym.website.startsWith("http") && (
            <a href={gym.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary">
              Website <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {gym.amenities.map((a) => (
            <Badge key={a} tone="muted">
              {a}
            </Badge>
          ))}
        </div>
      </div>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em]">Trainers here</h2>
        {trainers.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No Mittwork trainers listed at this gym yet.</p>
        ) : (
          <ul className="mt-1 divide-y divide-border">
            {trainers.map((t) => (
              <li key={t.id}>
                <BrowseRow trainer={t} showDistance={false} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em]">Reviews</h2>
        {reviews.length === 0 ? (
          <p className="text-sm text-muted">No reviews yet.</p>
        ) : (
          <ul className="space-y-3">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-lg bg-surface p-4 shadow-[var(--shadow-border)]">
                <p className="text-sm font-medium">{r.authorName}</p>
                <p className="mt-1.5 text-sm text-muted">{r.body}</p>
              </li>
            ))}
          </ul>
        )}
        <form className="space-y-2" onSubmit={(e) => void onReview(e)}>
          <Label>Your review</Label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} minLength={8} required />
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                className={n <= rating ? "text-cta" : "text-subtle"}
              >
                ★
              </button>
            ))}
          </div>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Posting…" : "Post review"}
          </Button>
        </form>
      </section>
    </div>
  );
}
