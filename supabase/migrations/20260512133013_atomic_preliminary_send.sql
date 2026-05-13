-- Migration: atomic_preliminary_send
-- Created: 2026-05-12
-- Description: Move Send Preliminary schedule creation and refresh into one server-side transaction.

begin;

create or replace function public.app_send_preliminary_schedule(
  p_actor_id uuid,
  p_cycle_id uuid
)
returns table (id uuid, label text, was_refresh boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_site_id text;
  v_cycle public.schedule_cycles%rowtype;
  v_snapshot_id uuid;
  v_was_refresh boolean := false;
  v_now timestamptz := now();
begin
  select actor.site_id
    into v_actor_site_id
  from public.profiles actor
  where actor.id = p_actor_id
    and actor.role = 'manager'
    and actor.is_active = true
    and actor.archived_at is null;

  if v_actor_site_id is null then
    raise exception 'Only active managers can send preliminary schedules.' using errcode = '42501';
  end if;

  select *
    into v_cycle
  from public.schedule_cycles cycle
  where cycle.id = p_cycle_id
  for update;

  if not found then
    raise exception 'Schedule Block not found.' using errcode = 'P0002';
  end if;

  if v_cycle.site_id is distinct from v_actor_site_id then
    raise exception 'Schedule Block is outside your site scope.' using errcode = '42501';
  end if;

  if v_cycle.status = 'archived'::public.schedule_cycle_status then
    raise exception 'Archived Schedule Blocks cannot be sent as Preliminary.' using errcode = '55000';
  end if;

  if coalesce(v_cycle.published, false)
    or v_cycle.status = 'final'::public.schedule_cycle_status
  then
    raise exception 'Final Schedule Blocks cannot be sent as Preliminary.' using errcode = '55000';
  end if;

  with slots as (
    select
      day::date as date,
      shift_type
    from generate_series(v_cycle.start_date, v_cycle.end_date, interval '1 day') as day
    cross join (values ('day'::text), ('night'::text)) as shift_types(shift_type)
  ),
  coverage as (
    select
      slots.date,
      slots.shift_type,
      count(shift.id) filter (where shift.status in ('scheduled', 'on_call')) as existing_coverage
    from slots
    left join public.shifts shift
      on shift.cycle_id = p_cycle_id
     and shift.date = slots.date
     and shift.shift_type = slots.shift_type
    group by slots.date, slots.shift_type
  ),
  missing_slots as (
    select
      coverage.date,
      coverage.shift_type,
      greatest(0, 3 - coverage.existing_coverage)::integer as missing_count
    from coverage
  )
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
  select
    p_cycle_id,
    null,
    missing_slots.date,
    missing_slots.shift_type,
    'scheduled',
    'scheduled'::public.assignment_status,
    'staff'::public.shift_role,
    v_cycle.site_id
  from missing_slots
  cross join lateral generate_series(1, missing_slots.missing_count)
  where missing_slots.missing_count > 0;

  select snapshot.id
    into v_snapshot_id
  from public.preliminary_snapshots snapshot
  where snapshot.cycle_id = p_cycle_id
    and snapshot.status = 'active'
  for update;

  if v_snapshot_id is null then
    insert into public.preliminary_snapshots (
      cycle_id,
      created_by,
      sent_at,
      status
    )
    values (
      p_cycle_id,
      p_actor_id,
      v_now,
      'active'
    )
    returning preliminary_snapshots.id into v_snapshot_id;
  else
    v_was_refresh := true;

    update public.preliminary_snapshots
    set sent_at = v_now
    where preliminary_snapshots.id = v_snapshot_id;
  end if;

  delete from public.preliminary_shift_states shift_state
  where shift_state.snapshot_id = v_snapshot_id;

  insert into public.preliminary_shift_states (
    snapshot_id,
    shift_id,
    state,
    reserved_by,
    active_request_id,
    updated_at
  )
  select
    v_snapshot_id,
    shift.id,
    case when shift.user_id is null then 'open' else 'tentative_assignment' end,
    shift.user_id,
    null,
    v_now
  from public.shifts shift
  where shift.cycle_id = p_cycle_id
  order by shift.date, shift.shift_type, shift.role, shift.created_at, shift.id;

  update public.schedule_cycles
  set status = 'preliminary'::public.schedule_cycle_status,
      published = false
  where schedule_cycles.id = p_cycle_id;

  return query select v_snapshot_id, v_cycle.label, v_was_refresh;
end;
$$;

alter function public.app_send_preliminary_schedule(uuid, uuid) owner to postgres;
revoke all on function public.app_send_preliminary_schedule(uuid, uuid) from public, anon, authenticated;
grant execute on function public.app_send_preliminary_schedule(uuid, uuid) to service_role;

commit;
