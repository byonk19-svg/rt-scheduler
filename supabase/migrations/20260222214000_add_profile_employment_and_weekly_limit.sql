alter table public.profiles
add column if not exists employment_type text not null default 'full_time';

alter table public.profiles
add column if not exists max_work_days_per_week smallint not null default 3;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_employment_type_check'
  ) then
    alter table public.profiles
    add constraint profiles_employment_type_check
    check (employment_type = any (array['full_time'::text, 'part_time'::text, 'prn'::text]));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_max_work_days_per_week_check'
  ) then
    alter table public.profiles
    add constraint profiles_max_work_days_per_week_check
    check (max_work_days_per_week between 1 and 7);
  end if;
end
$$;
