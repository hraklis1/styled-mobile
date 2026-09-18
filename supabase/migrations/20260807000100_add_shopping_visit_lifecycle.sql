-- Shopping visits exist before a store is known so camera capture can stay
-- immediate and offline-first. Store/location metadata can be backfilled later.

alter table public.shopping_sessions
  alter column store_name drop not null,
  add column if not exists location_hint text;

comment on column public.shopping_sessions.location_hint is
  'Coarse reverse-geocoded reminder such as Near Queen Street; never a full address.';
