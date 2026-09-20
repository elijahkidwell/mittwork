create table if not exists platform_settings (
  id text primary key,
  stripe_secret_key text,
  stripe_publishable_key text,
  owner_user_id text,
  updated_at timestamptz not null default now()
);
