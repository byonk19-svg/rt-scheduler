import { buildDateRange, dateKeyFromDate } from '@/lib/schedule-helpers'
import { MAX_SHIFT_COVERAGE_PER_DAY, MIN_SHIFT_COVERAGE_PER_DAY } from '@/lib/scheduling-constants'
import { summarizeShiftSlotViolations } from '@/lib/schedule-rule-validation'
import { resolveCoverageCycle } from '@/lib/coverage/active-cycle'
import {
  fetchActiveOperationalCodeMap,
  toLegacyShiftStatusFromOperationalCode,
} from '@/lib/operational-codes'
import { createClient } from '@/lib/supabase/server'
import { MANAGER_WORKFLOW_LINKS } from '@/lib/workflow-links'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

type CycleRow = {
  id: string
  label: string
  start_date: string
  end_date: string
  published: boolean
  archived_at?: string | null
}

type ShiftCoverageRow = {
  id: string
  date: string
  shift_type: 'day' | 'night'
  role: 'lead' | 'staff'
  user_id: string
  profiles: { is_lead_eligible: boolean } | { is_lead_eligible: boolean }[] | null
}

type PendingApprovalPostRow = {
  shift_id: string
}

type ShiftPublishLookupRow = {
  id: string
  schedule_cycles: { published: boolean } | { published: boolean }[] | null
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

function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function buildCoverageBaseLink(activeCycleId: string | null): string {
  if (!activeCycleId) return '/coverage?view=week'
  return `/coverage?cycle=${activeCycleId}&view=week`
}

function buildCoverageFilterLink(activeCycleId: string | null, filter: string): string {
  return `${buildCoverageBaseLink(activeCycleId)}&filter=${filter}&focus=first`
}

export function getManagerAttentionLinks(activeCycleId: string | null): DashboardLinks {
  const coverage = buildCoverageBaseLink(activeCycleId)
  const coverageMissingLead = buildCoverageFilterLink(activeCycleId, 'missing_lead')
  return {
    approvals: MANAGER_WORKFLOW_LINKS.approvals,
    approvalsPending: `/approvals?status=pending`,
    coverage,
    fixCoverage: coverageMissingLead,
    coverageMissingLead,
    coverageUnderCoverage: buildCoverageFilterLink(activeCycleId, 'under_coverage'),
    coverageUnfilled: buildCoverageFilterLink(activeCycleId, 'unfilled'),
    coverageNeedsAttention: buildCoverageFilterLink(activeCycleId, 'needs_attention'),
    publish: coverage,
  }
}

export async function getManagerAttentionSnapshot(
  supabase: SupabaseServerClient
): Promise<ManagerAttentionSnapshot> {
  const todayKey = dateKeyFromDate(new Date())

  const { data: cyclesData } = await supabase
    .from('schedule_cycles')
    .select('id, label, start_date, end_date, published, archived_at')
    .is('archived_at', null)
    .order('start_date', { ascending: false })
    .limit(12)

  const cycles = (cyclesData ?? []) as CycleRow[]
  const activeCycle = resolveCoverageCycle({
    cycles,
    cycleIdFromUrl: null,
    role: 'manager',
    todayKey,
  })

  const links = getManagerAttentionLinks(activeCycle?.id ?? null)

  const [pendingApprovalsResult, cycleShiftsResult] = await Promise.all([
    supabase.from('shift_posts').select('shift_id').eq('status', 'pending'),
    activeCycle
      ? supabase
          .from('shifts')
          .select(
            'id, date, shift_type, role, user_id, profiles:profiles!shifts_user_id_fkey(is_lead_eligible)'
          )
          .eq('cycle_id', activeCycle.id)
          .gte('date', activeCycle.start_date)
          .lte('date', activeCycle.end_date)
      : Promise.resolve({ data: [], error: null }),
  ])

  let pendingApprovals = 0
  const pendingApprovalPosts = (pendingApprovalsResult.data ?? []) as PendingApprovalPostRow[]
  if (pendingApprovalPosts.length > 0) {
    const shiftIds = Array.from(new Set(pendingApprovalPosts.map((post) => post.shift_id)))
    const { data: shiftCycleRows, error: shiftCycleError } = await supabase
      .from('shifts')
      .select('id, schedule_cycles!inner(published)')
      .in('id', shiftIds)

    if (shiftCycleError) {
      console.warn(
        'Could not scope pending approvals to published cycles. Falling back to all pending posts.',
        shiftCycleError.message || shiftCycleError
      )
      pendingApprovals = pendingApprovalPosts.length
    } else {
      const publishedShiftIds = new Set(
        ((shiftCycleRows ?? []) as ShiftPublishLookupRow[])
          .filter((row) => Boolean(getOne(row.schedule_cycles)?.published))
          .map((row) => row.id)
      )
      pendingApprovals = pendingApprovalPosts.filter((post) =>
        publishedShiftIds.has(post.shift_id)
      ).length
    }
  }

  let underCoverageSlots = 0
  let overCoverageSlots = 0
  let missingLeadShifts = 0

  if (activeCycle) {
    const cycleShiftRows = (cycleShiftsResult.data ?? []) as ShiftCoverageRow[]
    const activeOperationalCodesByShiftId = await fetchActiveOperationalCodeMap(
      supabase,
      cycleShiftRows.map((shift) => shift.id)
    )
    const cycleDates = buildDateRange(activeCycle.start_date, activeCycle.end_date)
    const validation = summarizeShiftSlotViolations({
      cycleDates,
      assignments: cycleShiftRows.map((shift) => ({
        date: shift.date,
        shiftType: shift.shift_type,
        status: toLegacyShiftStatusFromOperationalCode(
          activeOperationalCodesByShiftId.get(shift.id) ?? null
        ),
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
  const publishReady = activeCycle
    ? !activeCycle.published && pendingApprovals === 0 && coverageIssues === 0
    : false

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
