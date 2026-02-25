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
        'swap_request_received',
        'Someone wants to swap with you',
        'You have been tagged in a swap request. Check it out.',
        'shift_post',
        new.id::text
      );
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
  after insert or update of status
  on public.shift_posts
  for each row
  execute function public.notify_on_shift_post_change();

do $$
begin
  begin
    alter publication supabase_realtime add table public.notifications;
  exception
    when duplicate_object then
      null;
  end;
end
$$;
