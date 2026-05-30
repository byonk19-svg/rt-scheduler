-- Keep official availability submission state site-scoped and writable by the
-- authenticated therapist. App server actions also validate site membership
-- before using the service role to record this lifecycle row.

drop policy if exists "Authenticated users can read allowed availability submissions"
  on public.therapist_availability_submissions;
drop policy if exists "Therapists can read own availability submissions"
  on public.therapist_availability_submissions;
drop policy if exists "Managers and leads can read all availability submissions"
  on public.therapist_availability_submissions;
drop policy if exists "Therapists can insert own availability submissions"
  on public.therapist_availability_submissions;
drop policy if exists "Therapists can update own availability submissions"
  on public.therapist_availability_submissions;
drop policy if exists "Therapists can delete own availability submissions"
  on public.therapist_availability_submissions;

create policy "Site users can read allowed availability submissions"
on public.therapist_availability_submissions
for select
to authenticated
using (
  therapist_id = (select auth.uid())
  or exists (
    select 1
    from public.profiles actor
    join public.profiles therapist on therapist.id = therapist_availability_submissions.therapist_id
    join public.schedule_cycles cycle
      on cycle.id = therapist_availability_submissions.schedule_cycle_id
    where actor.id = (select auth.uid())
      and actor.is_active = true
      and actor.archived_at is null
      and actor.role = any (array['manager'::text, 'lead'::text])
      and actor.site_id = therapist.site_id
      and actor.site_id = cycle.site_id
  )
);

create policy "Therapists can insert own same-site availability submissions"
on public.therapist_availability_submissions
for insert
to authenticated
with check (
  therapist_id = (select auth.uid())
  and exists (
    select 1
    from public.profiles therapist
    join public.schedule_cycles cycle
      on cycle.id = therapist_availability_submissions.schedule_cycle_id
    where therapist.id = (select auth.uid())
      and therapist.is_active = true
      and therapist.archived_at is null
      and therapist.site_id = cycle.site_id
  )
);

create policy "Therapists can update own same-site availability submissions"
on public.therapist_availability_submissions
for update
to authenticated
using (therapist_id = (select auth.uid()))
with check (
  therapist_id = (select auth.uid())
  and exists (
    select 1
    from public.profiles therapist
    join public.schedule_cycles cycle
      on cycle.id = therapist_availability_submissions.schedule_cycle_id
    where therapist.id = (select auth.uid())
      and therapist.is_active = true
      and therapist.archived_at is null
      and therapist.site_id = cycle.site_id
  )
);
