-- Work patterns + cycle-scoped availability overrides + auto-generate unfilled reasons.

create table if not exists public.work_patterns (
  therapist_id uuid primary key references public.profiles(id) on delete cascade,
  works_dow smallint[] not null default '{}',
  offs_dow smallint[] not null default '{}',
  weekend_rotation text not null default 'none',
  weekend_anchor_date date,
  works_dow_mode text not null default 'hard',
  shift_preference text not null default 'either',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_patterns_weekend_rotation_check
    check (weekend_rotation in ('none', 'every_other')),
  constraint work_patterns_works_dow_mode_check
    check (works_dow_mode in ('hard', 'soft')),
  constraint work_patterns_works_dow_values_check
    check (works_dow <@ array[0,1,2,3,4,5,6]::smallint[]),
  constraint work_patterns_offs_dow_values_check
    check (offs_dow <@ array[0,1,2,3,4,5,6]::smallint[]),
  constraint work_patterns_weekend_anchor_required_check
    check (weekend_rotation <> 'every_other' or weekend_anchor_date is not null),
  constraint work_patterns_weekend_anchor_saturday_check
    check (
      weekend_rotation <> 'every_other'
      or extract(dow from weekend_anchor_date) = 6
    )
);

create index if not exists work_patterns_weekend_rotation_idx
  on public.work_patterns (weekend_rotation);

create or replace function public.touch_work_patterns_updated_at()
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

alter function public.touch_work_patterns_updated_at() owner to postgres;

drop trigger if exists work_patterns_touch_updated_at on public.work_patterns;
create trigger work_patterns_touch_updated_at
before update on public.work_patterns
for each row execute function public.touch_work_patterns_updated_at();

insert into public.work_patterns (
  therapist_id,
  works_dow,
  offs_dow,
  weekend_rotation,
  weekend_anchor_date,
  works_dow_mode,
  shift_preference
)
select
  p.id,
  coalesce(p.preferred_work_days::smallint[], '{}'::smallint[]),
  '{}'::smallint[],
  'none',
  null,
  'hard',
  'either'
from public.profiles p
where p.role = 'therapist'
on conflict (therapist_id) do nothing;

alter table public.work_patterns enable row level security;

drop policy if exists "Managers can read all work patterns" on public.work_patterns;
create policy "Managers can read all work patterns"
  on public.work_patterns
  for select
  using (public.is_manager());

drop policy if exists "Managers can modify all work patterns" on public.work_patterns;
create policy "Managers can modify all work patterns"
  on public.work_patterns
  for all
  using (public.is_manager())
  with check (public.is_manager());

drop policy if exists "Therapists can read own work pattern" on public.work_patterns;
create policy "Therapists can read own work pattern"
  on public.work_patterns
  for select
  using (auth.uid() = therapist_id);

grant all on table public.work_patterns to authenticated;
grant all on table public.work_patterns to service_role;

create table if not exists public.availability_overrides (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.schedule_cycles(id) on delete cascade,
  therapist_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  shift_type text not null default 'both',
  override_type text not null,
  note text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint availability_overrides_shift_type_check
    check (shift_type in ('day', 'night', 'both')),
  constraint availability_overrides_override_type_check
    check (override_type in ('force_off', 'force_on')),
  constraint availability_overrides_unique_cycle_therapist_date_shift unique (cycle_id, therapist_id, date, shift_type)
);

create index if not exists availability_overrides_cycle_date_idx
  on public.availability_overrides (cycle_id, date);

create index if not exists availability_overrides_cycle_therapist_idx
  on public.availability_overrides (cycle_id, therapist_id);

create or replace function public.restrict_availability_override_cycle_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_is_manager boolean := false;
  actor_role text := coalesce(auth.role(), '');
begin
  if actor_role in ('service_role', 'postgres') then
    return new;
  end if;

  if new.cycle_id is distinct from old.cycle_id then
    select public.is_manager() into actor_is_manager;
    if not actor_is_manager then
      raise exception 'Only managers can change cycle on availability overrides.' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

alter function public.restrict_availability_override_cycle_updates() owner to postgres;
grant execute on function public.restrict_availability_override_cycle_updates() to authenticated;
grant execute on function public.restrict_availability_override_cycle_updates() to service_role;

drop trigger if exists availability_overrides_restrict_cycle_updates on public.availability_overrides;
create trigger availability_overrides_restrict_cycle_updates
before update on public.availability_overrides
for each row execute function public.restrict_availability_override_cycle_updates();

alter table public.availability_overrides enable row level security;

drop policy if exists "Therapists can view own availability overrides" on public.availability_overrides;
create policy "Therapists can view own availability overrides"
  on public.availability_overrides
  for select
  using (auth.uid() = therapist_id);

drop policy if exists "Therapists can insert own availability overrides" on public.availability_overrides;
create policy "Therapists can insert own availability overrides"
  on public.availability_overrides
  for insert
  with check (auth.uid() = therapist_id and auth.uid() = created_by);

drop policy if exists "Therapists can update own availability overrides" on public.availability_overrides;
create policy "Therapists can update own availability overrides"
  on public.availability_overrides
  for update
  using (auth.uid() = therapist_id)
  with check (auth.uid() = therapist_id);

drop policy if exists "Therapists can delete own availability overrides" on public.availability_overrides;
create policy "Therapists can delete own availability overrides"
  on public.availability_overrides
  for delete
  using (auth.uid() = therapist_id);

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

grant all on table public.availability_overrides to authenticated;
grant all on table public.availability_overrides to service_role;

alter table public.shifts
  add column if not exists unfilled_reason text;

create index if not exists shifts_unfilled_reason_idx
  on public.shifts (cycle_id, date, shift_type)
  where unfilled_reason is not null;
