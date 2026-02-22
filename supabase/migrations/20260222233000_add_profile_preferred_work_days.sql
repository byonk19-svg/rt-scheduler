alter table public.profiles
add column if not exists preferred_work_days smallint[] not null default '{}';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_preferred_work_days_valid_check'
  ) then
    alter table public.profiles
    add constraint profiles_preferred_work_days_valid_check
    check (preferred_work_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]);
  end if;
end $$;
