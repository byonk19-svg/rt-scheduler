alter table public.profiles
  add column if not exists preferred_work_days_mode text not null default 'unset',
  add column if not exists staff_onboarding_required boolean not null default false,
  add column if not exists staff_onboarding_preferences_confirmed_at timestamptz,
  add column if not exists staff_onboarding_theme_confirmed_at timestamptz,
  add column if not exists staff_onboarding_completed_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_preferred_work_days_mode_check;

alter table public.profiles
  add constraint profiles_preferred_work_days_mode_check
  check (
    preferred_work_days_mode in ('unset', 'specific_days', 'no_preference')
  );

update public.profiles
set preferred_work_days_mode = 'specific_days'
where preferred_work_days_mode = 'unset'
  and coalesce(cardinality(preferred_work_days), 0) > 0;
