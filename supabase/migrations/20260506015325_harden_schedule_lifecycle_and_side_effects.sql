alter table public.schedule_cycles
  add column if not exists site_id text not null default 'default';

update public.schedule_cycles cycle
set site_id = shift_sites.site_id
from (
  select cycle_id, min(site_id) as site_id
  from public.shifts
  where cycle_id is not null
    and site_id is not null
  group by cycle_id
) shift_sites
where cycle.id = shift_sites.cycle_id
  and cycle.site_id = 'default';

create index if not exists schedule_cycles_site_start_idx
  on public.schedule_cycles (site_id, start_date desc);

create index if not exists shifts_site_cycle_idx
  on public.shifts (site_id, cycle_id);

drop policy if exists "Anyone logged in can view published cycles" on public.schedule_cycles;
create policy "Active users can view same-site published cycles"
on public.schedule_cycles
for select
to authenticated
using (
  published = true
  and exists (
    select 1
    from public.profiles actor
    where actor.id = auth.uid()
      and actor.is_active = true
      and actor.archived_at is null
      and actor.site_id = schedule_cycles.site_id
  )
);

drop policy if exists "Managers can view all cycles" on public.schedule_cycles;
create policy "Managers can view same-site cycles"
on public.schedule_cycles
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles actor
    where actor.id = auth.uid()
      and actor.role = 'manager'
      and actor.is_active = true
      and actor.archived_at is null
      and actor.site_id = schedule_cycles.site_id
  )
);

drop policy if exists "Leads can view all cycles" on public.schedule_cycles;
create policy "Leads can view same-site cycles"
on public.schedule_cycles
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles actor
    where actor.id = auth.uid()
      and actor.role = 'lead'
      and actor.is_active = true
      and actor.archived_at is null
      and actor.site_id = schedule_cycles.site_id
  )
);

drop policy if exists "Managers can insert cycles" on public.schedule_cycles;
create policy "Managers can insert same-site cycles"
on public.schedule_cycles
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles actor
    where actor.id = auth.uid()
      and actor.role = 'manager'
      and actor.is_active = true
      and actor.archived_at is null
      and actor.site_id = schedule_cycles.site_id
  )
);

drop policy if exists "Managers can update cycles" on public.schedule_cycles;
create policy "Managers can update same-site cycles"
on public.schedule_cycles
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles actor
    where actor.id = auth.uid()
      and actor.role = 'manager'
      and actor.is_active = true
      and actor.archived_at is null
      and actor.site_id = schedule_cycles.site_id
  )
)
with check (
  exists (
    select 1
    from public.profiles actor
    where actor.id = auth.uid()
      and actor.role = 'manager'
      and actor.is_active = true
      and actor.archived_at is null
      and actor.site_id = schedule_cycles.site_id
  )
);

drop policy if exists "Managers can delete unpublished cycles" on public.schedule_cycles;
create policy "Managers can delete same-site unpublished cycles"
on public.schedule_cycles
for delete
to authenticated
using (
  published = false
  and exists (
    select 1
    from public.profiles actor
    where actor.id = auth.uid()
      and actor.role = 'manager'
      and actor.is_active = true
      and actor.archived_at is null
      and actor.site_id = schedule_cycles.site_id
  )
);

drop policy if exists "Anyone logged in can view shifts in published cycles" on public.shifts;
create policy "Active users can view same-site published shifts"
on public.shifts
for select
to authenticated
using (
  exists (
    select 1
    from public.schedule_cycles cycle
    join public.profiles actor on actor.id = auth.uid()
    where cycle.id = shifts.cycle_id
      and cycle.published = true
      and actor.is_active = true
      and actor.archived_at is null
      and actor.site_id = shifts.site_id
      and actor.site_id = cycle.site_id
  )
);

drop policy if exists "Managers can view all shifts" on public.shifts;
create policy "Managers can view same-site shifts"
on public.shifts
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles actor
    where actor.id = auth.uid()
      and actor.role = 'manager'
      and actor.is_active = true
      and actor.archived_at is null
      and actor.site_id = shifts.site_id
  )
);

drop policy if exists "Leads can view all shifts" on public.shifts;
create policy "Leads can view same-site shifts"
on public.shifts
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles actor
    where actor.id = auth.uid()
      and actor.role = 'lead'
      and actor.is_active = true
      and actor.archived_at is null
      and actor.site_id = shifts.site_id
  )
);

drop policy if exists "Managers can insert shifts" on public.shifts;
create policy "Managers can insert same-site shifts"
on public.shifts
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles actor
    join public.schedule_cycles cycle on cycle.id = shifts.cycle_id
    where actor.id = auth.uid()
      and actor.role = 'manager'
      and actor.is_active = true
      and actor.archived_at is null
      and actor.site_id = shifts.site_id
      and actor.site_id = cycle.site_id
  )
  and (
    shifts.user_id is null
    or exists (
      select 1
      from public.profiles therapist
      where therapist.id = shifts.user_id
        and therapist.role in ('therapist', 'lead')
        and therapist.is_active = true
        and therapist.archived_at is null
        and therapist.site_id = shifts.site_id
    )
  )
);

drop policy if exists "Managers can update shifts" on public.shifts;
create policy "Managers can update same-site shifts"
on public.shifts
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles actor
    where actor.id = auth.uid()
      and actor.role = 'manager'
      and actor.is_active = true
      and actor.archived_at is null
      and actor.site_id = shifts.site_id
  )
)
with check (
  exists (
    select 1
    from public.profiles actor
    join public.schedule_cycles cycle on cycle.id = shifts.cycle_id
    where actor.id = auth.uid()
      and actor.role = 'manager'
      and actor.is_active = true
      and actor.archived_at is null
      and actor.site_id = shifts.site_id
      and actor.site_id = cycle.site_id
  )
  and (
    shifts.user_id is null
    or exists (
      select 1
      from public.profiles therapist
      where therapist.id = shifts.user_id
        and therapist.role in ('therapist', 'lead')
        and therapist.is_active = true
        and therapist.archived_at is null
        and therapist.site_id = shifts.site_id
    )
  )
);

drop policy if exists "Managers can delete shifts" on public.shifts;
create policy "Managers can delete same-site shifts"
on public.shifts
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles actor
    where actor.id = auth.uid()
      and actor.role = 'manager'
      and actor.is_active = true
      and actor.archived_at is null
      and actor.site_id = shifts.site_id
  )
);

drop policy if exists "Active users can read operational entries" on public.shift_operational_entries;
create policy "Active users can read same-site operational entries"
on public.shift_operational_entries
for select
to authenticated
using (
  exists (
    select 1
    from public.shifts shift
    join public.profiles actor on actor.id = auth.uid()
    where shift.id = shift_operational_entries.shift_id
      and actor.is_active = true
      and actor.archived_at is null
      and actor.site_id = shift.site_id
  )
);

drop policy if exists "Managers and leads can read operational entry audit" on public.shift_operational_entry_audit;
create policy "Managers and leads can read same-site operational entry audit"
on public.shift_operational_entry_audit
for select
to authenticated
using (
  exists (
    select 1
    from public.shifts shift
    join public.profiles actor on actor.id = auth.uid()
    where shift.id = shift_operational_entry_audit.shift_id
      and actor.site_id = shift.site_id
      and actor.is_active = true
      and actor.archived_at is null
      and (
        actor.role in ('manager', 'lead')
        or (
          actor.role in ('therapist', 'staff')
          and coalesce(actor.is_lead_eligible, false) = true
        )
      )
  )
);

create or replace function public.app_insert_unpublished_cycle_shifts(
  p_actor_id uuid,
  p_cycle_id uuid,
  p_shifts jsonb
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
begin
  select actor.site_id
    into v_actor_site_id
  from public.profiles actor
  where actor.id = p_actor_id
    and actor.role = 'manager'
    and actor.is_active = true
    and actor.archived_at is null;

  if v_actor_site_id is null then
    raise exception 'Only active managers can mutate draft shifts.' using errcode = '42501';
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
    raise exception 'Published cycles cannot receive draft mutations.' using errcode = '55000';
  end if;

  return query
  with payload as (
    select value as row
    from jsonb_array_elements(coalesce(p_shifts, '[]'::jsonb))
  ),
  normalized as (
    select
      nullif(row ->> 'user_id', '')::uuid as user_id,
      (row ->> 'date')::date as date,
      row ->> 'shift_type' as shift_type,
      coalesce(nullif(row ->> 'status', ''), 'scheduled') as status,
      coalesce(nullif(row ->> 'role', ''), 'staff')::public.shift_role as role,
      coalesce(nullif(row ->> 'assignment_status', ''), 'scheduled')::public.assignment_status as assignment_status,
      nullif(row ->> 'unfilled_reason', '') as unfilled_reason,
      nullif(row ->> 'status_note', '') as status_note
    from payload
  )
  insert into public.shifts (
    cycle_id,
    user_id,
    date,
    shift_type,
    status,
    role,
    assignment_status,
    unfilled_reason,
    status_note,
    site_id
  )
  select
    p_cycle_id,
    normalized.user_id,
    normalized.date,
    normalized.shift_type,
    normalized.status,
    normalized.role,
    normalized.assignment_status,
    normalized.unfilled_reason,
    normalized.status_note,
    v_actor_site_id
  from normalized
  where normalized.date is not null
    and normalized.shift_type in ('day', 'night')
    and (
      normalized.user_id is null
      or exists (
        select 1
        from public.profiles therapist
        where therapist.id = normalized.user_id
          and therapist.role in ('therapist', 'lead')
          and therapist.is_active = true
          and therapist.archived_at is null
          and therapist.site_id = v_actor_site_id
      )
    )
    and not exists (
      select 1
      from public.shifts existing
      where existing.cycle_id = p_cycle_id
        and existing.user_id = normalized.user_id
        and existing.date = normalized.date
    )
  returning shifts.id;
end;
$$;

alter function public.app_insert_unpublished_cycle_shifts(uuid, uuid, jsonb) owner to postgres;
revoke all on function public.app_insert_unpublished_cycle_shifts(uuid, uuid, jsonb) from public;
grant execute on function public.app_insert_unpublished_cycle_shifts(uuid, uuid, jsonb) to authenticated;
grant execute on function public.app_insert_unpublished_cycle_shifts(uuid, uuid, jsonb) to service_role;

create or replace function public.app_delete_unpublished_cycle_shifts(
  p_actor_id uuid,
  p_cycle_id uuid,
  p_unfilled_only boolean default false
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_site_id text;
  v_cycle_site_id text;
  v_cycle_published boolean;
  v_deleted_count integer := 0;
begin
  select actor.site_id
    into v_actor_site_id
  from public.profiles actor
  where actor.id = p_actor_id
    and actor.role = 'manager'
    and actor.is_active = true
    and actor.archived_at is null;

  if v_actor_site_id is null then
    raise exception 'Only active managers can mutate draft shifts.' using errcode = '42501';
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
    raise exception 'Published cycles cannot receive draft mutations.' using errcode = '55000';
  end if;

  with deleted as (
    delete from public.shifts shift
    where shift.cycle_id = p_cycle_id
      and shift.site_id = v_actor_site_id
      and (not p_unfilled_only or shift.unfilled_reason is not null)
    returning 1
  )
  select count(*) into v_deleted_count from deleted;

  return v_deleted_count;
end;
$$;

alter function public.app_delete_unpublished_cycle_shifts(uuid, uuid, boolean) owner to postgres;
revoke all on function public.app_delete_unpublished_cycle_shifts(uuid, uuid, boolean) from public;
grant execute on function public.app_delete_unpublished_cycle_shifts(uuid, uuid, boolean) to authenticated;
grant execute on function public.app_delete_unpublished_cycle_shifts(uuid, uuid, boolean) to service_role;

alter table public.notification_outbox
  drop constraint if exists notification_outbox_status_check;
alter table public.notification_outbox
  add constraint notification_outbox_status_check
  check (status in ('queued', 'processing', 'sent', 'failed'));

alter table public.shift_reminder_outbox
  drop constraint if exists shift_reminder_outbox_status_check;
alter table public.shift_reminder_outbox
  add constraint shift_reminder_outbox_status_check
  check (status in ('queued', 'processing', 'sent', 'failed'));

with ranked_outbox as (
  select
    id,
    row_number() over (
      partition by publish_event_id, email, channel
      order by created_at asc, id asc
    ) as rn
  from public.notification_outbox
)
delete from public.notification_outbox outbox
using ranked_outbox ranked
where outbox.id = ranked.id
  and ranked.rn > 1;

create unique index if not exists notification_outbox_unique_email_per_event_idx
  on public.notification_outbox (publish_event_id, email, channel);

with ranked_notifications as (
  select
    id,
    row_number() over (
      partition by user_id, event_type, target_type, target_id
      order by created_at asc, id asc
    ) as rn
  from public.notifications
  where target_type is not null
    and target_id is not null
    and event_type in ('cycle_published', 'shift_reminder')
)
delete from public.notifications notification
using ranked_notifications ranked
where notification.id = ranked.id
  and ranked.rn > 1;

create unique index if not exists notifications_unique_idempotent_event_idx
  on public.notifications (user_id, event_type, target_type, target_id)
  where target_type is not null
    and target_id is not null
    and event_type in ('cycle_published', 'shift_reminder');

create table if not exists public.resend_webhook_receipts (
  svix_id text primary key,
  event_type text not null,
  email_id text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.resend_webhook_receipts enable row level security;

drop policy if exists "Service role only" on public.resend_webhook_receipts;
create policy "Service role only"
on public.resend_webhook_receipts
using (false);
