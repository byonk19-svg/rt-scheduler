create table if not exists public.employee_roster (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  normalized_full_name text not null unique,
  role text not null check (role = any (array['manager'::text, 'therapist'::text, 'lead'::text])),
  shift_type text not null default 'day' check (shift_type = any (array['day'::text, 'night'::text])),
  employment_type text not null default 'full_time' check (employment_type = any (array['full_time'::text, 'part_time'::text, 'prn'::text])),
  max_work_days_per_week smallint not null default 3 check (max_work_days_per_week between 1 and 7),
  is_lead_eligible boolean not null default false,
  is_active boolean not null default true,
  matched_profile_id uuid references public.profiles (id) on delete set null,
  matched_email text,
  matched_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists employee_roster_active_name_idx
  on public.employee_roster (normalized_full_name)
  where is_active = true;

create or replace function public.touch_employee_roster_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists employee_roster_touch_updated_at on public.employee_roster;
create trigger employee_roster_touch_updated_at
before update on public.employee_roster
for each row execute function public.touch_employee_roster_updated_at();

alter table public.employee_roster enable row level security;

drop policy if exists "Managers can read employee roster" on public.employee_roster;
create policy "Managers can read employee roster"
on public.employee_roster
for select
using (public.is_manager());

drop policy if exists "Managers can mutate employee roster" on public.employee_roster;
create policy "Managers can mutate employee roster"
on public.employee_roster
for all
using (public.is_manager())
with check (public.is_manager());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
  requested_shift text;
  first_name text;
  last_name text;
  computed_full_name text;
  normalized_name text;
  roster_match public.employee_roster%rowtype;
begin
  requested_role := lower(coalesce(new.raw_user_meta_data->>'role', ''));
  requested_shift := lower(coalesce(new.raw_user_meta_data->>'shift_type', ''));
  first_name := nullif(new.raw_user_meta_data->>'first_name', '');
  last_name := nullif(new.raw_user_meta_data->>'last_name', '');
  computed_full_name := nullif(trim(concat_ws(' ', first_name, last_name)), '');
  normalized_name := lower(regexp_replace(coalesce(computed_full_name, nullif(new.raw_user_meta_data->>'full_name', ''), ''), '\s+', ' ', 'g'));

  select *
    into roster_match
  from public.employee_roster
  where is_active = true
    and normalized_full_name = normalized_name
    and matched_profile_id is null
  order by created_at asc
  limit 1
  for update skip locked;

  insert into public.profiles (
    id,
    full_name,
    email,
    phone_number,
    role,
    shift_type,
    employment_type,
    max_work_days_per_week,
    is_lead_eligible,
    is_active
  )
  values (
    new.id,
    coalesce(computed_full_name, nullif(new.raw_user_meta_data->>'full_name', ''), 'New User'),
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data->>'phone_number', ''),
    case
      when roster_match.id is not null then roster_match.role
      when requested_role in ('manager', 'therapist', 'lead') then requested_role
      else null
    end,
    case
      when roster_match.id is not null then roster_match.shift_type
      when requested_shift in ('day', 'night') then requested_shift
      else 'day'
    end,
    coalesce(roster_match.employment_type, 'full_time'),
    coalesce(roster_match.max_work_days_per_week, 3),
    coalesce(roster_match.is_lead_eligible, false),
    coalesce(roster_match.is_active, true)
  )
  on conflict (id) do nothing;

  if roster_match.id is not null then
    update public.employee_roster
    set
      matched_profile_id = new.id,
      matched_email = coalesce(new.email, ''),
      matched_at = now()
    where id = roster_match.id;
  end if;

  return new;
end;
$$;
