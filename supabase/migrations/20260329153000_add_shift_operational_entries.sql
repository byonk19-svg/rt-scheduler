-- Operational entries model (PRD v5.1):
-- - Keep planning rows in public.shifts immutable for operational state.
-- - Store active operational code in a separate table (one active code per shift cell).
-- - Preserve full append-only audit history for add / replace / remove transitions.

create table if not exists public.shift_operational_entries (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts(id) on delete cascade,
  code public.assignment_status not null check (code <> 'scheduled'),
  note text,
  left_early_time time,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete cascade,
  replaced_at timestamptz,
  replaced_by uuid references auth.users(id) on delete set null
);

create unique index if not exists shift_operational_entries_one_active_per_shift_idx
  on public.shift_operational_entries (shift_id)
  where active = true;

create index if not exists shift_operational_entries_shift_created_idx
  on public.shift_operational_entries (shift_id, created_at desc);

create table if not exists public.shift_operational_entry_audit (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts(id) on delete cascade,
  entry_id uuid references public.shift_operational_entries(id) on delete set null,
  action_type text not null check (action_type in ('add', 'replace', 'remove')),
  code public.assignment_status not null,
  note text,
  left_early_time time,
  acted_by uuid not null references auth.users(id) on delete cascade,
  acted_at timestamptz not null default now()
);

create index if not exists shift_operational_entry_audit_shift_idx
  on public.shift_operational_entry_audit (shift_id, acted_at desc);

alter table public.shift_operational_entries enable row level security;
alter table public.shift_operational_entry_audit enable row level security;

drop policy if exists "Active users can read operational entries" on public.shift_operational_entries;
create policy "Active users can read operational entries"
  on public.shift_operational_entries
  for select
  using (
    exists (
      select 1
      from public.profiles viewer_profile
      where viewer_profile.id = auth.uid()
        and viewer_profile.is_active = true
        and viewer_profile.archived_at is null
    )
  );

drop policy if exists "Managers and leads can read operational entry audit" on public.shift_operational_entry_audit;
create policy "Managers and leads can read operational entry audit"
  on public.shift_operational_entry_audit
  for select
  using (
    exists (
      select 1
      from public.profiles actor_profile
      where actor_profile.id = auth.uid()
        and (
          actor_profile.role in ('manager', 'lead')
          or (
            actor_profile.role in ('therapist', 'staff')
            and coalesce(actor_profile.is_lead_eligible, false) = true
          )
        )
    )
  );

-- One-time backfill: move currently-active non-scheduled assignment statuses
-- into active operational entries.
insert into public.shift_operational_entries (
  shift_id,
  code,
  note,
  left_early_time,
  active,
  created_at,
  created_by
)
select
  s.id as shift_id,
  s.assignment_status as code,
  s.status_note as note,
  s.left_early_time,
  true as active,
  coalesce(s.status_updated_at, now()) as created_at,
  coalesce(s.status_updated_by, s.user_id) as created_by
from public.shifts s
where s.user_id is not null
  and s.assignment_status <> 'scheduled'
  and not exists (
    select 1
    from public.shift_operational_entries existing
    where existing.shift_id = s.id
      and existing.active = true
  );

create or replace function public.update_assignment_status(
  p_assignment_id uuid,
  p_status public.assignment_status,
  p_note text default null,
  p_left_early_time time default null
)
returns table (
  id uuid,
  assignment_status public.assignment_status,
  status_note text,
  left_early_time time,
  status_updated_at timestamptz,
  status_updated_by uuid,
  status_updated_by_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role text;
  v_actor_is_lead_eligible boolean := false;
  v_actor_site_id text;
  v_assignment_site_id text;
  v_therapist_name text;
  v_active_entry_id uuid;
  v_previous_status public.assignment_status := 'scheduled';
  v_previous_note text;
  v_previous_left_early_time time;
  v_next_status public.assignment_status := 'scheduled';
  v_next_note text;
  v_next_left_early_time time;
begin
  if v_actor_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select p.role, coalesce(p.is_lead_eligible, false), p.site_id
    into v_actor_role, v_actor_is_lead_eligible, v_actor_site_id
  from public.profiles p
  where p.id = v_actor_id;

  if v_actor_role is null then
    raise exception 'Profile not found.' using errcode = '42501';
  end if;

  if not (
    v_actor_role = 'manager'
    or v_actor_role = 'lead'
    or (
      v_actor_role in ('therapist', 'staff')
      and v_actor_is_lead_eligible = true
    )
  ) then
    raise exception 'Only leads or managers can update assignment status.' using errcode = '42501';
  end if;

  select
    s.site_id,
    coalesce(therapist.full_name, 'Unknown')
    into v_assignment_site_id, v_therapist_name
  from public.shifts s
  left join public.profiles therapist on therapist.id = s.user_id
  where s.id = p_assignment_id
  for update;

  if not found then
    raise exception 'Assignment not found.' using errcode = 'P0002';
  end if;

  if v_assignment_site_id is distinct from v_actor_site_id then
    raise exception 'Assignment is outside your site scope.' using errcode = '42501';
  end if;

  select
    e.id,
    e.code,
    e.note,
    e.left_early_time
    into v_active_entry_id, v_previous_status, v_previous_note, v_previous_left_early_time
  from public.shift_operational_entries e
  where e.shift_id = p_assignment_id
    and e.active = true
  order by e.created_at desc, e.id desc
  limit 1
  for update;

  if p_status = 'scheduled' then
    v_next_status := 'scheduled';
    v_next_note := null;
    v_next_left_early_time := null;

    if v_active_entry_id is not null then
      update public.shift_operational_entries
      set
        active = false,
        replaced_at = now(),
        replaced_by = v_actor_id
      where id = v_active_entry_id;

      insert into public.shift_operational_entry_audit (
        shift_id,
        entry_id,
        action_type,
        code,
        note,
        left_early_time,
        acted_by
      )
      values (
        p_assignment_id,
        v_active_entry_id,
        'remove',
        v_previous_status,
        v_previous_note,
        v_previous_left_early_time,
        v_actor_id
      );
    end if;
  else
    v_next_status := p_status;
    v_next_note := nullif(trim(coalesce(p_note, '')), '');
    v_next_left_early_time := case when p_status = 'left_early' then p_left_early_time else null end;

    if v_active_entry_id is not null then
      update public.shift_operational_entries
      set
        active = false,
        replaced_at = now(),
        replaced_by = v_actor_id
      where id = v_active_entry_id;
    end if;

    insert into public.shift_operational_entries (
      shift_id,
      code,
      note,
      left_early_time,
      active,
      created_by
    )
    values (
      p_assignment_id,
      p_status,
      v_next_note,
      v_next_left_early_time,
      true,
      v_actor_id
    )
    returning id into v_active_entry_id;

    insert into public.shift_operational_entry_audit (
      shift_id,
      entry_id,
      action_type,
      code,
      note,
      left_early_time,
      acted_by
    )
    values (
      p_assignment_id,
      v_active_entry_id,
      case when v_previous_status = 'scheduled' then 'add' else 'replace' end,
      p_status,
      v_next_note,
      v_next_left_early_time,
      v_actor_id
    );
  end if;

  if v_previous_status is distinct from v_next_status then
    insert into public.shift_status_changes (
      shift_id,
      therapist_name,
      from_status,
      to_status,
      changed_by
    )
    values (
      p_assignment_id,
      v_therapist_name,
      v_previous_status::text,
      v_next_status::text,
      v_actor_id
    );
  end if;

  return query
  select
    p_assignment_id as id,
    v_next_status as assignment_status,
    v_next_note as status_note,
    v_next_left_early_time as left_early_time,
    now() as status_updated_at,
    v_actor_id as status_updated_by,
    updater.full_name as status_updated_by_name
  from public.profiles updater
  where updater.id = v_actor_id;
end;
$$;

alter function public.update_assignment_status(uuid, public.assignment_status, text, time) owner to postgres;
revoke all on function public.update_assignment_status(uuid, public.assignment_status, text, time) from public;
grant execute on function public.update_assignment_status(uuid, public.assignment_status, text, time) to authenticated;
grant execute on function public.update_assignment_status(uuid, public.assignment_status, text, time) to service_role;
