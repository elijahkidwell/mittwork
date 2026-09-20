import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NeedSignIn } from "@/components/auth/need-sign-in";
import { trainerDashboard } from "@/lib/server/queries";
import { formatMoney, formatWhen } from "@/lib/utils";

export const Route = createFileRoute("/dashboard")({ component: DashboardPage });

function DashboardPage() {
  return (
    <NeedSignIn>
      <Dash />
    </NeedSignIn>
  );
}

function Dash() {
  const q = useQuery({ queryKey: ["trainer-dash"], queryFn: () => trainerDashboard() });

  if (q.isLoading) return <Skeleton className="h-48 rounded-xl" />;

  if (!q.data) {
    return (
      <div className="space-y-4 py-10">
        <h1 className="font-display text-3xl tracking-wide">Trainer desk</h1>
        <p className="max-w-md text-sm text-muted">
          You're signed in as a client. Hang a profile and start taking mittwork, mats, or strength sessions.
        </p>
        <Button asChild>
          <Link to="/onboard">Become a trainer</Link>
        </Button>
      </div>
    );
  }

  const { trainer, bookings, earnedCents, upcoming } = q.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <img src={trainer.photo_url} alt="" className="size-14 rounded-full object-cover" />
        <div>
          <h1 className="font-display text-3xl tracking-wide">{trainer.name}</h1>
          <p className="text-sm text-muted">{upcoming} upcoming · {formatMoney(earnedCents)} earned after fees</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Payouts" value={formatMoney(earnedCents)} />
        <Stat label="Upcoming" value={String(upcoming)} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="secondary" size="sm">
          <Link to="/account">Edit profile & media</Link>
        </Button>
        <Button asChild variant="secondary" size="sm">
          <Link to="/trainers/$id" params={{ id: trainer.id }}>
            View public profile
          </Link>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void navigator.clipboard.writeText(`${window.location.origin}/trainers/${trainer.id}`)}
        >
          Copy share link
        </Button>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-2xl tracking-wide">Bookings</h2>
        {bookings.length === 0 ? (
          <p className="text-sm text-muted">No clients yet. Share your profile.</p>
        ) : (
          <ul className="space-y-2">
            {bookings.map((b) => (
              <li key={b.id} className="rounded-lg bg-surface px-3 py-3 shadow-[var(--shadow-border)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{b.clientName || "Client"}</p>
                    <p className="text-sm text-muted">{b.serviceName}</p>
                    <p className="text-xs text-subtle">{formatWhen(b.startAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="tabular-nums text-sm">{formatMoney(b.payoutCents)}</p>
                    <p className="text-xs capitalize text-subtle">{b.status}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-display text-3xl tracking-wide">{value}</p>
    </div>
  );
}
