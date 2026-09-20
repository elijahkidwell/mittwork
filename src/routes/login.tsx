import { useEffect } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Logo } from "@/components/brand";
import { SignInPanel } from "@/components/auth/sign-in-panel";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

function parseRedirect(s: Record<string, unknown>): { redirect?: string } {
  const redirect =
    typeof s.redirect === "string" && s.redirect.startsWith("/") && !s.redirect.startsWith("//") && s.redirect !== "/login"
      ? s.redirect
      : undefined;
  return redirect ? { redirect } : {};
}

export const Route = createFileRoute("/login")({
  validateSearch: parseRedirect,
  component: Login,
});

function safeNext(redirect?: string) {
  return redirect && redirect.startsWith("/") && !redirect.startsWith("//") && redirect !== "/login"
    ? redirect
    : "/search";
}

function Login() {
  const { redirect } = Route.useSearch();
  const next = safeNext(redirect);
  const { user, isPending } = useCurrentUserState();

  useEffect(() => {
    if (!isPending && user) window.location.replace(next);
  }, [isPending, user, next]);

  return (
    <main className="mx-auto flex h-full max-w-md flex-col justify-center gap-4 overflow-y-auto px-6 py-6">
      <Link to="/" className="flex justify-center">
        <Logo stacked />
      </Link>
      <p className="text-center text-sm text-muted">Google, X, or email — one screen.</p>
      <SignInPanel next={next} compact />
    </main>
  );
}
