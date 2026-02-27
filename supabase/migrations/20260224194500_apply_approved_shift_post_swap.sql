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
  partner_shift_date date;
  requester_shift_role public.shift_role;
  partner_shift_role public.shift_role;
  requester_shift_user_id uuid;
  partner_shift_user_id uuid;
  partner_is_lead_eligible boolean;
  requester_is_lead_eligible boolean;
begin
  -- Only apply assignment changes when status transitions to approved.
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

  select s.date, s.role, s.user_id
    into requester_shift_date, requester_shift_role, requester_shift_user_id
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

  if requester_shift_role = 'lead' and partner_id is not null then
    select coalesce(p.is_lead_eligible, false)
      into partner_is_lead_eligible
    from public.profiles p
    where p.id = partner_id;

    if not found then
      raise exception 'Cannot approve request %: partner profile % not found.', new.id, partner_id;
    end if;

    if not partner_is_lead_eligible then
      raise exception 'Swap/pickup partner is not lead eligible for requester lead shift.';
    end if;
  end if;

  if new.type = 'pickup' then
    update public.shifts
    set user_id = partner_id
    where id = requester_shift_id;

    return new;
  end if;

  -- Swap flow.
  if new.swap_shift_id is not null then
    select s.id, s.date, s.role, s.user_id
      into partner_shift_id, partner_shift_date, partner_shift_role, partner_shift_user_id
    from public.shifts s
    where s.id = new.swap_shift_id
    for update;
  else
    select s.id, s.date, s.role, s.user_id
      into partner_shift_id, partner_shift_date, partner_shift_role, partner_shift_user_id
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

  if partner_shift_role = 'lead' then
    select coalesce(p.is_lead_eligible, false)
      into requester_is_lead_eligible
    from public.profiles p
    where p.id = requester_id;

    if not found or not requester_is_lead_eligible then
      raise exception 'Requester is not lead eligible for partner lead shift.';
    end if;
  end if;

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
