-- Add source metadata and stricter therapist/manager RLS behavior for cycle-scoped availability overrides.

alter table if exists public.availability_overrides
  add column if not exists source text not null default 'therapist';

alter table if exists public.availability_overrides
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'availability_overrides_source_check'
  ) then
    alter table public.availability_overrides
      add constraint availability_overrides_source_check
      check (source in ('therapist', 'manager'));
  end if;
end
$$;

update public.availability_overrides
set source = case
  when created_by = therapist_id then 'therapist'
  else 'manager'
end
where source is null
   or source not in ('therapist', 'manager');

create or replace function public.touch_availability_overrides_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

alter function public.touch_availability_overrides_updated_at() owner to postgres;

drop trigger if exists availability_overrides_touch_updated_at on public.availability_overrides;
create trigger availability_overrides_touch_updated_at
before update on public.availability_overrides
for each row execute function public.touch_availability_overrides_updated_at();

drop policy if exists "Therapists can view own availability overrides" on public.availability_overrides;
create policy "Therapists can view own availability overrides"
  on public.availability_overrides
  for select
  using (auth.uid() = therapist_id and source = 'therapist');

drop policy if exists "Therapists can insert own availability overrides" on public.availability_overrides;
create policy "Therapists can insert own availability overrides"
  on public.availability_overrides
  for insert
  with check (auth.uid() = therapist_id and auth.uid() = created_by and source = 'therapist');

drop policy if exists "Therapists can update own availability overrides" on public.availability_overrides;
create policy "Therapists can update own availability overrides"
  on public.availability_overrides
  for update
  using (auth.uid() = therapist_id and source = 'therapist')
  with check (auth.uid() = therapist_id and source = 'therapist');

drop policy if exists "Therapists can delete own availability overrides" on public.availability_overrides;
create policy "Therapists can delete own availability overrides"
  on public.availability_overrides
  for delete
  using (auth.uid() = therapist_id and source = 'therapist');

drop policy if exists "Managers and leads can read all availability overrides" on public.availability_overrides;
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

drop policy if exists "Managers can modify all availability overrides" on public.availability_overrides;
create policy "Managers can modify all availability overrides"
  on public.availability_overrides
  for all
  using (public.is_manager())
  with check (public.is_manager());
