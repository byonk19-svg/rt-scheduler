-- Availability entries (non-approval constraints) and assignment availability override metadata.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    WHERE t.typname = 'availability_shift_type'
      AND t.typnamespace = 'public'::regnamespace
  ) THEN
    CREATE TYPE public.availability_shift_type AS ENUM ('day', 'night', 'both');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    WHERE t.typname = 'availability_entry_type'
      AND t.typnamespace = 'public'::regnamespace
  ) THEN
    CREATE TYPE public.availability_entry_type AS ENUM ('unavailable', 'available');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.availability_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cycle_id uuid NOT NULL REFERENCES public.schedule_cycles(id) ON DELETE CASCADE,
  date date NOT NULL,
  shift_type public.availability_shift_type NOT NULL DEFAULT 'both',
  entry_type public.availability_entry_type NOT NULL,
  reason text,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS availability_entries_unique_therapist_cycle_date_shift_idx
  ON public.availability_entries (therapist_id, cycle_id, date, shift_type);

CREATE INDEX IF NOT EXISTS availability_entries_therapist_cycle_idx
  ON public.availability_entries (therapist_id, cycle_id);

CREATE INDEX IF NOT EXISTS availability_entries_cycle_date_idx
  ON public.availability_entries (cycle_id, date);

CREATE INDEX IF NOT EXISTS availability_entries_conflict_lookup_idx
  ON public.availability_entries (therapist_id, cycle_id, date, entry_type, shift_type);

INSERT INTO public.availability_entries (
  therapist_id,
  cycle_id,
  date,
  shift_type,
  entry_type,
  reason,
  created_by,
  created_at
)
SELECT
  ar.user_id,
  ar.cycle_id,
  ar.date,
  'both'::public.availability_shift_type,
  'unavailable'::public.availability_entry_type,
  ar.reason,
  ar.user_id,
  COALESCE(ar.created_at, now())
FROM public.availability_requests ar
WHERE ar.user_id IS NOT NULL
  AND ar.cycle_id IS NOT NULL
ON CONFLICT (therapist_id, cycle_id, date, shift_type) DO UPDATE
SET
  reason = EXCLUDED.reason,
  created_by = EXCLUDED.created_by,
  created_at = EXCLUDED.created_at;

ALTER TABLE public.availability_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Therapists can view own availability entries" ON public.availability_entries;
CREATE POLICY "Therapists can view own availability entries"
  ON public.availability_entries
  FOR SELECT
  USING (auth.uid() = therapist_id);

DROP POLICY IF EXISTS "Therapists can insert own availability entries" ON public.availability_entries;
CREATE POLICY "Therapists can insert own availability entries"
  ON public.availability_entries
  FOR INSERT
  WITH CHECK (auth.uid() = therapist_id AND auth.uid() = created_by);

DROP POLICY IF EXISTS "Therapists can update own availability entries" ON public.availability_entries;
CREATE POLICY "Therapists can update own availability entries"
  ON public.availability_entries
  FOR UPDATE
  USING (auth.uid() = therapist_id)
  WITH CHECK (auth.uid() = therapist_id);

DROP POLICY IF EXISTS "Therapists can delete own availability entries" ON public.availability_entries;
CREATE POLICY "Therapists can delete own availability entries"
  ON public.availability_entries
  FOR DELETE
  USING (auth.uid() = therapist_id);

DROP POLICY IF EXISTS "Managers and leads can read availability entries" ON public.availability_entries;
CREATE POLICY "Managers and leads can read availability entries"
  ON public.availability_entries
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles actor_profile
      WHERE actor_profile.id = auth.uid()
        AND (
          actor_profile.role IN ('manager', 'lead')
          OR (
            actor_profile.role IN ('therapist', 'staff')
            AND COALESCE(actor_profile.is_lead_eligible, false) = true
          )
        )
    )
  );

GRANT ALL ON TABLE public.availability_entries TO authenticated;
GRANT ALL ON TABLE public.availability_entries TO service_role;

ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS availability_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS availability_override_reason text,
  ADD COLUMN IF NOT EXISTS availability_override_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS availability_override_at timestamptz;

CREATE INDEX IF NOT EXISTS shifts_availability_override_idx
  ON public.shifts (availability_override, date DESC);

CREATE OR REPLACE FUNCTION public.restrict_shift_availability_override_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_role text := COALESCE(auth.role(), '');
  actor_is_manager boolean := false;
BEGIN
  IF actor_role IN ('service_role', 'postgres') THEN
    RETURN NEW;
  END IF;

  IF
    NEW.availability_override IS DISTINCT FROM OLD.availability_override
    OR NEW.availability_override_reason IS DISTINCT FROM OLD.availability_override_reason
    OR NEW.availability_override_by IS DISTINCT FROM OLD.availability_override_by
    OR NEW.availability_override_at IS DISTINCT FROM OLD.availability_override_at
  THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'manager'
    ) INTO actor_is_manager;

    IF NOT actor_is_manager THEN
      RAISE EXCEPTION 'Only managers can set availability override fields.' USING errcode = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.restrict_shift_availability_override_updates() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.restrict_shift_availability_override_updates() TO authenticated;
GRANT EXECUTE ON FUNCTION public.restrict_shift_availability_override_updates() TO service_role;

DROP TRIGGER IF EXISTS shifts_restrict_availability_override_updates ON public.shifts;
CREATE TRIGGER shifts_restrict_availability_override_updates
BEFORE UPDATE ON public.shifts
FOR EACH ROW
EXECUTE FUNCTION public.restrict_shift_availability_override_updates();
