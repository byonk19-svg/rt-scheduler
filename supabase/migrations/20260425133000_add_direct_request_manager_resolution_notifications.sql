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

    if new.recipient_response = 'declined' and new.posted_by is not null then
      insert into public.notifications (user_id, event_type, title, message, target_type, target_id)
      values (
        new.posted_by,
        'direct_request_declined',
        'Direct request declined',
        'Your direct request was declined by the recipient.',
        'shift_post',
        new.id::text
      );

      insert into public.notifications (user_id, event_type, title, message, target_type, target_id)
      select
        manager_profile.id,
        'direct_request_declined',
        'Direct request declined',
        'A direct request was declined by the recipient.',
        'shift_post',
        new.id::text
      from public.profiles manager_profile
      where manager_profile.role = 'manager';
    end if;
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'approved' and new.posted_by is not null then
      if coalesce(new.visibility, 'team') = 'direct' then
        insert into public.notifications (user_id, event_type, title, message, target_type, target_id)
        values (
          new.posted_by,
          'direct_request_approved',
          'Direct request approved',
          'Your direct request was approved by the manager.',
          'shift_post',
          new.id::text
        );

        if new.claimed_by is not null and new.claimed_by is distinct from new.posted_by then
          insert into public.notifications (user_id, event_type, title, message, target_type, target_id)
          values (
            new.claimed_by,
            'direct_request_approved',
            'Direct request approved',
            'The manager approved this direct request.',
            'shift_post',
            new.id::text
          );
        end if;
      else
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
    end if;

    if new.status = 'denied' and new.posted_by is not null then
      if coalesce(new.visibility, 'team') = 'direct' then
        insert into public.notifications (user_id, event_type, title, message, target_type, target_id)
        values (
          new.posted_by,
          'direct_request_denied',
          'Direct request denied',
          'Your direct request was denied by the manager.',
          'shift_post',
          new.id::text
        );

        if new.claimed_by is not null and new.claimed_by is distinct from new.posted_by then
          insert into public.notifications (user_id, event_type, title, message, target_type, target_id)
          values (
            new.claimed_by,
            'direct_request_denied',
            'Direct request denied',
            'The manager denied this direct request.',
            'shift_post',
            new.id::text
          );
        end if;
      else
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

    if new.status = 'withdrawn' and coalesce(new.visibility, 'team') = 'direct' then
      if new.claimed_by is not null and new.claimed_by is distinct from new.posted_by then
        insert into public.notifications (user_id, event_type, title, message, target_type, target_id)
        values (
          new.claimed_by,
          'direct_request_withdrawn',
          'Direct request withdrawn',
          'The sender withdrew this direct request before final approval.',
          'shift_post',
          new.id::text
        );
      end if;

      insert into public.notifications (user_id, event_type, title, message, target_type, target_id)
      select
        manager_profile.id,
        'direct_request_withdrawn',
        'Direct request withdrawn',
        'A direct request was withdrawn before final approval.',
        'shift_post',
        new.id::text
      from public.profiles manager_profile
      where manager_profile.role = 'manager';
    end if;
  end if;

  return new;
end;
$$;
