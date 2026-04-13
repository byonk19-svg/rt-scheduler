alter table public.profiles
add column if not exists default_schedule_view text not null default 'week';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_default_schedule_view_check'
  ) then
    alter table public.profiles
    add constraint profiles_default_schedule_view_check
    check (default_schedule_view in ('week', 'roster'));
  end if;
end $$;
