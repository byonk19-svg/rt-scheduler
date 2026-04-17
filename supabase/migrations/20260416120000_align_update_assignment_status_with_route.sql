-- Assignment status updates: align SECURITY DEFINER RPC with app route + can() —
-- only manager or lead role (not legacy is_lead_eligible on therapist rows).

create or replace function public.update_assignment_status(
  p_assignment_id uuid,
  p_status public.assignment_status,
  p_note text default null,
  p_left_early_time time default null
)
returns table (
  id uuid,
  assignment_status public.assignment_status,
  status_note text,
  left_early_time time,
  status_updated_at timestamptz,
  status_updated_by uuid,
  status_updated_by_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role text;
  v_actor_site_id text;
  v_assignment_site_id text;
  v_assignment_user_id uuid;
  v_therapist_name text := 'Unknown';
  v_active_entry_id uuid;
  v_previous_status public.assignment_status := 'scheduled';
  v_previous_note text;
  v_previous_left_early_time time;
  v_next_status public.assignment_status := 'scheduled';
  v_next_note text;
  v_next_left_early_time time;
begin
  if v_actor_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select p.role, p.site_id
    into v_actor_role, v_actor_site_id
  from public.profiles p
  where p.id = v_actor_id;

  if v_actor_role is null then
    raise exception 'Profile not found.' using errcode = '42501';
  end if;

  if not (v_actor_role = 'manager' or v_actor_role = 'lead') then
    raise exception 'Only leads or managers can update assignment status.' using errcode = '42501';
  end if;

  select s.site_id, s.user_id
    into v_assignment_site_id, v_assignment_user_id
  from public.shifts s
  where s.id = p_assignment_id
  for update;

  if not found then
    raise exception 'Assignment not found.' using errcode = 'P0002';
  end if;

  if v_assignment_site_id is distinct from v_actor_site_id then
    raise exception 'Assignment is outside your site scope.' using errcode = '42501';
  end if;

  if v_assignment_user_id is not null then
    select coalesce(p.full_name, 'Unknown')
      into v_therapist_name
    from public.profiles p
    where p.id = v_assignment_user_id;
  end if;

  select
    e.id,
    e.code,
    e.note,
    e.left_early_time
    into v_active_entry_id, v_previous_status, v_previous_note, v_previous_left_early_time
  from public.shift_operational_entries e
  where e.shift_id = p_assignment_id
    and e.active = true
  order by e.created_at desc, e.id desc
  limit 1
  for update;

  if v_active_entry_id is null then
    v_previous_status := 'scheduled';
    v_previous_note := null;
    v_previous_left_early_time := null;
  end if;

  if p_status = 'scheduled' then
    v_next_status := 'scheduled';
    v_next_note := null;
    v_next_left_early_time := null;

    if v_active_entry_id is not null then
      update public.shift_operational_entries
      set
        active = false,
        replaced_at = now(),
        replaced_by = v_actor_id
      where id = v_active_entry_id;

      insert into public.shift_operational_entry_audit (
        shift_id,
        entry_id,
        action_type,
        code,
        note,
        left_early_time,
        acted_by
      )
      values (
        p_assignment_id,
        v_active_entry_id,
        'remove',
        v_previous_status,
        v_previous_note,
        v_previous_left_early_time,
        v_actor_id
      );
    end if;
  else
    v_next_status := p_status;
    v_next_note := nullif(trim(coalesce(p_note, '')), '');
    v_next_left_early_time := case when p_status = 'left_early' then p_left_early_time else null end;

    if v_active_entry_id is not null then
      update public.shift_operational_entries
      set
        active = false,
        replaced_at = now(),
        replaced_by = v_actor_id
      where id = v_active_entry_id;
    end if;

    insert into public.shift_operational_entries (
      shift_id,
      code,
      note,
      left_early_time,
      active,
      created_by
    )
    values (
      p_assignment_id,
      p_status,
      v_next_note,
      v_next_left_early_time,
      true,
      v_actor_id
    )
    returning public.shift_operational_entries.id into v_active_entry_id;

    insert into public.shift_operational_entry_audit (
      shift_id,
      entry_id,
      action_type,
      code,
      note,
      left_early_time,
      acted_by
    )
    values (
      p_assignment_id,
      v_active_entry_id,
      case when v_previous_status = 'scheduled' then 'add' else 'replace' end,
      p_status,
      v_next_note,
      v_next_left_early_time,
      v_actor_id
    );
  end if;

  if v_previous_status is distinct from v_next_status then
    insert into public.shift_status_changes (
      shift_id,
      therapist_name,
      from_status,
      to_status,
      changed_by
    )
    values (
      p_assignment_id,
      v_therapist_name,
      v_previous_status::text,
      v_next_status::text,
      v_actor_id
    );
  end if;

  return query
  select
    p_assignment_id as id,
    v_next_status as assignment_status,
    v_next_note as status_note,
    v_next_left_early_time as left_early_time,
    now() as status_updated_at,
    v_actor_id as status_updated_by,
    updater.full_name as status_updated_by_name
  from public.profiles updater
  where updater.id = v_actor_id;
end;
$$;

alter function public.update_assignment_status(uuid, public.assignment_status, text, time) owner to postgres;
revoke all on function public.update_assignment_status(uuid, public.assignment_status, text, time) from public;
grant execute on function public.update_assignment_status(uuid, public.assignment_status, text, time) to authenticated;
grant execute on function public.update_assignment_status(uuid, public.assignment_status, text, time) to service_role;
