import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useCurrentUser, useCurrentUserState } from "@/lib/auth/use-current-user";
import { ALL_PLACE_IDS, SESSION_PLACES, placeNeedsWhere, type SessionPlaceId } from "@/lib/locations";
import { createStripeCheckout, type ServiceRow } from "@/lib/server/queries";
import { openExternal } from "@/lib/open-external";
import { PLATFORM_FEE, formatMoney, formatWhen, priceForDuration, stripePassThroughFee } from "@/lib/utils";

export function Checkout({
  open,
  onClose,
  trainerName,
  trainerId,
  service,
  startAt,
  durationMin,
  places,
}: {
  open: boolean;
  onClose: () => void;
  trainerName: string;
  trainerId: string;
  service: ServiceRow | null;
  startAt: string | null;
  durationMin?: number;
  places?: SessionPlaceId[];
}) {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const { isPending } = useCurrentUserState();
  const [name, setName] = useState(user?.displayName ?? "");
  const [notes, setNotes] = useState("");
  const offered = places?.length ? places : ALL_PLACE_IDS;
  const [place, setPlace] = useState<SessionPlaceId>(offered[0] ?? "trainer_gym");
  const [where, setWhere] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  if (!service || !startAt) return null;

  const mins = durationMin ?? service.durationMin;
  const amount = priceForDuration(service.priceCents, service.durationMin, mins);
  const fee = Math.round(amount * PLATFORM_FEE);
  const cardFee = stripePassThroughFee(amount);
  const total = amount + cardFee;
  const needWhere = placeNeedsWhere(place);

  async function pay() {
    if (isPending) return;
    if (!user) {
      navigate({ to: "/login", search: { redirect: `/trainers/${trainerId}` } });
      return;
    }
    if (needWhere && !where.trim()) {
      toast.error("Add the gym, address, or park for this session.");
      return;
    }
    const svc = service;
    const when = startAt;
    if (!svc || !when) return;
    setBusy(true);
    try {
      const res = await createStripeCheckout({
        data: {
          trainerId,
          serviceId: svc.id,
          startAt: when,
          notes: notes.trim() || undefined,
          clientName: name.trim() || user.displayName || "Client",
          origin: window.location.origin,
          durationMin: mins,
          locationType: place,
          locationNote: where.trim() || undefined,
        },
      });
      if (res.mode === "stripe" && res.url) {
        openExternal(res.url);
        return;
      }
      setDone(res.bookingId);
      toast.success("Session booked.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not complete booking.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        if (done) navigate({ to: "/bookings" });
        else onClose();
      }}
      title={done ? "You're booked" : "Confirm & pay"}
    >
      {done ? (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            {service.name} with {trainerName} on {formatWhen(startAt)}. A reminder is waiting in your bookings.
          </p>
          <p className="text-sm text-subtle">
            Paid {formatMoney(total)} for {mins} min · trainer gets {formatMoney(amount - fee)}.
          </p>
          <Button className="w-full" onClick={() => navigate({ to: "/bookings" })}>
            View bookings
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg bg-elevated p-3.5 text-sm">
            <p className="font-medium">{service.name}</p>
            <p className="text-muted">
              {trainerName} · {mins} min
            </p>
            <p className="mt-1 text-muted">{formatWhen(startAt)}</p>
            <div className="mt-3 space-y-1 border-t border-border pt-3 tabular-nums">
              <Row label="Session" value={formatMoney(amount)} />
              <Row label="Card processing" value={formatMoney(cardFee)} />
              <Row label="You pay" value={formatMoney(total)} />
              <Row label="Trainer receives" value={formatMoney(amount - fee)} muted />
              <Row label="Mittwork keeps (8%)" value={formatMoney(fee)} muted />
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">Where</p>
            <div className="flex flex-col gap-1.5">
              {SESSION_PLACES.filter((p) => offered.includes(p.id)).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlace(p.id)}
                  className={
                    place === p.id
                      ? "rounded-lg bg-primary px-3 py-2 text-left text-sm text-white"
                      : "rounded-lg bg-elevated px-3 py-2 text-left text-sm"
                  }
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          {needWhere && (
            <div>
              <Label htmlFor="where">{place === "park" ? "Which park" : "Address or gym name"}</Label>
              <Input
                id="where"
                value={where}
                onChange={(e) => setWhere(e.target.value)}
                placeholder={place === "client_gym" ? "Gym name and city" : "Street, city, or pin drop"}
              />
            </div>
          )}
          <div>
            <Label htmlFor="nm">Name on the session</Label>
            <Input id="nm" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="nt">Note for your trainer</Label>
            <Input id="nt" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Injuries, goals, gloves…" />
          </div>
          <p className="text-xs text-subtle">
            Card processing is added on top so the trainer still gets 92% and Mittwork still keeps 8%. Cancel free until
            24 hours before. After that — including no-shows — the trainer is paid in full.
          </p>
          <Button className="w-full" disabled={busy} onClick={() => void pay()}>
            {busy ? "Redirecting…" : `Pay ${formatMoney(total)}`}
          </Button>
        </div>
      )}
    </Modal>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${muted ? "text-muted" : "font-medium"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
