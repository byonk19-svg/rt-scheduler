-- Rollback: work patterns + cycle-scoped availability overrides + auto-generate unfilled reasons.

drop index if exists public.shifts_unfilled_reason_idx;
alter table public.shifts drop column if exists unfilled_reason;

drop policy if exists "Managers can modify all availability overrides" on public.availability_overrides;
drop policy if exists "Managers and leads can read all availability overrides" on public.availability_overrides;
drop policy if exists "Therapists can delete own availability overrides" on public.availability_overrides;
drop policy if exists "Therapists can update own availability overrides" on public.availability_overrides;
drop policy if exists "Therapists can insert own availability overrides" on public.availability_overrides;
drop policy if exists "Therapists can view own availability overrides" on public.availability_overrides;

drop trigger if exists availability_overrides_restrict_cycle_updates on public.availability_overrides;
drop function if exists public.restrict_availability_override_cycle_updates();

drop index if exists public.availability_overrides_cycle_therapist_idx;
drop index if exists public.availability_overrides_cycle_date_idx;

drop table if exists public.availability_overrides;

drop policy if exists "Therapists can read own work pattern" on public.work_patterns;
drop policy if exists "Managers can modify all work patterns" on public.work_patterns;
drop policy if exists "Managers can read all work patterns" on public.work_patterns;

drop trigger if exists work_patterns_touch_updated_at on public.work_patterns;
drop function if exists public.touch_work_patterns_updated_at();

drop index if exists public.work_patterns_weekend_rotation_idx;

drop table if exists public.work_patterns;
