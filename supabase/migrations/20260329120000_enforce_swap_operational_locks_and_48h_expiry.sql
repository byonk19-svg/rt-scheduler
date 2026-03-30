-- PRD alignment:
-- - Swap approvals require two working scheduled shifts on the same date and shift type.
-- - Any active operational code locks a shift from swap approval.
-- - Pending swap posts expire after 48 hours.
-- - Expired swap posts cannot be reopened.

create or replace function public.expire_unclaimed_swap_requests()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  expired_count integer;
begin
  update public.shift_posts sp
  set
    status = 'expired',
    expired_at = now()
  where
    sp.type = 'swap'
    and sp.status = 'pending'
    and sp.created_at <= now() - interval '48 hours';

  get diagnostics expired_count = row_count;
  return expired_count;
end;
$$;

-- Keep one canonical cron schedule for the expiry job.
do $$
declare
  existing_job_id integer;
begin
  for existing_job_id in
    select jobid from cron.job where jobname = 'expire-unclaimed-swap-requests'
  loop
    perform cron.unschedule(existing_job_id);
  end loop;
end;
$$;

select cron.schedule(
  'expire-unclaimed-swap-requests',
  '0 * * * *',
  $$select public.expire_unclaimed_swap_requests()$$
);

create or replace function public.enforce_shift_post_status_transitions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'expired' and new.status <> 'expired' then
    raise exception 'Expired shift post % cannot be reopened. Create a new request.', new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists shift_post_status_transition_guard on public.shift_posts;
create trigger shift_post_status_transition_guard
before update of status on public.shift_posts
for each row
execute function public.enforce_shift_post_status_transitions();

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
  requester_assignment_status public.assignment_status;
  partner_assignment_status public.assignment_status;
  shift_is_lead_slot boolean := false;
  partner_slot_is_lead boolean := false;
  partner_is_eligible boolean := false;
  requester_is_eligible boolean := false;
  other_lead_count integer := 0;
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

  select s.date, s.shift_type, s.role, s.user_id, s.status, s.assignment_status
    into requester_shift_date, requester_shift_type, requester_shift_role, requester_shift_user_id, requester_shift_status, requester_assignment_status
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
      select s.id, s.date, s.shift_type, s.role, s.user_id, s.status, s.assignment_status
        into partner_shift_id, partner_shift_date, partner_shift_type, partner_shift_role, partner_shift_user_id, partner_shift_status, partner_assignment_status
      from public.shifts s
      where s.id = new.swap_shift_id
      for update;
    else
      select s.id, s.date, s.shift_type, s.role, s.user_id, s.status, s.assignment_status
        into partner_shift_id, partner_shift_date, partner_shift_type, partner_shift_role, partner_shift_user_id, partner_shift_status, partner_assignment_status
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

    if partner_shift_type is distinct from requester_shift_type then
      raise exception 'Cannot approve request %: partner shift type mismatch.', new.id;
    end if;

    if requester_shift_status is distinct from 'scheduled'
       or requester_assignment_status is distinct from 'scheduled' then
      raise exception
        'Cannot approve request %: requester shift has an active operational code or is not working.',
        new.id;
    end if;

    if partner_shift_status is distinct from 'scheduled'
       or partner_assignment_status is distinct from 'scheduled' then
      raise exception
        'Cannot approve request %: partner shift has an active operational code or is not working.',
        new.id;
    end if;
  end if;

  -- Lead-slot vacancy protection checks.
  -- Skipped when manager_override = true (manager accepts responsibility).
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

  -- Swap flow: defer the unique constraint so the intermediate state
  -- (partner temporarily holding both shifts) does not raise a violation.
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
