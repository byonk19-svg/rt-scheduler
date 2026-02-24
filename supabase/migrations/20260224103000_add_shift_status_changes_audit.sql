create table if not exists public.shift_status_changes (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts(id) on delete cascade,
  therapist_name text not null,
  from_status text not null,
  to_status text not null,
  changed_at timestamptz not null default now(),
  changed_by uuid not null references auth.users(id) on delete cascade
);

create index if not exists shift_status_changes_shift_id_idx
  on public.shift_status_changes (shift_id, changed_at desc);

create index if not exists shift_status_changes_changed_by_idx
  on public.shift_status_changes (changed_by, changed_at desc);

alter table public.shift_status_changes enable row level security;

drop policy if exists "Managers and leads can read shift status changes" on public.shift_status_changes;
create policy "Managers and leads can read shift status changes"
  on public.shift_status_changes
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

drop policy if exists "Managers and leads can insert shift status changes" on public.shift_status_changes;
create policy "Managers and leads can insert shift status changes"
  on public.shift_status_changes
  for insert
  with check (
    auth.uid() = changed_by
    and exists (
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
  v_previous_status public.assignment_status;
  v_therapist_name text;
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
    s.assignment_status,
    coalesce(therapist.full_name, 'Unknown')
    into v_assignment_site_id, v_previous_status, v_therapist_name
  from public.shifts s
  left join public.profiles therapist on therapist.id = s.user_id
  where s.id = p_assignment_id;

  if not found then
    raise exception 'Assignment not found.' using errcode = 'P0002';
  end if;

  if v_assignment_site_id is distinct from v_actor_site_id then
    raise exception 'Assignment is outside your site scope.' using errcode = '42501';
  end if;

  update public.shifts s
  set assignment_status = p_status,
      status_note = nullif(trim(coalesce(p_note, '')), ''),
      left_early_time = case when p_status = 'left_early' then p_left_early_time else null end,
      status_updated_at = now(),
      status_updated_by = v_actor_id
  where s.id = p_assignment_id;

  if v_previous_status is distinct from p_status then
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
      p_status::text,
      v_actor_id
    );
  end if;

  return query
  select
    s.id,
    s.assignment_status,
    s.status_note,
    s.left_early_time,
    s.status_updated_at,
    s.status_updated_by,
    updater.full_name as status_updated_by_name
  from public.shifts s
  left join public.profiles updater on updater.id = s.status_updated_by
  where s.id = p_assignment_id;
end;
$$;

alter function public.update_assignment_status(uuid, public.assignment_status, text, time) owner to postgres;
revoke all on function public.update_assignment_status(uuid, public.assignment_status, text, time) from public;
grant execute on function public.update_assignment_status(uuid, public.assignment_status, text, time) to authenticated;
grant execute on function public.update_assignment_status(uuid, public.assignment_status, text, time) to service_role;
