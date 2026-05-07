begin;

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
  actor_cycle_id uuid;
  actor_shift_date date;
  actor_shift_type text;
  actor_cycle_published boolean;
  actor_shift_status text;
  actor_assignment_status public.assignment_status;
  recipient_role text;
  recipient_shift_type text;
  recipient_is_active boolean;
  recipient_archived_at timestamptz;
  recipient_swap_shift_id uuid;
  recipient_has_same_day_shift boolean;
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
         shift.cycle_id,
         shift.date,
         shift.shift_type,
         cycle.published,
         shift.status,
         shift.assignment_status
    into actor_shift_user_id,
         actor_cycle_id,
         actor_shift_date,
         actor_shift_type,
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

  if coalesce(p_visibility, 'team') = 'direct' and p_claimed_by is null then
    raise exception 'Direct requests require a recipient.';
  end if;

  if p_type = 'pickup' and coalesce(p_visibility, 'team') = 'team' then
    p_claimed_by := null;
  end if;

  if p_claimed_by is not null then
    if p_claimed_by = p_actor_id then
      raise exception 'You cannot send a direct request to yourself.';
    end if;

    select profile.role,
           profile.shift_type,
           coalesce(profile.is_active, true),
           profile.archived_at
      into recipient_role,
           recipient_shift_type,
           recipient_is_active,
           recipient_archived_at
    from public.profiles profile
    where profile.id = p_claimed_by;

    if recipient_role not in ('therapist', 'lead')
       or recipient_shift_type is null
       or recipient_is_active is not true
       or recipient_archived_at is not null then
      raise exception 'Recipient is not available for direct requests.';
    end if;

    if recipient_shift_type is distinct from actor_shift_type then
      raise exception 'Direct requests must target a teammate on the same shift type.';
    end if;

    if p_type = 'swap' then
      select shift.id
        into recipient_swap_shift_id
      from public.shifts shift
      join public.schedule_cycles cycle on cycle.id = shift.cycle_id
      where shift.user_id = p_claimed_by
        and shift.cycle_id = actor_cycle_id
        and shift.date >= current_date
        and shift.date <> actor_shift_date
        and shift.shift_type = actor_shift_type
        and shift.status = 'scheduled'
        and shift.assignment_status = 'scheduled'
        and cycle.published = true
      order by shift.date asc, shift.id asc
      limit 1
      for update;

      if recipient_swap_shift_id is null then
        raise exception 'Swap partner must already have a different scheduled shift on the same shift type.';
      end if;
    elsif p_type = 'pickup' then
      select exists (
        select 1
        from public.shifts shift
        join public.schedule_cycles cycle on cycle.id = shift.cycle_id
        where shift.user_id = p_claimed_by
          and shift.cycle_id = actor_cycle_id
          and shift.date = actor_shift_date
          and shift.status = 'scheduled'
          and shift.assignment_status = 'scheduled'
          and cycle.published = true
      )
        into recipient_has_same_day_shift;

      if recipient_has_same_day_shift then
        raise exception 'Direct pickup recipient is already scheduled on this date.';
      end if;
    end if;
  end if;

  insert into public.shift_posts (
    shift_id,
    posted_by,
    claimed_by,
    swap_shift_id,
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
    case when p_type = 'swap' then recipient_swap_shift_id else null end,
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

create or replace function public.apply_approved_shift_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_shift_id uuid;
  requester_id uuid;
  partner_id uuid;
  partner_shift_id uuid;
  requester_cycle_id uuid;
  partner_cycle_id uuid;
  requester_shift_date date;
  requester_shift_type text;
  partner_shift_date date;
  partner_shift_type text;
  requester_shift_role public.shift_role;
  partner_shift_role public.shift_role;
  requester_shift_user_id uuid;
  partner_shift_user_id uuid;
  requester_shift_status text;
  partner_shift_status text;
  requester_assignment_status public.assignment_status;
  partner_assignment_status public.assignment_status;
  requester_cycle_published boolean;
  partner_cycle_published boolean;
  requester_has_active_op boolean := false;
  partner_has_active_op boolean := false;
  shift_is_lead_slot boolean := false;
  partner_slot_is_lead boolean := false;
  partner_is_eligible boolean := false;
  requester_is_eligible boolean := false;
  other_lead_count integer := 0;
begin
  if new.status <> 'approved' or old.status = 'approved' then
    return new;
  end if;

  requester_shift_id := new.shift_id;
  requester_id := new.posted_by;
  partner_id := coalesce(new.claimed_by, null);

  if requester_shift_id is null then
    raise exception 'Cannot approve request %: shift_id is null.', new.id;
  end if;
  if requester_id is null then
    raise exception 'Cannot approve request %: posted_by is null.', new.id;
  end if;
  if new.type not in ('swap', 'pickup') then
    raise exception 'Cannot approve request %: unsupported type %.', new.id, new.type;
  end if;
  if coalesce(new.visibility, 'team') = 'direct'
     and coalesce(new.recipient_response, 'pending') <> 'accepted' then
    raise exception 'Direct request must be accepted by the recipient before approval.';
  end if;

  select s.cycle_id, s.date, s.shift_type, s.role, s.user_id, s.status, s.assignment_status, cycle.published
    into requester_cycle_id, requester_shift_date, requester_shift_type, requester_shift_role,
         requester_shift_user_id, requester_shift_status, requester_assignment_status,
         requester_cycle_published
  from public.shifts s
  join public.schedule_cycles cycle on cycle.id = s.cycle_id
  where s.id = requester_shift_id
  for update;

  if not found then
    raise exception 'Cannot approve request %: requester shift % not found.',
      new.id, requester_shift_id;
  end if;
  if requester_shift_user_id is distinct from requester_id then
    raise exception 'Cannot approve request %: requester no longer owns shift %.',
      new.id, requester_shift_id;
  end if;
  if requester_cycle_published is not true
     or requester_shift_status is distinct from 'scheduled'
     or requester_assignment_status is distinct from 'scheduled' then
    raise exception 'Cannot approve request %: requester shift is not working on a published schedule.',
      new.id;
  end if;

  if new.type = 'pickup' then
    if partner_id is null then
      raise exception 'Cannot approve pickup request %: no claimant assigned.', new.id;
    end if;
  end if;

  if new.type = 'swap' then
    if partner_id is null then
      raise exception 'Cannot approve swap request %: no swap partner assigned.', new.id;
    end if;
    if partner_id = requester_id then
      raise exception 'Cannot approve swap request %: requester and partner are the same user.',
        new.id;
    end if;

    if new.swap_shift_id is not null then
      select s.id, s.cycle_id, s.date, s.shift_type, s.role, s.user_id, s.status, s.assignment_status, cycle.published
        into partner_shift_id, partner_cycle_id, partner_shift_date, partner_shift_type,
             partner_shift_role, partner_shift_user_id, partner_shift_status,
             partner_assignment_status, partner_cycle_published
      from public.shifts s
      join public.schedule_cycles cycle on cycle.id = s.cycle_id
      where s.id = new.swap_shift_id
      for update;
    else
      select s.id, s.cycle_id, s.date, s.shift_type, s.role, s.user_id, s.status, s.assignment_status, cycle.published
        into partner_shift_id, partner_cycle_id, partner_shift_date, partner_shift_type,
             partner_shift_role, partner_shift_user_id, partner_shift_status,
             partner_assignment_status, partner_cycle_published
      from public.shifts s
      join public.schedule_cycles cycle on cycle.id = s.cycle_id
      where s.user_id = partner_id
        and s.cycle_id = requester_cycle_id
        and s.date >= current_date
        and s.date <> requester_shift_date
        and s.shift_type = requester_shift_type
        and s.status = 'scheduled'
        and s.assignment_status = 'scheduled'
        and cycle.published = true
      order by s.date asc, s.id asc
      limit 1
      for update;
    end if;

    if partner_shift_id is null then
      raise exception 'Could not find a different shift for swap partner.';
    end if;
    if partner_shift_user_id is distinct from partner_id then
      raise exception 'Cannot approve request %: partner no longer owns shift %.',
        new.id, partner_shift_id;
    end if;
    if partner_cycle_id is distinct from requester_cycle_id then
      raise exception 'Cannot approve request %: partner shift is in a different schedule cycle.', new.id;
    end if;
    if partner_shift_date is not distinct from requester_shift_date then
      raise exception 'Cannot approve request %: swap partner is already on the requester shift date.', new.id;
    end if;
    if partner_shift_type is distinct from requester_shift_type then
      raise exception 'Cannot approve request %: partner shift type mismatch.', new.id;
    end if;
    if partner_cycle_published is not true
       or partner_shift_status is distinct from 'scheduled'
       or partner_assignment_status is distinct from 'scheduled' then
      raise exception 'Cannot approve request %: partner shift is not working on a published schedule.',
        new.id;
    end if;

    select exists(
      select 1
      from public.shift_operational_entries entry
      where entry.shift_id = requester_shift_id
        and entry.active = true
    ) into requester_has_active_op;

    select exists(
      select 1
      from public.shift_operational_entries entry
      where entry.shift_id = partner_shift_id
        and entry.active = true
    ) into partner_has_active_op;

    if requester_has_active_op then
      raise exception
        'Cannot approve request %: requester shift has an active operational code or is not working.',
        new.id;
    end if;
    if partner_has_active_op then
      raise exception
        'Cannot approve request %: partner shift has an active operational code or is not working.',
        new.id;
    end if;
  end if;

  if not coalesce(new.manager_override, false) then
    shift_is_lead_slot := requester_shift_role = 'lead';

    if shift_is_lead_slot then
      select coalesce(profile.is_lead_eligible, false)
        into partner_is_eligible
      from public.profiles profile
      where profile.id = partner_id;

      if not partner_is_eligible then
        select count(*)
          into other_lead_count
        from public.shifts shift
        join public.profiles profile on profile.id = shift.user_id
        where shift.date = requester_shift_date
          and shift.shift_type = requester_shift_type
          and shift.role = 'lead'
          and shift.id <> requester_shift_id
          and coalesce(profile.is_lead_eligible, false) = true;

        if other_lead_count = 0 then
          raise exception 'Lead coverage gap: this shift would have no lead after approval.';
        end if;
      end if;
    end if;

    if new.type = 'swap' and partner_shift_id is not null then
      partner_slot_is_lead := partner_shift_role = 'lead';

      if partner_slot_is_lead then
        select coalesce(profile.is_lead_eligible, false)
          into requester_is_eligible
        from public.profiles profile
        where profile.id = requester_id;

        if not requester_is_eligible then
          select count(*)
            into other_lead_count
          from public.shifts shift
          join public.profiles profile on profile.id = shift.user_id
          where shift.date = partner_shift_date
            and shift.shift_type = partner_shift_type
            and shift.role = 'lead'
            and shift.id <> partner_shift_id
            and coalesce(profile.is_lead_eligible, false) = true;

          if other_lead_count = 0 then
            raise exception 'Lead coverage gap: this shift would have no lead after approval.';
          end if;
        end if;
      end if;
    end if;
  end if;

  if new.type = 'pickup' then
    update public.shifts
    set user_id = partner_id
    where id = requester_shift_id;

    return new;
  end if;

  set constraints shifts_unique_cycle_user_date deferred;

  update public.shifts
  set user_id = partner_id
  where id = requester_shift_id;

  update public.shifts
  set user_id = requester_id
  where id = partner_shift_id;

  return new;
end;
$$;

drop trigger if exists on_shift_post_approved_apply_assignment on public.shift_posts;
create trigger on_shift_post_approved_apply_assignment
  after update of status
  on public.shift_posts
  for each row
  execute function public.apply_approved_shift_post();

revoke all on function public.app_create_shift_post_request(uuid, uuid, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.app_create_shift_post_request(uuid, uuid, text, text, uuid, text) to service_role;

commit;
