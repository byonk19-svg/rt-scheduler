import { dateRange } from '@/lib/calendar-utils'
import { toUiRole, type UiRole } from '@/lib/auth/roles'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchActiveOperationalCodeMap } from '@/lib/operational-codes'
import type { AssignmentStatus, EmploymentType } from '@/lib/shift-types'
import {
  buildLotteryRecommendation,
  type LotteryActionStatus,
  type LotteryCandidate,
  type LotteryRequest,
} from '@/lib/lottery/recommendation'
import { deriveLotteryStatusReconciliation } from '@/lib/lottery/status-reconciliation'

export type LotteryShiftType = 'day' | 'night'

export type LotteryActor = {
  userId: string
  fullName: string
  role: UiRole
  siteId: string
  shiftType: LotteryShiftType | null
}

export type LotteryRequestListItem = {
  id: string
  therapistId: string
  therapistName: string
  requestedAt: string
}

export type LotteryMyRequestItem = {
  id: string
  shiftDate: string
  shiftType: LotteryShiftType
  requestedAt: string
}

export type LotteryListItem = {
  id: string
  therapistId: string
  therapistName: string
  fixedOrder: number
  lastLotteriedDate: string | null
}

export type LotteryMissingListItem = {
  therapistId: string
  therapistName: string
}

export type LotteryEligiblePerson = {
  therapistId: string
  therapistName: string
  employmentType: EmploymentType | null
}

export type LotteryRecommendationActionView = {
  therapistId: string
  therapistName: string
  status: LotteryActionStatus
}

export type LotteryRecommendationView = {
  state: 'preview' | 'applied' | 'stale'
  keepToWork: number
  scheduledCount: number
  reductionsNeeded: number
  actions: LotteryRecommendationActionView[]
  explanation: string[]
  contextSignature: string
  latestAppliedAt: string | null
  latestAppliedBy: string | null
  overrideApplied: boolean
}

export type LotteryPageSnapshot = {
  actor: {
    userId: string
    role: UiRole
    canManageList: boolean
    canApply: boolean
    shiftType: LotteryShiftType | null
  }
  selectedDate: string | null
  selectedShift: LotteryShiftType
  availableDates: string[]
  keepToWork: number | null
  workingScheduledCount: number
  eligibleReductionCount: number
  protectedScheduledCount: number
  requestList: LotteryRequestListItem[]
  myRequests: LotteryMyRequestItem[]
  lotteryList: LotteryListItem[]
  missingListEntries: LotteryMissingListItem[]
  requestableTherapists: LotteryEligiblePerson[]
  recommendationCandidates: LotteryEligiblePerson[]
  canCurrentUserRequest: boolean
  currentUserHasRequest: boolean
  recommendation: LotteryRecommendationView | null
  recommendationError: string | null
  latestAppliedDecision: {
    keepToWork: number
    appliedAt: string
    appliedBy: string | null
    actions: LotteryRecommendationActionView[]
    overrideApplied: boolean
    contextSignature: string
  } | null
}

export type LotteryHistoryItem = {
  id: string
  shiftDate: string
  shiftType: LotteryShiftType
  appliedStatus: 'on_call' | 'cancelled'
  createdAt: string
  createdByName: string | null
  overrideApplied: boolean
  invalidatedAt: string | null
  invalidatedReason: string | null
  requestRestored: boolean
}

type ProfileActorRow = {
  id: string
  full_name: string | null
  role: string | null
  site_id: string | null
  shift_type: LotteryShiftType | null
}

type PublishedCycleRow = {
  id: string
  start_date: string
  end_date: string
}

type SlotShiftRow = {
  id: string
  site_id: string | null
  user_id: string | null
  date: string
  shift_type: LotteryShiftType
  status: string
  role: 'lead' | 'staff'
  schedule_cycles: { published: boolean } | { published: boolean }[] | null
  profiles:
    | {
        full_name: string | null
        employment_type: EmploymentType | null
      }
    | {
        full_name: string | null
        employment_type: EmploymentType | null
      }[]
    | null
}

type LotteryListEntryRow = {
  id: string
  therapist_id: string
  display_order: number
  profiles:
    | {
        full_name: string | null
      }
    | {
        full_name: string | null
      }[]
    | null
}

type LotteryRequestRow = {
  id: string
  therapist_id: string
  shift_date: string
  shift_type: LotteryShiftType
  requested_at: string
  state: 'active' | 'suppressed_status' | 'suppressed_schedule'
  profiles:
    | {
        full_name: string | null
      }
    | {
        full_name: string | null
      }[]
    | null
}

type LotteryHistoryRow = {
  id: string
  therapist_id: string
  shift_id: string
  shift_date: string
  shift_type: LotteryShiftType
  applied_status: 'on_call' | 'cancelled'
  created_at: string
  invalidated_at: string | null
  invalidated_reason: string | null
  override_applied: boolean | null
  request_restored: boolean | null
  creator:
    | {
        full_name: string | null
      }
    | {
        full_name: string | null
      }[]
    | null
}

type LotteryDecisionRow = {
  id: string
  keep_to_work: number
  applied_at: string
  override_applied: boolean | null
  context_signature: string
  applied_actions: LotteryRecommendationActionView[] | null
  actor:
    | {
        full_name: string | null
      }
    | {
        full_name: string | null
      }[]
    | null
}

type SlotAssignment = {
  shiftId: string
  therapistId: string
  therapistName: string
  employmentType: EmploymentType | null
  liveStatus: AssignmentStatus
}

type LotteryDecisionInputAction = {
  therapistId: string
  status: LotteryActionStatus
}

function admin() {
  return createAdminClient()
}

function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function canManageList(role: UiRole): boolean {
  return role === 'manager' || role === 'lead'
}

function canApplyLottery(role: UiRole): boolean {
  return role === 'manager' || role === 'lead'
}

function resolveLiveAssignmentStatus(
  rowStatus: string,
  activeCode: AssignmentStatus | undefined
): AssignmentStatus {
  if (activeCode) return activeCode
  if (rowStatus === 'on_call') return 'on_call'
  if (rowStatus === 'called_off' || rowStatus === 'sick') return 'cancelled'
  return 'scheduled'
}

function stringifyActions(actions: LotteryRecommendationActionView[]): string {
  return JSON.stringify(
    actions
      .slice()
      .sort(
        (a, b) => a.status.localeCompare(b.status) || a.therapistId.localeCompare(b.therapistId)
      )
  )
}

function buildRecommendationExplanation(args: {
  reductionsNeeded: number
  volunteerCount: number
  prnInvolved: boolean
  actions: LotteryRecommendationActionView[]
}): string[] {
  if (args.actions.length === 0) {
    return ['Keep-to-work matches the current scheduled headcount, so nobody needs to be notified.']
  }

  const lines: string[] = []
  if (args.volunteerCount > 0) {
    lines.push(
      args.volunteerCount === 1
        ? 'Volunteer sign-up order was used because one full-time therapist requested off.'
        : `Volunteer sign-up order was used because ${args.volunteerCount} full-time therapists requested off.`
    )
  } else {
    lines.push('No full-time volunteers were signed up, so the fixed lottery order was used.')
  }

  if (args.prnInvolved) {
    lines.push('A PRN is scheduled on this shift and is included in the reduction order.')
  }

  lines.push(
    args.reductionsNeeded === 1
      ? 'One reduction is needed, so the final notified person is on call.'
      : ` ${args.reductionsNeeded} reductions are needed, so every earlier person is cancelled and the final person is on call.`.trim()
  )

  return lines
}

function buildContextSignature(args: {
  shiftDate: string
  shiftType: LotteryShiftType
  workingAssignments: SlotAssignment[]
  requestList: LotteryRequestListItem[]
  lotteryList: LotteryListItem[]
}): string {
  return JSON.stringify({
    shiftDate: args.shiftDate,
    shiftType: args.shiftType,
    workingAssignments: args.workingAssignments
      .map((assignment) => ({
        shiftId: assignment.shiftId,
        therapistId: assignment.therapistId,
        employmentType: assignment.employmentType,
        liveStatus: assignment.liveStatus,
      }))
      .sort((a, b) => a.shiftId.localeCompare(b.shiftId)),
    requestList: args.requestList
      .map((request) => ({
        therapistId: request.therapistId,
        requestedAt: request.requestedAt,
      }))
      .sort(
        (a, b) =>
          a.requestedAt.localeCompare(b.requestedAt) || a.therapistId.localeCompare(b.therapistId)
      ),
    lotteryList: args.lotteryList
      .map((entry) => ({
        therapistId: entry.therapistId,
        fixedOrder: entry.fixedOrder,
        lastLotteriedDate: entry.lastLotteriedDate,
      }))
      .sort((a, b) => a.fixedOrder - b.fixedOrder),
  })
}

export async function loadLotteryActor(userId: string): Promise<LotteryActor | null> {
  const { data, error } = await admin()
    .from('profiles')
    .select('id, full_name, role, site_id, shift_type')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data) {
    if (error) console.error('Failed to load Lottery actor profile:', error)
    return null
  }

  const profile = data as ProfileActorRow
  if (!profile.site_id) return null

  return {
    userId: profile.id,
    fullName: profile.full_name?.trim() || 'Team member',
    role: toUiRole(profile.role),
    siteId: profile.site_id,
    shiftType: profile.shift_type ?? null,
  }
}

async function loadPublishedCycles(): Promise<PublishedCycleRow[]> {
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await admin()
    .from('schedule_cycles')
    .select('id, start_date, end_date')
    .eq('published', true)
    .is('archived_at', null)
    .gte('end_date', today)
    .order('start_date', { ascending: true })

  if (error) {
    console.error('Failed to load published Lottery cycles:', error)
    return []
  }

  return (data ?? []) as PublishedCycleRow[]
}

function buildAvailableDates(cycles: PublishedCycleRow[]): string[] {
  return cycles.flatMap((cycle) => dateRange(cycle.start_date, cycle.end_date))
}

async function loadSlotAssignments(args: {
  siteId: string
  shiftDate: string
  shiftType: LotteryShiftType
}): Promise<SlotAssignment[]> {
  const { data, error } = await admin()
    .from('shifts')
    .select(
      'id, site_id, user_id, date, shift_type, status, role, schedule_cycles!shifts_cycle_id_fkey!inner(published), profiles:profiles!shifts_user_id_fkey(full_name, employment_type)'
    )
    .eq('site_id', args.siteId)
    .eq('date', args.shiftDate)
    .eq('shift_type', args.shiftType)
    .eq('schedule_cycles.published', true)
    .not('user_id', 'is', null)

  if (error) {
    console.error('Failed to load Lottery slot assignments:', error)
    return []
  }

  const rows = (data ?? []) as SlotShiftRow[]
  const activeCodes = await fetchActiveOperationalCodeMap(
    admin(),
    rows.map((row) => row.id)
  )

  return rows
    .filter((row) => row.user_id)
    .map<SlotAssignment>((row) => {
      const profile = getOne(row.profiles)
      return {
        shiftId: row.id,
        therapistId: row.user_id as string,
        therapistName: profile?.full_name?.trim() || 'Unknown therapist',
        employmentType: profile?.employment_type ?? null,
        liveStatus: resolveLiveAssignmentStatus(row.status, activeCodes.get(row.id)),
      }
    })
}

async function loadLotteryList(
  siteId: string,
  shiftType: LotteryShiftType
): Promise<LotteryListItem[]> {
  const { data, error } = await admin()
    .from('lottery_list_entries')
    .select(
      'id, therapist_id, display_order, profiles:profiles!lottery_list_entries_therapist_id_fkey(full_name)'
    )
    .eq('site_id', siteId)
    .eq('shift_type', shiftType)
    .order('display_order', { ascending: true })

  if (error) {
    console.error('Failed to load Lottery list:', error)
    return []
  }

  return ((data ?? []) as LotteryListEntryRow[]).map((row) => ({
    id: row.id,
    therapistId: row.therapist_id,
    therapistName: getOne(row.profiles)?.full_name?.trim() || 'Unknown therapist',
    fixedOrder: row.display_order,
    lastLotteriedDate: null,
  }))
}

async function loadPrnPresenceByDate(args: {
  siteId: string
  shiftType: LotteryShiftType
  dates: string[]
}): Promise<Set<string>> {
  if (args.dates.length === 0) return new Set()

  const { data, error } = await admin()
    .from('shifts')
    .select(
      'id, user_id, date, shift_type, status, schedule_cycles!shifts_cycle_id_fkey!inner(published), profiles:profiles!shifts_user_id_fkey(employment_type)'
    )
    .eq('site_id', args.siteId)
    .in('date', args.dates)
    .eq('shift_type', args.shiftType)
    .eq('schedule_cycles.published', true)
    .not('user_id', 'is', null)

  if (error) {
    console.error('Failed to load PRN presence for Lottery history:', error)
    return new Set()
  }

  const rows = (data ?? []) as SlotShiftRow[]
  const activeCodes = await fetchActiveOperationalCodeMap(
    admin(),
    rows.map((row) => row.id)
  )
  const prnDates = new Set<string>()

  for (const row of rows) {
    const profile = getOne(row.profiles)
    if (profile?.employment_type !== 'prn') continue
    if (resolveLiveAssignmentStatus(row.status, activeCodes.get(row.id)) !== 'scheduled') continue
    prnDates.add(row.date)
  }

  return prnDates
}

async function loadLastLotteriedDates(args: {
  siteId: string
  shiftType: LotteryShiftType
  therapistIds: string[]
}): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>(
    args.therapistIds.map((therapistId) => [therapistId, null])
  )
  if (args.therapistIds.length === 0) return result

  const { data, error } = await admin()
    .from('lottery_history_entries')
    .select('therapist_id, shift_date, shift_type')
    .eq('site_id', args.siteId)
    .eq('shift_type', args.shiftType)
    .is('invalidated_at', null)
    .in('therapist_id', args.therapistIds)
    .order('shift_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to load Lottery history for ranking:', error)
    return result
  }

  const rows = (data ?? []) as Array<{
    therapist_id: string
    shift_date: string
    shift_type: LotteryShiftType
  }>
  const prnDates = await loadPrnPresenceByDate({
    siteId: args.siteId,
    shiftType: args.shiftType,
    dates: [...new Set(rows.map((row) => row.shift_date))],
  })

  for (const row of rows) {
    if (prnDates.has(row.shift_date)) continue
    if (result.get(row.therapist_id) != null) continue
    result.set(row.therapist_id, row.shift_date)
  }

  return result
}

async function loadActiveRequests(args: {
  siteId: string
  shiftDate: string
  shiftType: LotteryShiftType
}): Promise<LotteryRequestListItem[]> {
  const { data, error } = await admin()
    .from('lottery_requests')
    .select(
      'id, therapist_id, shift_date, shift_type, requested_at, state, profiles:profiles!lottery_requests_therapist_id_fkey(full_name)'
    )
    .eq('site_id', args.siteId)
    .eq('shift_date', args.shiftDate)
    .eq('shift_type', args.shiftType)
    .eq('state', 'active')
    .order('requested_at', { ascending: true })

  if (error) {
    console.error('Failed to load Lottery requests:', error)
    return []
  }

  return ((data ?? []) as LotteryRequestRow[]).map((row) => ({
    id: row.id,
    therapistId: row.therapist_id,
    therapistName: getOne(row.profiles)?.full_name?.trim() || 'Unknown therapist',
    requestedAt: row.requested_at,
  }))
}

async function suppressInvalidRequestsForSlot(args: {
  siteId: string
  shiftDate: string
  shiftType: LotteryShiftType
  actorId?: string | null
}): Promise<void> {
  const [slotAssignments, requests] = await Promise.all([
    loadSlotAssignments(args),
    loadActiveRequests(args),
  ])

  const eligibleIds = new Set(
    slotAssignments
      .filter((assignment) => assignment.liveStatus === 'scheduled')
      .map((assignment) => assignment.therapistId)
  )
  const toSuppress = requests
    .filter((request) => !eligibleIds.has(request.therapistId))
    .map((request) => request.id)

  if (toSuppress.length === 0) return

  const { error } = await admin()
    .from('lottery_requests')
    .update({
      state: 'suppressed_schedule',
      suppressed_at: new Date().toISOString(),
      suppressed_by: args.actorId ?? null,
    })
    .in('id', toSuppress)

  if (error) {
    console.error('Failed to suppress invalid Lottery requests:', error)
  }
}

async function suppressInvalidRequestsForUser(args: { actor: LotteryActor }): Promise<void> {
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await admin()
    .from('lottery_requests')
    .select('id, shift_date, shift_type')
    .eq('site_id', args.actor.siteId)
    .eq('therapist_id', args.actor.userId)
    .eq('state', 'active')
    .gte('shift_date', today)

  if (error) {
    console.error('Failed to load user Lottery requests for sync:', error)
    return
  }

  const rows = (data ?? []) as Array<{
    id: string
    shift_date: string
    shift_type: LotteryShiftType
  }>
  for (const row of rows) {
    await suppressInvalidRequestsForSlot({
      siteId: args.actor.siteId,
      shiftDate: row.shift_date,
      shiftType: row.shift_type,
      actorId: args.actor.userId,
    })
  }
}

async function loadMyRequests(actor: LotteryActor): Promise<LotteryMyRequestItem[]> {
  await suppressInvalidRequestsForUser({ actor })

  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await admin()
    .from('lottery_requests')
    .select('id, shift_date, shift_type, requested_at')
    .eq('site_id', actor.siteId)
    .eq('therapist_id', actor.userId)
    .eq('state', 'active')
    .gte('shift_date', today)
    .order('shift_date', { ascending: true })
    .order('requested_at', { ascending: true })

  if (error) {
    console.error('Failed to load Lottery my-requests:', error)
    return []
  }

  return (
    (data ?? []) as Array<{
      id: string
      shift_date: string
      shift_type: LotteryShiftType
      requested_at: string
    }>
  ).map((row) => ({
    id: row.id,
    shiftDate: row.shift_date,
    shiftType: row.shift_type,
    requestedAt: row.requested_at,
  }))
}

async function loadLatestAppliedDecision(args: {
  siteId: string
  shiftDate: string
  shiftType: LotteryShiftType
}): Promise<LotteryPageSnapshot['latestAppliedDecision']> {
  const { data, error } = await admin()
    .from('lottery_decisions')
    .select(
      'id, keep_to_work, applied_at, override_applied, context_signature, applied_actions, actor:profiles!lottery_decisions_applied_by_fkey(full_name)'
    )
    .eq('site_id', args.siteId)
    .eq('shift_date', args.shiftDate)
    .eq('shift_type', args.shiftType)
    .is('superseded_at', null)
    .order('applied_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Failed to load latest Lottery decision:', error)
    return null
  }

  if (!data) return null

  const row = data as LotteryDecisionRow
  return {
    keepToWork: row.keep_to_work,
    appliedAt: row.applied_at,
    appliedBy: getOne(row.actor)?.full_name?.trim() || null,
    actions: (row.applied_actions ?? []) as LotteryRecommendationActionView[],
    overrideApplied: row.override_applied === true,
    contextSignature: row.context_signature,
  }
}

function buildEligibleCandidates(args: {
  workingAssignments: SlotAssignment[]
  lotteryList: LotteryListItem[]
}): {
  candidates: LotteryCandidate[]
  protectedScheduledCount: number
  missingListEntries: LotteryMissingListItem[]
} {
  const lotteryListByTherapistId = new Map(
    args.lotteryList.map((entry) => [entry.therapistId, entry])
  )
  const candidates: LotteryCandidate[] = []
  const missingListEntries: LotteryMissingListItem[] = []
  let protectedScheduledCount = 0

  for (const assignment of args.workingAssignments) {
    if (assignment.employmentType === 'part_time') {
      protectedScheduledCount += 1
      continue
    }

    const listEntry = lotteryListByTherapistId.get(assignment.therapistId)
    if (assignment.employmentType === 'full_time' && !listEntry) {
      missingListEntries.push({
        therapistId: assignment.therapistId,
        therapistName: assignment.therapistName,
      })
    }

    candidates.push({
      id: assignment.therapistId,
      name: assignment.therapistName,
      employmentType: assignment.employmentType ?? 'full_time',
      fixedOrder: listEntry?.fixedOrder ?? null,
      lastLotteriedDate: listEntry?.lastLotteriedDate ?? null,
    })
  }

  return { candidates, protectedScheduledCount, missingListEntries }
}

export async function loadLotterySnapshot(args: {
  actor: LotteryActor
  shiftDate?: string | null
  shiftType?: LotteryShiftType | null
  keepToWork?: number | null
}): Promise<LotteryPageSnapshot> {
  const cycles = await loadPublishedCycles()
  const availableDates = buildAvailableDates(cycles)
  const today = new Date().toISOString().slice(0, 10)
  const selectedDate =
    (args.shiftDate && availableDates.includes(args.shiftDate) ? args.shiftDate : null) ??
    (availableDates.includes(today) ? today : (availableDates[0] ?? null))
  const selectedShift = args.shiftType ?? args.actor.shiftType ?? 'day'

  if (!selectedDate) {
    return {
      actor: {
        userId: args.actor.userId,
        role: args.actor.role,
        canManageList: canManageList(args.actor.role),
        canApply: canApplyLottery(args.actor.role),
        shiftType: args.actor.shiftType,
      },
      selectedDate: null,
      selectedShift,
      availableDates: [],
      keepToWork: args.keepToWork ?? null,
      workingScheduledCount: 0,
      eligibleReductionCount: 0,
      protectedScheduledCount: 0,
      requestList: [],
      myRequests: [],
      lotteryList: [],
      missingListEntries: [],
      requestableTherapists: [],
      recommendationCandidates: [],
      canCurrentUserRequest: false,
      currentUserHasRequest: false,
      recommendation: null,
      recommendationError: 'No published schedule dates are available yet.',
      latestAppliedDecision: null,
    }
  }

  await suppressInvalidRequestsForSlot({
    siteId: args.actor.siteId,
    shiftDate: selectedDate,
    shiftType: selectedShift,
    actorId: args.actor.userId,
  })

  const [workingAssignmentsAll, lotteryListBase, requestList, myRequests, latestAppliedDecision] =
    await Promise.all([
      loadSlotAssignments({
        siteId: args.actor.siteId,
        shiftDate: selectedDate,
        shiftType: selectedShift,
      }),
      loadLotteryList(args.actor.siteId, selectedShift),
      loadActiveRequests({
        siteId: args.actor.siteId,
        shiftDate: selectedDate,
        shiftType: selectedShift,
      }),
      loadMyRequests(args.actor),
      loadLatestAppliedDecision({
        siteId: args.actor.siteId,
        shiftDate: selectedDate,
        shiftType: selectedShift,
      }),
    ])

  const workingAssignments = workingAssignmentsAll.filter(
    (assignment) => assignment.liveStatus === 'scheduled'
  )
  const lastLotteriedDates = await loadLastLotteriedDates({
    siteId: args.actor.siteId,
    shiftType: selectedShift,
    therapistIds: lotteryListBase.map((entry) => entry.therapistId),
  })
  const lotteryList = lotteryListBase.map((entry) => ({
    ...entry,
    lastLotteriedDate: lastLotteriedDates.get(entry.therapistId) ?? null,
  }))

  const { candidates, protectedScheduledCount, missingListEntries } = buildEligibleCandidates({
    workingAssignments,
    lotteryList,
  })

  const currentUserHasRequest = requestList.some(
    (request) => request.therapistId === args.actor.userId
  )
  const currentUserEligible = workingAssignments.some(
    (assignment) =>
      assignment.therapistId === args.actor.userId && assignment.employmentType === 'full_time'
  )
  const requestableTherapists = workingAssignments
    .filter((assignment) => assignment.employmentType === 'full_time')
    .filter(
      (assignment) => !requestList.some((request) => request.therapistId === assignment.therapistId)
    )
    .map<LotteryEligiblePerson>((assignment) => ({
      therapistId: assignment.therapistId,
      therapistName: assignment.therapistName,
      employmentType: assignment.employmentType,
    }))
    .sort((a, b) => a.therapistName.localeCompare(b.therapistName))
  const recommendationCandidates = candidates
    .map<LotteryEligiblePerson>((candidate) => ({
      therapistId: candidate.id,
      therapistName: candidate.name,
      employmentType: candidate.employmentType,
    }))
    .sort((a, b) => a.therapistName.localeCompare(b.therapistName))

  let recommendation: LotteryRecommendationView | null = null
  let recommendationError: string | null = null

  const contextSignature = buildContextSignature({
    shiftDate: selectedDate,
    shiftType: selectedShift,
    workingAssignments,
    requestList,
    lotteryList,
  })

  if (args.keepToWork != null) {
    if (
      !Number.isInteger(args.keepToWork) ||
      args.keepToWork < 0 ||
      args.keepToWork > workingAssignments.length
    ) {
      recommendationError = 'Keep-to-work must be between 0 and the current scheduled headcount.'
    } else if (workingAssignments.length - args.keepToWork > candidates.length) {
      recommendationError =
        'That keep-to-work value would require reducing protected staff or already-resolved assignments.'
    } else if (missingListEntries.length > 0 && workingAssignments.length - args.keepToWork > 0) {
      recommendationError =
        'Add the missing full-time therapists to the lottery list before generating a recommendation.'
    } else {
      const preview = buildLotteryRecommendation({
        keepToWork: args.keepToWork,
        scheduled: candidates,
        requests: requestList.map<LotteryRequest>((request) => ({
          therapistId: request.therapistId,
          therapistName: request.therapistName,
          requestedAt: request.requestedAt,
        })),
      })

      const previewActions = preview.actions.map((action) => ({
        therapistId: action.therapistId,
        therapistName: action.therapistName,
        status: action.status,
      }))

      const previewActionSignature = stringifyActions(previewActions)
      const appliedActionSignature = stringifyActions(latestAppliedDecision?.actions ?? [])
      const state: LotteryRecommendationView['state'] =
        latestAppliedDecision &&
        latestAppliedDecision.keepToWork === args.keepToWork &&
        latestAppliedDecision.contextSignature === contextSignature &&
        appliedActionSignature === previewActionSignature
          ? 'applied'
          : latestAppliedDecision
            ? 'stale'
            : 'preview'

      recommendation = {
        state,
        keepToWork: args.keepToWork,
        scheduledCount: preview.scheduledCount,
        reductionsNeeded: preview.reductionsNeeded,
        actions: previewActions,
        explanation: buildRecommendationExplanation({
          reductionsNeeded: preview.reductionsNeeded,
          volunteerCount: requestList.length,
          prnInvolved: preview.prnInvolved,
          actions: previewActions,
        }),
        contextSignature,
        latestAppliedAt: latestAppliedDecision?.appliedAt ?? null,
        latestAppliedBy: latestAppliedDecision?.appliedBy ?? null,
        overrideApplied: latestAppliedDecision?.overrideApplied ?? false,
      }
    }
  }

  return {
    actor: {
      userId: args.actor.userId,
      role: args.actor.role,
      canManageList: canManageList(args.actor.role),
      canApply: canApplyLottery(args.actor.role),
      shiftType: args.actor.shiftType,
    },
    selectedDate,
    selectedShift,
    availableDates,
    keepToWork: args.keepToWork ?? null,
    workingScheduledCount: workingAssignments.length,
    eligibleReductionCount: candidates.length,
    protectedScheduledCount,
    requestList,
    myRequests,
    lotteryList,
    missingListEntries,
    requestableTherapists,
    recommendationCandidates,
    canCurrentUserRequest: currentUserEligible && !currentUserHasRequest,
    currentUserHasRequest,
    recommendation,
    recommendationError,
    latestAppliedDecision,
  }
}

export async function loadLotteryHistory(args: {
  actor: LotteryActor
  therapistId: string
  shiftType: LotteryShiftType
}): Promise<LotteryHistoryItem[]> {
  const { data, error } = await admin()
    .from('lottery_history_entries')
    .select(
      'id, therapist_id, shift_id, shift_date, shift_type, applied_status, created_at, invalidated_at, invalidated_reason, override_applied, request_restored, creator:profiles!lottery_history_entries_created_by_fkey(full_name)'
    )
    .eq('site_id', args.actor.siteId)
    .eq('therapist_id', args.therapistId)
    .eq('shift_type', args.shiftType)
    .order('shift_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to load Lottery therapist history:', error)
    return []
  }

  return ((data ?? []) as LotteryHistoryRow[]).map((row) => ({
    id: row.id,
    shiftDate: row.shift_date,
    shiftType: row.shift_type,
    appliedStatus: row.applied_status,
    createdAt: row.created_at,
    createdByName: getOne(row.creator)?.full_name?.trim() || null,
    overrideApplied: row.override_applied === true,
    invalidatedAt: row.invalidated_at,
    invalidatedReason: row.invalidated_reason,
    requestRestored: row.request_restored === true,
  }))
}

async function findShiftForTherapistSlot(args: {
  siteId: string
  therapistId: string
  shiftDate: string
  shiftType: LotteryShiftType
}): Promise<SlotAssignment | null> {
  const assignments = await loadSlotAssignments({
    siteId: args.siteId,
    shiftDate: args.shiftDate,
    shiftType: args.shiftType,
  })

  return assignments.find((assignment) => assignment.therapistId === args.therapistId) ?? null
}

export async function addLotteryRequest(args: {
  actor: LotteryActor
  therapistId: string
  shiftDate: string
  shiftType: LotteryShiftType
  requestedAt?: string | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const managingAnotherTherapist = args.therapistId !== args.actor.userId
  if (managingAnotherTherapist && !canManageList(args.actor.role)) {
    return { ok: false, error: 'You can only add your own request.' }
  }

  await suppressInvalidRequestsForSlot({
    siteId: args.actor.siteId,
    shiftDate: args.shiftDate,
    shiftType: args.shiftType,
    actorId: args.actor.userId,
  })

  const slotAssignment = await findShiftForTherapistSlot({
    siteId: args.actor.siteId,
    therapistId: args.therapistId,
    shiftDate: args.shiftDate,
    shiftType: args.shiftType,
  })

  if (!slotAssignment || slotAssignment.liveStatus !== 'scheduled') {
    return {
      ok: false,
      error: 'Requests are only allowed for therapists currently scheduled on that shift.',
    }
  }

  if (slotAssignment.employmentType !== 'full_time') {
    return { ok: false, error: 'Only full-time therapists can sign up for Lottery requests.' }
  }

  const { data: existing, error: existingError } = await admin()
    .from('lottery_requests')
    .select('id')
    .eq('site_id', args.actor.siteId)
    .eq('therapist_id', args.therapistId)
    .eq('shift_date', args.shiftDate)
    .eq('shift_type', args.shiftType)
    .in('state', ['active', 'suppressed_status'])
    .limit(1)

  if (existingError) {
    console.error('Failed to check existing Lottery request:', existingError)
    return { ok: false, error: 'Could not verify existing requests.' }
  }

  if ((existing ?? []).length > 0) {
    return { ok: false, error: 'That therapist already has a Lottery request for this shift.' }
  }

  const requestedAt = args.requestedAt ?? new Date().toISOString()
  const { error } = await admin().from('lottery_requests').insert({
    site_id: args.actor.siteId,
    therapist_id: args.therapistId,
    shift_date: args.shiftDate,
    shift_type: args.shiftType,
    requested_at: requestedAt,
    state: 'active',
    created_by: args.actor.userId,
  })

  if (error) {
    console.error('Failed to add Lottery request:', error)
    return { ok: false, error: 'Could not save the Lottery request.' }
  }

  return { ok: true }
}

export async function removeLotteryRequest(args: {
  actor: LotteryActor
  therapistId: string
  shiftDate: string
  shiftType: LotteryShiftType
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const managingAnotherTherapist = args.therapistId !== args.actor.userId
  if (managingAnotherTherapist && !canManageList(args.actor.role)) {
    return { ok: false, error: 'You can only remove your own request.' }
  }

  const { error } = await admin()
    .from('lottery_requests')
    .delete()
    .eq('site_id', args.actor.siteId)
    .eq('therapist_id', args.therapistId)
    .eq('shift_date', args.shiftDate)
    .eq('shift_type', args.shiftType)
    .eq('state', 'active')

  if (error) {
    console.error('Failed to remove Lottery request:', error)
    return { ok: false, error: 'Could not remove the Lottery request.' }
  }

  return { ok: true }
}

export async function addLotteryListEntry(args: {
  actor: LotteryActor
  therapistId: string
  shiftType: LotteryShiftType
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!canManageList(args.actor.role)) {
    return { ok: false, error: 'Only leads or managers can edit the Lottery list.' }
  }

  const [profileResult, currentList] = await Promise.all([
    admin()
      .from('profiles')
      .select('id, full_name, employment_type, site_id, shift_type')
      .eq('id', args.therapistId)
      .maybeSingle(),
    loadLotteryList(args.actor.siteId, args.shiftType),
  ])

  if (profileResult.error || !profileResult.data) {
    if (profileResult.error)
      console.error('Failed to load Lottery list candidate:', profileResult.error)
    return { ok: false, error: 'Could not load that therapist.' }
  }

  const profile = profileResult.data as {
    id: string
    employment_type: EmploymentType | null
    site_id: string | null
    shift_type: LotteryShiftType | null
  }

  if (profile.site_id !== args.actor.siteId || profile.shift_type !== args.shiftType) {
    return { ok: false, error: 'That therapist is not on the selected shift at your site.' }
  }

  if (profile.employment_type !== 'full_time') {
    return { ok: false, error: 'Only full-time therapists belong on the Lottery list.' }
  }

  if (currentList.some((entry) => entry.therapistId === args.therapistId)) {
    return { ok: false, error: 'That therapist is already on the Lottery list.' }
  }

  const nextOrder = currentList.length + 1
  const { error } = await admin().from('lottery_list_entries').insert({
    site_id: args.actor.siteId,
    shift_type: args.shiftType,
    therapist_id: args.therapistId,
    display_order: nextOrder,
    created_by: args.actor.userId,
    updated_by: args.actor.userId,
  })

  if (error) {
    console.error('Failed to add Lottery list entry:', error)
    return { ok: false, error: 'Could not add that therapist to the Lottery list.' }
  }

  return { ok: true }
}

export async function moveLotteryListEntry(args: {
  actor: LotteryActor
  entryId: string
  shiftType: LotteryShiftType
  direction: 'up' | 'down'
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!canManageList(args.actor.role)) {
    return { ok: false, error: 'Only leads or managers can edit the Lottery list.' }
  }

  const list = await loadLotteryList(args.actor.siteId, args.shiftType)
  const index = list.findIndex((entry) => entry.id === args.entryId)
  if (index === -1) {
    return { ok: false, error: 'That Lottery list row no longer exists.' }
  }

  const swapIndex = args.direction === 'up' ? index - 1 : index + 1
  if (swapIndex < 0 || swapIndex >= list.length) {
    return { ok: true }
  }

  const current = list[index]
  const target = list[swapIndex]
  const currentOrder = current.fixedOrder
  const targetOrder = target.fixedOrder
  const temporaryOrder = list.length + 1

  const first = await admin()
    .from('lottery_list_entries')
    .update({
      display_order: temporaryOrder,
      updated_at: new Date().toISOString(),
      updated_by: args.actor.userId,
    })
    .eq('id', current.id)
  if (first.error) {
    console.error('Failed to move Lottery list row (step 1):', first.error)
    return { ok: false, error: 'Could not reorder the Lottery list.' }
  }

  const second = await admin()
    .from('lottery_list_entries')
    .update({
      display_order: currentOrder,
      updated_at: new Date().toISOString(),
      updated_by: args.actor.userId,
    })
    .eq('id', target.id)
  if (second.error) {
    console.error('Failed to move Lottery list row (step 2):', second.error)
    return { ok: false, error: 'Could not reorder the Lottery list.' }
  }

  const third = await admin()
    .from('lottery_list_entries')
    .update({
      display_order: targetOrder,
      updated_at: new Date().toISOString(),
      updated_by: args.actor.userId,
    })
    .eq('id', current.id)
  if (third.error) {
    console.error('Failed to move Lottery list row (step 3):', third.error)
    return { ok: false, error: 'Could not reorder the Lottery list.' }
  }

  return { ok: true }
}

async function loadShiftStatusMutationContext(args: { shiftId: string }): Promise<{
  shiftId: string
  therapistId: string | null
  therapistName: string
  employmentType: EmploymentType | null
  shiftDate: string
  shiftType: LotteryShiftType
  siteId: string
  published: boolean
  previousStatus: AssignmentStatus
} | null> {
  const { data, error } = await admin()
    .from('shifts')
    .select(
      'id, site_id, user_id, date, shift_type, status, schedule_cycles!shifts_cycle_id_fkey(published), profiles:profiles!shifts_user_id_fkey(full_name, employment_type)'
    )
    .eq('id', args.shiftId)
    .maybeSingle()

  if (error || !data) {
    if (error) console.error('Failed to load shift mutation context for Lottery:', error)
    return null
  }

  const row = data as SlotShiftRow
  const profile = getOne(row.profiles)
  const activeCodes = await fetchActiveOperationalCodeMap(admin(), [row.id])

  return {
    shiftId: row.id,
    therapistId: row.user_id ?? null,
    therapistName: profile?.full_name?.trim() || 'Unknown therapist',
    employmentType: profile?.employment_type ?? null,
    shiftDate: row.date,
    shiftType: row.shift_type,
    siteId: row.site_id ?? '',
    published: Boolean(getOne(row.schedule_cycles)?.published),
    previousStatus: resolveLiveAssignmentStatus(row.status, activeCodes.get(row.id)),
  }
}

type SupabaseRpcClient = {
  rpc: (
    fn: string,
    args: {
      p_assignment_id: string
      p_status: AssignmentStatus
      p_note?: string | null
      p_left_early_time?: string | null
    }
  ) => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>
}

export async function updateAssignmentStatusWithLottery(args: {
  authClient: SupabaseRpcClient
  actor: LotteryActor
  shiftId: string
  nextStatus: AssignmentStatus
  note?: string | null
  decisionId?: string | null
  overrideApplied?: boolean
}): Promise<
  { ok: true; previousStatus: AssignmentStatus } | { ok: false; error: string; code?: string }
> {
  const context = await loadShiftStatusMutationContext({ shiftId: args.shiftId })
  if (!context || !context.siteId) {
    return { ok: false, error: 'Could not load the current shift state.' }
  }

  const rpcResult = await args.authClient.rpc('update_assignment_status', {
    p_assignment_id: args.shiftId,
    p_status: args.nextStatus,
    p_note: args.note ?? null,
    p_left_early_time: null,
  })

  if (rpcResult.error) {
    return {
      ok: false,
      error: rpcResult.error.message || 'Could not update assignment status.',
      code: rpcResult.error.code,
    }
  }

  if (!context.published || !context.therapistId) {
    return { ok: true, previousStatus: context.previousStatus }
  }

  if (context.employmentType === 'part_time') {
    return { ok: true, previousStatus: context.previousStatus }
  }

  const [activeRequestRows, suppressedRequestRows] = await Promise.all([
    admin()
      .from('lottery_requests')
      .select('id')
      .eq('site_id', context.siteId)
      .eq('therapist_id', context.therapistId)
      .eq('shift_date', context.shiftDate)
      .eq('shift_type', context.shiftType)
      .eq('state', 'active'),
    admin()
      .from('lottery_requests')
      .select('id')
      .eq('site_id', context.siteId)
      .eq('therapist_id', context.therapistId)
      .eq('shift_date', context.shiftDate)
      .eq('shift_type', context.shiftType)
      .eq('state', 'suppressed_status'),
  ])

  const reconciliation = deriveLotteryStatusReconciliation({
    previousStatus: context.previousStatus,
    nextStatus: args.nextStatus,
    hasActiveRequest: (activeRequestRows.data ?? []).length > 0,
    hasSuppressedStatusRequest: (suppressedRequestRows.data ?? []).length > 0,
  })

  if (reconciliation.invalidatePreviousHistory) {
    const { data: currentHistory } = await admin()
      .from('lottery_history_entries')
      .select('id')
      .eq('shift_id', context.shiftId)
      .eq('therapist_id', context.therapistId)
      .is('invalidated_at', null)
      .order('created_at', { ascending: false })
      .limit(1)

    const currentHistoryId = ((currentHistory ?? []) as Array<{ id: string }>)[0]?.id
    if (currentHistoryId) {
      const reason =
        args.nextStatus === 'on_call' || args.nextStatus === 'cancelled'
          ? 'status_changed'
          : 'status_reverted'
      const { error } = await admin()
        .from('lottery_history_entries')
        .update({
          invalidated_at: new Date().toISOString(),
          invalidated_by: args.actor.userId,
          invalidated_reason: reason,
        })
        .eq('id', currentHistoryId)
      if (error) {
        console.error('Failed to invalidate Lottery history entry:', error)
      }
    }
  }

  if (reconciliation.suppressActiveRequest) {
    const { error } = await admin()
      .from('lottery_requests')
      .update({
        state: 'suppressed_status',
        suppressed_at: new Date().toISOString(),
        suppressed_by: args.actor.userId,
      })
      .eq('site_id', context.siteId)
      .eq('therapist_id', context.therapistId)
      .eq('shift_date', context.shiftDate)
      .eq('shift_type', context.shiftType)
      .eq('state', 'active')
    if (error) {
      console.error('Failed to suppress Lottery request after status change:', error)
    }
  }

  if (reconciliation.createHistoryEntry) {
    const { error } = await admin()
      .from('lottery_history_entries')
      .insert({
        site_id: context.siteId,
        shift_id: context.shiftId,
        decision_id: args.decisionId ?? null,
        therapist_id: context.therapistId,
        shift_date: context.shiftDate,
        shift_type: context.shiftType,
        applied_status: args.nextStatus,
        created_by: args.actor.userId,
        override_applied: args.overrideApplied === true,
      })
    if (error) {
      console.error('Failed to insert Lottery history entry:', error)
    }
  }

  if (reconciliation.restoreSuppressedRequest) {
    const { data: suppressedRows } = await admin()
      .from('lottery_requests')
      .select('id')
      .eq('site_id', context.siteId)
      .eq('therapist_id', context.therapistId)
      .eq('shift_date', context.shiftDate)
      .eq('shift_type', context.shiftType)
      .eq('state', 'suppressed_status')
      .order('requested_at', { ascending: true })
      .limit(1)

    const suppressedId = ((suppressedRows ?? []) as Array<{ id: string }>)[0]?.id
    if (suppressedId) {
      const { error } = await admin()
        .from('lottery_requests')
        .update({
          state: 'active',
          restored_at: new Date().toISOString(),
          restored_by: args.actor.userId,
        })
        .eq('id', suppressedId)
      if (error) {
        console.error('Failed to restore Lottery request after undo:', error)
      } else {
        const { data: invalidatedRows } = await admin()
          .from('lottery_history_entries')
          .select('id')
          .eq('shift_id', context.shiftId)
          .eq('therapist_id', context.therapistId)
          .not('invalidated_at', 'is', null)
          .order('invalidated_at', { ascending: false })
          .limit(1)

        const invalidatedId = ((invalidatedRows ?? []) as Array<{ id: string }>)[0]?.id
        if (invalidatedId) {
          const historyUpdate = await admin()
            .from('lottery_history_entries')
            .update({ request_restored: true })
            .eq('id', invalidatedId)
          if (historyUpdate.error) {
            console.error(
              'Failed to mark Lottery request restoration on history entry:',
              historyUpdate.error
            )
          }
        }
      }
    }
  }

  return { ok: true, previousStatus: context.previousStatus }
}

export async function applyLotteryDecision(args: {
  actor: LotteryActor
  authClient: SupabaseRpcClient
  shiftDate: string
  shiftType: LotteryShiftType
  keepToWork: number
  contextSignature: string
  actions: LotteryDecisionInputAction[]
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!canApplyLottery(args.actor.role)) {
    return { ok: false, error: 'Only leads or managers can apply Lottery results.' }
  }

  const snapshot = await loadLotterySnapshot({
    actor: args.actor,
    shiftDate: args.shiftDate,
    shiftType: args.shiftType,
    keepToWork: args.keepToWork,
  })

  if (!snapshot.recommendation) {
    return {
      ok: false,
      error: snapshot.recommendationError ?? 'A recommendation is required before applying.',
    }
  }

  if (snapshot.recommendation.contextSignature !== args.contextSignature) {
    return { ok: false, error: 'The Lottery slot changed. Refresh the preview before applying.' }
  }

  const recommendedSignature = stringifyActions(snapshot.recommendation.actions)
  const appliedActions = snapshot.recommendation.actions.map((action) => ({
    therapistId: action.therapistId,
    therapistName: action.therapistName,
    status: action.status,
  }))
  const overrideApplied =
    stringifyActions(
      args.actions.map((action) => ({
        therapistId: action.therapistId,
        therapistName:
          appliedActions.find((applied) => applied.therapistId === action.therapistId)
            ?.therapistName ?? action.therapistId,
        status: action.status,
      }))
    ) !== recommendedSignature

  if (overrideApplied && args.actor.role !== 'manager') {
    return { ok: false, error: 'Only managers can override the recommended result.' }
  }

  if (args.actions.length !== snapshot.recommendation.reductionsNeeded) {
    return {
      ok: false,
      error: `Apply exactly ${snapshot.recommendation.reductionsNeeded} reduction action${snapshot.recommendation.reductionsNeeded === 1 ? '' : 's'}.`,
    }
  }

  const onCallCount = args.actions.filter((action) => action.status === 'on_call').length
  const cancelledCount = args.actions.filter((action) => action.status === 'cancelled').length
  if (args.actions.length === 1 && onCallCount !== 1) {
    return { ok: false, error: 'A single reduction must be recorded as on call.' }
  }
  if (
    args.actions.length > 1 &&
    (onCallCount !== 1 || cancelledCount !== args.actions.length - 1)
  ) {
    return {
      ok: false,
      error:
        'Multi-person reductions must have exactly one on-call therapist and cancel everyone else.',
    }
  }

  const actionSet = new Map(args.actions.map((action) => [action.therapistId, action.status]))
  const shiftAssignments = await loadSlotAssignments({
    siteId: args.actor.siteId,
    shiftDate: args.shiftDate,
    shiftType: args.shiftType,
  })
  const eligibleAssignments = shiftAssignments.filter(
    (assignment) => assignment.liveStatus === 'scheduled'
  )
  const targetAssignments = eligibleAssignments.filter((assignment) =>
    actionSet.has(assignment.therapistId)
  )

  if (targetAssignments.length !== args.actions.length) {
    return {
      ok: false,
      error: 'One or more selected therapists are no longer eligible for this Lottery slot.',
    }
  }

  const touched: Array<{ shiftId: string; previousStatus: AssignmentStatus }> = []
  for (const assignment of targetAssignments) {
    const nextStatus = actionSet.get(assignment.therapistId)
    if (!nextStatus) continue
    const result = await updateAssignmentStatusWithLottery({
      authClient: args.authClient,
      actor: args.actor,
      shiftId: assignment.shiftId,
      nextStatus,
      overrideApplied,
    })

    if (!result.ok) {
      for (const prior of touched.slice().reverse()) {
        await updateAssignmentStatusWithLottery({
          authClient: args.authClient,
          actor: args.actor,
          shiftId: prior.shiftId,
          nextStatus: prior.previousStatus,
        })
      }
      return { ok: false, error: result.error }
    }

    touched.push({ shiftId: assignment.shiftId, previousStatus: result.previousStatus })
  }

  const { error: supersedeError } = await admin()
    .from('lottery_decisions')
    .update({
      superseded_at: new Date().toISOString(),
      superseded_by: args.actor.userId,
    })
    .eq('site_id', args.actor.siteId)
    .eq('shift_date', args.shiftDate)
    .eq('shift_type', args.shiftType)
    .is('superseded_at', null)

  if (supersedeError) {
    console.error('Failed to supersede previous Lottery decisions:', supersedeError)
  }

  const appliedActionsView = args.actions
    .map((action) => {
      const assignment = targetAssignments.find((row) => row.therapistId === action.therapistId)
      return {
        therapistId: action.therapistId,
        therapistName: assignment?.therapistName ?? action.therapistId,
        status: action.status,
      } satisfies LotteryRecommendationActionView
    })
    .sort(
      (a, b) => a.status.localeCompare(b.status) || a.therapistName.localeCompare(b.therapistName)
    )

  const decisionInsert = await admin()
    .from('lottery_decisions')
    .insert({
      site_id: args.actor.siteId,
      shift_date: args.shiftDate,
      shift_type: args.shiftType,
      keep_to_work: args.keepToWork,
      scheduled_count: snapshot.recommendation.scheduledCount,
      reductions_needed: snapshot.recommendation.reductionsNeeded,
      context_signature: args.contextSignature,
      recommended_actions: snapshot.recommendation.actions,
      applied_actions: appliedActionsView,
      override_applied: overrideApplied,
      applied_by: args.actor.userId,
    })
    .select('id')
    .maybeSingle()

  if (decisionInsert.error || !decisionInsert.data) {
    console.error('Failed to insert Lottery decision:', decisionInsert.error)
    for (const prior of touched.slice().reverse()) {
      await updateAssignmentStatusWithLottery({
        authClient: args.authClient,
        actor: args.actor,
        shiftId: prior.shiftId,
        nextStatus: prior.previousStatus,
      })
    }
    return { ok: false, error: 'Could not save the applied Lottery result.' }
  }

  const decisionId = (decisionInsert.data as { id: string }).id
  const historyUpdate = await admin()
    .from('lottery_history_entries')
    .update({
      decision_id: decisionId,
      override_applied: overrideApplied,
    })
    .eq('site_id', args.actor.siteId)
    .eq('created_by', args.actor.userId)
    .in(
      'shift_id',
      touched.map((item) => item.shiftId)
    )
    .is('decision_id', null)

  if (historyUpdate.error) {
    console.error('Failed to attach Lottery history entries to decision:', historyUpdate.error)
  }

  return { ok: true }
}
