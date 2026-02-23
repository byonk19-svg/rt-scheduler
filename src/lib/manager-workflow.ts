import { buildDateRange, dateKeyFromDate, getOne } from '@/lib/schedule-helpers'
import { MAX_SHIFT_COVERAGE_PER_DAY, MIN_SHIFT_COVERAGE_PER_DAY } from '@/lib/scheduling-constants'
import { summarizeShiftSlotViolations } from '@/lib/schedule-rule-validation'
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
  status: 'scheduled' | 'on_call' | 'sick' | 'called_off'
  role: 'lead' | 'staff'
  user_id: string
  profiles:
    | { is_lead_eligible: boolean }
    | { is_lead_eligible: boolean }[]
    | null
}

type DashboardLinks = {
  approvals: string
  approvalsPending: string
  coverage: string
  fixCoverage: string
  coverageMissingLead: string
  coverageUnderCoverage: string
  coverageUnfilled: string
  coverageNeedsAttention: string
  publish: string
}

export type ManagerAttentionSnapshot = {
  pendingApprovals: number
  unfilledShiftSlots: number
  missingLeadShifts: number
  underCoverageSlots: number
  overCoverageSlots: number
  coverageIssues: number
  attentionItems: number
  coverageConfirmed: boolean
  publishReady: boolean
  resolveBlockersLink: string
  activeCycle: CycleRow | null
  links: DashboardLinks
}

function getLinks(activeCycle: CycleRow | null): DashboardLinks {
  if (!activeCycle) {
    return {
      approvals: MANAGER_WORKFLOW_LINKS.approvals,
      approvalsPending: '/approvals?status=pending',
      coverage: MANAGER_WORKFLOW_LINKS.coverage,
      fixCoverage: '/coverage?view=calendar&filter=missing_lead&focus=first',
      coverageMissingLead: '/coverage?view=calendar&filter=missing_lead&focus=first',
      coverageUnderCoverage: '/coverage?view=calendar&filter=under_coverage&focus=first',
      coverageUnfilled: '/coverage?view=calendar&filter=unfilled&focus=first',
      coverageNeedsAttention: '/coverage?view=calendar&filter=needs_attention&focus=first',
      publish: MANAGER_WORKFLOW_LINKS.publish,
    }
  }

  const cycleParam = `cycle=${activeCycle.id}`
  return {
    approvals: MANAGER_WORKFLOW_LINKS.approvals,
    approvalsPending: `/approvals?status=pending`,
    coverage: `/coverage?${cycleParam}&view=calendar`,
    fixCoverage: `/coverage?${cycleParam}&view=calendar&filter=missing_lead&focus=first`,
    coverageMissingLead: `/coverage?${cycleParam}&view=calendar&filter=missing_lead&focus=first`,
    coverageUnderCoverage: `/coverage?${cycleParam}&view=calendar&filter=under_coverage&focus=first`,
    coverageUnfilled: `/coverage?${cycleParam}&view=calendar&filter=unfilled&focus=first`,
    coverageNeedsAttention: `/coverage?${cycleParam}&view=calendar&filter=needs_attention&focus=first`,
    publish: `/schedule?${cycleParam}&view=grid`,
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

  const links = getLinks(activeCycle)

  const [pendingApprovalsResult, cycleShiftsResult] = await Promise.all([
    supabase.from('shift_posts').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    activeCycle
      ? supabase
          .from('shifts')
          .select(
            'date, shift_type, status, role, user_id, profiles:profiles!shifts_user_id_fkey(is_lead_eligible)'
          )
          .eq('cycle_id', activeCycle.id)
          .gte('date', activeCycle.start_date)
          .lte('date', activeCycle.end_date)
      : Promise.resolve({ data: [], error: null }),
  ])

  const pendingApprovals = pendingApprovalsResult.count ?? 0

  let underCoverageSlots = 0
  let overCoverageSlots = 0
  let missingLeadShifts = 0

  if (activeCycle) {
    const cycleDates = buildDateRange(activeCycle.start_date, activeCycle.end_date)
    const validation = summarizeShiftSlotViolations({
      cycleDates,
      assignments: ((cycleShiftsResult.data ?? []) as ShiftCoverageRow[]).map((shift) => ({
        date: shift.date,
        shiftType: shift.shift_type,
        status: shift.status,
        role: shift.role,
        therapistId: shift.user_id,
        therapistName: shift.user_id,
        isLeadEligible: Boolean(getOne(shift.profiles)?.is_lead_eligible),
      })),
      minCoveragePerShift: MIN_SHIFT_COVERAGE_PER_DAY,
      maxCoveragePerShift: MAX_SHIFT_COVERAGE_PER_DAY,
    })

    underCoverageSlots = validation.underCoverage
    overCoverageSlots = validation.overCoverage
    missingLeadShifts = validation.missingLead
  }

  const coverageIssues = missingLeadShifts + underCoverageSlots + overCoverageSlots
  const unfilledShiftSlots = underCoverageSlots
  const attentionItems = pendingApprovals + coverageIssues
  const publishReady = Boolean(activeCycle) && !activeCycle.published && pendingApprovals === 0 && coverageIssues === 0

  const resolveBlockersLink =
    coverageIssues > 0
      ? links.fixCoverage
      : pendingApprovals > 0
        ? links.approvalsPending
        : links.publish

  return {
    pendingApprovals,
    unfilledShiftSlots,
    missingLeadShifts,
    underCoverageSlots,
    overCoverageSlots,
    coverageIssues,
    attentionItems,
    coverageConfirmed: coverageIssues === 0,
    publishReady,
    resolveBlockersLink,
    activeCycle,
    links,
  }
}
