-- Mittwork marketplace schema

create table if not exists profiles (
  user_id text primary key,
  role text not null default 'client',
  display_name text,
  phone text,
  city text,
  created_at timestamptz not null default now()
);

create table if not exists gyms (
  id text primary key,
  name text not null,
  gym_type text not null,
  address text not null,
  city text not null,
  lat double precision not null,
  lng double precision not null,
  photo_url text not null,
  description text not null,
  amenities text not null default '[]',
  hours text not null default '',
  phone text
);

create table if not exists trainers (
  id text primary key,
  user_id text,
  gym_id text not null references gyms(id),
  name text not null,
  headline text not null,
  bio text not null,
  photo_url text not null,
  specialties text not null,
  years_exp int not null default 5,
  rating numeric not null default 5,
  review_count int not null default 0,
  price_from int not null,
  city text not null,
  lat double precision not null,
  lng double precision not null,
  verified boolean not null default true,
  gallery text not null default '[]',
  created_at timestamptz not null default now()
);

create index if not exists trainers_gym_id_idx on trainers (gym_id);
create index if not exists trainers_user_id_idx on trainers (user_id);

create table if not exists services (
  id text primary key,
  trainer_id text not null references trainers(id) on delete cascade,
  name text not null,
  style text not null,
  service_type text not null,
  description text not null,
  duration_min int not null,
  price_cents int not null
);

create index if not exists services_trainer_id_idx on services (trainer_id);

create table if not exists availability (
  id serial primary key,
  trainer_id text not null references trainers(id) on delete cascade,
  weekday int not null,
  start_min int not null,
  end_min int not null
);

create index if not exists availability_trainer_id_idx on availability (trainer_id);

create table if not exists bookings (
  id text primary key,
  user_id text not null,
  trainer_id text not null references trainers(id),
  service_id text not null references services(id),
  gym_id text not null references gyms(id),
  start_at timestamptz not null,
  status text not null default 'confirmed',
  amount_cents int not null,
  fee_cents int not null,
  notes text,
  client_name text,
  created_at timestamptz not null default now()
);

create index if not exists bookings_user_id_idx on bookings (user_id);
create index if not exists bookings_trainer_id_idx on bookings (trainer_id);
create index if not exists bookings_start_at_idx on bookings (start_at);

create table if not exists reviews (
  id text primary key,
  booking_id text,
  trainer_id text not null references trainers(id) on delete cascade,
  user_id text,
  author_name text not null,
  rating int not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists reviews_trainer_id_idx on reviews (trainer_id);

create table if not exists notifications (
  id text primary key,
  user_id text not null,
  title text not null,
  body text not null,
  href text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on notifications (user_id);

create table if not exists trainer_messages (
  id text primary key,
  booking_id text not null references bookings(id) on delete cascade,
  sender_user_id text not null,
  body text not null,
  created_at timestamptz not null default now()
);
