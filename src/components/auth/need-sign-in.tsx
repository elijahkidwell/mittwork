import { Navigate, useRouterState } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

/** Signed-out visitors go to /login and return here after Google/email. */
export function NeedSignIn({ children }: { children: React.ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  const loc = useRouterState({ select: (s) => s.location });
  if (isPending) return <p className="text-sm text-muted">Loading…</p>;
  if (!user) {
    let extra = "";
    try {
      extra = new URL(loc.href, "https://mittwork.local").search;
    } catch {
      extra = "";
    }
    const redirect = `${loc.pathname || "/"}${extra}`;
    return <Navigate to="/login" search={{ redirect }} />;
  }
  return <>{children}</>;
}
