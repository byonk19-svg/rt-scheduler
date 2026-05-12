-- Enforce availability-derived publish blockers inside the final publish RPC.
-- Missing availability remains an app-level warning because managers can explicitly acknowledge it.

create or replace function public.assert_schedule_cycle_availability_publish_ready(
  p_cycle_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_need_to_work_misses integer := 0;
  v_need_off_overrides_missing_reason integer := 0;
begin
  select count(*)
    into v_need_to_work_misses
  from public.availability_overrides override_row
  where override_row.cycle_id = p_cycle_id
    and override_row.override_type = 'force_on'
    and not exists (
      select 1
      from public.shifts shift_row
      left join public.shift_operational_entries active_entry
        on active_entry.shift_id = shift_row.id
       and active_entry.active = true
       and active_entry.code in ('on_call', 'call_in', 'cancelled', 'left_early')
      where shift_row.cycle_id = p_cycle_id
        and shift_row.user_id = override_row.therapist_id
        and shift_row.date = override_row.date
        and shift_row.unfilled_reason is null
        and active_entry.id is null
        and (
          override_row.shift_type = 'both'
          or shift_row.shift_type = override_row.shift_type
        )
    );

  if v_need_to_work_misses > 0 then
    raise exception 'Final publish requires every Need to Work entry to be assigned or resolved.' using errcode = '23514';
  end if;

  select count(*)
    into v_need_off_overrides_missing_reason
  from public.availability_overrides override_row
  join public.shifts shift_row
    on shift_row.cycle_id = p_cycle_id
   and shift_row.user_id = override_row.therapist_id
   and shift_row.date = override_row.date
   and shift_row.unfilled_reason is null
   and (
     override_row.shift_type = 'both'
     or shift_row.shift_type = override_row.shift_type
   )
  left join public.shift_operational_entries active_entry
    on active_entry.shift_id = shift_row.id
   and active_entry.active = true
   and active_entry.code in ('on_call', 'call_in', 'cancelled', 'left_early')
  where override_row.cycle_id = p_cycle_id
    and override_row.override_type = 'force_off'
    and active_entry.id is null
    and not (
      shift_row.availability_override = true
      and nullif(btrim(shift_row.availability_override_reason), '') is not null
      and shift_row.availability_override_by is not null
      and shift_row.availability_override_at is not null
    );

  if v_need_off_overrides_missing_reason > 0 then
    raise exception 'Final publish requires manager override context before scheduling over Need Off.' using errcode = '23514';
  end if;
end;
$$;

create or replace function public.app_publish_schedule_cycle(
  p_actor_id uuid,
  p_cycle_id uuid
)
returns table (id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_site_id text;
  v_cycle public.schedule_cycles%rowtype;
  v_updated_id uuid;
  v_missing_or_bad_lead_slots integer := 0;
begin
  select actor.site_id
    into v_actor_site_id
  from public.profiles actor
  where actor.id = p_actor_id
    and actor.role = 'manager'
    and actor.is_active = true
    and actor.archived_at is null;

  if v_actor_site_id is null then
    raise exception 'Only active managers can publish Schedule Blocks.' using errcode = '42501';
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

  if v_cycle.status = 'final'::public.schedule_cycle_status or v_cycle.published then
    raise exception 'Schedule Block is already published.' using errcode = '55000';
  end if;

  if v_cycle.status not in (
    'draft'::public.schedule_cycle_status,
    'preliminary'::public.schedule_cycle_status,
    'offline'::public.schedule_cycle_status
  ) then
    raise exception 'Only Draft, Preliminary, or Offline Schedule Blocks can be published.' using errcode = '55000';
  end if;

  if v_cycle.status = 'offline'::public.schedule_cycle_status and exists (
    select 1
    from public.schedule_cycles replacement
    where replacement.id <> p_cycle_id
      and replacement.site_id is not distinct from v_cycle.site_id
      and replacement.start_date = v_cycle.start_date
      and replacement.end_date = v_cycle.end_date
      and replacement.published = true
      and replacement.status = 'final'::public.schedule_cycle_status
      and replacement.archived_at is null
  ) then
    raise exception 'Offline Schedule Block cannot be republished while another live block covers the same date range.' using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.preliminary_snapshots snapshot
    join public.preliminary_cell_marks mark on mark.snapshot_id = snapshot.id
    where snapshot.cycle_id = p_cycle_id
      and snapshot.status = 'active'
      and mark.status = 'pending'
  ) then
    raise exception 'Resolve preliminary marks before publishing.' using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.preliminary_snapshots snapshot
    join public.preliminary_requests request on request.snapshot_id = snapshot.id
    where snapshot.cycle_id = p_cycle_id
      and snapshot.status = 'active'
      and request.status = 'pending'
  ) then
    raise exception 'Resolve preliminary requests before publishing.' using errcode = '55000';
  end if;

  perform public.assert_schedule_cycle_availability_publish_ready(p_cycle_id);

  with slots as (
    select
      day::date as date,
      shift_type
    from generate_series(v_cycle.start_date, v_cycle.end_date, interval '1 day') as day
    cross join (values ('day'::text), ('night'::text)) as shift_types(shift_type)
  ),
  slot_leads as (
    select
      slots.date,
      slots.shift_type,
      count(lead_shift.id) as lead_count,
      bool_or(coalesce(profile.is_lead_eligible, false) = false) as has_ineligible_lead,
      bool_or(coalesce(profile.is_active, false) = false or profile.archived_at is not null) as has_inactive_lead,
      bool_or(active_entry.id is not null) as has_non_working_lead
    from slots
    left join public.shifts lead_shift
      on lead_shift.cycle_id = p_cycle_id
     and lead_shift.date = slots.date
     and lead_shift.shift_type = slots.shift_type
     and lead_shift.role = 'lead'
     and lead_shift.user_id is not null
     and lead_shift.unfilled_reason is null
    left join public.profiles profile on profile.id = lead_shift.user_id
    left join public.shift_operational_entries active_entry
      on active_entry.shift_id = lead_shift.id
     and active_entry.active = true
     and active_entry.code in ('on_call', 'call_in', 'cancelled', 'left_early')
    group by slots.date, slots.shift_type
  )
  select count(*)
    into v_missing_or_bad_lead_slots
  from slot_leads
  where lead_count <> 1
    or coalesce(has_ineligible_lead, false)
    or coalesce(has_inactive_lead, false)
    or coalesce(has_non_working_lead, false);

  if v_missing_or_bad_lead_slots > 0 then
    raise exception 'Final publish requires exactly one active lead-capable assigned Designated Lead for every date and shift.' using errcode = '23514';
  end if;

  update public.schedule_cycles
  set status = 'final'::public.schedule_cycle_status,
      published = true
  where schedule_cycles.id = p_cycle_id
    and schedule_cycles.status in (
      'draft'::public.schedule_cycle_status,
      'preliminary'::public.schedule_cycle_status,
      'offline'::public.schedule_cycle_status
    )
  returning schedule_cycles.id into v_updated_id;

  if v_updated_id is null then
    return;
  end if;

  update public.preliminary_snapshots
  set status = 'superseded'
  where cycle_id = p_cycle_id
    and status = 'active';

  return query select v_updated_id;
end;
$$;

alter function public.assert_schedule_cycle_availability_publish_ready(uuid) owner to postgres;
alter function public.app_publish_schedule_cycle(uuid, uuid) owner to postgres;

revoke all on function public.assert_schedule_cycle_availability_publish_ready(uuid) from public, anon, authenticated;
revoke all on function public.app_publish_schedule_cycle(uuid, uuid) from public, anon, authenticated;

grant execute on function public.assert_schedule_cycle_availability_publish_ready(uuid) to service_role;
grant execute on function public.app_publish_schedule_cycle(uuid, uuid) to service_role;
