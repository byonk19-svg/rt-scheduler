drop trigger if exists profiles_restrict_staffing_field_updates on public.profiles;
drop function if exists public.restrict_profile_staffing_field_updates();

alter table public.profiles
drop column if exists is_active;

alter table public.profiles
drop column if exists fmla_return_date;

alter table public.profiles
drop column if exists on_fmla;
