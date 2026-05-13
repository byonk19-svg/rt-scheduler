-- Schedule Grid Unification removes the user-facing Grid/Roster layout choice.
-- Keep the column for compatibility with older code and generated types, but
-- normalize existing rows and prevent the retired roster value from returning.

update public.profiles
set default_schedule_view = 'week'
where default_schedule_view is distinct from 'week';

alter table public.profiles
  alter column default_schedule_view set default 'week';

alter table public.profiles
  drop constraint if exists profiles_default_schedule_view_check;

alter table public.profiles
  add constraint profiles_default_schedule_view_check
  check (default_schedule_view = 'week');
