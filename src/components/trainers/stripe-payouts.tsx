import { CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function StripePayoutCard({
  onboarded,
  email,
  busy,
  stripeUrl,
  onConnect,
}: {
  onboarded: boolean;
  email?: string | null;
  busy: boolean;
  stripeUrl?: string | null;
  onConnect: () => void;
}) {
  return (
    <div
      className={
        onboarded
          ? "rounded-xl border border-success/30 bg-success/10 p-4"
          : "rounded-xl bg-elevated p-4"
      }
    >
      {onboarded ? (
        <div className="flex items-start gap-3">
          <CircleCheck className="mt-0.5 size-6 shrink-0 text-success" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-success">Stripe connected · ready for payouts</p>
            <p className="mt-1 text-sm text-muted">
              {email
                ? `Deposits go to ${email}. Clients pay in Mittwork; you get 92%.`
                : "Your Stripe account is linked. Clients pay in Mittwork; you get 92%."}
            </p>
          </div>
        </div>
      ) : (
        <>
          <p className="font-medium">Get paid with Stripe</p>
          <p className="mt-1 text-sm text-muted">
            Sign in to Stripe and pick the account that should receive your 92%.
          </p>
        </>
      )}
      <Button
        className="mt-3 w-full"
        variant={onboarded ? "secondary" : "primary"}
        onClick={onConnect}
        disabled={busy}
      >
        {busy ? "Opening Stripe…" : onboarded ? "Edit Stripe account" : "Sign in with Stripe"}
      </Button>
      {stripeUrl && (
        <a href={stripeUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-primary">
          Stripe didn’t open? Tap here
        </a>
      )}
    </div>
  );
}
