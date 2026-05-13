begin;
create or replace function public.app_cancel_preliminary_cell_mark(
  p_actor_id uuid,
  p_mark_id uuid
)
returns table (id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mark public.preliminary_cell_marks%rowtype;
  v_now timestamptz := now();
begin
  select *
    into v_mark
  from public.preliminary_cell_marks mark
  where mark.id = p_mark_id
  for update;

  if not found then
    raise exception 'Preliminary mark not found.' using errcode = 'P0002';
  end if;

  if v_mark.requester_id is distinct from p_actor_id then
    raise exception 'Only the staff member who created the mark can cancel it.' using errcode = '42501';
  end if;

  if v_mark.status <> 'pending' then
    raise exception 'Only pending preliminary marks can be cancelled.' using errcode = '55000';
  end if;

  if v_mark.group_id is not null then
    update public.preliminary_cell_marks
    set status = 'cancelled',
        reviewed_by = p_actor_id,
        reviewed_at = v_now,
        updated_at = v_now
    where preliminary_cell_marks.group_id = v_mark.group_id
      and preliminary_cell_marks.status = 'pending';

    update public.preliminary_mark_groups
    set status = 'cancelled',
        reviewed_by = p_actor_id,
        reviewed_at = v_now,
        updated_at = v_now
    where preliminary_mark_groups.id = v_mark.group_id
      and preliminary_mark_groups.status = 'pending';
  else
    update public.preliminary_cell_marks
    set status = 'cancelled',
        reviewed_by = p_actor_id,
        reviewed_at = v_now,
        updated_at = v_now
    where preliminary_cell_marks.id = p_mark_id;
  end if;

  return query select p_mark_id;
end;
$$;
create or replace function public.app_review_preliminary_cell_mark(
  p_actor_id uuid,
  p_mark_id uuid,
  p_decision text,
  p_decision_note text default null
)
returns table (id uuid, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_site_id text;
  v_mark public.preliminary_cell_marks%rowtype;
  v_cycle public.schedule_cycles%rowtype;
  v_now timestamptz := now();
  v_effective_note text := nullif(trim(coalesce(p_decision_note, '')), '');
  v_rows_reviewed integer := 0;
  v_shift_rows integer := 0;
  v_open_shift_id uuid;
  mark_row public.preliminary_cell_marks%rowtype;
begin
  if p_decision not in ('approved', 'denied', 'dismissed') then
    raise exception 'Unsupported preliminary review decision.' using errcode = '22023';
  end if;

  select actor.site_id
    into v_actor_site_id
  from public.profiles actor
  where actor.id = p_actor_id
    and actor.role = 'manager'
    and actor.is_active = true
    and actor.archived_at is null;

  if v_actor_site_id is null then
    raise exception 'Only active managers can review preliminary marks.' using errcode = '42501';
  end if;

  select *
    into v_mark
  from public.preliminary_cell_marks mark
  where mark.id = p_mark_id
  for update;

  if not found then
    raise exception 'Preliminary mark not found.' using errcode = 'P0002';
  end if;

  if v_mark.status <> 'pending' then
    raise exception 'Only pending preliminary marks can be reviewed.' using errcode = '55000';
  end if;

  select cycle.*
    into v_cycle
  from public.preliminary_snapshots snapshot
  join public.schedule_cycles cycle on cycle.id = snapshot.cycle_id
  where snapshot.id = v_mark.snapshot_id
  for update;

  if not found then
    raise exception 'Schedule block not found for preliminary mark.' using errcode = 'P0002';
  end if;

  if v_cycle.site_id is distinct from v_actor_site_id then
    raise exception 'Preliminary mark is outside your site scope.' using errcode = '42501';
  end if;

  if v_cycle.published then
    raise exception 'Published schedules cannot review preliminary marks.' using errcode = '55000';
  end if;

  if p_decision = 'approved' then
    for mark_row in
      select *
      from public.preliminary_cell_marks pending_mark
      where pending_mark.status = 'pending'
        and (
          (v_mark.group_id is not null and pending_mark.group_id = v_mark.group_id)
          or (v_mark.group_id is null and pending_mark.id = v_mark.id)
        )
      order by case when pending_mark.mark_type = 'mark_off' then 0 else 1 end, pending_mark.created_at
      for update
    loop
      if mark_row.mark_type = 'mark_off' then
        update public.shifts shift
        set user_id = null,
            role = 'staff'
        where shift.id = mark_row.shift_id
          and shift.cycle_id = v_cycle.id
          and shift.user_id = mark_row.requester_id;

        get diagnostics v_shift_rows = row_count;
        if v_shift_rows <> 1 then
          raise exception 'Scheduled shift is no longer assigned to this staff member.' using errcode = '55000';
        end if;

        update public.preliminary_shift_states shift_state
        set state = 'open',
            reserved_by = null,
            active_request_id = null,
            updated_at = v_now
        where shift_state.snapshot_id = mark_row.snapshot_id
          and shift_state.shift_id = mark_row.shift_id;
      else
        if exists (
          select 1
          from public.shifts shift
          where shift.cycle_id = v_cycle.id
            and shift.user_id = mark_row.requester_id
            and shift.date = mark_row.date
            and shift.shift_type = mark_row.shift_type
        ) then
          raise exception 'Staff member is already scheduled on this cell.' using errcode = '23505';
        end if;

        select shift.id
          into v_open_shift_id
        from public.shifts shift
        where shift.cycle_id = v_cycle.id
          and shift.date = mark_row.date
          and shift.shift_type = mark_row.shift_type
          and shift.user_id is null
          and shift.status = 'scheduled'
          and shift.role = 'staff'
        order by shift.created_at, shift.id
        limit 1
        for update;

        if v_open_shift_id is not null then
          update public.shifts
          set user_id = mark_row.requester_id,
              role = mark_row.requested_role,
              unfilled_reason = null,
              status = 'scheduled',
              assignment_status = 'scheduled',
              status_note = null,
              left_early_time = null
          where shifts.id = v_open_shift_id;
        else
          insert into public.shifts (
            cycle_id,
            user_id,
            date,
            shift_type,
            status,
            assignment_status,
            role,
            site_id
          )
          values (
            v_cycle.id,
            mark_row.requester_id,
            mark_row.date,
            mark_row.shift_type,
            'scheduled',
            'scheduled',
            mark_row.requested_role,
            v_cycle.site_id
          )
          returning public.shifts.id into v_open_shift_id;
        end if;

        insert into public.preliminary_shift_states (
          snapshot_id,
          shift_id,
          state,
          reserved_by,
          active_request_id,
          updated_at
        )
        values (
          mark_row.snapshot_id,
          v_open_shift_id,
          'tentative_assignment',
          mark_row.requester_id,
          null,
          v_now
        )
        on conflict (snapshot_id, shift_id)
        do update set state = excluded.state,
                      reserved_by = excluded.reserved_by,
                      active_request_id = excluded.active_request_id,
                      updated_at = excluded.updated_at;
      end if;

      v_rows_reviewed := v_rows_reviewed + 1;
    end loop;
  end if;

  update public.preliminary_cell_marks pending_mark
  set status = p_decision,
      decision_note = v_effective_note,
      reviewed_by = p_actor_id,
      reviewed_at = v_now,
      updated_at = v_now
  where pending_mark.status = 'pending'
    and (
      (v_mark.group_id is not null and pending_mark.group_id = v_mark.group_id)
      or (v_mark.group_id is null and pending_mark.id = v_mark.id)
    );

  get diagnostics v_rows_reviewed = row_count;

  if v_mark.group_id is not null then
    update public.preliminary_mark_groups
    set status = p_decision,
        decision_note = v_effective_note,
        reviewed_by = p_actor_id,
        reviewed_at = v_now,
        updated_at = v_now
    where preliminary_mark_groups.id = v_mark.group_id
      and preliminary_mark_groups.status = 'pending';
  end if;

  return query select p_mark_id, p_decision;
end;
$$;
alter function public.app_cancel_preliminary_cell_mark(uuid, uuid) owner to postgres;
alter function public.app_review_preliminary_cell_mark(uuid, uuid, text, text) owner to postgres;
revoke all on function public.app_cancel_preliminary_cell_mark(uuid, uuid) from public, anon, authenticated;
revoke all on function public.app_review_preliminary_cell_mark(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.app_cancel_preliminary_cell_mark(uuid, uuid) to service_role;
grant execute on function public.app_review_preliminary_cell_mark(uuid, uuid, text, text) to service_role;
commit;
