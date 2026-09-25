import { useState } from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

export function LazyVideo({
  src,
  poster,
  className,
  controls = false,
}: {
  src: string;
  poster?: string;
  className?: string;
  controls?: boolean;
}) {
  const [on, setOn] = useState(false);

  if (!on) {
    return (
      <button
        type="button"
        onClick={() => setOn(true)}
        className={cn("relative block overflow-hidden bg-elevated", className)}
        aria-label="Play video"
      >
        {poster ? (
          <img src={poster} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
        ) : (
          <span className="block size-full bg-elevated" />
        )}
        <span className="absolute inset-0 grid place-items-center bg-black/25">
          <span className="grid size-12 place-items-center rounded-full bg-black/70 text-white">
            <Play className="size-5 fill-white" />
          </span>
        </span>
      </button>
    );
  }

  return (
    <video
      src={src}
      poster={poster}
      className={className}
      controls={controls}
      playsInline
      muted
      autoPlay
      preload="metadata"
      onCanPlay={(e) => {
        const el = e.currentTarget;
        void el.play().catch(() => {});
      }}
    />
  );
}
