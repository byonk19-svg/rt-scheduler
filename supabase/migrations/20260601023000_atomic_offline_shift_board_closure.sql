create or replace function public.app_take_schedule_cycle_offline(
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
  v_closure_reason text := 'Schedule block was taken offline. Submit a new request after it is republished.';
begin
  select actor.site_id
    into v_actor_site_id
  from public.profiles actor
  where actor.id = p_actor_id
    and actor.role = 'manager'
    and actor.is_active = true
    and actor.archived_at is null;

  if v_actor_site_id is null then
    raise exception 'Only active managers can take Schedule Blocks offline.' using errcode = '42501';
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

  if v_cycle.status <> 'final'::public.schedule_cycle_status
    or coalesce(v_cycle.published, false) = false
  then
    raise exception 'Only live Final Schedule Blocks can be taken offline.' using errcode = '55000';
  end if;

  update public.schedule_cycles
  set status = 'offline'::public.schedule_cycle_status,
      published = false,
      offline_at = now(),
      offline_by = p_actor_id
  where schedule_cycles.id = p_cycle_id
    and schedule_cycles.status = 'final'::public.schedule_cycle_status
    and schedule_cycles.published = true
  returning schedule_cycles.id into v_updated_id;

  if v_updated_id is null then
    return;
  end if;

  update public.preliminary_snapshots
  set status = 'superseded'
  where cycle_id = p_cycle_id
    and status = 'active';

  with posts_to_close as (
    update public.shift_posts post
    set status = 'denied',
        override_reason = v_closure_reason
    where post.status = 'pending'
      and exists (
        select 1
        from public.shifts shift
        where shift.id = post.shift_id
          and shift.cycle_id = p_cycle_id
          and shift.site_id is not distinct from v_actor_site_id
      )
    returning post.id
  )
  update public.shift_post_interests interest
  set status = 'declined',
      responded_at = now()
  where interest.status in ('pending', 'selected')
    and exists (
      select 1
      from posts_to_close closed
      where closed.id = interest.shift_post_id
    );

  return query select v_updated_id;
end;
$$;

alter function public.app_take_schedule_cycle_offline(uuid, uuid) owner to postgres;

revoke all on function public.app_take_schedule_cycle_offline(uuid, uuid) from public, anon, authenticated;
grant execute on function public.app_take_schedule_cycle_offline(uuid, uuid) to service_role;
