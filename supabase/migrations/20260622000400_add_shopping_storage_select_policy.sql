-- Storage upserts require SELECT in addition to INSERT and UPDATE. Keep read
-- access scoped to the authenticated user's own folder even though objects are
-- served publicly through the bucket URL.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can read their own shopping snap objects'
  ) then
    create policy "Users can read their own shopping snap objects"
      on storage.objects
      for select
      to authenticated
      using (
        bucket_id = 'shopping-snaps'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  end if;
end
$$;
