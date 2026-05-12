-- Migration: active_designated_lead_publish_check
-- Created: 2026-05-12
-- Description: Require active working designated leads for final publish and automatic lead promotion.

begin;

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

  if v_cycle.status not in ('draft'::public.schedule_cycle_status, 'preliminary'::public.schedule_cycle_status) then
    raise exception 'Only Draft or Preliminary Schedule Blocks can be published.' using errcode = '55000';
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
      bool_or(coalesce(profile.is_lead_eligible, false) = false) as has_ineligible_lead
    from slots
    left join public.shifts lead_shift
      on lead_shift.cycle_id = p_cycle_id
     and lead_shift.date = slots.date
     and lead_shift.shift_type = slots.shift_type
     and lead_shift.role = 'lead'
     and lead_shift.user_id is not null
     and lead_shift.unfilled_reason is null
     and not exists (
       select 1
       from public.shift_operational_entries active_entry
       where active_entry.shift_id = lead_shift.id
         and active_entry.active = true
         and active_entry.code in ('on_call', 'call_in', 'cancelled', 'left_early')
     )
    left join public.profiles profile on profile.id = lead_shift.user_id
    group by slots.date, slots.shift_type
  )
  select count(*)
    into v_missing_or_bad_lead_slots
  from slot_leads
  where lead_count <> 1
    or coalesce(has_ineligible_lead, false);

  if v_missing_or_bad_lead_slots > 0 then
    raise exception 'Final publish requires exactly one active lead-capable assigned Designated Lead for every date and shift.' using errcode = '23514';
  end if;

  update public.schedule_cycles
  set status = 'final'::public.schedule_cycle_status,
      published = true
  where schedule_cycles.id = p_cycle_id
    and schedule_cycles.status in ('draft'::public.schedule_cycle_status, 'preliminary'::public.schedule_cycle_status)
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

create or replace function public.promote_next_designated_lead_for_shift(
  p_shift_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shift public.shifts%rowtype;
  v_next_shift_id uuid;
begin
  select *
    into v_shift
  from public.shifts shift
  where shift.id = p_shift_id
  for update;

  if not found or v_shift.role <> 'lead' or v_shift.user_id is null then
    return null;
  end if;

  select candidate.id
    into v_next_shift_id
  from public.shifts candidate
  join public.profiles profile on profile.id = candidate.user_id
  where candidate.cycle_id = v_shift.cycle_id
    and candidate.date = v_shift.date
    and candidate.shift_type = v_shift.shift_type
    and candidate.id <> v_shift.id
    and candidate.user_id is not null
    and candidate.role = 'staff'
    and candidate.unfilled_reason is null
    and profile.is_lead_eligible = true
    and profile.is_active = true
    and profile.archived_at is null
    and not exists (
      select 1
      from public.shift_operational_entries active_entry
      where active_entry.shift_id = candidate.id
        and active_entry.active = true
        and active_entry.code in ('on_call', 'call_in', 'cancelled', 'left_early')
    )
  order by profile.full_name nulls last, candidate.user_id, candidate.id
  limit 1
  for update of candidate;

  if v_next_shift_id is null then
    return null;
  end if;

  update public.shifts
  set role = 'staff'
  where shifts.id = v_shift.id
    and shifts.role = 'lead';

  update public.shifts
  set role = 'lead'
  where shifts.id = v_next_shift_id
    and shifts.role = 'staff';

  return v_next_shift_id;
end;
$$;

create or replace function public.promote_next_designated_lead_after_operational_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    return old;
  end if;

  if new.active = true and new.code in ('on_call', 'call_in', 'cancelled', 'left_early') then
    perform public.promote_next_designated_lead_for_shift(new.shift_id);
  end if;

  return new;
end;
$$;

alter function public.app_publish_schedule_cycle(uuid, uuid) owner to postgres;
alter function public.promote_next_designated_lead_for_shift(uuid) owner to postgres;
alter function public.promote_next_designated_lead_after_operational_change() owner to postgres;

revoke all on function public.app_publish_schedule_cycle(uuid, uuid) from public, anon, authenticated;
revoke all on function public.promote_next_designated_lead_for_shift(uuid) from public, anon, authenticated;
revoke all on function public.promote_next_designated_lead_after_operational_change() from public, anon, authenticated;

grant execute on function public.app_publish_schedule_cycle(uuid, uuid) to service_role;
grant execute on function public.promote_next_designated_lead_for_shift(uuid) to service_role;

commit;
