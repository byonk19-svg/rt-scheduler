-- Migration: harden_preliminary_cell_mark_requests
-- Created: 2026-07-17
-- Description: Enforce resolved preliminary mark and adjacent-shift safety rules in the cell mark RPC.

BEGIN;

create or replace function public.app_preliminary_add_work_has_adjacent_conflict(
  p_snapshot_id uuid,
  p_requester_id uuid,
  p_cycle_id uuid,
  p_mark_date date,
  p_shift_type text,
  p_excluded_mark_id uuid default null
)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.shifts shift
    where shift.cycle_id = p_cycle_id
      and shift.user_id = p_requester_id
      and shift.status = 'scheduled'
      and (
        (p_shift_type = 'night' and shift.shift_type = 'day' and shift.date = (p_mark_date + interval '1 day')::date)
        or (p_shift_type = 'day' and shift.shift_type = 'night' and shift.date = (p_mark_date - interval '1 day')::date)
      )
  ) or exists (
    select 1
    from public.preliminary_cell_marks sibling_mark
    where sibling_mark.snapshot_id = p_snapshot_id
      and sibling_mark.requester_id = p_requester_id
      and sibling_mark.mark_type = 'add_work'
      and sibling_mark.status in ('pending', 'approved')
      and (p_excluded_mark_id is null or sibling_mark.id <> p_excluded_mark_id)
      and (
        (p_shift_type = 'night' and sibling_mark.shift_type = 'day' and sibling_mark.date = (p_mark_date + interval '1 day')::date)
        or (p_shift_type = 'day' and sibling_mark.shift_type = 'night' and sibling_mark.date = (p_mark_date - interval '1 day')::date)
      )
  );
$$;

create or replace function public.app_create_preliminary_cell_mark(
  p_actor_id uuid,
  p_snapshot_id uuid,
  p_mark_type text,
  p_mark_date date,
  p_shift_type text,
  p_shift_id uuid default null,
  p_group_id uuid default null,
  p_note text default null
)
returns table (id uuid, group_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_shift_type text;
  v_actor_site_id text;
  v_cycle_id uuid;
  v_cycle_site_id text;
  v_mark_id uuid;
  v_group_status text;
begin
  if p_mark_type not in ('mark_off', 'add_work') then
    raise exception 'Unsupported preliminary mark type.' using errcode = '22023';
  end if;

  if p_shift_type not in ('day', 'night') then
    raise exception 'Unsupported shift type.' using errcode = '22023';
  end if;

  select actor.shift_type, actor.site_id
    into v_actor_shift_type, v_actor_site_id
  from public.profiles actor
  where actor.id = p_actor_id
    and actor.role in ('therapist', 'lead')
    and actor.is_active = true
    and actor.archived_at is null;

  if v_actor_site_id is null then
    raise exception 'Only active staff can create preliminary marks.' using errcode = '42501';
  end if;

  if v_actor_shift_type is distinct from p_shift_type and (
    p_mark_type <> 'add_work' or nullif(trim(coalesce(p_note, '')), '') is null
  ) then
    raise exception 'Cross-shift preliminary add-work requires a note for manager review.' using errcode = '42501';
  end if;

  select cycle.id, cycle.site_id
    into v_cycle_id, v_cycle_site_id
  from public.preliminary_snapshots snapshot
  join public.schedule_cycles cycle on cycle.id = snapshot.cycle_id
  where snapshot.id = p_snapshot_id
    and snapshot.status = 'active'
    and cycle.status = 'preliminary'
    and p_mark_date between cycle.start_date and cycle.end_date;

  if v_cycle_id is null then
    raise exception 'Active preliminary schedule not found for this date.' using errcode = 'P0002';
  end if;

  if v_cycle_site_id is distinct from v_actor_site_id then
    raise exception 'Preliminary schedule is outside your site scope.' using errcode = '42501';
  end if;

  if p_group_id is not null then
    select group_row.status
      into v_group_status
    from public.preliminary_mark_groups group_row
    where group_row.id = p_group_id
      and group_row.snapshot_id = p_snapshot_id
      and group_row.requester_id = p_actor_id
    for update;

    if v_group_status is distinct from 'pending' then
      raise exception 'Linked preliminary change is not editable.' using errcode = '55000';
    end if;
  end if;

  if exists (
    select 1
    from public.preliminary_cell_marks resolved_mark
    where resolved_mark.snapshot_id = p_snapshot_id
      and resolved_mark.requester_id = p_actor_id
      and resolved_mark.date = p_mark_date
      and resolved_mark.shift_type = p_shift_type
      and resolved_mark.mark_type = p_mark_type
      and resolved_mark.status in ('denied', 'dismissed')
  ) then
    raise exception 'A manager already resolved this preliminary mark. Contact the manager if something changed.' using errcode = '55000';
  end if;

  if p_mark_type = 'mark_off' then
    if p_shift_id is null then
      raise exception 'Mark-off requires a scheduled shift.' using errcode = '22023';
    end if;

    if not exists (
      select 1
      from public.shifts shift
      where shift.id = p_shift_id
        and shift.cycle_id = v_cycle_id
        and shift.user_id = p_actor_id
        and shift.date = p_mark_date
        and shift.shift_type = p_shift_type
    ) then
      raise exception 'Only the assigned staff member can mark out this scheduled day.' using errcode = '42501';
    end if;
  end if;

  if p_mark_type = 'add_work' and exists (
    select 1
    from public.shifts shift
    where shift.cycle_id = v_cycle_id
      and shift.user_id = p_actor_id
      and shift.date = p_mark_date
      and shift.shift_type = p_shift_type
  ) then
    raise exception 'Staff member is already scheduled on this cell.' using errcode = '23505';
  end if;

  if p_mark_type = 'add_work' and public.app_preliminary_add_work_has_adjacent_conflict(
    p_snapshot_id,
    p_actor_id,
    v_cycle_id,
    p_mark_date,
    p_shift_type
  ) then
    raise exception 'This preliminary mark would create unsafe adjacent day and night shifts.' using errcode = '55000';
  end if;

  insert into public.preliminary_cell_marks (
    snapshot_id, group_id, requester_id, mark_type, shift_id, date, shift_type, note
  )
  values (
    p_snapshot_id, p_group_id, p_actor_id, p_mark_type, p_shift_id, p_mark_date, p_shift_type,
    nullif(trim(coalesce(p_note, '')), '')
  )
  returning preliminary_cell_marks.id into v_mark_id;

  return query select v_mark_id, p_group_id;
end;
$$;

create or replace function public.app_preliminary_cell_mark_approval_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle_id uuid;
begin
  if new.mark_type <> 'add_work' or new.status <> 'approved' or old.status = 'approved' then
    return new;
  end if;

  select cycle.id
    into v_cycle_id
  from public.preliminary_snapshots snapshot
  join public.schedule_cycles cycle on cycle.id = snapshot.cycle_id
  where snapshot.id = new.snapshot_id;

  if v_cycle_id is null then
    raise exception 'Schedule block not found for preliminary mark.' using errcode = 'P0002';
  end if;

  if public.app_preliminary_add_work_has_adjacent_conflict(
    new.snapshot_id,
    new.requester_id,
    v_cycle_id,
    new.date,
    new.shift_type,
    new.id
  ) then
    raise exception 'This preliminary mark would create unsafe adjacent day and night shifts.' using errcode = '55000';
  end if;

  return new;
end;
$$;

drop trigger if exists preliminary_cell_mark_approval_guard on public.preliminary_cell_marks;
create trigger preliminary_cell_mark_approval_guard
before update of status on public.preliminary_cell_marks
for each row
execute function public.app_preliminary_cell_mark_approval_guard();

COMMIT;
