-- Centralize Open Shifts responder promotion so withdraw and manager-deny paths
-- cannot drift on selected-backup ordering.

create or replace function public.app_promote_next_shift_post_interest(
  p_post_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  next_interest_id uuid;
begin
  select interest.id
    into next_interest_id
  from public.shift_post_interests interest
  where interest.shift_post_id = p_post_id
    and interest.status = 'pending'
  order by interest.created_at asc, interest.id asc
  limit 1
  for update skip locked;

  if next_interest_id is not null then
    update public.shift_post_interests interest
    set status = 'selected',
        responded_at = null
    where interest.id = next_interest_id;
  end if;

  return next_interest_id;
end;
$$;

create or replace function public.app_withdraw_shift_post_interest(
  p_actor_id uuid,
  p_interest_id uuid
)
returns table (
  shift_post_id uuid,
  withdrawn_interest_id uuid,
  promoted_interest_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  locked_interest public.shift_post_interests;
  locked_post public.shift_posts;
  next_interest_id uuid;
begin
  select interest.*
    into locked_interest
  from public.shift_post_interests interest
  where interest.id = p_interest_id
    and interest.therapist_id = p_actor_id
  for update;

  if locked_interest.id is null then
    raise exception 'Shift post interest % cannot be withdrawn by this user.', p_interest_id;
  end if;

  if locked_interest.status not in ('pending', 'selected') then
    raise exception 'Only active pickup interests can be withdrawn.';
  end if;

  select post.*
    into locked_post
  from public.shift_posts post
  where post.id = locked_interest.shift_post_id
  for update;

  if locked_post.id is null or locked_post.status <> 'pending' then
    raise exception 'This pickup request is no longer pending.';
  end if;

  update public.shift_post_interests interest
  set status = 'withdrawn',
      responded_at = now()
  where interest.id = p_interest_id;

  if locked_interest.status = 'selected' then
    next_interest_id := public.app_promote_next_shift_post_interest(locked_interest.shift_post_id);
  end if;

  return query
  select locked_interest.shift_post_id, locked_interest.id, next_interest_id;
end;
$$;

create or replace function public.app_deny_pickup_claimant(
  p_actor_id uuid,
  p_post_id uuid,
  p_interest_id uuid
)
returns table (
  denied_interest_id uuid,
  promoted_interest_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
  actor_active boolean;
  actor_archived_at timestamptz;
  locked_post public.shift_posts;
  denied_interest public.shift_post_interests;
  next_interest_id uuid;
begin
  select profile.role, coalesce(profile.is_active, true), profile.archived_at
    into actor_role, actor_active, actor_archived_at
  from public.profiles profile
  where profile.id = p_actor_id;

  if actor_role <> 'manager' or not actor_active or actor_archived_at is not null then
    raise exception 'Only active managers can deny pickup claimants.';
  end if;

  select post.*
    into locked_post
  from public.shift_posts post
  where post.id = p_post_id
  for update;

  if locked_post.id is null or locked_post.status <> 'pending' or locked_post.type <> 'pickup' then
    raise exception 'Pickup request % is not available for claimant denial.', p_post_id;
  end if;

  select interest.*
    into denied_interest
  from public.shift_post_interests interest
  where interest.id = p_interest_id
    and interest.shift_post_id = p_post_id
    and interest.status in ('pending', 'selected')
  for update;

  if denied_interest.id is null then
    raise exception 'Pickup claimant % is no longer active for shift post %.', p_interest_id, p_post_id;
  end if;

  update public.shift_post_interests interest
  set status = 'declined',
      responded_at = now()
  where interest.id = denied_interest.id;

  if denied_interest.status = 'selected' then
    next_interest_id := public.app_promote_next_shift_post_interest(p_post_id);
  end if;

  return query
  select denied_interest.id, next_interest_id;
end;
$$;

revoke all on function public.app_promote_next_shift_post_interest(uuid) from public, anon, authenticated;
grant execute on function public.app_promote_next_shift_post_interest(uuid) to service_role;

revoke all on function public.app_withdraw_shift_post_interest(uuid, uuid) from public, anon, authenticated;
grant execute on function public.app_withdraw_shift_post_interest(uuid, uuid) to service_role;

revoke all on function public.app_deny_pickup_claimant(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.app_deny_pickup_claimant(uuid, uuid, uuid) to service_role;
