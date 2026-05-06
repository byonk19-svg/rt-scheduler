drop policy if exists "Active users can read lottery requests" on public.lottery_requests;
create policy "Managers and owners can read lottery requests"
  on public.lottery_requests
  for select
  using (
    exists (
      select 1
      from public.profiles actor
      where actor.id = auth.uid()
        and actor.is_active = true
        and actor.archived_at is null
        and actor.site_id = lottery_requests.site_id
        and (actor.role = 'manager' or lottery_requests.therapist_id = auth.uid())
    )
  );

drop policy if exists "Users can insert allowed lottery requests" on public.lottery_requests;
create policy "Users can insert their own active lottery requests"
  on public.lottery_requests
  for insert
  with check (
    auth.uid() = created_by
    and auth.uid() = therapist_id
    and state = 'active'
    and suppressed_at is null
    and suppressed_by is null
    and restored_at is null
    and restored_by is null
    and exists (
      select 1
      from public.profiles actor
      where actor.id = auth.uid()
        and actor.is_active = true
        and actor.archived_at is null
        and actor.site_id = lottery_requests.site_id
    )
  );

drop policy if exists "Users can update allowed lottery requests" on public.lottery_requests;
drop policy if exists "Users can delete allowed lottery requests" on public.lottery_requests;

drop policy if exists "Active users can read lottery decisions" on public.lottery_decisions;
create policy "Managers can read lottery decisions"
  on public.lottery_decisions
  for select
  using (
    exists (
      select 1
      from public.profiles actor
      where actor.id = auth.uid()
        and actor.role = 'manager'
        and actor.is_active = true
        and actor.archived_at is null
        and actor.site_id = lottery_decisions.site_id
    )
  );

drop policy if exists "Leads and managers can manage lottery decisions" on public.lottery_decisions;
create policy "Managers can manage lottery decisions"
  on public.lottery_decisions
  for all
  using (
    exists (
      select 1
      from public.profiles actor
      where actor.id = auth.uid()
        and actor.role = 'manager'
        and actor.is_active = true
        and actor.archived_at is null
        and actor.site_id = lottery_decisions.site_id
    )
  )
  with check (
    auth.uid() = applied_by
    and exists (
      select 1
      from public.profiles actor
      where actor.id = auth.uid()
        and actor.role = 'manager'
        and actor.is_active = true
        and actor.archived_at is null
        and actor.site_id = lottery_decisions.site_id
    )
  );

drop policy if exists "Active users can read lottery history entries" on public.lottery_history_entries;
create policy "Managers and owners can read lottery history entries"
  on public.lottery_history_entries
  for select
  using (
    exists (
      select 1
      from public.profiles actor
      where actor.id = auth.uid()
        and actor.is_active = true
        and actor.archived_at is null
        and actor.site_id = lottery_history_entries.site_id
        and (actor.role = 'manager' or lottery_history_entries.therapist_id = auth.uid())
    )
  );

drop policy if exists "Leads and managers can manage lottery history entries" on public.lottery_history_entries;
create policy "Managers can manage lottery history entries"
  on public.lottery_history_entries
  for all
  using (
    exists (
      select 1
      from public.profiles actor
      where actor.id = auth.uid()
        and actor.role = 'manager'
        and actor.is_active = true
        and actor.archived_at is null
        and actor.site_id = lottery_history_entries.site_id
    )
  )
  with check (
    auth.uid() = created_by
    and exists (
      select 1
      from public.profiles actor
      where actor.id = auth.uid()
        and actor.role = 'manager'
        and actor.is_active = true
        and actor.archived_at is null
        and actor.site_id = lottery_history_entries.site_id
    )
  );

drop policy if exists "Leads and managers can manage lottery list entries" on public.lottery_list_entries;
create policy "Managers can manage lottery list entries"
  on public.lottery_list_entries
  for all
  using (
    exists (
      select 1
      from public.profiles actor
      where actor.id = auth.uid()
        and actor.role = 'manager'
        and actor.is_active = true
        and actor.archived_at is null
        and actor.site_id = lottery_list_entries.site_id
    )
  )
  with check (
    auth.uid() = created_by
    and auth.uid() = updated_by
    and exists (
      select 1
      from public.profiles actor
      where actor.id = auth.uid()
        and actor.role = 'manager'
        and actor.is_active = true
        and actor.archived_at is null
        and actor.site_id = lottery_list_entries.site_id
    )
  );
