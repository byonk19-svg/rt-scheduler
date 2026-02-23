-- Assignment status support for shift assignments (stored in public.shifts)

alter table public.profiles
add column if not exists site_id text not null default 'default';

alter table public.shifts
add column if not exists site_id text not null default 'default';

update public.shifts s
set site_id = p.site_id
from public.profiles p
where s.user_id = p.id
  and (s.site_id is null or s.site_id = 'default')
  and p.site_id is not null;

create index if not exists shifts_site_id_idx on public.shifts (site_id);

create or replace function public.restrict_profile_staffing_field_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_is_manager boolean := false;
  actor_role text := coalesce(auth.role(), '');
begin
  if actor_role in ('service_role', 'postgres') then
    if new.on_fmla = false then
      new.fmla_return_date := null;
    end if;
    return new;
  end if;

  select public.is_manager() into actor_is_manager;

  if not actor_is_manager
     and (
       new.is_lead_eligible is distinct from old.is_lead_eligible
       or new.on_fmla is distinct from old.on_fmla
       or new.fmla_return_date is distinct from old.fmla_return_date
       or new.is_active is distinct from old.is_active
       or new.site_id is distinct from old.site_id
     ) then
    raise exception 'Only managers can update staffing eligibility fields.'
      using errcode = '42501';
  end if;

  if new.on_fmla = false then
    new.fmla_return_date := null;
  end if;

  return new;
end;
$$;

alter function public.restrict_profile_staffing_field_updates() owner to postgres;
grant execute on function public.restrict_profile_staffing_field_updates() to authenticated;
grant execute on function public.restrict_profile_staffing_field_updates() to service_role;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    where t.typname = 'assignment_status'
      and t.typnamespace = 'public'::regnamespace
  ) then
    create type public.assignment_status as enum (
      'scheduled',
      'call_in',
      'cancelled',
      'on_call',
      'left_early'
    );
  end if;
end
$$;

alter table public.shifts
add column if not exists assignment_status public.assignment_status not null default 'scheduled';

alter table public.shifts
add column if not exists status_note text;

alter table public.shifts
add column if not exists left_early_time time;

alter table public.shifts
add column if not exists status_updated_at timestamptz;

alter table public.shifts
add column if not exists status_updated_by uuid references public.profiles(id) on delete set null;

create index if not exists shifts_assignment_status_idx
  on public.shifts (assignment_status, date desc);

update public.shifts
set assignment_status = 'on_call'
where assignment_status = 'scheduled'
  and status = 'on_call';

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

  select s.site_id
    into v_assignment_site_id
  from public.shifts s
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

drop policy if exists "Managers can update shifts" on public.shifts;
create policy "Managers can update shifts"
on public.shifts
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles manager_profile
    where manager_profile.id = auth.uid()
      and manager_profile.role = 'manager'
  )
)
with check (
  exists (
    select 1
    from public.profiles manager_profile
    where manager_profile.id = auth.uid()
      and manager_profile.role = 'manager'
  )
);

-- Rollback reference (manual):
-- 1) drop function public.update_assignment_status(uuid, public.assignment_status, text, time);
-- 2) drop index if exists public.shifts_assignment_status_idx;
-- 3) alter table public.shifts drop column if exists status_updated_by;
-- 4) alter table public.shifts drop column if exists status_updated_at;
-- 5) alter table public.shifts drop column if exists left_early_time;
-- 6) alter table public.shifts drop column if exists status_note;
-- 7) alter table public.shifts drop column if exists assignment_status;
-- 8) drop type if exists public.assignment_status;
-- 9) alter table public.shifts drop column if exists site_id;
-- 10) alter table public.profiles drop column if exists site_id;
