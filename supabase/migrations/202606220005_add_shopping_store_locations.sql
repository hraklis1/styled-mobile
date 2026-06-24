-- A store location is a durable, user-scoped branch/place record. Shopping
-- sessions remain the visit history; this table lets repeated branches be
-- suggested and displayed consistently across visits.

create table if not exists public.shopping_store_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  store_name text not null,
  normalized_store_name text not null,
  location_key text not null,
  branch_label text,
  latitude double precision,
  longitude double precision,
  location_accuracy_meters double precision,
  locality text,
  region text,
  country_code text,
  location_source text not null default 'unavailable',
  visit_count integer not null default 1,
  first_visited_at timestamptz not null default now(),
  last_visited_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint shopping_store_locations_coordinates_pair
    check ((latitude is null) = (longitude is null)),
  constraint shopping_store_locations_latitude_range
    check (latitude is null or latitude between -90 and 90),
  constraint shopping_store_locations_longitude_range
    check (longitude is null or longitude between -180 and 180),
  constraint shopping_store_locations_accuracy_nonnegative
    check (location_accuracy_meters is null or location_accuracy_meters >= 0),
  constraint shopping_store_locations_visit_count_positive
    check (visit_count > 0),
  constraint shopping_store_locations_location_source
    check (location_source in ('device', 'photo_exif', 'manual', 'recent', 'unavailable')),
  constraint shopping_store_locations_user_key_unique
    unique (user_id, location_key)
);

create index if not exists shopping_store_locations_user_last_visited_idx
  on public.shopping_store_locations (user_id, last_visited_at desc);

create index if not exists shopping_store_locations_user_store_idx
  on public.shopping_store_locations (user_id, normalized_store_name, locality, region);

alter table public.shopping_store_locations enable row level security;

grant select, insert, update, delete on table public.shopping_store_locations to authenticated;

create policy "Users can read their own shopping store locations"
  on public.shopping_store_locations for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own shopping store locations"
  on public.shopping_store_locations for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own shopping store locations"
  on public.shopping_store_locations for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own shopping store locations"
  on public.shopping_store_locations for delete to authenticated
  using ((select auth.uid()) = user_id);

alter table public.shopping_sessions
  add column if not exists store_location_id uuid
  references public.shopping_store_locations (id) on delete set null;

create index if not exists shopping_sessions_store_location_idx
  on public.shopping_sessions (store_location_id, started_at desc);

insert into public.shopping_store_locations (
  user_id,
  store_name,
  normalized_store_name,
  location_key,
  branch_label,
  latitude,
  longitude,
  location_accuracy_meters,
  locality,
  region,
  country_code,
  location_source,
  visit_count,
  first_visited_at,
  last_visited_at
)
select
  session_groups.user_id,
  max(session_groups.store_name) as store_name,
  session_groups.normalized_store_name,
  session_groups.location_key,
  max(session_groups.branch_label) as branch_label,
  max(session_groups.latitude) as latitude,
  max(session_groups.longitude) as longitude,
  max(session_groups.location_accuracy_meters) as location_accuracy_meters,
  max(session_groups.locality) as locality,
  max(session_groups.region) as region,
  max(session_groups.country_code) as country_code,
  max(session_groups.location_source) as location_source,
  count(*)::integer as visit_count,
  min(session_groups.started_at) as first_visited_at,
  max(session_groups.started_at) as last_visited_at
from (
  select
    user_id,
    store_name,
    lower(regexp_replace(trim(store_name), '\s+', ' ', 'g')) as normalized_store_name,
    concat_ws('|',
      lower(regexp_replace(trim(store_name), '\s+', ' ', 'g')),
      lower(coalesce(trim(branch_label), '')),
      lower(coalesce(trim(locality), '')),
      lower(coalesce(trim(region), '')),
      lower(coalesce(trim(country_code), ''))
    ) as location_key,
    branch_label,
    latitude,
    longitude,
    location_accuracy_meters,
    locality,
    region,
    country_code,
    location_source,
    started_at
  from public.shopping_sessions
  where store_name is not null
    and (
      branch_label is not null
      or locality is not null
      or region is not null
      or latitude is not null
    )
) as session_groups
group by session_groups.user_id, session_groups.normalized_store_name, session_groups.location_key
on conflict (user_id, location_key) do update set
  store_name = excluded.store_name,
  branch_label = coalesce(excluded.branch_label, shopping_store_locations.branch_label),
  latitude = coalesce(excluded.latitude, shopping_store_locations.latitude),
  longitude = coalesce(excluded.longitude, shopping_store_locations.longitude),
  location_accuracy_meters = coalesce(excluded.location_accuracy_meters, shopping_store_locations.location_accuracy_meters),
  locality = coalesce(excluded.locality, shopping_store_locations.locality),
  region = coalesce(excluded.region, shopping_store_locations.region),
  country_code = coalesce(excluded.country_code, shopping_store_locations.country_code),
  location_source = excluded.location_source,
  visit_count = greatest(shopping_store_locations.visit_count, excluded.visit_count),
  first_visited_at = least(shopping_store_locations.first_visited_at, excluded.first_visited_at),
  last_visited_at = greatest(shopping_store_locations.last_visited_at, excluded.last_visited_at),
  updated_at = now();

update public.shopping_sessions sessions
set store_location_id = locations.id
from public.shopping_store_locations locations
where sessions.user_id = locations.user_id
  and concat_ws('|',
    lower(regexp_replace(trim(sessions.store_name), '\s+', ' ', 'g')),
    lower(coalesce(trim(sessions.branch_label), '')),
    lower(coalesce(trim(sessions.locality), '')),
    lower(coalesce(trim(sessions.region), '')),
    lower(coalesce(trim(sessions.country_code), ''))
  ) = locations.location_key
  and sessions.store_location_id is null;
