alter table public.profiles
drop constraint if exists profiles_preferred_work_days_valid_check;

alter table public.profiles
drop column if exists preferred_work_days;
