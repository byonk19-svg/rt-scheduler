import { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

type ProfileTargetRow = {
  site_id: string | null
  is_active: boolean | null
  archived_at: string | null
}

type TherapistTargetRow = ProfileTargetRow & {
  shift_type: 'day' | 'night' | null
}

type CycleTargetRow = {
  start_date: string
  end_date: string
  site_id: string | null
  archived_at?: string | null
  status?: 'draft' | 'preliminary' | 'final' | 'offline' | 'archived' | null
}

type PlannerOverrideTargetRow = {
  cycle_id: string | null
  therapist_id: string | null
  source: string | null
}

type ManagerAvailabilityPlannerTarget = {
  cycle: {
    start_date: string
    end_date: string
    site_id: string
  }
  therapist: {
    shift_type: 'day' | 'night'
  }
}

type LoadManagerAvailabilityPlannerTargetArgs = {
  admin: AdminClient
  managerId: string
  therapistId: string
  cycleId: string
  overrideId?: string
}

function isActiveProfile(row: ProfileTargetRow | null | undefined): row is ProfileTargetRow {
  return Boolean(row?.site_id) && row?.is_active !== false && !row?.archived_at
}

function isPlannerTherapist(
  row: TherapistTargetRow | null | undefined
): row is TherapistTargetRow & { shift_type: 'day' | 'night'; site_id: string } {
  return isActiveProfile(row) && (row.shift_type === 'day' || row.shift_type === 'night')
}

function isActiveCycle(
  row: CycleTargetRow | null | undefined
): row is CycleTargetRow & { site_id: string } {
  return Boolean(row?.site_id) && !row?.archived_at && row?.status !== 'archived'
}

function isOwnedManagerOverride(
  row: PlannerOverrideTargetRow | null | undefined,
  cycleId: string,
  therapistId: string
): boolean {
  return row?.cycle_id === cycleId && row.therapist_id === therapistId && row.source === 'manager'
}

export async function loadManagerAvailabilityPlannerTarget({
  admin,
  managerId,
  therapistId,
  cycleId,
  overrideId,
}: LoadManagerAvailabilityPlannerTargetArgs): Promise<ManagerAvailabilityPlannerTarget | null> {
  const [managerResult, therapistResult, cycleResult, overrideResult] = await Promise.all([
    admin
      .from('profiles')
      .select('site_id, is_active, archived_at')
      .eq('id', managerId)
      .maybeSingle(),
    admin
      .from('profiles')
      .select('site_id, is_active, archived_at, shift_type')
      .eq('id', therapistId)
      .maybeSingle(),
    admin
      .from('schedule_cycles')
      .select('start_date, end_date, site_id, archived_at, status')
      .eq('id', cycleId)
      .maybeSingle(),
    overrideId
      ? admin
          .from('availability_overrides')
          .select('cycle_id, therapist_id, source')
          .eq('id', overrideId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  const manager = managerResult.data as ProfileTargetRow | null
  const therapist = therapistResult.data as TherapistTargetRow | null
  const cycle = cycleResult.data as CycleTargetRow | null
  const override = overrideResult.data as PlannerOverrideTargetRow | null

  if (!isActiveProfile(manager) || !isPlannerTherapist(therapist) || !isActiveCycle(cycle)) {
    return null
  }

  if (manager.site_id !== therapist.site_id || manager.site_id !== cycle.site_id) {
    return null
  }

  if (overrideId && !isOwnedManagerOverride(override, cycleId, therapistId)) {
    return null
  }

  return {
    cycle: {
      start_date: cycle.start_date,
      end_date: cycle.end_date,
      site_id: cycle.site_id,
    },
    therapist: {
      shift_type: therapist.shift_type,
    },
  }
}
