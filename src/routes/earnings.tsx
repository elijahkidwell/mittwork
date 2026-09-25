import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { GuestPrompt } from "@/components/auth/guest-prompt";
import { StripePayoutCard } from "@/components/trainers/stripe-payouts";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { openExternal } from "@/lib/open-external";
import { getEarnings, startTrainerPayouts } from "@/lib/server/queries";
import { formatMoney, formatWhen } from "@/lib/utils";

const EMPTY = {
  stripeEnabled: true,
  trainer: null as null | {
    id: string;
    name: string;
    stripeAccountId: string | null;
    onboarded: boolean;
    email: string | null;
  },
  grossCents: 0,
  feeCents: 0,
  netCents: 0,
  paidOutCents: 0,
  pendingCents: 0,
  platformFeeCents: 0,
  bookings: [] as {
    id: string;
    startAt: string;
    status: string;
    amountCents: number;
    feeCents: number;
    payoutStatus: string;
    clientName: string | null;
    serviceName: string;
    netCents: number;
  }[],
};

export const Route = createFileRoute("/earnings")({
  validateSearch: (s: Record<string, unknown>): { connected?: string; refresh?: string } => ({
    connected: s.connected ? String(s.connected) : undefined,
    refresh: s.refresh ? String(s.refresh) : undefined,
  }),
  component: EarningsPage,
});

function EarningsPage() {
  const { user, isPending } = useCurrentUserState();
  const search = Route.useSearch();
  const q = useQuery({
    queryKey: ["earnings"],
    queryFn: () => getEarnings(),
    enabled: !isPending && !!user,
    placeholderData: EMPTY,
    retry: 0,
  });
  const [busy, setBusy] = useState(false);
  const [stripeUrl, setStripeUrl] = useState<string | null>(null);

  useEffect(() => {
    if (search.connected === "1") toast.success("Checking Stripe… finish onboarding if payouts aren’t live yet.");
  }, [search.connected]);

  if (isPending) return <p className="text-sm text-muted">Loading earnings…</p>;
  if (!user) {
    return (
      <GuestPrompt
        title="Earnings"
        blurb="Log in as a trainer to track payouts. Mittwork keeps 8%."
        next="/earnings"
      />
    );
  }

  const d = q.data ?? EMPTY;

  async function connect() {
    setBusy(true);
    try {
      const res = await startTrainerPayouts({ data: { origin: window.location.origin } });
      if (!res.url) throw new Error("Stripe did not return a sign-in link.");
      setStripeUrl(res.url);
      openExternal(res.url);
      setBusy(false);
    } catch (err) {
      setBusy(false);
      toast.error(err instanceof Error ? err.message : "Could not open Stripe.");
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-wide">Earnings</h1>
        <p className="text-sm text-muted">Mittwork keeps 8%. You get 92% in the Stripe account you connect.</p>
      </div>

      {q.isError ? (
        <p className="text-sm text-muted">Couldn’t load earnings. Pull to refresh.</p>
      ) : q.isPlaceholderData ? (
        <p className="text-sm text-muted">Loading earnings…</p>
      ) : !d.trainer ? (
        <div className="rounded-xl bg-elevated p-5">
          <p className="font-medium">Trainer profile needed</p>
          <p className="mt-1 text-sm text-muted">Payouts are for coaches. Set up your trainer page first.</p>
          <Link to="/account" className="mt-3 inline-block text-sm text-primary">
            Open account →
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Gross" value={formatMoney(d.grossCents)} />
            <Stat label="Your 92%" value={formatMoney(d.netCents)} />
            <Stat label="Mittwork 8%" value={formatMoney(d.feeCents)} />
            <Stat label="Pending payout" value={formatMoney(d.pendingCents)} />
          </div>

          <StripePayoutCard
            onboarded={d.trainer.onboarded}
            email={d.trainer.email}
            busy={busy}
            stripeUrl={stripeUrl}
            onConnect={() => void connect()}
          />

          <section>
            <h2 className="mb-2 font-display text-xl tracking-wide">Payouts</h2>
            {d.bookings.length === 0 ? (
              <p className="text-sm text-muted">No sessions yet.</p>
            ) : (
              <ul className="divide-y divide-border rounded-xl bg-elevated">
                {d.bookings.map((b) => (
                  <li key={b.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
                    <div>
                      <p className="font-medium">{b.serviceName}</p>
                      <p className="text-xs text-muted">
                        {b.clientName || "Client"} · {formatWhen(b.startAt)}
                      </p>
                    </div>
                    <div className="text-right tabular-nums">
                      <p>{formatMoney(b.netCents)}</p>
                      <p className="text-[11px] uppercase tracking-wide text-subtle">
                        {b.status === "pending_payment" ? "awaiting card" : b.payoutStatus}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
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
