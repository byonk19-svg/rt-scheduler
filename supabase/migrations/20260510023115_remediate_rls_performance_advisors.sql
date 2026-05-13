-- Remediate remaining Supabase performance advisor findings without changing
-- the intended access model. Consolidate overlapping permissive policies first,
-- then wrap auth helpers so they are evaluated once per statement.

begin;

-- SELECT policy overlaps.
drop policy if exists "Managers and leads can read availability entries" on public.availability_entries;
drop policy if exists "Therapists can view own availability entries" on public.availability_entries;
create policy "Authenticated users can read allowed availability entries"
on public.availability_entries
for select
to public
using (
  exists (
    select 1
    from public.profiles actor_profile
    where actor_profile.id = auth.uid()
      and (
        actor_profile.role = any (array['manager'::text, 'lead'::text])
        or (
          actor_profile.role = any (array['therapist'::text, 'staff'::text])
          and coalesce(actor_profile.is_lead_eligible, false) = true
        )
      )
  )
  or auth.uid() = therapist_id
);

drop policy if exists "Managers and leads can read all availability overrides" on public.availability_overrides;
drop policy if exists "Therapists can view own availability overrides" on public.availability_overrides;
create policy "Authenticated users can read allowed availability overrides"
on public.availability_overrides
for select
to public
using (
  exists (
    select 1
    from public.profiles actor_profile
    where actor_profile.id = auth.uid()
      and (
        actor_profile.role = any (array['manager'::text, 'lead'::text])
        or (
          actor_profile.role = any (array['therapist'::text, 'staff'::text])
          and availability_overrides.therapist_id = auth.uid()
        )
      )
  )
  or (auth.uid() = therapist_id and source = 'therapist'::text)
);

drop policy if exists "Managers can view all availability" on public.availability_requests;
drop policy if exists "Users can view their own availability" on public.availability_requests;
create policy "Authenticated users can read allowed availability requests"
on public.availability_requests
for select
to public
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'manager'::text
  )
);

drop policy if exists "Managers can read all preliminary requests" on public.preliminary_requests;
drop policy if exists "Users can read own preliminary requests" on public.preliminary_requests;
create policy "Authenticated users can read allowed preliminary requests"
on public.preliminary_requests
for select
to public
using (
  exists (
    select 1
    from public.profiles manager_profile
    where manager_profile.id = auth.uid()
      and manager_profile.role = 'manager'::text
      and manager_profile.is_active = true
      and manager_profile.archived_at is null
  )
  or (
    auth.uid() = requester_id
    and exists (
      select 1
      from public.profiles requester_profile
      where requester_profile.id = auth.uid()
        and requester_profile.is_active = true
        and requester_profile.archived_at is null
    )
  )
);

drop policy if exists "Managers can update preliminary requests" on public.preliminary_requests;
drop policy if exists "Users can cancel own preliminary requests" on public.preliminary_requests;
create policy "Authenticated users can update allowed preliminary requests"
on public.preliminary_requests
for update
to public
using (
  exists (
    select 1
    from public.profiles manager_profile
    where manager_profile.id = auth.uid()
      and manager_profile.role = 'manager'::text
      and manager_profile.is_active = true
      and manager_profile.archived_at is null
  )
  or (
    auth.uid() = requester_id
    and status = 'pending'::text
    and exists (
      select 1
      from public.profiles requester_profile
      where requester_profile.id = auth.uid()
        and requester_profile.is_active = true
        and requester_profile.archived_at is null
    )
  )
)
with check (
  exists (
    select 1
    from public.profiles manager_profile
    where manager_profile.id = auth.uid()
      and manager_profile.role = 'manager'::text
      and manager_profile.is_active = true
      and manager_profile.archived_at is null
  )
  or (
    auth.uid() = requester_id
    and exists (
      select 1
      from public.profiles requester_profile
      where requester_profile.id = auth.uid()
        and requester_profile.is_active = true
        and requester_profile.archived_at is null
    )
  )
);

drop policy if exists "Managers and leads can read all profiles" on public.profiles;
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Authenticated users can read allowed profiles"
on public.profiles
for select
to public
using (is_manager() or is_lead() or auth.uid() = id);

drop policy if exists "Managers can update all profiles" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Authenticated users can update allowed profiles"
on public.profiles
for update
to public
using (
  auth.uid() = id
  or exists (
    select 1
    from public.profiles manager_profile
    where manager_profile.id = auth.uid()
      and manager_profile.role = 'manager'::text
  )
)
with check (
  auth.uid() = id
  or exists (
    select 1
    from public.profiles manager_profile
    where manager_profile.id = auth.uid()
      and manager_profile.role = 'manager'::text
  )
);

drop policy if exists "Active users can view same-site published cycles" on public.schedule_cycles;
drop policy if exists "Leads can view same-site cycles" on public.schedule_cycles;
drop policy if exists "Managers can view same-site cycles" on public.schedule_cycles;
create policy "Authenticated users can view allowed same-site cycles"
on public.schedule_cycles
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles actor
    where actor.id = auth.uid()
      and actor.is_active = true
      and actor.archived_at is null
      and actor.site_id = schedule_cycles.site_id
      and (
        schedule_cycles.published = true
        or actor.role = any (array['manager'::text, 'lead'::text])
      )
  )
);

drop policy if exists "Managers can read shift post interests" on public.shift_post_interests;
drop policy if exists "Post participants can read shift post interests" on public.shift_post_interests;
create policy "Authenticated users can read allowed shift post interests"
on public.shift_post_interests
for select
to public
using (
  exists (
    select 1
    from public.profiles actor
    where actor.id = auth.uid()
      and actor.role = 'manager'::text
      and actor.is_active = true
      and actor.archived_at is null
  )
  or therapist_id = auth.uid()
  or exists (
    select 1
    from public.shift_posts post
    where post.id = shift_post_interests.shift_post_id
      and post.posted_by = auth.uid()
  )
);

drop policy if exists "Authenticated users can read team shift posts" on public.shift_posts;
drop policy if exists "Managers can read all shift posts" on public.shift_posts;
drop policy if exists "Participants can read direct shift posts" on public.shift_posts;
create policy "Authenticated users can read allowed shift posts"
on public.shift_posts
for select
to public
using (
  (auth.uid() is not null and coalesce(visibility, 'team'::text) = 'team'::text)
  or exists (
    select 1
    from public.profiles actor
    where actor.id = auth.uid()
      and actor.role = 'manager'::text
      and actor.is_active = true
      and actor.archived_at is null
  )
  or (
    coalesce(visibility, 'team'::text) = 'direct'::text
    and auth.uid() is not null
    and (posted_by = auth.uid() or claimed_by = auth.uid())
  )
);

drop policy if exists "Active users can view same-site published shifts" on public.shifts;
drop policy if exists "Leads can view same-site shifts" on public.shifts;
drop policy if exists "Managers can view same-site shifts" on public.shifts;
create policy "Authenticated users can view allowed same-site shifts"
on public.shifts
for select
to authenticated
using (
  exists (
    select 1
    from public.schedule_cycles cycle
    join public.profiles actor on actor.id = auth.uid()
    where cycle.id = shifts.cycle_id
      and actor.is_active = true
      and actor.archived_at is null
      and actor.site_id = shifts.site_id
      and actor.site_id = cycle.site_id
      and (
        cycle.published = true
        or actor.role = any (array['manager'::text, 'lead'::text])
      )
  )
);

drop policy if exists "Managers and leads can read all availability submissions" on public.therapist_availability_submissions;
drop policy if exists "Therapists can read own availability submissions" on public.therapist_availability_submissions;
create policy "Authenticated users can read allowed availability submissions"
on public.therapist_availability_submissions
for select
to public
using (
  therapist_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = any (array['manager'::text, 'lead'::text])
  )
);

-- Split broad ALL policies that overlap separate SELECT policies.
drop policy if exists "Managers can modify availability email attachments" on public.availability_email_attachments;
create policy "Managers can insert availability email attachments"
on public.availability_email_attachments for insert to public with check (is_manager());
create policy "Managers can update availability email attachments"
on public.availability_email_attachments for update to public using (is_manager()) with check (is_manager());
create policy "Managers can delete availability email attachments"
on public.availability_email_attachments for delete to public using (is_manager());

drop policy if exists "Managers can modify availability email intakes" on public.availability_email_intakes;
create policy "Managers can insert availability email intakes"
on public.availability_email_intakes for insert to public with check (is_manager());
create policy "Managers can update availability email intakes"
on public.availability_email_intakes for update to public using (is_manager()) with check (is_manager());
create policy "Managers can delete availability email intakes"
on public.availability_email_intakes for delete to public using (is_manager());

drop policy if exists "Managers can modify availability email intake items" on public.availability_email_intake_items;
create policy "Managers can insert availability email intake items"
on public.availability_email_intake_items for insert to public with check (is_manager());
create policy "Managers can update availability email intake items"
on public.availability_email_intake_items for update to public using (is_manager()) with check (is_manager());
create policy "Managers can delete availability email intake items"
on public.availability_email_intake_items for delete to public using (is_manager());

drop policy if exists "Managers can modify all availability overrides" on public.availability_overrides;
drop policy if exists "Therapists can insert own availability overrides" on public.availability_overrides;
drop policy if exists "Therapists can update own availability overrides" on public.availability_overrides;
drop policy if exists "Therapists can delete own availability overrides" on public.availability_overrides;
create policy "Authenticated users can insert allowed availability overrides"
on public.availability_overrides
for insert
to public
with check (
  is_manager()
  or (auth.uid() = therapist_id and auth.uid() = created_by and source = 'therapist'::text)
);
create policy "Authenticated users can update allowed availability overrides"
on public.availability_overrides
for update
to public
using (
  is_manager()
  or (auth.uid() = therapist_id and source = 'therapist'::text)
)
with check (
  is_manager()
  or (auth.uid() = therapist_id and source = 'therapist'::text)
);
create policy "Authenticated users can delete allowed availability overrides"
on public.availability_overrides
for delete
to public
using (
  is_manager()
  or (auth.uid() = therapist_id and source = 'therapist'::text)
);

do $$
begin
  if to_regclass('public.availability_reviews') is not null then
    drop policy if exists "managers_all_availability_reviews" on public.availability_reviews;
    drop policy if exists "therapists_read_own_availability_reviews" on public.availability_reviews;
    create policy "Authenticated users can read allowed availability reviews"
    on public.availability_reviews
    for select
    to public
    using (
      therapist_id = auth.uid()
      or exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
          and profiles.role = 'manager'::text
      )
    );
    create policy "Managers can insert availability reviews"
    on public.availability_reviews
    for insert
    to public
    with check (
      exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
          and profiles.role = 'manager'::text
      )
    );
    create policy "Managers can update availability reviews"
    on public.availability_reviews
    for update
    to public
    using (
      exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
          and profiles.role = 'manager'::text
      )
    )
    with check (
      exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
          and profiles.role = 'manager'::text
      )
    );
    create policy "Managers can delete availability reviews"
    on public.availability_reviews
    for delete
    to public
    using (
      exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
          and profiles.role = 'manager'::text
      )
    );
  end if;
end;
$$;

drop policy if exists "Managers can mutate employee roster" on public.employee_roster;
create policy "Managers can insert employee roster"
on public.employee_roster for insert to public with check (is_manager());
create policy "Managers can update employee roster"
on public.employee_roster for update to public using (is_manager()) with check (is_manager());
create policy "Managers can delete employee roster"
on public.employee_roster for delete to public using (is_manager());

drop policy if exists "Managers can manage lottery decisions" on public.lottery_decisions;
create policy "Managers can insert lottery decisions"
on public.lottery_decisions
for insert
to public
with check (
  auth.uid() = applied_by
  and exists (
    select 1
    from public.profiles actor
    where actor.id = auth.uid()
      and actor.role = 'manager'::text
      and actor.is_active = true
      and actor.archived_at is null
      and actor.site_id = lottery_decisions.site_id
  )
);
create policy "Managers can update lottery decisions"
on public.lottery_decisions
for update
to public
using (
  exists (
    select 1
    from public.profiles actor
    where actor.id = auth.uid()
      and actor.role = 'manager'::text
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
      and actor.role = 'manager'::text
      and actor.is_active = true
      and actor.archived_at is null
      and actor.site_id = lottery_decisions.site_id
  )
);
create policy "Managers can delete lottery decisions"
on public.lottery_decisions
for delete
to public
using (
  exists (
    select 1
    from public.profiles actor
    where actor.id = auth.uid()
      and actor.role = 'manager'::text
      and actor.is_active = true
      and actor.archived_at is null
      and actor.site_id = lottery_decisions.site_id
  )
);

drop policy if exists "Managers can manage lottery history entries" on public.lottery_history_entries;
create policy "Managers can insert lottery history entries"
on public.lottery_history_entries
for insert
to public
with check (
  auth.uid() = created_by
  and exists (
    select 1
    from public.profiles actor
    where actor.id = auth.uid()
      and actor.role = 'manager'::text
      and actor.is_active = true
      and actor.archived_at is null
      and actor.site_id = lottery_history_entries.site_id
  )
);
create policy "Managers can update lottery history entries"
on public.lottery_history_entries
for update
to public
using (
  exists (
    select 1
    from public.profiles actor
    where actor.id = auth.uid()
      and actor.role = 'manager'::text
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
      and actor.role = 'manager'::text
      and actor.is_active = true
      and actor.archived_at is null
      and actor.site_id = lottery_history_entries.site_id
  )
);
create policy "Managers can delete lottery history entries"
on public.lottery_history_entries
for delete
to public
using (
  exists (
    select 1
    from public.profiles actor
    where actor.id = auth.uid()
      and actor.role = 'manager'::text
      and actor.is_active = true
      and actor.archived_at is null
      and actor.site_id = lottery_history_entries.site_id
  )
);

drop policy if exists "Managers can manage lottery list entries" on public.lottery_list_entries;
create policy "Managers can insert lottery list entries"
on public.lottery_list_entries
for insert
to public
with check (
  auth.uid() = created_by
  and auth.uid() = updated_by
  and exists (
    select 1
    from public.profiles actor
    where actor.id = auth.uid()
      and actor.role = 'manager'::text
      and actor.is_active = true
      and actor.archived_at is null
      and actor.site_id = lottery_list_entries.site_id
  )
);
create policy "Managers can update lottery list entries"
on public.lottery_list_entries
for update
to public
using (
  exists (
    select 1
    from public.profiles actor
    where actor.id = auth.uid()
      and actor.role = 'manager'::text
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
      and actor.role = 'manager'::text
      and actor.is_active = true
      and actor.archived_at is null
      and actor.site_id = lottery_list_entries.site_id
  )
);
create policy "Managers can delete lottery list entries"
on public.lottery_list_entries
for delete
to public
using (
  exists (
    select 1
    from public.profiles actor
    where actor.id = auth.uid()
      and actor.role = 'manager'::text
      and actor.is_active = true
      and actor.archived_at is null
      and actor.site_id = lottery_list_entries.site_id
  )
);

drop policy if exists "Managers can mutate preliminary shift states" on public.preliminary_shift_states;
create policy "Managers can insert preliminary shift states"
on public.preliminary_shift_states
for insert
to public
with check (
  exists (
    select 1
    from public.profiles manager_profile
    where manager_profile.id = auth.uid()
      and manager_profile.role = 'manager'::text
      and manager_profile.is_active = true
      and manager_profile.archived_at is null
  )
);
create policy "Managers can update preliminary shift states"
on public.preliminary_shift_states
for update
to public
using (
  exists (
    select 1
    from public.profiles manager_profile
    where manager_profile.id = auth.uid()
      and manager_profile.role = 'manager'::text
      and manager_profile.is_active = true
      and manager_profile.archived_at is null
  )
)
with check (
  exists (
    select 1
    from public.profiles manager_profile
    where manager_profile.id = auth.uid()
      and manager_profile.role = 'manager'::text
      and manager_profile.is_active = true
      and manager_profile.archived_at is null
  )
);
create policy "Managers can delete preliminary shift states"
on public.preliminary_shift_states
for delete
to public
using (
  exists (
    select 1
    from public.profiles manager_profile
    where manager_profile.id = auth.uid()
      and manager_profile.role = 'manager'::text
      and manager_profile.is_active = true
      and manager_profile.archived_at is null
  )
);

-- Apply Supabase's initplan recommendation across remaining policies.
do $$
declare
  policy_row record;
  next_qual text;
  next_check text;
  sql text;
begin
  for policy_row in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (
        coalesce(qual, '') like '%auth.uid()%'
        or coalesce(with_check, '') like '%auth.uid()%'
        or coalesce(qual, '') like '%auth.role()%'
        or coalesce(with_check, '') like '%auth.role()%'
      )
  loop
    next_qual := policy_row.qual;
    next_check := policy_row.with_check;

    if next_qual is not null then
      next_qual := replace(next_qual, '(select auth.uid())', '__AUTH_UID__');
      next_qual := replace(next_qual, '(select auth.role())', '__AUTH_ROLE__');
      next_qual := replace(next_qual, 'auth.uid()', '(select auth.uid())');
      next_qual := replace(next_qual, 'auth.role()', '(select auth.role())');
      next_qual := replace(next_qual, '__AUTH_UID__', '(select auth.uid())');
      next_qual := replace(next_qual, '__AUTH_ROLE__', '(select auth.role())');
    end if;

    if next_check is not null then
      next_check := replace(next_check, '(select auth.uid())', '__AUTH_UID__');
      next_check := replace(next_check, '(select auth.role())', '__AUTH_ROLE__');
      next_check := replace(next_check, 'auth.uid()', '(select auth.uid())');
      next_check := replace(next_check, 'auth.role()', '(select auth.role())');
      next_check := replace(next_check, '__AUTH_UID__', '(select auth.uid())');
      next_check := replace(next_check, '__AUTH_ROLE__', '(select auth.role())');
    end if;

    sql := format('alter policy %I on %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
    if next_qual is not null then
      sql := sql || format(' using (%s)', next_qual);
    end if;
    if next_check is not null then
      sql := sql || format(' with check (%s)', next_check);
    end if;
    execute sql;
  end loop;
end;
$$;

commit;
