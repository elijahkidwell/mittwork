alter table trainers add column if not exists location_options text;
alter table bookings add column if not exists location_type text;
alter table bookings add column if not exists location_note text;
