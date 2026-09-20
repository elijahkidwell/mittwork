import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export function Badge({
  className,
  tone = "default",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: "default" | "primary" | "success" | "muted" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        tone === "default" && "bg-elevated text-muted",
        tone === "primary" && "bg-primary/15 text-primary",
        tone === "success" && "bg-success/15 text-success",
        tone === "muted" && "bg-transparent text-subtle shadow-[var(--shadow-border)]",
        className,
      )}
      {...props}
    />
  );
}
