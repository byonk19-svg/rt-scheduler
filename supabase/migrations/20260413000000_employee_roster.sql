-- Employee roster: managers pre-seed employee records here.
-- When someone signs up with a matching name, their profile is auto-provisioned
-- with the pre-configured role and shift details (bypassing the pending-approval flow).

create table public.employee_roster (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text, -- optional informational field; matching is by name
  role text not null check (role in ('therapist', 'lead', 'manager')),
  shift_type text not null default 'day' check (shift_type in ('day', 'night')),
  employment_type text not null default 'full_time' check (employment_type in ('full_time', 'part_time', 'prn')),
  is_lead_eligible boolean not null default false,
  max_work_days_per_week smallint not null default 3 check (max_work_days_per_week between 1 and 7),
  matched_profile_id uuid references public.profiles(id) on delete set null,
  matched_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

-- Unique index on normalized name for unmatched entries to prevent duplicate roster rows
create unique index employee_roster_normalized_name_unmatched_idx
  on public.employee_roster (trim(regexp_replace(lower(full_name), '\s+', ' ', 'g')))
  where matched_profile_id is null;

-- RLS: managers only
alter table public.employee_roster enable row level security;

create policy "Managers can manage employee roster"
  on public.employee_roster
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'manager'
        and p.is_active = true
        and p.archived_at is null
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'manager'
        and p.is_active = true
        and p.archived_at is null
    )
  );

-- Update handle_new_user to auto-match new signups against the employee roster by name.
-- Matching is case-insensitive and collapses repeated whitespace.
-- If matched: profile is created with the roster's role/shift/employment (active, no pending approval).
-- If not matched: falls through to the existing pending-profile behavior.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  roster_row employee_roster%rowtype;
  requested_shift text;
  first_name text;
  last_name text;
  computed_full_name text;
  normalized_signup_name text;
begin
  first_name := nullif(new.raw_user_meta_data->>'first_name', '');
  last_name := nullif(new.raw_user_meta_data->>'last_name', '');
  computed_full_name := nullif(trim(concat_ws(' ', first_name, last_name)), '');
  requested_shift := lower(coalesce(new.raw_user_meta_data->>'shift_type', ''));

  -- Normalize the signed-up name for roster comparison (lowercase + collapse spaces)
  normalized_signup_name := trim(regexp_replace(
    lower(coalesce(
      computed_full_name,
      nullif(new.raw_user_meta_data->>'full_name', ''),
      ''
    )),
    '\s+', ' ', 'g'
  ));

  -- Look for an unmatched roster entry with the same normalized name
  select * into roster_row
  from public.employee_roster
  where trim(regexp_replace(lower(full_name), '\s+', ' ', 'g')) = normalized_signup_name
    and matched_profile_id is null
    and length(normalized_signup_name) > 0
  limit 1;

  if found then
    -- Auto-match: provision a fully active profile from the roster record
    insert into public.profiles (
      id, full_name, email, role, shift_type, employment_type,
      is_lead_eligible, max_work_days_per_week, is_active
    ) values (
      new.id,
      coalesce(computed_full_name, roster_row.full_name, 'New User'),
      coalesce(new.email, ''),
      roster_row.role,
      roster_row.shift_type,
      roster_row.employment_type,
      roster_row.is_lead_eligible,
      coalesce(roster_row.max_work_days_per_week, 3),
      true
    )
    on conflict (id) do nothing;

    -- Record the match on the roster row
    update public.employee_roster
    set matched_profile_id = new.id,
        matched_at = now()
    where id = roster_row.id;

  else
    -- No roster match — create a pending profile (existing behavior)
    insert into public.profiles (id, full_name, email, phone_number, role, shift_type)
    values (
      new.id,
      coalesce(
        computed_full_name,
        nullif(new.raw_user_meta_data->>'full_name', ''),
        'New User'
      ),
      coalesce(new.email, ''),
      nullif(new.raw_user_meta_data->>'phone_number', ''),
      null,
      case when requested_shift in ('day', 'night') then requested_shift else 'day' end
    )
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;
