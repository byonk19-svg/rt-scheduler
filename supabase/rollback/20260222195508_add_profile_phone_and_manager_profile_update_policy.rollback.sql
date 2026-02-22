drop policy if exists "Managers can update all profiles" on public.profiles;

alter table public.profiles
drop column if exists phone_number;
