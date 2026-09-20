import { cn } from "@/lib/utils";

/** Exact brand mark from the Mittwork lockup. */
export function MittIcon({ className }: { className?: string }) {
  return (
    <img
      src="/logo-mark.png"
      alt=""
      className={cn("h-8 w-auto shrink-0", className)}
      draggable={false}
    />
  );
}

export function Logo({
  compact = false,
  alwaysShow = false,
  stacked = false,
  className,
}: {
  compact?: boolean;
  alwaysShow?: boolean;
  stacked?: boolean;
  className?: string;
}) {
  if (stacked) {
    return (
      <span className={cn("inline-flex flex-col items-center gap-2", className)}>
        <img src="/logo-mark.png" alt="" className="h-12 w-auto max-w-[72px] object-contain" draggable={false} />
        <img src="/logo-wordmark.png" alt="MITTWORK" className="h-4 w-auto max-w-[160px] object-contain" draggable={false} />
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <img src="/logo-mark.png" alt="" width={270} height={385} className="h-7 w-auto object-contain" draggable={false} />
      <img
        src="/logo-wordmark.png"
        alt="MITTWORK"
        width={926}
        height={133}
        className="h-3.5 w-auto object-contain"
        draggable={false}
      />
    </span>
  );
}

export function Stars({ value, size = "sm" }: { value: number; size?: "sm" | "md" }) {
  const full = Math.round(value * 2) / 2;
  const cls = size === "md" ? "size-4" : "size-3.5";
  return (
    <span className="inline-flex items-center gap-0.5 text-primary" aria-label={`${value.toFixed(1)} stars`}>
      {Array.from({ length: 5 }, (_, i) => {
        const filled = full >= i + 1;
        const half = !filled && full >= i + 0.5;
        return (
          <svg key={i} viewBox="0 0 20 20" className={cls} aria-hidden="true">
            {half ? (
              <>
                <defs>
                  <linearGradient id={`half-${i}-${value}`}>
                    <stop offset="50%" stopColor="currentColor" />
                    <stop offset="50%" stopColor="currentColor" stopOpacity="0.25" />
                  </linearGradient>
                </defs>
                <path
                  fill={`url(#half-${i}-${value})`}
                  d="M10 1.5 12.5 7l6 .7-4.4 4.1 1.2 5.9L10 14.8 4.7 17.7l1.2-5.9L1.5 7.7 7.5 7z"
                />
              </>
            ) : (
              <path
                fill="currentColor"
                opacity={filled ? 1 : 0.25}
                d="M10 1.5 12.5 7l6 .7-4.4 4.1 1.2 5.9L10 14.8 4.7 17.7l1.2-5.9L1.5 7.7 7.5 7z"
              />
            )}
          </svg>
        );
      })}
    </span>
  );
}
