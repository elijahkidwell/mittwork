-- Live gym metadata + Stripe Connect payouts

alter table gyms add column if not exists website text;
alter table gyms add column if not exists rating numeric;
alter table gyms add column if not exists review_count int not null default 0;
alter table gyms add column if not exists yelp_url text;
alter table gyms add column if not exists source text not null default 'seed';
alter table gyms add column if not exists wiki_extract text;

alter table trainers add column if not exists stripe_account_id text;
alter table trainers add column if not exists stripe_onboarded boolean not null default false;

alter table bookings add column if not exists stripe_session_id text;
alter table bookings add column if not exists payout_status text not null default 'pending';

create table if not exists gym_reviews (
  id text primary key,
  gym_id text not null references gyms(id) on delete cascade,
  user_id text,
  author_name text not null,
  rating int not null,
  body text not null,
  source text not null default 'mittwork',
  created_at timestamptz not null default now()
);

create index if not exists gym_reviews_gym_id_idx on gym_reviews (gym_id);
