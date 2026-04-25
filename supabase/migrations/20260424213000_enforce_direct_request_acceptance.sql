create or replace function public.notify_on_shift_post_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    insert into public.notifications (user_id, event_type, title, message, target_type, target_id)
    select
      manager_profile.id,
      'new_request',
      'New swap request',
      'A staff member posted a new swap request.',
      'shift_post',
      new.id::text
    from public.profiles manager_profile
    where manager_profile.role = 'manager'
      and manager_profile.id is distinct from new.posted_by;

    if new.claimed_by is not null and new.claimed_by is distinct from new.posted_by then
      insert into public.notifications (user_id, event_type, title, message, target_type, target_id)
      values (
        new.claimed_by,
        case when coalesce(new.visibility, 'team') = 'direct' then 'direct_request_received' else 'swap_request_received' end,
        case when coalesce(new.visibility, 'team') = 'direct' then 'Direct request received' else 'Someone wants to swap with you' end,
        case when coalesce(new.visibility, 'team') = 'direct'
          then 'You have a private direct request. Review it before the manager can approve it.'
          else 'You have been tagged in a swap request. Check it out.'
        end,
        'shift_post',
        new.id::text
      );
    end if;
  end if;

  if tg_op = 'UPDATE' and new.recipient_response is distinct from old.recipient_response and coalesce(new.visibility, 'team') = 'direct' then
    if new.recipient_response = 'accepted' and new.posted_by is not null then
      insert into public.notifications (user_id, event_type, title, message, target_type, target_id)
      values (
        new.posted_by,
        'direct_request_accepted',
        'Direct request accepted',
        'Your direct request was accepted and is waiting for manager approval.',
        'shift_post',
        new.id::text
      );

      insert into public.notifications (user_id, event_type, title, message, target_type, target_id)
      select
        manager_profile.id,
        'direct_request_accepted',
        'Direct request accepted',
        'A direct request was accepted and is ready for manager review.',
        'shift_post',
        new.id::text
      from public.profiles manager_profile
      where manager_profile.role = 'manager';
    end if;
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'approved' and new.posted_by is not null then
      insert into public.notifications (user_id, event_type, title, message, target_type, target_id)
      values (
        new.posted_by,
        'request_approved',
        'Swap request approved',
        'Your swap request has been approved by the manager.',
        'shift_post',
        new.id::text
      );
    end if;

    if new.status = 'denied' and new.posted_by is not null then
      insert into public.notifications (user_id, event_type, title, message, target_type, target_id)
      values (
        new.posted_by,
        'request_denied',
        'Swap request denied',
        'Your swap request was not approved. You can post a new one.',
        'shift_post',
        new.id::text
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_shift_post_change on public.shift_posts;
create trigger on_shift_post_change
  after insert or update of status, recipient_response
  on public.shift_posts
  for each row
  execute function public.notify_on_shift_post_change();

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
  requester_shift_date date;
  requester_shift_type text;
  partner_shift_date date;
  partner_shift_type text;
  requester_shift_role public.shift_role;
  partner_shift_role public.shift_role;
  requester_shift_user_id uuid;
  partner_shift_user_id uuid;
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

  if coalesce(new.visibility, 'team') = 'direct' and coalesce(new.recipient_response, 'pending') <> 'accepted' then
    raise exception 'Direct request must be accepted by the recipient before approval.';
  end if;

  select s.date, s.shift_type, s.role, s.user_id
    into requester_shift_date, requester_shift_type, requester_shift_role, requester_shift_user_id
  from public.shifts s
  where s.id = requester_shift_id
  for update;

  if not found then
    raise exception 'Cannot approve request %: requester shift % not found.', new.id, requester_shift_id;
  end if;

  if requester_shift_user_id is distinct from requester_id then
    raise exception 'Cannot approve request %: requester no longer owns shift %.', new.id, requester_shift_id;
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
      raise exception 'Cannot approve swap request %: requester and partner are the same user.', new.id;
    end if;
  end if;

  if not coalesce(new.manager_override, false) then
    shift_is_lead_slot := requester_shift_role = 'lead';

    if shift_is_lead_slot then
      select coalesce(p.is_lead_eligible, false)
        into partner_is_eligible
      from public.profiles p
      where p.id = partner_id;

      if not partner_is_eligible then
        select count(*)
          into other_lead_count
        from public.shifts s
        join public.profiles p on p.id = s.user_id
        where s.date = requester_shift_date
          and s.shift_type = requester_shift_type
          and s.role = 'lead'
          and s.id <> requester_shift_id
          and coalesce(p.is_lead_eligible, false) = true;

        if other_lead_count = 0 then
          raise exception
            'Lead coverage gap: this shift would have no lead after approval.';
        end if;
      end if;
    end if;

    if new.type = 'swap' and partner_shift_id is not null then
      partner_slot_is_lead := partner_shift_role = 'lead';

      if partner_slot_is_lead then
        select coalesce(p.is_lead_eligible, false)
          into requester_is_eligible
        from public.profiles p
        where p.id = requester_id;

        if not requester_is_eligible then
          select count(*)
            into other_lead_count
          from public.shifts s
          join public.profiles p on p.id = s.user_id
          where s.date = partner_shift_date
            and s.shift_type = partner_shift_type
            and s.role = 'lead'
            and s.id <> partner_shift_id
            and coalesce(p.is_lead_eligible, false) = true;

          if other_lead_count = 0 then
            raise exception
              'Lead coverage gap: this shift would have no lead after approval.';
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

  if new.swap_shift_id is not null then
    select s.id, s.date, s.shift_type, s.role, s.user_id
      into partner_shift_id, partner_shift_date, partner_shift_type, partner_shift_role, partner_shift_user_id
    from public.shifts s
    where s.id = new.swap_shift_id
    for update;
  else
    select s.id, s.date, s.shift_type, s.role, s.user_id
      into partner_shift_id, partner_shift_date, partner_shift_type, partner_shift_role, partner_shift_user_id
    from public.shifts s
    where s.date = requester_shift_date
      and s.user_id = partner_id
    order by case when s.shift_type = 'day' then 0 else 1 end, s.id
    limit 1
    for update;
  end if;

  if partner_shift_id is null then
    raise exception 'Could not find a shift for swap partner on %.', requester_shift_date;
  end if;

  if partner_shift_user_id is distinct from partner_id then
    raise exception 'Cannot approve request %: partner no longer owns shift %.', new.id, partner_shift_id;
  end if;

  if partner_shift_date is distinct from requester_shift_date then
    raise exception 'Cannot approve request %: partner shift date mismatch.', new.id;
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
