begin;

do $$
begin
  create type public.profile_access_status as enum ('pending', 'approved', 'declined');
exception
  when duplicate_object then null;
end $$;

alter table public.profiles
  add column if not exists access_status public.profile_access_status not null default 'approved';

update public.profiles
set access_status = 'pending'
where role is null;

create index if not exists profiles_pending_access_idx
  on public.profiles (created_at desc)
  where access_status = 'pending';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  first_name text;
  last_name text;
  computed_full_name text;
  normalized_name text;
  signup_phone text;
  resolved_role text;
  resolved_access_status public.profile_access_status;
  should_require_onboarding boolean;
  roster_match public.employee_roster%rowtype;
begin
  first_name := nullif(new.raw_user_meta_data->>'first_name', '');
  last_name := nullif(new.raw_user_meta_data->>'last_name', '');
  computed_full_name := nullif(trim(concat_ws(' ', first_name, last_name)), '');
  normalized_name := nullif(
    lower(
      trim(
        regexp_replace(
          coalesce(computed_full_name, nullif(btrim(new.raw_user_meta_data->>'full_name'), ''), ''),
          '\s+',
          ' ',
          'g'
        )
      )
    ),
    ''
  );
  signup_phone := nullif(btrim(new.raw_user_meta_data->>'phone_number'), '');

  select *
    into roster_match
  from public.employee_roster
  where normalized_name is not null
    and signup_phone is not null
    and is_active = true
    and role in ('therapist', 'lead')
    and normalized_full_name = normalized_name
    and phone_number = signup_phone
    and matched_profile_id is null
  order by created_at asc
  limit 1
  for update skip locked;

  resolved_role :=
    case
      when roster_match.id is not null then roster_match.role
      else 'therapist'
    end;
  resolved_access_status :=
    case
      when roster_match.id is not null then 'approved'::public.profile_access_status
      else 'pending'::public.profile_access_status
    end;
  should_require_onboarding := roster_match.id is not null
    and resolved_role in ('therapist', 'lead');

  insert into public.profiles (
    id,
    full_name,
    email,
    phone_number,
    role,
    access_status,
    shift_type,
    employment_type,
    max_work_days_per_week,
    is_lead_eligible,
    is_active,
    preferred_work_days_mode,
    staff_onboarding_required,
    site_id
  )
  values (
    new.id,
    coalesce(computed_full_name, nullif(btrim(new.raw_user_meta_data->>'full_name'), ''), 'New User'),
    coalesce(new.email, ''),
    coalesce(signup_phone, roster_match.phone_number),
    resolved_role,
    resolved_access_status,
    case
      when roster_match.id is not null then roster_match.shift_type
      else 'day'
    end,
    coalesce(roster_match.employment_type, 'full_time'),
    coalesce(roster_match.max_work_days_per_week, 3),
    coalesce(roster_match.is_lead_eligible, false),
    case
      when resolved_access_status = 'approved' then coalesce(roster_match.is_active, true)
      else false
    end,
    'unset',
    should_require_onboarding,
    'default'
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

alter function public.handle_new_user() owner to postgres;
revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to service_role;

commit;
