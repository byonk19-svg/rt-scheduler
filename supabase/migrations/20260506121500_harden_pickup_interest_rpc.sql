begin;

drop policy if exists "Users can create their own shift posts" on public.shift_posts;
drop policy if exists "Therapists can create their own shift post interest" on public.shift_post_interests;

revoke insert on table public.shift_posts from anon, authenticated;
revoke insert on table public.shift_post_interests from anon, authenticated;

create or replace function public.app_assert_pickup_claimant_eligible(
  p_post_id uuid,
  p_claimant_id uuid,
  p_allow_direct boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  post_status text;
  post_type text;
  post_visibility text;
  post_requester_id uuid;
  post_shift_id uuid;
  post_shift_date date;
  post_shift_type text;
  post_shift_role public.shift_role;
  post_shift_site_id text;
  post_shift_status text;
  post_assignment_status public.assignment_status;
  post_cycle_published boolean;
  claimant_role text;
  claimant_shift_type text;
  claimant_site_id text;
  claimant_active boolean;
  claimant_archived_at timestamptz;
  claimant_is_lead_eligible boolean;
begin
  select post.status,
         post.type,
         coalesce(post.visibility, 'team'),
         post.posted_by,
         shift.id,
         shift.date,
         shift.shift_type,
         shift.role,
         shift.site_id,
         shift.status,
         shift.assignment_status,
         cycle.published
    into post_status,
         post_type,
         post_visibility,
         post_requester_id,
         post_shift_id,
         post_shift_date,
         post_shift_type,
         post_shift_role,
         post_shift_site_id,
         post_shift_status,
         post_assignment_status,
         post_cycle_published
  from public.shift_posts post
  join public.shifts shift on shift.id = post.shift_id
  join public.schedule_cycles cycle on cycle.id = shift.cycle_id
  where post.id = p_post_id
  for update of post, shift;

  if post_shift_id is null then
    raise exception 'Shift post % was not found.', p_post_id;
  end if;

  if post_type <> 'pickup'
     or post_status <> 'pending'
     or (
       post_visibility <> 'team'
       and (p_allow_direct is not true or post_visibility <> 'direct')
     ) then
    raise exception 'This pickup request is no longer accepting interests.';
  end if;

  if post_cycle_published is not true
     or post_shift_status is distinct from 'scheduled'
     or post_assignment_status is distinct from 'scheduled' then
    raise exception 'Pickup request is not tied to a working scheduled shift.';
  end if;

  select profile.role,
         profile.shift_type,
         profile.site_id,
         coalesce(profile.is_active, true),
         profile.archived_at,
         coalesce(profile.is_lead_eligible, false)
    into claimant_role,
         claimant_shift_type,
         claimant_site_id,
         claimant_active,
         claimant_archived_at,
         claimant_is_lead_eligible
  from public.profiles profile
  where profile.id = p_claimant_id;

  if claimant_role not in ('therapist', 'lead')
     or claimant_active is not true
     or claimant_archived_at is not null then
    raise exception 'Pickup claimant is not eligible for this request.';
  end if;

  if p_claimant_id = post_requester_id then
    raise exception 'You cannot express interest in your own pickup request.';
  end if;

  if claimant_site_id is distinct from post_shift_site_id then
    raise exception 'Pickup claimant is outside this request site.';
  end if;

  if claimant_shift_type is distinct from post_shift_type then
    raise exception 'Pickup claimant must work the same shift type.';
  end if;

  if post_shift_role = 'lead' and claimant_is_lead_eligible is not true then
    raise exception 'Pickup claimant is not lead eligible for this request.';
  end if;

  if exists (
    select 1
    from public.shifts claimant_shift
    join public.schedule_cycles claimant_cycle on claimant_cycle.id = claimant_shift.cycle_id
    where claimant_shift.user_id = p_claimant_id
      and claimant_shift.date = post_shift_date
      and claimant_shift.status = 'scheduled'
      and claimant_shift.assignment_status = 'scheduled'
      and claimant_cycle.published = true
      and claimant_shift.id <> post_shift_id
  ) then
    raise exception 'Pickup claimant already has a scheduled shift on this date.';
  end if;
end;
$$;

create or replace function public.app_express_shift_post_interest(
  p_actor_id uuid,
  p_post_id uuid
)
returns table (
  id uuid,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_interest public.shift_post_interests;
  next_status text := 'selected';
begin
  perform public.app_assert_pickup_claimant_eligible(p_post_id, p_actor_id);

  if exists (
    select 1
    from public.shift_post_interests interest
    where interest.shift_post_id = p_post_id
      and interest.status = 'selected'
  ) then
    next_status := 'pending';
  end if;

  begin
    insert into public.shift_post_interests (
      shift_post_id,
      therapist_id,
      status
    )
    values (
      p_post_id,
      p_actor_id,
      next_status
    )
    returning *
    into inserted_interest;
  exception
    when unique_violation then
      if next_status = 'selected' then
        insert into public.shift_post_interests (
          shift_post_id,
          therapist_id,
          status
        )
        values (
          p_post_id,
          p_actor_id,
          'pending'
        )
        returning *
        into inserted_interest;

        next_status := 'pending';
      else
        raise;
      end if;
  end;

  return query
  select inserted_interest.id, next_status;
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
  effective_swap_partner_id uuid;
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
        raise exception 'Direct pickup request % has no accepted recipient to approve.', locked_post.id;
      end if;

      perform public.app_assert_pickup_claimant_eligible(locked_post.id, locked_post.claimed_by, true);

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

    perform public.app_assert_pickup_claimant_eligible(locked_post.id, selected_interest.therapist_id);

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
    effective_swap_partner_id := coalesce(p_swap_partner_id, locked_post.claimed_by);

    if effective_swap_partner_id is null then
      raise exception 'Team-visible swap approvals require a swap partner.';
    end if;

    update public.shift_posts post
    set claimed_by = effective_swap_partner_id,
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

revoke all on function public.app_assert_pickup_claimant_eligible(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.app_assert_pickup_claimant_eligible(uuid, uuid, boolean) to service_role;

revoke all on function public.app_express_shift_post_interest(uuid, uuid) from public, anon, authenticated;
grant execute on function public.app_express_shift_post_interest(uuid, uuid) to service_role;

comment on table public.shift_posts is
  'Lifecycle writes are routed through service-role RPCs and trusted server routes; authenticated clients cannot insert or update shift_posts directly.';

comment on table public.shift_post_interests is
  'Pickup-interest writes are routed through service-role RPCs and trusted server routes; authenticated clients cannot insert interests directly.';

commit;
