create or replace function public.update_assignment_status(
  p_actor_id uuid,
  p_assignment_id uuid,
  p_status public.assignment_status,
  p_note text default null::text,
  p_left_early_time time without time zone default null::time without time zone
)
returns table(
  id uuid,
  assignment_status public.assignment_status,
  status_note text,
  left_early_time time without time zone,
  status_updated_at timestamp with time zone,
  status_updated_by uuid,
  status_updated_by_name text
)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is not null and auth.uid() is distinct from p_actor_id then
    raise exception 'Actor does not match authenticated user.' using errcode = '42501';
  end if;

  if p_actor_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  perform set_config('request.jwt.claim.sub', p_actor_id::text, true);

  return query
  select *
  from public.update_assignment_status(
    p_assignment_id,
    p_status,
    p_note,
    p_left_early_time
  );
end;
$function$;

alter function public.update_assignment_status(
  uuid,
  uuid,
  public.assignment_status,
  text,
  time without time zone
) owner to postgres;

revoke all on function public.update_assignment_status(
  uuid,
  uuid,
  public.assignment_status,
  text,
  time without time zone
) from public, anon, authenticated;
grant execute on function public.update_assignment_status(
  uuid,
  uuid,
  public.assignment_status,
  text,
  time without time zone
) to service_role;

revoke all on function public.update_assignment_status(
  uuid,
  public.assignment_status,
  text,
  time without time zone
) from public, anon, authenticated, service_role;

revoke all on function public.app_insert_unpublished_cycle_shifts(uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.app_insert_unpublished_cycle_shifts(uuid, uuid, jsonb)
  to service_role;

revoke all on function public.app_delete_unpublished_cycle_shifts(uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.app_delete_unpublished_cycle_shifts(uuid, uuid, boolean)
  to service_role;

revoke all on function public.apply_approved_shift_post()
  from public, anon, authenticated, service_role;
