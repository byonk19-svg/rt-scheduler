DROP TRIGGER IF EXISTS shifts_restrict_availability_override_updates ON public.shifts;
DROP FUNCTION IF EXISTS public.restrict_shift_availability_override_updates();

DROP INDEX IF EXISTS public.shifts_availability_override_idx;

ALTER TABLE public.shifts
  DROP COLUMN IF EXISTS availability_override_at,
  DROP COLUMN IF EXISTS availability_override_by,
  DROP COLUMN IF EXISTS availability_override_reason,
  DROP COLUMN IF EXISTS availability_override;

DROP POLICY IF EXISTS "Managers and leads can read availability entries" ON public.availability_entries;
DROP POLICY IF EXISTS "Therapists can delete own availability entries" ON public.availability_entries;
DROP POLICY IF EXISTS "Therapists can update own availability entries" ON public.availability_entries;
DROP POLICY IF EXISTS "Therapists can insert own availability entries" ON public.availability_entries;
DROP POLICY IF EXISTS "Therapists can view own availability entries" ON public.availability_entries;

DROP INDEX IF EXISTS public.availability_entries_conflict_lookup_idx;
DROP INDEX IF EXISTS public.availability_entries_cycle_date_idx;
DROP INDEX IF EXISTS public.availability_entries_therapist_cycle_idx;
DROP INDEX IF EXISTS public.availability_entries_unique_therapist_cycle_date_shift_idx;

DROP TABLE IF EXISTS public.availability_entries;

DROP TYPE IF EXISTS public.availability_entry_type;
DROP TYPE IF EXISTS public.availability_shift_type;
