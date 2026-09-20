import type { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

const FALLBACK_MESSAGE = "Something glitched. Try again.";

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    if (/Can't find variable: Notification/i.test(error.message)) {
      return "This phone doesn’t support pop-up alerts. Browse still works — tap Try again.";
    }
    return error.message;
  }
  if (typeof error === "string" && error) return error;
  return FALLBACK_MESSAGE;
}

export function AppErrorComponent({ error }: ErrorComponentProps) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-bg px-6 text-center text-fg">
      <span className="text-danger" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="max-w-md text-sm break-words text-muted">{errorMessage(error)}</p>
      <a
        href="/search"
        className="mt-2 inline-flex h-12 items-center rounded-full bg-cta px-6 text-sm font-semibold text-cta-fg"
      >
        Try again
      </a>
    </main>
  );
}
