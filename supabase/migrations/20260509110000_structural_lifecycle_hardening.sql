begin;

comment on column public.shifts.status is
  'Legacy planned/compatibility status. Live operational state is represented by active rows in public.shift_operational_entries.';

comment on column public.shifts.assignment_status is
  'Legacy UI compatibility mirror paired with public.shifts.status. Do not treat as independent operational truth; use public.shift_operational_entries for active operational state.';

alter table public.shifts
  drop constraint if exists shifts_legacy_status_pair_check;

alter table public.shifts
  add constraint shifts_legacy_status_pair_check
  check (
    (assignment_status <> 'on_call' or status = 'on_call')
    and (assignment_status not in ('call_in', 'cancelled') or status = 'called_off')
    and (assignment_status <> 'left_early' or status = 'scheduled')
  )
  not valid;

create or replace function public.find_invalid_shift_status_pairs()
returns table (
  shift_id uuid,
  assignment_status public.assignment_status,
  status text
)
language sql
stable
security definer
set search_path = public
as $$
  select shifts.id, shifts.assignment_status, shifts.status
  from public.shifts
  where (
    shifts.assignment_status = 'on_call'
    and shifts.status <> 'on_call'
  )
  or (
    shifts.assignment_status in ('call_in', 'cancelled')
    and shifts.status <> 'called_off'
  )
  or (
    shifts.assignment_status = 'left_early'
    and shifts.status <> 'scheduled'
  );
$$;

alter function public.find_invalid_shift_status_pairs() owner to postgres;
revoke all on function public.find_invalid_shift_status_pairs() from public;
grant execute on function public.find_invalid_shift_status_pairs() to authenticated;
grant execute on function public.find_invalid_shift_status_pairs() to service_role;

alter table public.availability_overrides
  add column if not exists intent text;

update public.availability_overrides
set intent = case
  when source_intake_id is not null or source_intake_item_id is not null then 'email_intake'
  when source = 'manager' and override_type = 'force_off' then 'manager_block'
  when source = 'manager' and override_type = 'force_on' then 'manager_force'
  when source = 'therapist' and override_type = 'force_on' then 'therapist_wants_work'
  else 'therapist_need_off'
end
where intent is null;

alter table public.availability_overrides
  drop constraint if exists availability_overrides_intent_check;

alter table public.availability_overrides
  add constraint availability_overrides_intent_check
  check (
    intent in (
      'therapist_need_off',
      'therapist_wants_work',
      'manager_block',
      'manager_force',
      'email_intake'
    )
  );

alter table public.availability_overrides
  alter column intent set not null;

comment on column public.availability_overrides.source is
  'Provenance: who wrote the row. Reason/intent is stored separately in public.availability_overrides.intent.';

comment on column public.availability_overrides.intent is
  'Reason for the override: therapist_need_off, therapist_wants_work, manager_block, manager_force, or email_intake.';

create index if not exists availability_overrides_intent_idx
  on public.availability_overrides (intent, cycle_id, therapist_id);

alter table public.availability_email_intake_items
  add column if not exists applied_at timestamptz null,
  add column if not exists applied_by uuid null references public.profiles (id) on delete set null,
  add column if not exists apply_method text null;

update public.availability_email_intake_items
set parse_status = 'applied',
    applied_at = coalesce(applied_at, auto_applied_at),
    applied_by = coalesce(applied_by, auto_applied_by),
    apply_method = coalesce(apply_method, 'auto')
where parse_status = 'auto_applied'
  and auto_applied_at is not null;

alter table public.availability_email_intake_items
  drop constraint if exists availability_email_intake_items_parse_status_check;

alter table public.availability_email_intake_items
  add constraint availability_email_intake_items_parse_status_check
  check (parse_status in ('parsed', 'ready_to_apply', 'applied', 'auto_applied', 'needs_review', 'failed'));

alter table public.availability_email_intake_items
  drop constraint if exists availability_email_intake_items_apply_method_check;

alter table public.availability_email_intake_items
  add constraint availability_email_intake_items_apply_method_check
  check (apply_method is null or apply_method in ('auto', 'manual'));

comment on column public.availability_email_intake_items.parse_status is
  'Item lifecycle status. ready_to_apply means pre-screened only; applied means the availability_overrides write succeeded.';

comment on column public.availability_email_intake_items.applied_at is
  'Set only after the corresponding availability_overrides write succeeds.';

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
  v_cycle_site_id text;
  v_cycle_published boolean;
  v_updated_id uuid;
begin
  select actor.site_id
    into v_actor_site_id
  from public.profiles actor
  where actor.id = p_actor_id
    and actor.role = 'manager'
    and actor.is_active = true
    and actor.archived_at is null;

  if v_actor_site_id is null then
    raise exception 'Only active managers can publish schedule cycles.' using errcode = '42501';
  end if;

  select cycle.site_id, coalesce(cycle.published, false)
    into v_cycle_site_id, v_cycle_published
  from public.schedule_cycles cycle
  where cycle.id = p_cycle_id
  for update;

  if not found then
    raise exception 'Schedule cycle not found.' using errcode = 'P0002';
  end if;

  if v_cycle_site_id is distinct from v_actor_site_id then
    raise exception 'Schedule cycle is outside your site scope.' using errcode = '42501';
  end if;

  if v_cycle_published then
    raise exception 'Schedule cycle is already published.' using errcode = '55000';
  end if;

  update public.schedule_cycles
  set published = true
  where schedule_cycles.id = p_cycle_id
    and schedule_cycles.published = false
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

alter function public.app_publish_schedule_cycle(uuid, uuid) owner to postgres;
revoke all on function public.app_publish_schedule_cycle(uuid, uuid) from public, anon, authenticated;
grant execute on function public.app_publish_schedule_cycle(uuid, uuid) to authenticated;
grant execute on function public.app_publish_schedule_cycle(uuid, uuid) to service_role;

commit;
