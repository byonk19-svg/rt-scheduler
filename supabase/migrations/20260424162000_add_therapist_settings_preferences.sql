alter table public.profiles
  add column if not exists max_consecutive_days integer not null default 3;

alter table public.profiles
  add column if not exists notification_in_app_enabled boolean not null default true;

alter table public.profiles
  add column if not exists notification_email_enabled boolean not null default true;

alter table public.profiles
  drop constraint if exists profiles_max_consecutive_days_check;

alter table public.profiles
  add constraint profiles_max_consecutive_days_check
  check (max_consecutive_days between 1 and 7);

comment on column public.profiles.max_consecutive_days is
  'Preferred maximum consecutive work days for therapist scheduling flows.';

comment on column public.profiles.notification_in_app_enabled is
  'When false, app notification rows should not be created for this user.';

comment on column public.profiles.notification_email_enabled is
  'When false, email notification delivery should be skipped for this user.';
