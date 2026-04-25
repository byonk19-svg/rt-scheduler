-- Migration: harden_shift_post_request_mutations
-- Created: 2026-04-26
-- Description: Tighten shift-post privacy and insert/update rules, and add transactional request mutation functions for direct requests and pickup queues.

BEGIN;

drop policy if exists "Anyone logged in can view shift posts" on public.shift_posts;

drop policy if exists "Managers can read all shift posts" on public.shift_posts;
create policy "Managers can read all shift posts"
  on public.shift_posts
  for select
  using (
    exists (
      select 1
      from public.profiles actor
      where actor.id = auth.uid()
        and actor.role = 'manager'
        and actor.is_active = true
        and actor.archived_at is null
    )
  );

drop policy if exists "Authenticated users can read team shift posts" on public.shift_posts;
create policy "Authenticated users can read team shift posts"
  on public.shift_posts
  for select
  using (
    auth.uid() is not null
    and coalesce(visibility, 'team') = 'team'
  );

drop policy if exists "Participants can read direct shift posts" on public.shift_posts;
create policy "Participants can read direct shift posts"
  on public.shift_posts
  for select
  using (
    coalesce(visibility, 'team') = 'direct'
    and auth.uid() is not null
    and (
      posted_by = auth.uid()
      or claimed_by = auth.uid()
    )
  );

drop policy if exists "Users can create their own shift posts" on public.shift_posts;
create policy "Users can create their own shift posts"
  on public.shift_posts
  for insert
  with check (
    auth.uid() = posted_by
    and status = 'pending'
    and coalesce(request_kind, 'standard') = 'standard'
    and (
      (
        coalesce(visibility, 'team') = 'direct'
        and claimed_by is not null
        and claimed_by is distinct from auth.uid()
        and recipient_response = 'pending'
      )
      or (
        coalesce(visibility, 'team') = 'team'
        and claimed_by is null
        and recipient_response is null
      )
    )
  );

drop policy if exists "Therapists can update their own shift post interest" on public.shift_post_interests;
create policy "Therapists can update their own shift post interest"
  on public.shift_post_interests
  for update
  using (
    therapist_id = auth.uid()
    and status in ('pending', 'selected')
  )
  with check (
    therapist_id = auth.uid()
    and status = 'withdrawn'
  );

create or replace function public.enforce_shift_post_interest_parent_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_post_status text;
  parent_post_type text;
  parent_post_visibility text;
begin
  select post.status, post.type, coalesce(post.visibility, 'team')
    into parent_post_status, parent_post_type, parent_post_visibility
  from public.shift_posts post
  where post.id = new.shift_post_id
  for update;

  if not found then
    raise exception 'Shift post % not found for interest %.', new.shift_post_id, new.id;
  end if;

  if parent_post_type <> 'pickup' then
    raise exception 'Shift post % does not accept pickup interests.', new.shift_post_id;
  end if;

  if parent_post_visibility <> 'team' then
    raise exception 'Shift post % does not allow pickup interests.', new.shift_post_id;
  end if;

  if new.status in ('pending', 'selected') and parent_post_status <> 'pending' then
    raise exception 'Shift post % is no longer pending.', new.shift_post_id;
  end if;

  return new;
end;
$$;

drop trigger if exists shift_post_interest_parent_state_guard on public.shift_post_interests;
create trigger shift_post_interest_parent_state_guard
  before insert or update of status
  on public.shift_post_interests
  for each row
  execute function public.enforce_shift_post_interest_parent_state();

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
      and entry.cleared_at is null
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

create or replace function public.app_respond_direct_shift_post(
  p_actor_id uuid,
  p_post_id uuid,
  p_response text
)
returns public.shift_posts
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_post public.shift_posts;
begin
  if p_response not in ('accepted', 'declined') then
    raise exception 'Unsupported direct request response %.', p_response;
  end if;

  update public.shift_posts post
  set recipient_response = p_response,
      recipient_responded_at = now(),
      status = case when p_response = 'declined' then 'denied' else post.status end
  where post.id = p_post_id
    and post.posted_by is not null
    and post.claimed_by = p_actor_id
    and coalesce(post.visibility, 'team') = 'direct'
    and post.status = 'pending'
  returning post.*
  into updated_post;

  if updated_post.id is null then
    raise exception 'Direct request % is not available for this recipient response.', p_post_id;
  end if;

  return updated_post;
end;
$$;

create or replace function public.app_withdraw_shift_post(
  p_actor_id uuid,
  p_post_id uuid
)
returns public.shift_posts
language plpgsql
security definer
set search_path = public
as $$
declare
  locked_post public.shift_posts;
  withdrawn_post public.shift_posts;
begin
  select post.*
    into locked_post
  from public.shift_posts post
  where post.id = p_post_id
    and post.posted_by = p_actor_id
  for update;

  if locked_post.id is null then
    raise exception 'Shift post % cannot be withdrawn by this user.', p_post_id;
  end if;

  if locked_post.status <> 'pending' then
    raise exception 'Only pending requests can be withdrawn.';
  end if;

  if locked_post.request_kind = 'call_in' then
    raise exception 'Call-in alerts cannot be withdrawn from this workflow.';
  end if;

  update public.shift_posts post
  set status = 'withdrawn',
      override_reason = 'Withdrawn by requester.'
  where post.id = p_post_id
  returning post.*
  into withdrawn_post;

  if withdrawn_post.type = 'pickup' then
    update public.shift_post_interests interest
    set status = 'declined',
        responded_at = now()
    where interest.shift_post_id = p_post_id
      and interest.status in ('pending', 'selected');
  end if;

  return withdrawn_post;
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
    select interest.id
      into next_interest_id
    from public.shift_post_interests interest
    where interest.shift_post_id = locked_interest.shift_post_id
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
  end if;

  return query
  select locked_interest.shift_post_id, locked_interest.id, next_interest_id;
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
        responded_at = case when interest.id = selected_interest.id then now() else now() end
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
  end if;

  return query
  select denied_interest.id, next_interest_id;
end;
$$;

revoke all on function public.app_create_shift_post_request(uuid, uuid, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.app_create_shift_post_request(uuid, uuid, text, text, uuid, text) to service_role;

revoke all on function public.app_respond_direct_shift_post(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.app_respond_direct_shift_post(uuid, uuid, text) to service_role;

revoke all on function public.app_withdraw_shift_post(uuid, uuid) from public, anon, authenticated;
grant execute on function public.app_withdraw_shift_post(uuid, uuid) to service_role;

revoke all on function public.app_withdraw_shift_post_interest(uuid, uuid) from public, anon, authenticated;
grant execute on function public.app_withdraw_shift_post_interest(uuid, uuid) to service_role;

revoke all on function public.app_review_shift_post(uuid, uuid, text, uuid, uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.app_review_shift_post(uuid, uuid, text, uuid, uuid, boolean, text) to service_role;

revoke all on function public.app_deny_pickup_claimant(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.app_deny_pickup_claimant(uuid, uuid, uuid) to service_role;

COMMIT;
