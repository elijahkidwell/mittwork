# Mittwork

Trainer booking marketplace: find a gym, book a coach, pay with Stripe Connect (92% trainer / 8% Mittwork), message after you book.

Live site: [mitt-work.online](https://mitt-work.online)

## Stack

- TanStack Start + React 19 + Tailwind v4
- Better Auth (Google, X, email)
- Stripe Checkout + Connect Express
- Resend for booking emails
- OpenStreetMap / Leaflet for gyms
- Postgres in production, PGLite in preview

## Setup

```bash
npm install
cp .env.example .env
# fill Stripe, Resend, and auth values
npm run dev
```

App listens on port 8080.

Required env for real payments:

- `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` (same mode)
- `STRIPE_WEBHOOK_SECRET` — Dashboard webhook for `checkout.session.completed` and `checkout.session.expired` → `/api/stripe/webhook`
- `RESEND_API_KEY`
- `BETTER_AUTH_URL` — public origin
- `DATABASE_URL` — Postgres

Trainers must finish Stripe Express (charges + payouts) before clients can pay. Catalog coaches without Connect cannot take cards.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build + migrations |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests |

## Notes

- Do not commit `.env`. Keys belong in the host’s env, not the repo.
- Trainer photos and gym media under `public/photos` / `public/videos` are not in this export (too large for the GitHub file API). Copy them from the live app or regenerate.
- Cancel is free until 24 hours before the session; that path refunds Stripe (application fee + transfer reversed).
