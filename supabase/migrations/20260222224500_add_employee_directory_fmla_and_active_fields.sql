alter table public.profiles
add column if not exists is_lead_eligible boolean not null default false;

alter table public.profiles
add column if not exists on_fmla boolean not null default false;

alter table public.profiles
add column if not exists fmla_return_date date;

alter table public.profiles
add column if not exists is_active boolean not null default true;

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

drop trigger if exists profiles_restrict_staffing_field_updates on public.profiles;
create trigger profiles_restrict_staffing_field_updates
before update on public.profiles
for each row
execute function public.restrict_profile_staffing_field_updates();
