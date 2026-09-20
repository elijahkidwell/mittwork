import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { notifyBookingConfirmed } from "@/lib/server/queries";
import { getStripe, stripeSecret } from "@/lib/server/stripe";

export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const stripe = await getStripe();
        const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
        if (!stripe || !(await stripeSecret())) {
          return Response.json({ error: "Stripe off" }, { status: 503 });
        }
        if (!secret) {
          return Response.json({ error: "Webhook not configured" }, { status: 503 });
        }
        const raw = await request.text();
        let event;
        try {
          const sig = request.headers.get("stripe-signature");
          if (!sig) return Response.json({ error: "No signature" }, { status: 400 });
          event = stripe.webhooks.constructEvent(raw, sig, secret);
        } catch {
          return Response.json({ error: "Invalid payload" }, { status: 400 });
        }

        if (event.type === "checkout.session.completed") {
          const obj = (event as { data: { object: { metadata?: { bookingId?: string }; payment_status?: string } } }).data
            .object;
          const bookingId = obj.metadata?.bookingId;
          if (bookingId && obj.payment_status === "paid") {
            const sql = await getSql();
            const updated = await sql<{ id: string }>`
              update bookings
              set status = 'confirmed', payout_status = 'pending'
              where id = ${bookingId} and status = 'pending_payment'
              returning id
            `;
            if (updated[0]) await notifyBookingConfirmed(bookingId);
          }
        }
        if (event.type === "checkout.session.expired") {
          const obj = (event as { data: { object: { metadata?: { bookingId?: string } } } }).data.object;
          const bookingId = obj.metadata?.bookingId;
          if (bookingId) {
            const sql = await getSql();
            await sql`
              update bookings
              set status = 'cancelled', cancelled_at = now(), cancel_kind = 'expired'
              where id = ${bookingId} and status = 'pending_payment'
            `;
          }
        }
        if (event.type === "account.updated") {
          const obj = (event as { data: { object: { id: string; charges_enabled?: boolean; payouts_enabled?: boolean } } })
            .data.object;
          const sql = await getSql();
          const ready = Boolean(obj.charges_enabled && obj.payouts_enabled);
          await sql`
            update trainers set stripe_onboarded = ${ready} where stripe_account_id = ${obj.id}
          `;
        }
        return Response.json({ received: true });
      },
    },
  },
});
