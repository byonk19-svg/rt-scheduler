alter table public.profiles
add column if not exists is_lead_eligible boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'shift_role'
      and n.nspname = 'public'
  ) then
    create type public.shift_role as enum ('lead', 'staff');
  end if;
end
$$;

alter table public.shifts
add column if not exists role public.shift_role not null default 'staff';

create unique index if not exists shifts_unique_designated_lead_per_slot_idx
  on public.shifts (cycle_id, date, shift_type)
  where role = 'lead';

create or replace function public.set_designated_shift_lead(
  p_cycle_id uuid,
  p_shift_date date,
  p_shift_type text,
  p_therapist_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_is_eligible boolean;
begin
  if p_shift_type not in ('day', 'night') then
    raise exception 'Invalid shift type: %', p_shift_type using errcode = '22023';
  end if;

  select p.is_lead_eligible
  into v_is_eligible
  from public.profiles p
  where p.id = p_therapist_id
    and p.role = 'therapist';

  if coalesce(v_is_eligible, false) = false then
    raise exception 'Selected therapist is not lead-eligible.' using errcode = 'P0001';
  end if;

  update public.shifts
  set role = 'staff'
  where cycle_id = p_cycle_id
    and date = p_shift_date
    and shift_type = p_shift_type
    and role = 'lead';

  update public.shifts
  set role = 'lead'
  where cycle_id = p_cycle_id
    and date = p_shift_date
    and shift_type = p_shift_type
    and user_id = p_therapist_id;

  if not found then
    insert into public.shifts (cycle_id, user_id, date, shift_type, status, role)
    values (p_cycle_id, p_therapist_id, p_shift_date, p_shift_type, 'scheduled', 'lead');
  end if;
end;
$$;

grant execute on function public.set_designated_shift_lead(uuid, date, text, uuid) to authenticated;
