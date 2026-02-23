alter table public.profiles
add column if not exists default_calendar_view text not null default 'day';

alter table public.profiles
add column if not exists default_landing_page text not null default 'dashboard';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_default_calendar_view_check'
  ) then
    alter table public.profiles
    add constraint profiles_default_calendar_view_check
    check (default_calendar_view = any (array['day'::text, 'night'::text]));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_default_landing_page_check'
  ) then
    alter table public.profiles
    add constraint profiles_default_landing_page_check
    check (default_landing_page = any (array['dashboard'::text, 'coverage'::text]));
  end if;
end $$;
