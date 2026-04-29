BEGIN;
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
  requester_shift_date date;
  requester_shift_type text;
  requester_shift_role public.shift_role;
  requester_shift_user_id uuid;
  partner_is_eligible boolean := false;
  other_lead_count integer := 0;
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

    select shift.date, shift.shift_type, shift.role, shift.user_id
      into requester_shift_date, requester_shift_type, requester_shift_role, requester_shift_user_id
    from public.shifts shift
    where shift.id = locked_post.shift_id
    for update;

    if requester_shift_user_id is distinct from locked_post.posted_by then
      raise exception 'Cannot approve request %: requester no longer owns shift %.',
        locked_post.id, locked_post.shift_id;
    end if;

    if not coalesce(p_manager_override, false) and requester_shift_role = 'lead' then
      select coalesce(profile.is_lead_eligible, false)
        into partner_is_eligible
      from public.profiles profile
      where profile.id = selected_interest.therapist_id;

      if not partner_is_eligible then
        select count(*)
          into other_lead_count
        from public.shifts shift
        join public.profiles profile on profile.id = shift.user_id
        where shift.date = requester_shift_date
          and shift.shift_type = requester_shift_type
          and shift.role = 'lead'
          and shift.id <> locked_post.shift_id
          and coalesce(profile.is_lead_eligible, false) = true;

        if other_lead_count = 0 then
          raise exception 'Lead coverage gap: this shift would have no lead after approval.';
        end if;
      end if;
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

    update public.shifts shift
    set user_id = selected_interest.therapist_id
    where shift.id = locked_post.shift_id;

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
revoke all on function public.app_review_shift_post(uuid, uuid, text, uuid, uuid, boolean, text)
  from public, anon, authenticated;
grant execute on function public.app_review_shift_post(uuid, uuid, text, uuid, uuid, boolean, text)
  to service_role;
COMMIT;
