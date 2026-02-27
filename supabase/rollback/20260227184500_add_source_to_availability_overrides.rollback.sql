-- Rollback source metadata and therapist-source RLS restrictions on availability_overrides.

drop policy if exists "Managers can modify all availability overrides" on public.availability_overrides;
drop policy if exists "Managers and leads can read all availability overrides" on public.availability_overrides;
drop policy if exists "Therapists can delete own availability overrides" on public.availability_overrides;
drop policy if exists "Therapists can update own availability overrides" on public.availability_overrides;
drop policy if exists "Therapists can insert own availability overrides" on public.availability_overrides;
drop policy if exists "Therapists can view own availability overrides" on public.availability_overrides;

create policy "Therapists can view own availability overrides"
  on public.availability_overrides
  for select
  using (auth.uid() = therapist_id);

create policy "Therapists can insert own availability overrides"
  on public.availability_overrides
  for insert
  with check (auth.uid() = therapist_id and auth.uid() = created_by);

create policy "Therapists can update own availability overrides"
  on public.availability_overrides
  for update
  using (auth.uid() = therapist_id)
  with check (auth.uid() = therapist_id);

create policy "Therapists can delete own availability overrides"
  on public.availability_overrides
  for delete
  using (auth.uid() = therapist_id);

create policy "Managers and leads can read all availability overrides"
  on public.availability_overrides
  for select
  using (
    exists (
      select 1
      from public.profiles actor_profile
      where actor_profile.id = auth.uid()
        and (
          actor_profile.role in ('manager', 'lead')
          or (
            actor_profile.role in ('therapist', 'staff')
            and coalesce(actor_profile.is_lead_eligible, false) = true
          )
        )
    )
  );

create policy "Managers can modify all availability overrides"
  on public.availability_overrides
  for all
  using (public.is_manager())
  with check (public.is_manager());

drop trigger if exists availability_overrides_touch_updated_at on public.availability_overrides;
drop function if exists public.touch_availability_overrides_updated_at();

alter table if exists public.availability_overrides
  drop constraint if exists availability_overrides_source_check;

alter table if exists public.availability_overrides
  drop column if exists updated_at;

alter table if exists public.availability_overrides
  drop column if exists source;
