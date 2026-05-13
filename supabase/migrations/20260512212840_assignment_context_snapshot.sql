begin;

alter table public.shifts
  add column if not exists employment_type_at_assignment text,
  add column if not exists shift_type_at_assignment text,
  add column if not exists lead_eligible_at_assignment boolean;

comment on column public.shifts.employment_type_at_assignment is
  'Snapshot of the therapist employment type when this assignment row was created or assigned.';

comment on column public.shifts.shift_type_at_assignment is
  'Snapshot of the therapist regular shift preference when this assignment row was created or assigned.';

comment on column public.shifts.lead_eligible_at_assignment is
  'Snapshot of lead eligibility when this assignment row was created or assigned.';

create or replace function public.set_shift_assignment_context_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if new.user_id is null then
    new.employment_type_at_assignment := null;
    new.shift_type_at_assignment := null;
    new.lead_eligible_at_assignment := null;
    return new;
  end if;

  if tg_op = 'INSERT'
     or new.user_id is distinct from old.user_id
     or new.employment_type_at_assignment is null
     or new.shift_type_at_assignment is null
     or new.lead_eligible_at_assignment is null then
    select *
      into v_profile
    from public.profiles
    where id = new.user_id;

    new.employment_type_at_assignment := v_profile.employment_type;
    new.shift_type_at_assignment := v_profile.shift_type;
    new.lead_eligible_at_assignment := coalesce(v_profile.is_lead_eligible, false);
  end if;

  return new;
end;
$$;

update public.shifts shift_row
set
  employment_type_at_assignment = profile.employment_type,
  shift_type_at_assignment = profile.shift_type,
  lead_eligible_at_assignment = coalesce(profile.is_lead_eligible, false)
from public.profiles profile
where shift_row.user_id = profile.id
  and (
    shift_row.employment_type_at_assignment is null
    or shift_row.shift_type_at_assignment is null
    or shift_row.lead_eligible_at_assignment is null
  );

drop trigger if exists shifts_assignment_context_snapshot on public.shifts;
create trigger shifts_assignment_context_snapshot
before insert or update of user_id, employment_type_at_assignment, shift_type_at_assignment, lead_eligible_at_assignment
on public.shifts
for each row
execute function public.set_shift_assignment_context_snapshot();

alter function public.set_shift_assignment_context_snapshot() owner to postgres;
revoke all on function public.set_shift_assignment_context_snapshot() from public, anon, authenticated;
grant execute on function public.set_shift_assignment_context_snapshot() to service_role;

commit;
