-- Fix request creation to use the live operational-entry schema.
-- Active operational locks are represented by shift_operational_entries.active = true;
-- there is no cleared_at column on this table.

create or replace function public.app_create_shift_post_request(
  p_actor_id uuid,
  p_shift_id uuid,
  p_type text,
  p_visibility text,
  p_claimed_by uuid,
  p_message text
)
returns public.shift_posts
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
  actor_active boolean;
  actor_archived_at timestamptz;
  actor_shift_user_id uuid;
  actor_shift_date date;
  actor_shift_type text;
  actor_shift_role public.shift_role;
  actor_cycle_published boolean;
  actor_shift_status text;
  actor_assignment_status public.assignment_status;
  recipient_shift_type text;
  recipient_is_active boolean;
  recipient_archived_at timestamptz;
  created_post public.shift_posts;
begin
  if p_actor_id is null then
    raise exception 'Missing actor id.';
  end if;

  select profile.role, coalesce(profile.is_active, true), profile.archived_at
    into actor_role, actor_active, actor_archived_at
  from public.profiles profile
  where profile.id = p_actor_id;

  if actor_role not in ('therapist', 'lead') or not actor_active or actor_archived_at is not null then
    raise exception 'Only active therapists can create requests.';
  end if;

  if p_type not in ('swap', 'pickup') then
    raise exception 'Unsupported request type %.', p_type;
  end if;

  if coalesce(p_visibility, 'team') not in ('team', 'direct') then
    raise exception 'Unsupported request visibility %.', p_visibility;
  end if;

  select shift.user_id,
         shift.date,
         shift.shift_type,
         shift.role,
         cycle.published,
         shift.status,
         shift.assignment_status
    into actor_shift_user_id,
         actor_shift_date,
         actor_shift_type,
         actor_shift_role,
         actor_cycle_published,
         actor_shift_status,
         actor_assignment_status
  from public.shifts shift
  join public.schedule_cycles cycle on cycle.id = shift.cycle_id
  where shift.id = p_shift_id
  for update;

  if not found then
    raise exception 'Shift % was not found.', p_shift_id;
  end if;

  if actor_shift_user_id is distinct from p_actor_id then
    raise exception 'You can only create requests from your own shift.';
  end if;

  if actor_cycle_published is not true then
    raise exception 'Requests can only be created from a published schedule.';
  end if;

  if actor_shift_status is distinct from 'scheduled' or actor_assignment_status is distinct from 'scheduled' then
    raise exception 'Requests can only be created from a working scheduled shift.';
  end if;

  if exists (
    select 1
    from public.shift_operational_entries entry
    where entry.shift_id = p_shift_id
      and entry.active = true
  ) then
    raise exception 'Requests cannot be created for shifts with active operational codes.';
  end if;

  if coalesce(p_visibility, 'team') = 'direct' then
    if p_claimed_by is null then
      raise exception 'Direct requests require a recipient.';
    end if;

    if p_claimed_by = p_actor_id then
      raise exception 'You cannot send a direct request to yourself.';
    end if;

    select profile.shift_type, coalesce(profile.is_active, true), profile.archived_at
      into recipient_shift_type, recipient_is_active, recipient_archived_at
    from public.profiles profile
    where profile.id = p_claimed_by;

    if recipient_shift_type is null or recipient_is_active is not true or recipient_archived_at is not null then
      raise exception 'Recipient is not available for direct requests.';
    end if;

    if recipient_shift_type is distinct from actor_shift_type then
      raise exception 'Direct requests must target a teammate on the same shift type.';
    end if;
  else
    p_claimed_by := null;
  end if;

  insert into public.shift_posts (
    shift_id,
    posted_by,
    claimed_by,
    type,
    status,
    visibility,
    recipient_response,
    recipient_responded_at,
    request_kind,
    message
  )
  values (
    p_shift_id,
    p_actor_id,
    p_claimed_by,
    p_type,
    'pending',
    coalesce(p_visibility, 'team'),
    case when coalesce(p_visibility, 'team') = 'direct' then 'pending' else null end,
    null,
    'standard',
    nullif(btrim(p_message), '')
  )
  returning *
  into created_post;

  return created_post;
end;
$$;
