import { buildDateRange, countsTowardWeeklyLimit, coverageSlotKey, dateKeyFromDate } from '@/lib/schedule-helpers'
import { MIN_SHIFT_COVERAGE_PER_DAY } from '@/lib/scheduling-constants'
import { createClient } from '@/lib/supabase/server'
import { MANAGER_WORKFLOW_LINKS } from '@/lib/workflow-links'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

type CycleRow = {
  id: string
  label: string
  start_date: string
  end_date: string
  published: boolean
}

type ShiftCoverageRow = {
  date: string
  shift_type: 'day' | 'night'
  status: string
}

export type ManagerAttentionSnapshot = {
  pendingApprovals: number
  unfilledShiftSlots: number
  attentionItems: number
  coverageConfirmed: boolean
  publishReady: boolean
  activeCycle: CycleRow | null
  links: {
    approvals: string
    coverage: string
    publish: string
  }
}

export async function getManagerAttentionSnapshot(supabase: SupabaseServerClient): Promise<ManagerAttentionSnapshot> {
  const todayKey = dateKeyFromDate(new Date())

  const { data: cyclesData } = await supabase
    .from('schedule_cycles')
    .select('id, label, start_date, end_date, published')
    .order('start_date', { ascending: false })
    .limit(12)

  const cycles = (cyclesData ?? []) as CycleRow[]
  const activeCycle =
    cycles.find((cycle) => cycle.start_date <= todayKey && cycle.end_date >= todayKey) ??
    cycles[0] ??
    null

  const [pendingApprovalsResult, cycleShiftsResult] = await Promise.all([
    supabase.from('shift_posts').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    activeCycle
      ? supabase
          .from('shifts')
          .select('date, shift_type, status')
          .eq('cycle_id', activeCycle.id)
          .gte('date', activeCycle.start_date)
          .lte('date', activeCycle.end_date)
      : Promise.resolve({ data: [], error: null }),
  ])

  const pendingApprovals = pendingApprovalsResult.count ?? 0

  let unfilledShiftSlots = 0
  if (activeCycle) {
    const cycleDates = buildDateRange(activeCycle.start_date, activeCycle.end_date)
    const coverageBySlot = new Map<string, number>()

    for (const shift of (cycleShiftsResult.data ?? []) as ShiftCoverageRow[]) {
      if (!countsTowardWeeklyLimit(shift.status)) continue
      const slotKey = coverageSlotKey(shift.date, shift.shift_type)
      coverageBySlot.set(slotKey, (coverageBySlot.get(slotKey) ?? 0) + 1)
    }

    for (const date of cycleDates) {
      for (const shiftType of ['day', 'night'] as const) {
        const slotCoverage = coverageBySlot.get(coverageSlotKey(date, shiftType)) ?? 0
        if (slotCoverage < MIN_SHIFT_COVERAGE_PER_DAY) {
          unfilledShiftSlots += 1
        }
      }
    }
  }

  const links = {
    approvals: MANAGER_WORKFLOW_LINKS.approvals,
    coverage: activeCycle ? `/schedule?cycle=${activeCycle.id}&view=calendar` : MANAGER_WORKFLOW_LINKS.coverage,
    publish: activeCycle ? `/schedule?cycle=${activeCycle.id}&view=grid` : MANAGER_WORKFLOW_LINKS.publish,
  }

  return {
    pendingApprovals,
    unfilledShiftSlots,
    attentionItems: pendingApprovals + unfilledShiftSlots,
    coverageConfirmed: Boolean(activeCycle) && unfilledShiftSlots === 0,
    publishReady: Boolean(activeCycle) && !activeCycle.published && pendingApprovals === 0 && unfilledShiftSlots === 0,
    activeCycle,
    links,
  }
}
