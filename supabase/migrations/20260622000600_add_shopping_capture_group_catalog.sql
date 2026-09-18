-- Shopping capture groups are the item-level record for shopping mode. These
-- catalog fields let a group move from raw photos into a curated find.

alter table public.shopping_capture_groups
  add column if not exists category text,
  add column if not exists size_label text,
  add column if not exists color_label text,
  add column if not exists material_label text,
  add column if not exists notes text,
  add column if not exists is_favorite boolean not null default false,
  add column if not exists catalog_status text not null default 'considering',
  add column if not exists updated_at timestamptz not null default now();

alter table public.shopping_capture_groups
  drop constraint if exists shopping_capture_groups_catalog_status,
  add constraint shopping_capture_groups_catalog_status
    check (catalog_status in ('considering', 'wishlist', 'closet', 'passed'));

create index if not exists shopping_capture_groups_user_catalog_status_idx
  on public.shopping_capture_groups (user_id, catalog_status, started_at desc);

create index if not exists shopping_capture_groups_user_favorite_idx
  on public.shopping_capture_groups (user_id, is_favorite, started_at desc)
  where is_favorite = true;
