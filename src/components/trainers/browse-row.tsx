import { Calendar, Star } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { TrainerCard as T } from "@/lib/server/queries";
import { formatMiles, formatPrice } from "@/lib/utils";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function bucks(cents: number) {
  if (cents < 4500) return "$";
  if (cents < 8500) return "$$";
  return "$$$";
}

export function BrowseRow({ trainer: t, showDistance }: { trainer: T; showDistance: boolean }) {
  const shots = [t.photoUrl, ...t.gallery.filter((u) => u !== t.photoUrl)].slice(0, 4);
  while (shots.length < 4) shots.push(t.photoUrl);
  const today = new Date().getDay();

  return (
    <Link to="/trainers/$id" params={{ id: t.id }} className="block space-y-3 py-4">
      <div className="flex items-start gap-3">
        <img src={t.photoUrl} alt="" className="size-14 shrink-0 rounded-full object-cover object-top" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold">{t.name}</p>
              <p className="mt-0.5 inline-flex items-center gap-1 text-sm font-semibold">
                <Star className="size-3.5 fill-cta text-cta" />
                <span>{t.rating.toFixed(1)}</span>
                <span className="font-normal text-subtle">({t.reviewCount})</span>
              </p>
              <p className="truncate text-sm text-muted">{t.gymName}</p>
              <p className="text-sm text-subtle">
                {t.city}
                <span className="text-subtle"> · {bucks(t.priceFrom)}</span>
              </p>
            </div>
            {showDistance && (
              <p className="shrink-0 text-sm tabular-nums text-muted">{formatMiles(t.miles)}</p>
            )}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {shots.map((src, i) => (
          <img key={`${src}-${i}`} src={src} alt="" className="aspect-square w-full rounded-md object-cover object-top" />
        ))}
      </div>
      <div>
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <Calendar className="size-4 text-muted" />
          {t.availableNow ? "Available Now" : `From ${formatPrice(t.priceFrom)}`}
        </p>
        <div className="mt-2 flex justify-between text-xs text-subtle">
          {DOW.map((d, i) => (
            <span key={d} className={t.openDays.includes(i) || i === today ? "text-fg" : "text-subtle/50"}>
              {d}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
