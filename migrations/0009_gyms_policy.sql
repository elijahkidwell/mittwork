alter table gyms add column if not exists owner_user_id text;
alter table gyms add column if not exists gallery text not null default '[]';

alter table bookings add column if not exists no_show_by text;
alter table bookings add column if not exists cancelled_at timestamptz;
alter table bookings add column if not exists cancel_kind text;

create index if not exists gyms_owner_user_id_idx on gyms (owner_user_id);
