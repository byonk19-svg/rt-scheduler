-- Reassert availability override freshness metadata and restrict broad reads to
-- managers/leads. Therapists and staff can read only their own override rows.

alter table if exists public.availability_overrides
  add column if not exists updated_at timestamptz not null default now();

update public.availability_overrides
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

alter table if exists public.availability_overrides
  alter column updated_at set default now(),
  alter column updated_at set not null;

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

drop policy if exists "Managers and leads can read all availability overrides"
  on public.availability_overrides;

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
            and public.availability_overrides.therapist_id = auth.uid()
          )
        )
    )
  );
