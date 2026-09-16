-- Additive: old clients keep their catalog columns/status values.
alter table public.shopping_capture_groups add column if not exists purchase_details jsonb not null default '{}';
create table if not exists public.shopping_mutations (
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(user_id, operation_id)
);
alter table public.shopping_mutations enable row level security;
-- Access only through the ownership-checking RPC below.
create or replace function public.apply_shopping_mutation(operation_id uuid, operation jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); prior jsonb; current_value jsonb; changes jsonb;
  field text; value jsonb; conflicts jsonb := '{}'; g shopping_capture_groups;
  snap shopping_snaps; u jsonb; target uuid; result jsonb;
  allowed text[] := array['category','size_label','color_label','material_label','notes','is_favorite','catalog_status','productName','brand','productCode','purchaseUrl','priceOverride','currencyCode','coverPhotoId','wardrobeItemId'];
begin
  if uid is null then raise exception 'Authentication required'; end if;
  -- Serialize operations per account, including retries with the same operation ID.
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  select m.result into prior from shopping_mutations m where m.user_id=uid and m.operation_id=apply_shopping_mutation.operation_id;
  if found then return prior; end if;
  if operation->>'kind' = 'catalog' then
    select * into g from shopping_capture_groups where id=(operation->>'groupId')::uuid and user_id=uid for update;
    if not found then raise exception 'Shopping piece unavailable'; end if;
    current_value := (to_jsonb(g) - 'purchase_details') || g.purchase_details;
    changes := operation->'patch';
    for field, value in select * from jsonb_each(changes) loop
      if not field = any(allowed) then raise exception 'Unsupported field'; end if;
      if coalesce(current_value->field, 'null'::jsonb) is distinct from coalesce(operation->'base'->field, 'null'::jsonb)
        and coalesce(current_value->field, 'null'::jsonb) is distinct from value then
        conflicts := conflicts || jsonb_build_object(field, coalesce(current_value->field, 'null'::jsonb));
      end if;
    end loop;
    if conflicts <> '{}' then return jsonb_build_object('conflicts', conflicts); end if;
    current_value := current_value || changes;
    if current_value->>'priceOverride' is not null and (jsonb_typeof(current_value->'priceOverride') <> 'number' or (current_value->>'priceOverride')::numeric < 0) then raise exception 'Invalid price'; end if;
    if current_value->>'currencyCode' is not null and current_value->>'currencyCode' !~ '^[A-Z]{3}$' then raise exception 'Invalid currency'; end if;
    if current_value->>'purchaseUrl' is not null and current_value->>'purchaseUrl' !~ '^https?://[^/[:space:]]+' then raise exception 'Invalid purchase URL'; end if;
    if current_value->>'coverPhotoId' is not null and not exists(select 1 from shopping_snaps where id=(current_value->>'coverPhotoId')::uuid and user_id=uid and capture_group_id=g.id) then raise exception 'Cover must belong to this piece'; end if;
    update shopping_capture_groups set
      category=current_value->>'category', size_label=current_value->>'size_label',
      color_label=current_value->>'color_label', material_label=current_value->>'material_label',
      notes=current_value->>'notes', is_favorite=(current_value->>'is_favorite')::boolean,
      catalog_status=current_value->>'catalog_status', updated_at=now(),
      purchase_details=current_value - array['id','user_id','shopping_session_id','started_at','ended_at','created_at','updated_at','category','size_label','color_label','material_label','notes','is_favorite','catalog_status']
    where id=g.id and user_id=uid;
  elsif operation->>'kind' = 'organization' then
    -- Validate the full batch before writes; return resolvable field conflicts.
    for u in select * from jsonb_array_elements(operation->'updates') loop
      select * into snap from shopping_snaps where id=(u->>'snapId')::uuid and user_id=uid for update;
      if not found then raise exception 'Shopping photo unavailable'; end if;
      target := (u->>'captureGroupId')::uuid;
      if exists(select 1 from shopping_capture_groups where id=target and (user_id<>uid or shopping_session_id is distinct from snap.shopping_session_id)) then raise exception 'Invalid group or visit'; end if;
      if coalesce(u->>'baseGroupId', snap.capture_group_id::text) <> snap.capture_group_id::text and target <> snap.capture_group_id then
        conflicts := conflicts || jsonb_build_object(snap.id::text, jsonb_build_object('captureGroupId',snap.capture_group_id,'captureRole',snap.capture_role,'captureSequence',snap.capture_sequence));
      end if;
    end loop;
    if conflicts <> '{}' then return jsonb_build_object('conflicts',conflicts); end if;
    for u in select * from jsonb_array_elements(operation->'updates') loop
      select * into snap from shopping_snaps where id=(u->>'snapId')::uuid and user_id=uid;
      target := (u->>'captureGroupId')::uuid;
      select * into g from shopping_capture_groups where id=snap.capture_group_id and user_id=uid;
      insert into shopping_capture_groups(id,user_id,shopping_session_id,started_at,category,size_label,color_label,material_label,notes,is_favorite,catalog_status,purchase_details)
        values(target,uid,snap.shopping_session_id,to_timestamp((u->>'captureGroupStartedAt')::double precision / 1000),g.category,g.size_label,g.color_label,g.material_label,g.notes,g.is_favorite,g.catalog_status,g.purchase_details - 'coverPhotoId') on conflict(id) do nothing;
      -- Preserve source evidence when merging into an otherwise unannotated target.
      update shopping_capture_groups set purchase_details=jsonb_strip_nulls(g.purchase_details - 'coverPhotoId') || jsonb_strip_nulls(purchase_details)
        where id=target and user_id=uid and target<>g.id;
      update shopping_snaps set capture_group_id=target,capture_role=u->>'captureRole',capture_sequence=(u->>'captureSequence')::integer where id=snap.id and user_id=uid;
    end loop;
  else raise exception 'Unsupported operation'; end if;
  result := '{"ok":true}'::jsonb;
  insert into shopping_mutations(user_id,operation_id,result) values(uid,operation_id,result);
  return result;
end $$;
revoke all on function public.apply_shopping_mutation(uuid,jsonb) from public;
grant execute on function public.apply_shopping_mutation(uuid,jsonb) to authenticated;
