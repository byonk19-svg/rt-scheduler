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
  v_actor_site_id text;
  v_target_site_id text;
  v_is_eligible boolean;
begin
  select p.site_id
    into v_actor_site_id
  from public.profiles p
  where p.id = auth.uid()
    and p.role = 'manager'
    and coalesce(p.is_active, true)
    and p.archived_at is null;

  if v_actor_site_id is null then
    raise exception 'Only active managers can set designated lead.' using errcode = '42501';
  end if;

  if p_shift_type not in ('day', 'night') then
    raise exception 'Invalid shift type: %', p_shift_type using errcode = '22023';
  end if;

  select p.site_id, p.is_lead_eligible
    into v_target_site_id, v_is_eligible
  from public.profiles p
  where p.id = p_therapist_id
    and p.role in ('therapist', 'lead')
    and coalesce(p.is_active, true)
    and p.archived_at is null;

  if v_target_site_id is distinct from v_actor_site_id then
    raise exception 'Selected therapist is outside your site scope.' using errcode = '42501';
  end if;

  if coalesce(v_is_eligible, false) = false then
    raise exception 'Selected therapist is not lead-eligible.' using errcode = 'P0001';
  end if;

  update public.shifts
  set role = 'staff'
  where cycle_id = p_cycle_id
    and date = p_shift_date
    and shift_type = p_shift_type
    and site_id = v_actor_site_id
    and role = 'lead';

  update public.shifts
  set role = 'lead'
  where cycle_id = p_cycle_id
    and date = p_shift_date
    and shift_type = p_shift_type
    and site_id = v_actor_site_id
    and user_id = p_therapist_id;

  if not found then
    insert into public.shifts (cycle_id, user_id, date, shift_type, status, role, site_id)
    values (p_cycle_id, p_therapist_id, p_shift_date, p_shift_type, 'scheduled', 'lead', v_actor_site_id);
  end if;
end;
$$;

alter function public.set_designated_shift_lead(uuid, date, text, uuid) owner to postgres;
grant execute on function public.set_designated_shift_lead(uuid, date, text, uuid) to authenticated;
