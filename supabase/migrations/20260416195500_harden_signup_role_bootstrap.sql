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
  roster_match public.employee_roster%rowtype;
begin
  first_name := nullif(new.raw_user_meta_data->>'first_name', '');
  last_name := nullif(new.raw_user_meta_data->>'last_name', '');
  computed_full_name := nullif(trim(concat_ws(' ', first_name, last_name)), '');
  normalized_name := lower(
    regexp_replace(
      coalesce(computed_full_name, nullif(new.raw_user_meta_data->>'full_name', ''), ''),
      '\s+',
      ' ',
      'g'
    )
  );

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
      else null
    end,
    case
      when roster_match.id is not null then roster_match.shift_type
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
