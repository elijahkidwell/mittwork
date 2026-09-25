-- Guard rails added with the performance/glitch fixes.
--
-- 1) At most one active (confirmed or awaiting payment) booking per trainer per
--    start time, so two people clicking the same slot at once can't both win.
-- 2) One Mittwork review per signed-in user per gym.
--
-- Both are wrapped so a database that already contains duplicates doesn't fail
-- the deploy: the index is simply skipped (the app code still enforces the same
-- rules), and can be created later after cleaning up duplicates.

do $$
begin
  create unique index if not exists bookings_trainer_slot_active_uidx
    on bookings (trainer_id, start_at)
    where status in ('confirmed', 'pending_payment');
exception when unique_violation then
  raise notice 'bookings_trainer_slot_active_uidx skipped: duplicate active bookings exist';
end
$$;

do $$
begin
  create unique index if not exists gym_reviews_one_per_user_uidx
    on gym_reviews (gym_id, user_id)
    where user_id is not null and source = 'mittwork';
exception when unique_violation then
  raise notice 'gym_reviews_one_per_user_uidx skipped: duplicate reviews exist';
end
$$;

-- Speeds up the bounding-box gym lookups used by search and the map.
create index if not exists gyms_lat_lng_idx on gyms (lat, lng);
