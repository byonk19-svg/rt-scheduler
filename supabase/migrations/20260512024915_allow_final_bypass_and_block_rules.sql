-- Migration: allow_final_bypass_and_block_rules
-- Created: 2026-05-12
-- Description: Enforce Schedule Block shape rules and align draft/preliminary/final lifecycle RPCs with department rules.

begin;

create or replace function public.enforce_schedule_cycle_block_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.archived_at is not null then
    return new;
  end if;

  if new.start_date is null
    or new.end_date is null
    or new.end_date <> new.start_date + 41
    or extract(dow from new.start_date) <> 0
  then
    raise exception 'Schedule Blocks must start on Sunday and run exactly 42 calendar days.' using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.schedule_cycles existing
    where existing.id <> new.id
      and existing.site_id = new.site_id
      and existing.archived_at is null
      and daterange(existing.start_date, existing.end_date, '[]')
        && daterange(new.start_date, new.end_date, '[]')
  ) then
    raise exception 'Active Schedule Blocks cannot overlap for the same site.' using errcode = '23505';
  end if;

  return new;
end;
$$;

drop trigger if exists schedule_cycles_enforce_block_rules
  on public.schedule_cycles;
create trigger schedule_cycles_enforce_block_rules
before insert or update of site_id, start_date, end_date, archived_at
on public.schedule_cycles
for each row execute function public.enforce_schedule_cycle_block_rules();

comment on function public.enforce_schedule_cycle_block_rules() is
  'Enforces new or date-edited Schedule Blocks as non-overlapping six-week Sunday-start ranges while preserving legacy historical rows.';

create or replace function public.app_insert_unpublished_cycle_shifts(
  p_actor_id uuid,
  p_cycle_id uuid,
  p_shifts jsonb
)
returns table (id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_site_id text;
  v_cycle_site_id text;
  v_cycle_published boolean;
  v_cycle_status public.schedule_cycle_status;
begin
  select actor.site_id
    into v_actor_site_id
  from public.profiles actor
  where actor.id = p_actor_id
    and actor.role = 'manager'
    and actor.is_active = true
    and actor.archived_at is null;

  if v_actor_site_id is null then
    raise exception 'Only active managers can mutate draft shifts.' using errcode = '42501';
  end if;

  select cycle.site_id, coalesce(cycle.published, false), cycle.status
    into v_cycle_site_id, v_cycle_published, v_cycle_status
  from public.schedule_cycles cycle
  where cycle.id = p_cycle_id
  for update;

  if not found then
    raise exception 'Schedule Block not found.' using errcode = 'P0002';
  end if;

  if v_cycle_site_id is distinct from v_actor_site_id then
    raise exception 'Schedule Block is outside your site scope.' using errcode = '42501';
  end if;

  if v_cycle_published or v_cycle_status <> 'draft'::public.schedule_cycle_status then
    raise exception 'Only Draft Schedule Blocks can receive auto-draft mutations.' using errcode = '55000';
  end if;

  return query
  with payload as (
    select value as row
    from jsonb_array_elements(coalesce(p_shifts, '[]'::jsonb))
  ),
  normalized as (
    select
      nullif(row ->> 'user_id', '')::uuid as user_id,
      (row ->> 'date')::date as date,
      row ->> 'shift_type' as shift_type,
      coalesce(nullif(row ->> 'status', ''), 'scheduled') as status,
      coalesce(nullif(row ->> 'role', ''), 'staff')::public.shift_role as role,
      coalesce(nullif(row ->> 'assignment_status', ''), 'scheduled')::public.assignment_status as assignment_status,
      nullif(row ->> 'unfilled_reason', '') as unfilled_reason,
      nullif(row ->> 'status_note', '') as status_note
    from payload
  )
  insert into public.shifts (
    cycle_id,
    user_id,
    date,
    shift_type,
    status,
    role,
    assignment_status,
    unfilled_reason,
    status_note,
    site_id
  )
  select
    p_cycle_id,
    normalized.user_id,
    normalized.date,
    normalized.shift_type,
    normalized.status,
    normalized.role,
    normalized.assignment_status,
    normalized.unfilled_reason,
    normalized.status_note,
    v_actor_site_id
  from normalized
  where normalized.date is not null
    and normalized.shift_type in ('day', 'night')
    and (
      normalized.user_id is null
      or exists (
        select 1
        from public.profiles therapist
        where therapist.id = normalized.user_id
          and therapist.role in ('therapist', 'lead')
          and therapist.is_active = true
          and therapist.archived_at is null
          and therapist.site_id = v_actor_site_id
      )
    )
    and not exists (
      select 1
      from public.shifts existing
      where existing.cycle_id = p_cycle_id
        and existing.user_id = normalized.user_id
        and existing.date = normalized.date
    )
  returning shifts.id;
end;
$$;

create or replace function public.app_delete_unpublished_cycle_shifts(
  p_actor_id uuid,
  p_cycle_id uuid,
  p_unfilled_only boolean default false
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_site_id text;
  v_cycle_site_id text;
  v_cycle_published boolean;
  v_cycle_status public.schedule_cycle_status;
  v_deleted_count integer := 0;
begin
  select actor.site_id
    into v_actor_site_id
  from public.profiles actor
  where actor.id = p_actor_id
    and actor.role = 'manager'
    and actor.is_active = true
    and actor.archived_at is null;

  if v_actor_site_id is null then
    raise exception 'Only active managers can mutate draft shifts.' using errcode = '42501';
  end if;

  select cycle.site_id, coalesce(cycle.published, false), cycle.status
    into v_cycle_site_id, v_cycle_published, v_cycle_status
  from public.schedule_cycles cycle
  where cycle.id = p_cycle_id
  for update;

  if not found then
    raise exception 'Schedule Block not found.' using errcode = 'P0002';
  end if;

  if v_cycle_site_id is distinct from v_actor_site_id then
    raise exception 'Schedule Block is outside your site scope.' using errcode = '42501';
  end if;

  if v_cycle_published or v_cycle_status <> 'draft'::public.schedule_cycle_status then
    raise exception 'Only Draft Schedule Blocks can receive draft reset mutations.' using errcode = '55000';
  end if;

  with deleted as (
    delete from public.shifts shift
    where shift.cycle_id = p_cycle_id
      and shift.site_id = v_actor_site_id
      and (not p_unfilled_only or shift.unfilled_reason is not null)
    returning 1
  )
  select count(*) into v_deleted_count from deleted;

  return v_deleted_count;
end;
$$;

create or replace function public.app_start_schedule_cycle_over(
  p_actor_id uuid,
  p_cycle_id uuid
)
returns table (id uuid, deleted_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_site_id text;
  v_cycle public.schedule_cycles%rowtype;
  v_deleted_count integer := 0;
begin
  select actor.site_id
    into v_actor_site_id
  from public.profiles actor
  where actor.id = p_actor_id
    and actor.role = 'manager'
    and actor.is_active = true
    and actor.archived_at is null;

  if v_actor_site_id is null then
    raise exception 'Only active managers can start a Schedule Block over.' using errcode = '42501';
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

  if v_cycle.status not in ('draft'::public.schedule_cycle_status, 'preliminary'::public.schedule_cycle_status)
    or coalesce(v_cycle.published, false)
  then
    raise exception 'Only Draft or Preliminary Schedule Blocks can be started over.' using errcode = '55000';
  end if;

  with deleted as (
    delete from public.shifts shift
    where shift.cycle_id = p_cycle_id
      and shift.site_id = v_actor_site_id
    returning 1
  )
  select count(*) into v_deleted_count from deleted;

  update public.preliminary_snapshots
  set status = 'superseded'
  where cycle_id = p_cycle_id
    and status = 'active';

  update public.schedule_cycles
  set status = 'draft'::public.schedule_cycle_status,
      published = false
  where schedule_cycles.id = p_cycle_id;

  return query select p_cycle_id, v_deleted_count;
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
    left join public.profiles profile on profile.id = lead_shift.user_id
    group by slots.date, slots.shift_type
  )
  select count(*)
    into v_missing_or_bad_lead_slots
  from slot_leads
  where lead_count <> 1
    or coalesce(has_ineligible_lead, false);

  if v_missing_or_bad_lead_slots > 0 then
    raise exception 'Final publish requires exactly one lead-capable assigned Designated Lead for every date and shift.' using errcode = '23514';
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
        and active_entry.code in ('on_call', 'call_in', 'cancelled')
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

  if new.active = true and new.code in ('call_in', 'cancelled') then
    perform public.promote_next_designated_lead_for_shift(new.shift_id);
  end if;

  return new;
end;
$$;

drop trigger if exists shift_operational_entries_promote_next_designated_lead
  on public.shift_operational_entries;
create trigger shift_operational_entries_promote_next_designated_lead
after insert or update of active, code on public.shift_operational_entries
for each row execute function public.promote_next_designated_lead_after_operational_change();

alter function public.app_insert_unpublished_cycle_shifts(uuid, uuid, jsonb) owner to postgres;
alter function public.app_delete_unpublished_cycle_shifts(uuid, uuid, boolean) owner to postgres;
alter function public.app_start_schedule_cycle_over(uuid, uuid) owner to postgres;
alter function public.app_publish_schedule_cycle(uuid, uuid) owner to postgres;
alter function public.promote_next_designated_lead_for_shift(uuid) owner to postgres;
alter function public.promote_next_designated_lead_after_operational_change() owner to postgres;
alter function public.enforce_schedule_cycle_block_rules() owner to postgres;

revoke all on function public.app_insert_unpublished_cycle_shifts(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.app_delete_unpublished_cycle_shifts(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.app_start_schedule_cycle_over(uuid, uuid) from public, anon, authenticated;
revoke all on function public.app_publish_schedule_cycle(uuid, uuid) from public, anon, authenticated;
revoke all on function public.promote_next_designated_lead_for_shift(uuid) from public, anon, authenticated;
revoke all on function public.promote_next_designated_lead_after_operational_change() from public, anon, authenticated;
revoke all on function public.enforce_schedule_cycle_block_rules() from public, anon, authenticated;

grant execute on function public.app_insert_unpublished_cycle_shifts(uuid, uuid, jsonb) to service_role;
grant execute on function public.app_delete_unpublished_cycle_shifts(uuid, uuid, boolean) to service_role;
grant execute on function public.app_start_schedule_cycle_over(uuid, uuid) to service_role;
grant execute on function public.app_publish_schedule_cycle(uuid, uuid) to service_role;
grant execute on function public.promote_next_designated_lead_for_shift(uuid) to service_role;

commit;
