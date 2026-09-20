-- Profile photos, bios, and trainer media galleries

alter table profiles add column if not exists photo_url text;
alter table profiles add column if not exists bio text;

create table if not exists trainer_media (
  id text primary key,
  trainer_id text not null references trainers(id) on delete cascade,
  url text not null,
  kind text not null default 'photo',
  created_at timestamptz not null default now()
);

create index if not exists trainer_media_trainer_id_idx on trainer_media (trainer_id);
