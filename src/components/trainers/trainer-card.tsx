import { Link } from "@tanstack/react-router";
import { MapPin, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Stars } from "@/components/brand";
import type { TrainerCard as TrainerCardType } from "@/lib/server/queries";
import { styleLabel } from "@/lib/catalog";
import { cn, formatMiles, formatPrice } from "@/lib/utils";

export function TrainerCard({
  trainer,
  featured = false,
  showDistance = true,
}: {
  trainer: TrainerCardType;
  featured?: boolean;
  showDistance?: boolean;
}) {
  return (
    <Link
      to="/trainers/$id"
      params={{ id: trainer.id }}
      className={cn(
        "group block overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-border)]",
        "transition-[transform,box-shadow] duration-200 ease-out hover:shadow-[var(--shadow-border-hover)]",
        featured ? "min-w-[240px]" : "",
      )}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-elevated">
        <img
          src={trainer.photoUrl}
          alt={trainer.name}
          className="size-full object-cover object-top transition-transform duration-300 ease-out group-hover:scale-[1.03]"
        />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-bg/90 to-transparent" />
        {trainer.availableNow && (
          <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full bg-bg/80 px-2 py-1 text-[11px] font-medium text-success">
            <span className="size-1.5 rounded-full bg-success" />
            Available now
          </span>
        )}
        <span className="absolute bottom-2.5 right-2.5 rounded-sm bg-bg/80 px-2 py-1 text-sm font-medium tabular-nums">
          {formatPrice(trainer.priceFrom)}
        </span>
      </div>
      <div className="space-y-1.5 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[15px] font-medium leading-tight">{trainer.name}</h3>
          {trainer.verified && (
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-label="Verified" />
          )}
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <Stars value={trainer.rating} />
          <span className="tabular-nums text-fg">{trainer.rating.toFixed(1)}</span>
          <span className="text-subtle">({trainer.reviewCount})</span>
        </div>
        <p className="line-clamp-2 text-sm text-muted">{trainer.headline}</p>
        <div className="flex flex-wrap gap-1 pt-1">
          {trainer.specialties.slice(0, 3).map((s) => (
            <Badge key={s}>{styleLabel(s)}</Badge>
          ))}
        </div>
        <p className="flex items-center gap-1 pt-0.5 text-xs text-subtle">
          <MapPin className="size-3.5" />
          {trainer.city}
          {showDistance && (
            <span className="text-subtle/80">· {formatMiles(trainer.miles)}</span>
          )}
        </p>
      </div>
    </Link>
  );
}
