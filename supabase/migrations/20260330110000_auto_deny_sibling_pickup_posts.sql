-- PRD v5.1 §6.1: When a manager approves one PRN pickup candidate, all other
-- pending pickup posts for the same shift_id are auto-denied.

create or replace function public.deny_sibling_pickup_posts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only fires when a pickup post transitions to approved.
  if new.status = 'approved' and old.status <> 'approved' and new.type = 'pickup' then
    update public.shift_posts
    set status = 'denied'
    where shift_id = new.shift_id
      and type     = 'pickup'
      and status   = 'pending'
      and id       <> new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists deny_sibling_pickup_posts_trigger on public.shift_posts;
create trigger deny_sibling_pickup_posts_trigger
after update of status on public.shift_posts
for each row
execute function public.deny_sibling_pickup_posts();
