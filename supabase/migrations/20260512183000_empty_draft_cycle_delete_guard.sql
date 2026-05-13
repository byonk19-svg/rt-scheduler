create or replace function public.app_delete_empty_draft_schedule_cycle(
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
  v_dependency_count integer := 0;
  v_deleted_id uuid;
begin
  select actor.site_id
    into v_actor_site_id
  from public.profiles actor
  where actor.id = p_actor_id
    and actor.role = 'manager'
    and actor.is_active = true
    and actor.archived_at is null;

  if v_actor_site_id is null then
    raise exception 'Only active managers can delete Schedule Blocks.' using errcode = '42501';
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

  if coalesce(v_cycle.published, false)
    or v_cycle.status <> 'draft'::public.schedule_cycle_status
    or v_cycle.archived_at is not null
  then
    raise exception 'Only empty unpublished Draft Schedule Blocks can be deleted.' using errcode = '55000';
  end if;

  select
    (select count(*) from public.shifts where cycle_id = p_cycle_id)
    + (select count(*) from public.preliminary_snapshots where cycle_id = p_cycle_id)
    + (select count(*) from public.publish_events where cycle_id = p_cycle_id)
    + (select count(*) from public.therapist_availability_submissions where schedule_cycle_id = p_cycle_id)
    + (select count(*) from public.availability_overrides where cycle_id = p_cycle_id)
    into v_dependency_count;

  if v_dependency_count > 0 then
    raise exception 'Schedule Block has schedule, availability, preliminary, or publish history and cannot be deleted.' using errcode = '23503';
  end if;

  delete from public.schedule_cycles
  where schedule_cycles.id = p_cycle_id
    and schedule_cycles.status = 'draft'::public.schedule_cycle_status
    and schedule_cycles.published = false
    and schedule_cycles.archived_at is null
  returning schedule_cycles.id into v_deleted_id;

  if v_deleted_id is null then
    return;
  end if;

  return query select v_deleted_id;
end;
$$;

alter function public.app_delete_empty_draft_schedule_cycle(uuid, uuid) owner to postgres;

revoke all on function public.app_delete_empty_draft_schedule_cycle(uuid, uuid) from public, anon, authenticated;
grant execute on function public.app_delete_empty_draft_schedule_cycle(uuid, uuid) to service_role;
