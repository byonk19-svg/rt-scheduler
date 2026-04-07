-- Managers could insert/update schedule_cycles but had no DELETE policy, so draft
-- cycle deletion from the app always failed under RLS. Match existing manager policies
-- and require unpublished rows so published cycles cannot be deleted at the DB layer.

create policy "Managers can delete unpublished cycles"
  on public.schedule_cycles
  for delete
  using (
    published = false
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'manager'::text
    )
  );
