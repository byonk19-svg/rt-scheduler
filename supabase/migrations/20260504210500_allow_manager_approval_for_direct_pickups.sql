-- Allow managers to approve direct pickup requests after the recipient accepts,
-- without requiring a shift_post_interests queue entry.

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
