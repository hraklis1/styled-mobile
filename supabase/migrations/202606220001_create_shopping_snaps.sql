-- Shopping Mode photos are created on-device first, then synced directly to
-- Supabase by the authenticated mobile client.

create table if not exists public.shopping_snaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null,
  image_url text not null,
  store_name text,
  latitude double precision,
  longitude double precision,
  extracted_price numeric(12, 2),
  raw_ocr_text text,
  captured_at timestamptz not null,
  created_at timestamptz not null default now(),

  constraint shopping_snaps_storage_path_unique unique (storage_path),
  constraint shopping_snaps_extracted_price_nonnegative
    check (extracted_price is null or extracted_price >= 0),
  constraint shopping_snaps_coordinates_pair
    check ((latitude is null) = (longitude is null)),
  constraint shopping_snaps_latitude_range
    check (latitude is null or latitude between -90 and 90),
  constraint shopping_snaps_longitude_range
    check (longitude is null or longitude between -180 and 180)
);

create index if not exists shopping_snaps_user_captured_at_idx
  on public.shopping_snaps (user_id, captured_at desc);

alter table public.shopping_snaps enable row level security;

grant select, insert, update, delete on table public.shopping_snaps to authenticated;

create policy "Users can read their own shopping snaps"
  on public.shopping_snaps
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own shopping snaps"
  on public.shopping_snaps
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own shopping snaps"
  on public.shopping_snaps
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can update their own shopping snaps"
  on public.shopping_snaps
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Public objects are required by the requested getPublicUrl() sync flow. Each
-- user's writes remain isolated to shopping-snaps/<auth.uid()>/... by policy.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shopping-snaps',
  'shopping-snaps',
  true,
  20971520,
  array['image/jpeg', 'image/png', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can upload their own shopping snap objects"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'shopping-snaps'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can update their own shopping snap objects"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'shopping-snaps'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'shopping-snaps'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can delete their own shopping snap objects"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'shopping-snaps'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
