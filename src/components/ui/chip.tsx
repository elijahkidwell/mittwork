import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Chip({
  active,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "h-10 shrink-0 whitespace-nowrap rounded-full px-4 text-sm font-medium",
        active
          ? "bg-elevated text-fg shadow-[0_0_0_1px_rgb(255_255_255_/_0.55)]"
          : "bg-elevated text-muted shadow-[var(--shadow-border)]",
        className,
      )}
      {...props}
    />
  );
}
