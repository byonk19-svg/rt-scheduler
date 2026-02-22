alter table public.profiles
drop constraint if exists profiles_max_work_days_per_week_check;

alter table public.profiles
drop constraint if exists profiles_employment_type_check;

alter table public.profiles
drop column if exists max_work_days_per_week;

alter table public.profiles
drop column if exists employment_type;
