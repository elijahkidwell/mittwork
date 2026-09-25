import { Link, Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { GuestPrompt } from "@/components/auth/guest-prompt";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { listInbox } from "@/lib/server/queries";

export const Route = createFileRoute("/inbox")({ component: InboxPage });

function InboxPage() {
  const inThread = useRouterState({
    select: (s) => s.location.pathname.startsWith("/inbox/") && s.location.pathname.length > 8,
  });
  const { user, isPending } = useCurrentUserState();
  if (inThread) return <Outlet />;
  if (isPending) return <p className="text-sm text-muted">Loading inbox…</p>;
  if (!user) {
    return (
      <GuestPrompt
        title="Inbox"
        blurb="Log in to message trainers you’ve booked."
        next="/inbox"
      />
    );
  }
  return <InboxList />;
}

function InboxList() {
  const q = useQuery({
    queryKey: ["inbox"],
    queryFn: () => listInbox(),
    enabled: true,
    placeholderData: [],
    refetchInterval: 8000,
  });
  const rows = q.data ?? [];
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl tracking-wide">Inbox</h1>
        <p className="text-sm text-muted">Message after a booking. Only you and that trainer/client.</p>
      </div>
      {q.isError ? (
        <p className="text-sm text-danger">Couldn’t load messages. Pull to retry.</p>
      ) : null}
      {rows.length === 0 ? (
        <p className="text-sm text-muted">No threads yet. Book a session and you can message from here.</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((t) => (
            <li key={t.bookingId}>
              <Link
                to="/inbox/$bookingId"
                params={{ bookingId: t.bookingId }}
                className="flex min-h-16 items-center gap-3 py-3 active:bg-elevated"
              >
                {t.otherPhoto ? (
                  <img src={t.otherPhoto} alt="" width={48} height={48} loading="lazy" decoding="async" className="size-12 rounded-full object-cover object-top" />
                ) : (
                  <div className="grid size-12 place-items-center rounded-full bg-elevated text-sm font-medium">
                    {(t.otherName || "?").slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{t.otherName}</p>
                  <p className="truncate text-sm text-muted">{t.lastBody || t.serviceName}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
