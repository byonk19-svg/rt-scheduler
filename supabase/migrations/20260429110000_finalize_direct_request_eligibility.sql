-- Finalize direct-request eligibility so the request form, approval path,
-- and lead-coverage rules agree on which teammates can actually complete
-- swap and pickup requests.

BEGIN;

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
  actor_is_lead_eligible boolean := false;
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
  recipient_is_lead_eligible boolean := false;
  recipient_swap_shift_id uuid;
  recipient_swap_shift_role public.shift_role;
  other_lead_count integer := 0;
  created_post public.shift_posts;
begin
  if p_actor_id is null then
    raise exception 'Missing actor id.';
  end if;

  select profile.role,
         coalesce(profile.is_active, true),
         profile.archived_at,
         coalesce(profile.is_lead_eligible, false)
    into actor_role,
         actor_active,
         actor_archived_at,
         actor_is_lead_eligible
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

    select profile.shift_type,
           coalesce(profile.is_active, true),
           profile.archived_at,
           coalesce(profile.is_lead_eligible, false)
      into recipient_shift_type,
           recipient_is_active,
           recipient_archived_at,
           recipient_is_lead_eligible
    from public.profiles profile
    where profile.id = p_claimed_by;

    if recipient_shift_type is null or recipient_is_active is not true or recipient_archived_at is not null then
      raise exception 'Recipient is not available for direct requests.';
    end if;

    if recipient_shift_type is distinct from actor_shift_type then
      raise exception 'Direct requests must target a teammate on the same shift type.';
    end if;

    if actor_shift_role = 'lead' and not recipient_is_lead_eligible then
      select count(*)
        into other_lead_count
      from public.shifts shift
      join public.profiles profile on profile.id = shift.user_id
      join public.schedule_cycles cycle on cycle.id = shift.cycle_id
      where shift.date = actor_shift_date
        and shift.shift_type = actor_shift_type
        and shift.role = 'lead'
        and shift.id <> p_shift_id
        and shift.status = 'scheduled'
        and shift.assignment_status = 'scheduled'
        and cycle.published = true
        and coalesce(profile.is_lead_eligible, false) = true;

      if other_lead_count = 0 then
        raise exception 'Lead coverage gap: the selected teammate is not lead eligible for this direct request.';
      end if;
    end if;

    if p_type = 'swap' then
      select shift.id, shift.role
        into recipient_swap_shift_id, recipient_swap_shift_role
      from public.shifts shift
      join public.schedule_cycles cycle on cycle.id = shift.cycle_id
      where shift.user_id = p_claimed_by
        and shift.date = actor_shift_date
        and shift.shift_type = actor_shift_type
        and shift.status = 'scheduled'
        and shift.assignment_status = 'scheduled'
        and cycle.published = true
      order by shift.id
      limit 1
      for update;

      if recipient_swap_shift_id is null then
        raise exception 'Direct swap recipients must already be scheduled for the same date and shift type.';
      end if;

      if recipient_swap_shift_role = 'lead' and not actor_is_lead_eligible then
        select count(*)
          into other_lead_count
        from public.shifts shift
        join public.profiles profile on profile.id = shift.user_id
        join public.schedule_cycles cycle on cycle.id = shift.cycle_id
        where shift.date = actor_shift_date
          and shift.shift_type = actor_shift_type
          and shift.role = 'lead'
          and shift.id <> recipient_swap_shift_id
          and shift.status = 'scheduled'
          and shift.assignment_status = 'scheduled'
          and cycle.published = true
          and coalesce(profile.is_lead_eligible, false) = true;

        if other_lead_count = 0 then
          raise exception 'Lead coverage gap: you are not lead eligible to receive this direct swap.';
        end if;
      end if;
    else
      if exists (
        select 1
        from public.shifts shift
        join public.schedule_cycles cycle on cycle.id = shift.cycle_id
        where shift.user_id = p_claimed_by
          and shift.date = actor_shift_date
          and shift.status = 'scheduled'
          and shift.assignment_status = 'scheduled'
          and cycle.published = true
      ) then
        raise exception 'Direct pickup recipients cannot already be scheduled on this date.';
      end if;
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

create or replace function public.app_review_shift_post(
  p_actor_id uuid,
  p_post_id uuid,
  p_decision text,
  p_selected_interest_id uuid default null,
  p_swap_partner_id uuid default null,
  p_manager_override boolean default false,
  p_override_reason text default null
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
  locked_post public.shift_posts;
  selected_interest record;
  reviewed_post public.shift_posts;
begin
  select profile.role, coalesce(profile.is_active, true), profile.archived_at
    into actor_role, actor_active, actor_archived_at
  from public.profiles profile
  where profile.id = p_actor_id;

  if actor_role <> 'manager' or not actor_active or actor_archived_at is not null then
    raise exception 'Only active managers can review shift posts.';
  end if;

  if p_decision not in ('approve', 'deny') then
    raise exception 'Unsupported review decision %.', p_decision;
  end if;

  select post.*
    into locked_post
  from public.shift_posts post
  where post.id = p_post_id
  for update;

  if locked_post.id is null then
    raise exception 'Shift post % was not found.', p_post_id;
  end if;

  if locked_post.status <> 'pending' then
    raise exception 'Only pending shift posts can be reviewed.';
  end if;

  if p_decision = 'deny' then
    if locked_post.type = 'pickup' then
      update public.shift_post_interests interest
      set status = 'declined',
          responded_at = now()
      where interest.shift_post_id = locked_post.id
        and interest.status in ('pending', 'selected');
    end if;

    update public.shift_posts post
    set status = 'denied'
    where post.id = locked_post.id
    returning post.*
    into reviewed_post;

    return reviewed_post;
  end if;

  if coalesce(locked_post.visibility, 'team') = 'direct'
     and coalesce(locked_post.recipient_response, 'pending') <> 'accepted' then
    raise exception 'Direct request must be accepted by the recipient before approval.';
  end if;

  if locked_post.type = 'pickup' then
    if coalesce(locked_post.visibility, 'team') = 'direct' then
      if locked_post.claimed_by is null then
        raise exception 'Cannot approve pickup request %: no claimant assigned.', locked_post.id;
      end if;

      update public.shift_posts post
      set manager_override = p_manager_override,
          override_reason = case
            when p_manager_override then nullif(btrim(p_override_reason), '')
            else post.override_reason
          end,
          status = 'approved'
      where post.id = locked_post.id
      returning post.*
      into reviewed_post;

      return reviewed_post;
    end if;

    select interest.id,
           interest.therapist_id
      into selected_interest
    from public.shift_post_interests interest
    where interest.shift_post_id = locked_post.id
      and interest.status in ('pending', 'selected')
      and (p_selected_interest_id is null or interest.id = p_selected_interest_id)
    order by case when interest.status = 'selected' then 0 else 1 end,
             interest.created_at asc,
             interest.id asc
    limit 1
    for update;

    if selected_interest.id is null then
      raise exception 'No pickup interest is available to approve for shift post %.', locked_post.id;
    end if;

    update public.shift_post_interests interest
    set status = case when interest.id = selected_interest.id then 'selected' else 'declined' end,
        responded_at = now()
    where interest.shift_post_id = locked_post.id
      and interest.status in ('pending', 'selected');

    update public.shift_posts post
    set claimed_by = selected_interest.therapist_id,
        manager_override = p_manager_override,
        override_reason = case
          when p_manager_override then nullif(btrim(p_override_reason), '')
          else post.override_reason
        end,
        status = 'approved'
    where post.id = locked_post.id
    returning post.*
    into reviewed_post;

    return reviewed_post;
  end if;

  if coalesce(locked_post.visibility, 'team') = 'team' then
    if p_swap_partner_id is null then
      raise exception 'Team-visible swap approvals require a swap partner.';
    end if;

    update public.shift_posts post
    set claimed_by = p_swap_partner_id,
        manager_override = p_manager_override,
        override_reason = case
          when p_manager_override then nullif(btrim(p_override_reason), '')
          else post.override_reason
        end,
        status = 'approved'
    where post.id = locked_post.id
    returning post.*
    into reviewed_post;

    return reviewed_post;
  end if;

  update public.shift_posts post
  set manager_override = p_manager_override,
      override_reason = case
        when p_manager_override then nullif(btrim(p_override_reason), '')
        else post.override_reason
      end,
      status = 'approved'
  where post.id = locked_post.id
  returning post.*
  into reviewed_post;

  return reviewed_post;
end;
$$;

COMMIT;
