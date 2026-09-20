import type { InputHTMLAttributes, LabelHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-12 w-full rounded-full bg-elevated px-4 text-base text-fg shadow-[var(--shadow-border)]",
        "placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-md bg-elevated px-3 py-2.5 text-base text-fg shadow-[var(--shadow-border)]",
        "placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted", className)}
      {...props}
    />
  );
}
