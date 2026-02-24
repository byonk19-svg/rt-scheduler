-- Rollback: restore previous trigger/function behavior before hardening role and designated lead guards.

create or replace function public.restrict_profile_staffing_field_updates()
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
    if new.on_fmla = false then
      new.fmla_return_date := null;
    end if;
    return new;
  end if;

  select public.is_manager() into actor_is_manager;

  if not actor_is_manager
     and (
       new.is_lead_eligible is distinct from old.is_lead_eligible
       or new.on_fmla is distinct from old.on_fmla
       or new.fmla_return_date is distinct from old.fmla_return_date
       or new.is_active is distinct from old.is_active
       or new.site_id is distinct from old.site_id
     ) then
    raise exception 'Only managers can update staffing eligibility fields.'
      using errcode = '42501';
  end if;

  if new.on_fmla = false then
    new.fmla_return_date := null;
  end if;

  return new;
end;
$$;

alter function public.restrict_profile_staffing_field_updates() owner to postgres;
grant execute on function public.restrict_profile_staffing_field_updates() to authenticated;
grant execute on function public.restrict_profile_staffing_field_updates() to service_role;

create or replace function public.set_designated_shift_lead(
  p_cycle_id uuid,
  p_shift_date date,
  p_shift_type text,
  p_therapist_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_is_eligible boolean;
begin
  if p_shift_type not in ('day', 'night') then
    raise exception 'Invalid shift type: %', p_shift_type using errcode = '22023';
  end if;

  select p.is_lead_eligible
  into v_is_eligible
  from public.profiles p
  where p.id = p_therapist_id
    and p.role = 'therapist';

  if coalesce(v_is_eligible, false) = false then
    raise exception 'Selected therapist is not lead-eligible.' using errcode = 'P0001';
  end if;

  update public.shifts
  set role = 'staff'
  where cycle_id = p_cycle_id
    and date = p_shift_date
    and shift_type = p_shift_type
    and role = 'lead';

  update public.shifts
  set role = 'lead'
  where cycle_id = p_cycle_id
    and date = p_shift_date
    and shift_type = p_shift_type
    and user_id = p_therapist_id;

  if not found then
    insert into public.shifts (cycle_id, user_id, date, shift_type, status, role)
    values (p_cycle_id, p_therapist_id, p_shift_date, p_shift_type, 'scheduled', 'lead');
  end if;
end;
$$;

alter function public.set_designated_shift_lead(uuid, date, text, uuid) owner to postgres;
grant execute on function public.set_designated_shift_lead(uuid, date, text, uuid) to authenticated;
