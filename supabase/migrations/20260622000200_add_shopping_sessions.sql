-- A shopping session represents one physical store visit. Camera captures can
-- share rich branch-level location data without resolving GPS on every snap.

create table if not exists public.shopping_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  store_name text not null,
  branch_label text,
  latitude double precision,
  longitude double precision,
  location_accuracy_meters double precision,
  locality text,
  region text,
  country_code text,
  location_source text not null default 'unavailable',
  location_captured_at timestamptz,
  started_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default now(),

  constraint shopping_sessions_coordinates_pair
    check ((latitude is null) = (longitude is null)),
  constraint shopping_sessions_latitude_range
    check (latitude is null or latitude between -90 and 90),
  constraint shopping_sessions_longitude_range
    check (longitude is null or longitude between -180 and 180),
  constraint shopping_sessions_accuracy_nonnegative
    check (location_accuracy_meters is null or location_accuracy_meters >= 0),
  constraint shopping_sessions_location_source
    check (location_source in ('device', 'photo_exif', 'manual', 'recent', 'unavailable'))
);

create index if not exists shopping_sessions_user_started_at_idx
  on public.shopping_sessions (user_id, started_at desc);

create index if not exists shopping_sessions_user_store_idx
  on public.shopping_sessions (user_id, store_name, locality, region);

alter table public.shopping_sessions enable row level security;

grant select, insert, update, delete on table public.shopping_sessions to authenticated;

create policy "Users can read their own shopping sessions"
  on public.shopping_sessions for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own shopping sessions"
  on public.shopping_sessions for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own shopping sessions"
  on public.shopping_sessions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own shopping sessions"
  on public.shopping_sessions for delete to authenticated
  using ((select auth.uid()) = user_id);

alter table public.shopping_snaps
  add column if not exists shopping_session_id uuid
  references public.shopping_sessions (id) on delete set null;

create index if not exists shopping_snaps_session_captured_at_idx
  on public.shopping_snaps (shopping_session_id, captured_at desc);
