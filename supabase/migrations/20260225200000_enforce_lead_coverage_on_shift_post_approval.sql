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
  shift_is_lead_slot boolean := false;
  partner_slot_is_lead boolean := false;
  partner_is_eligible boolean := false;
  requester_is_eligible boolean := false;
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

  if new.type = 'swap' then
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
  end if;

  -- Lead-slot vacancy protection checks (before assignment updates).
  shift_is_lead_slot := requester_shift_role = 'lead';

  if shift_is_lead_slot then
    select coalesce(p.is_lead_eligible, false)
      into partner_is_eligible
    from public.profiles p
    where p.id = partner_id;

    if not found or not partner_is_eligible then
      raise exception
        'Lead coverage gap: this is a lead shift and the swap partner is not lead eligible. The day would be left without a lead.';
    end if;
  end if;

  if new.type = 'swap' and partner_shift_id is not null then
    partner_slot_is_lead := partner_shift_role = 'lead';

    if partner_slot_is_lead then
      select coalesce(p.is_lead_eligible, false)
        into requester_is_eligible
      from public.profiles p
      where p.id = requester_id;

      if not found or not requester_is_eligible then
        raise exception
          'Lead coverage gap: the shift you are receiving is a lead shift but you are not lead eligible.';
      end if;
    end if;
  end if;

  if new.type = 'pickup' then
    update public.shifts
    set user_id = partner_id
    where id = requester_shift_id;

    return new;
  end if;

  -- Swap flow.
  update public.shifts
  set user_id = partner_id
  where id = requester_shift_id;

  update public.shifts
  set user_id = requester_id
  where id = partner_shift_id;

  return new;
end;
$$;
