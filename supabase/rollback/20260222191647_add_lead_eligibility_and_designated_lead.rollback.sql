drop function if exists public.set_designated_shift_lead(uuid, date, text, uuid);

drop index if exists public.shifts_unique_designated_lead_per_slot_idx;

alter table public.shifts
drop column if exists role;

alter table public.profiles
drop column if exists is_lead_eligible;

do $$
begin
  if exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'shift_role'
      and n.nspname = 'public'
  ) then
    drop type public.shift_role;
  end if;
end
$$;
