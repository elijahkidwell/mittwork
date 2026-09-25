import { useEffect, useLayoutEffect } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, Calendar, DollarSign, Map, MessageSquare, Search, UserRound } from "lucide-react";
import { Logo } from "@/components/brand";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useOrigin } from "@/lib/origin";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { getMyProfile, listMyBookings, listNotifications, listTrainerSessions } from "@/lib/server/queries";
import { tickBookingReminders } from "@/lib/reminders";

const NAV = [
  { to: "/search", label: "Browse", icon: Search },
  { to: "/map", label: "Map", icon: Map },
  { to: "/bookings", label: "Bookings", icon: Calendar },
  { to: "/earnings", label: "Earnings", icon: DollarSign },
  { to: "/inbox", label: "Inbox", icon: MessageSquare },
] as const;

function useVisibleHeight() {
  useLayoutEffect(() => {
    const apply = () => {
      const h = window.visualViewport?.height || window.innerHeight;
      document.documentElement.style.setProperty("--vvh", `${Math.round(h)}px`);
    };
    apply();
    window.addEventListener("orientationchange", apply);
    window.addEventListener("resize", apply);
    window.visualViewport?.addEventListener("resize", apply);
    return () => {
      window.removeEventListener("orientationchange", apply);
      window.removeEventListener("resize", apply);
      window.visualViewport?.removeEventListener("resize", apply);
    };
  }, []);
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hydrate = useOrigin((s) => s.hydrate);
  useVisibleHeight();
  useLayoutEffect(() => {
    hydrate();
  }, [hydrate]);

  const bare = pathname === "/" || pathname === "/login";

  if (bare) {
    return <div className="landing-shell">{children}</div>;
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="mx-auto flex h-12 max-w-3xl items-center gap-3 px-4">
          <Link to="/" className="shrink-0" aria-label="Mittwork home">
            <Logo />
          </Link>
          <div className="hidden flex-1 items-center justify-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "rounded-full px-3.5 py-2 text-sm font-medium",
                  pathname === item.to || pathname.startsWith(item.to + "/")
                    ? "bg-elevated text-fg"
                    : "text-muted hover:text-fg",
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <NotifyBell />
            <AuthChip />
          </div>
        </div>
      </header>
      <main className="app-main mx-auto w-full max-w-3xl px-4">
        {children}
      </main>
      <nav
        className="app-nav md:hidden"
      >
        <ul className="grid grid-cols-5">
          {NAV.map((item) => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={cn(
                    "flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
                    active ? "text-cta" : "text-muted",
                  )}
                >
                  <Icon className="size-5" strokeWidth={active ? 2.4 : 2} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <ReminderBridge />
    </div>
  );
}

function ReminderBridge() {
  const { user, isPending } = useCurrentUserState();
  const mine = useQuery({
    queryKey: ["bookings"],
    queryFn: () => listMyBookings(),
    enabled: !isPending && !!user,
    refetchInterval: 60_000,
  });
  const desk = useQuery({
    queryKey: ["trainer-sessions"],
    queryFn: () => listTrainerSessions(),
    enabled: !isPending && !!user,
    refetchInterval: 60_000,
  });
  // Notification permission is only requested from the explicit "Turn on reminders" button
  // on /bookings; prompting on every page load is blocked by browsers and annoys people.
  useEffect(() => {
    if (!user) return;
    const rows = [
      ...(mine.data ?? [])
        .filter((b) => b.status === "confirmed")
        .map((b) => ({
          id: b.id,
          startAt: b.startAt,
          serviceName: b.serviceName,
          trainerName: b.trainerName,
        })),
      ...(desk.data?.sessions ?? [])
        .filter((s) => s.status === "confirmed")
        .map((s) => ({
          id: s.id,
          startAt: s.startAt,
          serviceName: s.serviceName,
          clientName: s.clientName,
        })),
    ];
    if (!rows.length) return;
    tickBookingReminders(rows);
  }, [user, mine.data, desk.data]);
  return null;
}

function AuthChip() {
  const { user, isPending } = useCurrentUserState();
  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: () => getMyProfile(),
    enabled: !isPending && !!user,
  });
  if (isPending) return <div className="size-9 rounded-full bg-elevated" />;
  if (!user) {
    return (
      <Link
        to="/login"
        search={{ redirect: "/search" }}
        className="inline-flex h-9 items-center rounded-full bg-cta px-3.5 text-sm font-semibold text-cta-fg"
      >
        Log in
      </Link>
    );
  }
  const avatar = profile.data?.photoUrl || user.profileImageUrl;
  return (
    <Link
      to="/account"
      className="grid size-9 place-items-center overflow-hidden rounded-full bg-elevated"
      aria-label="Account"
    >
      {avatar ? <img src={avatar} alt="" className="size-9 object-cover" /> : <UserRound className="size-4 text-muted" />}
    </Link>
  );
}

function NotifyBell() {
  const { user, isPending } = useCurrentUserState();
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listNotifications(),
    enabled: !isPending && !!user,
    refetchInterval: 20_000,
  });
  const unread = (data ?? []).filter((n) => !n.read).length;
  // Hold the bell's space while auth resolves so the header doesn't jump.
  if (isPending) return <div className="size-11" aria-hidden />;
  if (!user) return null;
  return (
    <Link
      to="/inbox"
      className="relative grid size-11 place-items-center rounded-full text-muted hover:bg-elevated hover:text-fg"
      aria-label="Inbox"
    >
      <Bell className="size-5" />
      {unread > 0 && <span className="absolute right-2 top-2 size-2 rounded-full bg-cta" />}
    </Link>
  );
}
