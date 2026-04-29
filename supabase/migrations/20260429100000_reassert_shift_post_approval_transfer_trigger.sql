BEGIN;

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
  requester_shift_status text;
  partner_shift_status text;
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

  select s.date, s.shift_type, s.role, s.user_id, s.status
    into requester_shift_date, requester_shift_type, requester_shift_role,
         requester_shift_user_id, requester_shift_status
  from public.shifts s
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
      select s.id, s.date, s.shift_type, s.role, s.user_id, s.status
        into partner_shift_id, partner_shift_date, partner_shift_type,
             partner_shift_role, partner_shift_user_id, partner_shift_status
      from public.shifts s
      where s.id = new.swap_shift_id
      for update;
    else
      select s.id, s.date, s.shift_type, s.role, s.user_id, s.status
        into partner_shift_id, partner_shift_date, partner_shift_type,
             partner_shift_role, partner_shift_user_id, partner_shift_status
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
      raise exception 'Cannot approve request %: partner no longer owns shift %.',
        new.id, partner_shift_id;
    end if;
    if partner_shift_date is distinct from requester_shift_date then
      raise exception 'Cannot approve request %: partner shift date mismatch.', new.id;
    end if;
    if partner_shift_type is distinct from requester_shift_type then
      raise exception 'Cannot approve request %: partner shift type mismatch.', new.id;
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

    if requester_shift_status is distinct from 'scheduled' or requester_has_active_op then
      raise exception
        'Cannot approve request %: requester shift has an active operational code or is not working.',
        new.id;
    end if;
    if partner_shift_status is distinct from 'scheduled' or partner_has_active_op then
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

COMMIT;
