begin;
create table if not exists public.preliminary_mark_groups (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.preliminary_snapshots (id) on delete cascade,
  requester_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'denied', 'dismissed', 'cancelled')),
  note text,
  decision_note text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint preliminary_mark_groups_review_metadata_check
    check (
      (
        status = 'pending'
        and reviewed_by is null
        and reviewed_at is null
      )
      or (
        status <> 'pending'
        and reviewed_by is not null
        and reviewed_at is not null
      )
    )
);
create table if not exists public.preliminary_cell_marks (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.preliminary_snapshots (id) on delete cascade,
  group_id uuid references public.preliminary_mark_groups (id) on delete cascade,
  requester_id uuid not null references public.profiles (id) on delete cascade,
  mark_type text not null check (mark_type in ('mark_off', 'add_work')),
  shift_id uuid references public.shifts (id) on delete cascade,
  date date not null,
  shift_type text not null check (shift_type in ('day', 'night')),
  requested_role public.shift_role not null default 'staff',
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'denied', 'dismissed', 'cancelled')),
  note text,
  decision_note text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint preliminary_cell_marks_shift_requirement_check
    check (
      (mark_type = 'mark_off' and shift_id is not null)
      or (mark_type = 'add_work')
    ),
  constraint preliminary_cell_marks_review_metadata_check
    check (
      (
        status = 'pending'
        and reviewed_by is null
        and reviewed_at is null
      )
      or (
        status <> 'pending'
        and reviewed_by is not null
        and reviewed_at is not null
      )
    )
);
create index if not exists preliminary_mark_groups_snapshot_status_idx
  on public.preliminary_mark_groups (snapshot_id, status, created_at desc);
create index if not exists preliminary_mark_groups_requester_idx
  on public.preliminary_mark_groups (requester_id, created_at desc);
create index if not exists preliminary_cell_marks_snapshot_status_idx
  on public.preliminary_cell_marks (snapshot_id, status, created_at desc);
create index if not exists preliminary_cell_marks_requester_idx
  on public.preliminary_cell_marks (requester_id, created_at desc);
create index if not exists preliminary_cell_marks_group_idx
  on public.preliminary_cell_marks (group_id)
  where group_id is not null;
create unique index if not exists preliminary_cell_marks_one_pending_type_per_cell_idx
  on public.preliminary_cell_marks (snapshot_id, requester_id, date, shift_type, mark_type)
  where status = 'pending';
create unique index if not exists preliminary_cell_marks_one_pending_mark_off_per_shift_idx
  on public.preliminary_cell_marks (snapshot_id, requester_id, shift_id)
  where status = 'pending'
    and mark_type = 'mark_off';
alter table public.preliminary_mark_groups enable row level security;
alter table public.preliminary_cell_marks enable row level security;
drop policy if exists "Managers can read preliminary mark groups" on public.preliminary_mark_groups;
create policy "Managers can read preliminary mark groups"
  on public.preliminary_mark_groups
  for select
  using (
    exists (
      select 1
      from public.profiles actor
      join public.preliminary_snapshots snapshot on snapshot.id = preliminary_mark_groups.snapshot_id
      join public.schedule_cycles cycle on cycle.id = snapshot.cycle_id
      where actor.id = (select auth.uid())
        and actor.role = 'manager'
        and actor.is_active = true
        and actor.archived_at is null
        and actor.site_id = cycle.site_id
    )
  );
drop policy if exists "Users can read own preliminary mark groups" on public.preliminary_mark_groups;
create policy "Users can read own preliminary mark groups"
  on public.preliminary_mark_groups
  for select
  using (
    requester_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles requester
      where requester.id = (select auth.uid())
        and requester.is_active = true
        and requester.archived_at is null
    )
  );
drop policy if exists "Managers can read preliminary cell marks" on public.preliminary_cell_marks;
create policy "Managers can read preliminary cell marks"
  on public.preliminary_cell_marks
  for select
  using (
    exists (
      select 1
      from public.profiles actor
      join public.preliminary_snapshots snapshot on snapshot.id = preliminary_cell_marks.snapshot_id
      join public.schedule_cycles cycle on cycle.id = snapshot.cycle_id
      where actor.id = (select auth.uid())
        and actor.role = 'manager'
        and actor.is_active = true
        and actor.archived_at is null
        and actor.site_id = cycle.site_id
    )
  );
drop policy if exists "Users can read own preliminary cell marks" on public.preliminary_cell_marks;
create policy "Users can read own preliminary cell marks"
  on public.preliminary_cell_marks
  for select
  using (
    requester_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles requester
      where requester.id = (select auth.uid())
        and requester.is_active = true
        and requester.archived_at is null
    )
  );
create or replace function public.app_create_preliminary_mark_group(
  p_actor_id uuid,
  p_snapshot_id uuid,
  p_note text default null
)
returns table (id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_site_id text;
  v_snapshot_id uuid;
  v_group_id uuid;
begin
  select actor.site_id
    into v_actor_site_id
  from public.profiles actor
  where actor.id = p_actor_id
    and actor.role in ('therapist', 'lead')
    and actor.is_active = true
    and actor.archived_at is null;

  if v_actor_site_id is null then
    raise exception 'Only active staff can create preliminary marks.' using errcode = '42501';
  end if;

  select snapshot.id
    into v_snapshot_id
  from public.preliminary_snapshots snapshot
  join public.schedule_cycles cycle on cycle.id = snapshot.cycle_id
  where snapshot.id = p_snapshot_id
    and snapshot.status = 'active'
    and cycle.published = false
    and cycle.site_id = v_actor_site_id;

  if v_snapshot_id is null then
    raise exception 'Active preliminary schedule not found.' using errcode = 'P0002';
  end if;

  insert into public.preliminary_mark_groups (
    snapshot_id,
    requester_id,
    note
  )
  values (
    p_snapshot_id,
    p_actor_id,
    nullif(trim(coalesce(p_note, '')), '')
  )
  returning preliminary_mark_groups.id into v_group_id;

  return query select v_group_id;
end;
$$;
create or replace function public.app_create_preliminary_cell_mark(
  p_actor_id uuid,
  p_snapshot_id uuid,
  p_mark_type text,
  p_mark_date date,
  p_shift_type text,
  p_shift_id uuid default null,
  p_group_id uuid default null,
  p_note text default null
)
returns table (id uuid, group_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_shift_type text;
  v_actor_site_id text;
  v_cycle_id uuid;
  v_cycle_site_id text;
  v_mark_id uuid;
  v_group_status text;
  v_shift public.shifts%rowtype;
begin
  if p_mark_type not in ('mark_off', 'add_work') then
    raise exception 'Unsupported preliminary mark type.' using errcode = '22023';
  end if;

  if p_shift_type not in ('day', 'night') then
    raise exception 'Unsupported shift type.' using errcode = '22023';
  end if;

  select actor.shift_type, actor.site_id
    into v_actor_shift_type, v_actor_site_id
  from public.profiles actor
  where actor.id = p_actor_id
    and actor.role in ('therapist', 'lead')
    and actor.is_active = true
    and actor.archived_at is null;

  if v_actor_site_id is null then
    raise exception 'Only active staff can create preliminary marks.' using errcode = '42501';
  end if;

  if v_actor_shift_type is distinct from p_shift_type then
    raise exception 'Staff can only mark their own regular shift.' using errcode = '42501';
  end if;

  select cycle.id, cycle.site_id
    into v_cycle_id, v_cycle_site_id
  from public.preliminary_snapshots snapshot
  join public.schedule_cycles cycle on cycle.id = snapshot.cycle_id
  where snapshot.id = p_snapshot_id
    and snapshot.status = 'active'
    and cycle.published = false
    and p_mark_date between cycle.start_date and cycle.end_date;

  if v_cycle_id is null then
    raise exception 'Active preliminary schedule not found for this date.' using errcode = 'P0002';
  end if;

  if v_cycle_site_id is distinct from v_actor_site_id then
    raise exception 'Preliminary schedule is outside your site scope.' using errcode = '42501';
  end if;

  if p_group_id is not null then
    select group_row.status
      into v_group_status
    from public.preliminary_mark_groups group_row
    where group_row.id = p_group_id
      and group_row.snapshot_id = p_snapshot_id
      and group_row.requester_id = p_actor_id
    for update;

    if v_group_status is distinct from 'pending' then
      raise exception 'Linked preliminary change is not editable.' using errcode = '55000';
    end if;
  end if;

  if p_mark_type = 'mark_off' then
    if p_shift_id is null then
      raise exception 'Mark-off requires a scheduled shift.' using errcode = '22023';
    end if;

    select *
      into v_shift
    from public.shifts shift
    where shift.id = p_shift_id
      and shift.cycle_id = v_cycle_id
      and shift.user_id = p_actor_id
      and shift.date = p_mark_date
      and shift.shift_type = p_shift_type
    for update;

    if not found then
      raise exception 'Only the assigned staff member can mark out this scheduled day.' using errcode = '42501';
    end if;
  end if;

  if p_mark_type = 'add_work' then
    if exists (
      select 1
      from public.shifts shift
      where shift.cycle_id = v_cycle_id
        and shift.user_id = p_actor_id
        and shift.date = p_mark_date
        and shift.shift_type = p_shift_type
    ) then
      raise exception 'Staff member is already scheduled on this cell.' using errcode = '23505';
    end if;
  end if;

  insert into public.preliminary_cell_marks (
    snapshot_id,
    group_id,
    requester_id,
    mark_type,
    shift_id,
    date,
    shift_type,
    note
  )
  values (
    p_snapshot_id,
    p_group_id,
    p_actor_id,
    p_mark_type,
    p_shift_id,
    p_mark_date,
    p_shift_type,
    nullif(trim(coalesce(p_note, '')), '')
  )
  returning preliminary_cell_marks.id into v_mark_id;

  return query select v_mark_id, p_group_id;
end;
$$;
create or replace function public.app_cancel_preliminary_cell_mark(
  p_actor_id uuid,
  p_mark_id uuid
)
returns table (id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mark public.preliminary_cell_marks%rowtype;
  v_now timestamptz := now();
begin
  select *
    into v_mark
  from public.preliminary_cell_marks mark
  where mark.id = p_mark_id
  for update;

  if not found then
    raise exception 'Preliminary mark not found.' using errcode = 'P0002';
  end if;

  if v_mark.requester_id is distinct from p_actor_id then
    raise exception 'Only the staff member who created the mark can cancel it.' using errcode = '42501';
  end if;

  if v_mark.status <> 'pending' then
    raise exception 'Only pending preliminary marks can be cancelled.' using errcode = '55000';
  end if;

  if v_mark.group_id is not null then
    update public.preliminary_cell_marks
    set status = 'cancelled',
        reviewed_by = p_actor_id,
        reviewed_at = v_now,
        updated_at = v_now
    where group_id = v_mark.group_id
      and status = 'pending';

    update public.preliminary_mark_groups
    set status = 'cancelled',
        reviewed_by = p_actor_id,
        reviewed_at = v_now,
        updated_at = v_now
    where id = v_mark.group_id
      and status = 'pending';
  else
    update public.preliminary_cell_marks
    set status = 'cancelled',
        reviewed_by = p_actor_id,
        reviewed_at = v_now,
        updated_at = v_now
    where id = p_mark_id;
  end if;

  return query select p_mark_id;
end;
$$;
create or replace function public.app_review_preliminary_cell_mark(
  p_actor_id uuid,
  p_mark_id uuid,
  p_decision text,
  p_decision_note text default null
)
returns table (id uuid, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_site_id text;
  v_mark public.preliminary_cell_marks%rowtype;
  v_cycle public.schedule_cycles%rowtype;
  v_now timestamptz := now();
  v_effective_note text := nullif(trim(coalesce(p_decision_note, '')), '');
  v_rows_reviewed integer := 0;
  v_shift_rows integer := 0;
  v_open_shift_id uuid;
  mark_row public.preliminary_cell_marks%rowtype;
begin
  if p_decision not in ('approved', 'denied', 'dismissed') then
    raise exception 'Unsupported preliminary review decision.' using errcode = '22023';
  end if;

  select actor.site_id
    into v_actor_site_id
  from public.profiles actor
  where actor.id = p_actor_id
    and actor.role = 'manager'
    and actor.is_active = true
    and actor.archived_at is null;

  if v_actor_site_id is null then
    raise exception 'Only active managers can review preliminary marks.' using errcode = '42501';
  end if;

  select *
    into v_mark
  from public.preliminary_cell_marks mark
  where mark.id = p_mark_id
  for update;

  if not found then
    raise exception 'Preliminary mark not found.' using errcode = 'P0002';
  end if;

  if v_mark.status <> 'pending' then
    raise exception 'Only pending preliminary marks can be reviewed.' using errcode = '55000';
  end if;

  select cycle.*
    into v_cycle
  from public.preliminary_snapshots snapshot
  join public.schedule_cycles cycle on cycle.id = snapshot.cycle_id
  where snapshot.id = v_mark.snapshot_id
  for update;

  if not found then
    raise exception 'Schedule block not found for preliminary mark.' using errcode = 'P0002';
  end if;

  if v_cycle.site_id is distinct from v_actor_site_id then
    raise exception 'Preliminary mark is outside your site scope.' using errcode = '42501';
  end if;

  if v_cycle.published then
    raise exception 'Published schedules cannot review preliminary marks.' using errcode = '55000';
  end if;

  if p_decision = 'approved' then
    for mark_row in
      select *
      from public.preliminary_cell_marks pending_mark
      where pending_mark.status = 'pending'
        and (
          (v_mark.group_id is not null and pending_mark.group_id = v_mark.group_id)
          or (v_mark.group_id is null and pending_mark.id = v_mark.id)
        )
      order by case when pending_mark.mark_type = 'mark_off' then 0 else 1 end, pending_mark.created_at
      for update
    loop
      if mark_row.mark_type = 'mark_off' then
        update public.shifts shift
        set user_id = null,
            role = 'staff'
        where shift.id = mark_row.shift_id
          and shift.cycle_id = v_cycle.id
          and shift.user_id = mark_row.requester_id;

        get diagnostics v_shift_rows = row_count;
        if v_shift_rows <> 1 then
          raise exception 'Scheduled shift is no longer assigned to this staff member.' using errcode = '55000';
        end if;

        update public.preliminary_shift_states shift_state
        set state = 'open',
            reserved_by = null,
            active_request_id = null,
            updated_at = v_now
        where shift_state.snapshot_id = mark_row.snapshot_id
          and shift_state.shift_id = mark_row.shift_id;
      else
        if exists (
          select 1
          from public.shifts shift
          where shift.cycle_id = v_cycle.id
            and shift.user_id = mark_row.requester_id
            and shift.date = mark_row.date
            and shift.shift_type = mark_row.shift_type
        ) then
          raise exception 'Staff member is already scheduled on this cell.' using errcode = '23505';
        end if;

        select shift.id
          into v_open_shift_id
        from public.shifts shift
        where shift.cycle_id = v_cycle.id
          and shift.date = mark_row.date
          and shift.shift_type = mark_row.shift_type
          and shift.user_id is null
          and shift.status = 'scheduled'
          and shift.role = 'staff'
        order by shift.created_at, shift.id
        limit 1
        for update;

        if v_open_shift_id is not null then
          update public.shifts
          set user_id = mark_row.requester_id,
              role = mark_row.requested_role,
              unfilled_reason = null,
              status = 'scheduled',
              assignment_status = 'scheduled',
              status_note = null,
              left_early_time = null
          where shifts.id = v_open_shift_id;
        else
          insert into public.shifts (
            cycle_id,
            user_id,
            date,
            shift_type,
            status,
            assignment_status,
            role,
            site_id
          )
          values (
            v_cycle.id,
            mark_row.requester_id,
            mark_row.date,
            mark_row.shift_type,
            'scheduled',
            'scheduled',
            mark_row.requested_role,
            v_cycle.site_id
          )
          returning id into v_open_shift_id;
        end if;

        insert into public.preliminary_shift_states (
          snapshot_id,
          shift_id,
          state,
          reserved_by,
          active_request_id,
          updated_at
        )
        values (
          mark_row.snapshot_id,
          v_open_shift_id,
          'tentative_assignment',
          mark_row.requester_id,
          null,
          v_now
        )
        on conflict (snapshot_id, shift_id)
        do update set state = excluded.state,
                      reserved_by = excluded.reserved_by,
                      active_request_id = excluded.active_request_id,
                      updated_at = excluded.updated_at;
      end if;

      v_rows_reviewed := v_rows_reviewed + 1;
    end loop;
  end if;

  update public.preliminary_cell_marks pending_mark
  set status = p_decision,
      decision_note = v_effective_note,
      reviewed_by = p_actor_id,
      reviewed_at = v_now,
      updated_at = v_now
  where pending_mark.status = 'pending'
    and (
      (v_mark.group_id is not null and pending_mark.group_id = v_mark.group_id)
      or (v_mark.group_id is null and pending_mark.id = v_mark.id)
    );

  get diagnostics v_rows_reviewed = row_count;

  if v_mark.group_id is not null then
    update public.preliminary_mark_groups
    set status = p_decision,
        decision_note = v_effective_note,
        reviewed_by = p_actor_id,
        reviewed_at = v_now,
        updated_at = v_now
    where id = v_mark.group_id
      and status = 'pending';
  end if;

  return query select p_mark_id, p_decision;
end;
$$;
create or replace function public.app_publish_schedule_cycle(
  p_actor_id uuid,
  p_cycle_id uuid
)
returns table (id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_site_id text;
  v_cycle_site_id text;
  v_cycle_published boolean;
  v_updated_id uuid;
begin
  select actor.site_id
    into v_actor_site_id
  from public.profiles actor
  where actor.id = p_actor_id
    and actor.role = 'manager'
    and actor.is_active = true
    and actor.archived_at is null;

  if v_actor_site_id is null then
    raise exception 'Only active managers can publish schedule cycles.' using errcode = '42501';
  end if;

  select cycle.site_id, coalesce(cycle.published, false)
    into v_cycle_site_id, v_cycle_published
  from public.schedule_cycles cycle
  where cycle.id = p_cycle_id
  for update;

  if not found then
    raise exception 'Schedule cycle not found.' using errcode = 'P0002';
  end if;

  if v_cycle_site_id is distinct from v_actor_site_id then
    raise exception 'Schedule cycle is outside your site scope.' using errcode = '42501';
  end if;

  if v_cycle_published then
    raise exception 'Schedule cycle is already published.' using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.preliminary_snapshots snapshot
    join public.preliminary_cell_marks mark on mark.snapshot_id = snapshot.id
    where snapshot.cycle_id = p_cycle_id
      and snapshot.status = 'active'
      and mark.status = 'pending'
  ) then
    raise exception 'Resolve preliminary marks before publishing.' using errcode = '55000';
  end if;

  update public.schedule_cycles
  set published = true
  where schedule_cycles.id = p_cycle_id
    and schedule_cycles.published = false
  returning schedule_cycles.id into v_updated_id;

  if v_updated_id is null then
    return;
  end if;

  update public.preliminary_snapshots
  set status = 'superseded'
  where cycle_id = p_cycle_id
    and status = 'active';

  return query select v_updated_id;
end;
$$;
update public.shifts
set role = 'staff'
where role = 'lead'
  and user_id is null;
alter table public.shifts
  drop constraint if exists shifts_designated_lead_assigned_check,
  add constraint shifts_designated_lead_assigned_check
    check (role <> 'lead' or user_id is not null) not valid;
alter table public.shifts validate constraint shifts_designated_lead_assigned_check;
alter function public.app_create_preliminary_mark_group(uuid, uuid, text) owner to postgres;
alter function public.app_create_preliminary_cell_mark(uuid, uuid, text, date, text, uuid, uuid, text) owner to postgres;
alter function public.app_cancel_preliminary_cell_mark(uuid, uuid) owner to postgres;
alter function public.app_review_preliminary_cell_mark(uuid, uuid, text, text) owner to postgres;
alter function public.app_publish_schedule_cycle(uuid, uuid) owner to postgres;
revoke all on function public.app_create_preliminary_mark_group(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.app_create_preliminary_cell_mark(uuid, uuid, text, date, text, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.app_cancel_preliminary_cell_mark(uuid, uuid) from public, anon, authenticated;
revoke all on function public.app_review_preliminary_cell_mark(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.app_publish_schedule_cycle(uuid, uuid) from public, anon, authenticated;
grant execute on function public.app_create_preliminary_mark_group(uuid, uuid, text) to service_role;
grant execute on function public.app_create_preliminary_cell_mark(uuid, uuid, text, date, text, uuid, uuid, text) to service_role;
grant execute on function public.app_cancel_preliminary_cell_mark(uuid, uuid) to service_role;
grant execute on function public.app_review_preliminary_cell_mark(uuid, uuid, text, text) to service_role;
grant execute on function public.app_publish_schedule_cycle(uuid, uuid) to service_role;
commit;
