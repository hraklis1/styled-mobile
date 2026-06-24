-- Capture groups connect garment/outfit photos with their price and size tags.
-- The mobile client owns group boundaries so grouping remains deterministic
-- and fully offline-capable.

create table if not exists public.shopping_capture_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  shopping_session_id uuid references public.shopping_sessions (id) on delete set null,
  started_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists shopping_capture_groups_user_started_at_idx
  on public.shopping_capture_groups (user_id, started_at desc);

create index if not exists shopping_capture_groups_session_idx
  on public.shopping_capture_groups (shopping_session_id, started_at);

alter table public.shopping_capture_groups enable row level security;

grant select, insert, update, delete on table public.shopping_capture_groups to authenticated;

create policy "Users can read their own shopping capture groups"
  on public.shopping_capture_groups for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own shopping capture groups"
  on public.shopping_capture_groups for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own shopping capture groups"
  on public.shopping_capture_groups for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own shopping capture groups"
  on public.shopping_capture_groups for delete to authenticated
  using ((select auth.uid()) = user_id);

alter table public.shopping_snaps
  add column if not exists capture_group_id uuid
    references public.shopping_capture_groups (id) on delete set null,
  add column if not exists capture_role text not null default 'unknown',
  add column if not exists capture_sequence integer not null default 0;

alter table public.shopping_snaps
  drop constraint if exists shopping_snaps_capture_role,
  add constraint shopping_snaps_capture_role
    check (capture_role in ('garment', 'tag', 'unknown')),
  drop constraint if exists shopping_snaps_capture_sequence_nonnegative,
  add constraint shopping_snaps_capture_sequence_nonnegative
    check (capture_sequence >= 0);

create index if not exists shopping_snaps_capture_group_sequence_idx
  on public.shopping_snaps (capture_group_id, capture_sequence);
