import { createClient } from '@/lib/supabase/server'
import { isTrustedMutationRequest } from '@/lib/security/request-origin'
import { toIsoDate } from '@/lib/calendar-utils'
import { SCHEDULE_MUTATION_ERROR_CODES as ERROR_CODES } from '@/lib/schedule-mutations/errors'
import { assignScheduleShift } from '@/lib/schedule-mutations/assign-shift'
import { authorizeScheduleMutationManager } from '@/lib/schedule-mutations/authorize-manager'
import { loadScheduleMutationCycle } from '@/lib/schedule-mutations/load-cycle'
import { moveScheduleShift } from '@/lib/schedule-mutations/move-shift'
import { removeScheduleShift } from '@/lib/schedule-mutations/remove-shift'
import { setScheduleMutationLead } from '@/lib/schedule-mutations/set-lead'
import { scheduleMutationErrorResponse } from '@/lib/schedule-mutations/mutation-response'
import { parseActionBody } from '@/lib/schedule-mutations/parse-action-body'
import { fetchActiveOperationalCodeMap } from '@/lib/operational-codes'

type ShiftSlotRow = {
  id: string
}

async function slotHasActiveOperationalEntries(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cycleId: string,
  date: string,
  shiftType: 'day' | 'night'
): Promise<boolean> {
  const { data, error } = await supabase
    .from('shifts')
    .select('id')
    .eq('cycle_id', cycleId)
    .eq('date', date)
    .eq('shift_type', shiftType)

  if (error) {
    console.error('Could not load slot shifts for post-publish audit:', error)
    return false
  }

  const shiftIds = ((data ?? []) as ShiftSlotRow[]).map((shift) => shift.id).filter(Boolean)
  if (shiftIds.length === 0) return false

  const activeOperationalEntries = await fetchActiveOperationalCodeMap(supabase, shiftIds)
  return activeOperationalEntries.size > 0
}

async function shouldLogPostPublishModificationForSlot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cycleId: string,
  date: string,
  shiftType: 'day' | 'night',
  cyclePublished: boolean
): Promise<boolean> {
  if (cyclePublished) {
    return true
  }

  if (date < toIsoDate(new Date())) {
    return true
  }

  return await slotHasActiveOperationalEntries(supabase, cycleId, date, shiftType)
}

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) {
    return scheduleMutationErrorResponse('Invalid request origin.', ERROR_CODES.forbidden, 403)
  }

  const supabase = await createClient()
  const authorization = await authorizeScheduleMutationManager(supabase)
  if (!authorization.ok) {
    return scheduleMutationErrorResponse(
      authorization.error,
      authorization.code,
      authorization.status
    )
  }
  const { managerSiteId, userId } = authorization

  const payload = parseActionBody(await request.json().catch(() => null))

  if (!payload) {
    return scheduleMutationErrorResponse('Invalid request body', ERROR_CODES.invalidBody, 400)
  }

  const cycleLoad = await loadScheduleMutationCycle(supabase, payload.cycleId, managerSiteId)
  if (!cycleLoad.ok) {
    return scheduleMutationErrorResponse(cycleLoad.error, cycleLoad.code, cycleLoad.status)
  }
  const { cycle } = cycleLoad

  const { data: activePreliminarySnapshot } = await supabase
    .from('preliminary_snapshots')
    .select('id')
    .eq('cycle_id', payload.cycleId)
    .eq('status', 'active')
    .maybeSingle()
  const preliminaryActive = Boolean(activePreliminarySnapshot) && !Boolean(cycle.published)

  if (payload.action === 'assign') {
    return assignScheduleShift(supabase, {
      payload,
      cycle,
      managerSiteId,
      actorId: userId,
      preliminaryActive,
      shouldLogPostPublishModification: ({ cycleId, date, shiftType, cyclePublished }) =>
        shouldLogPostPublishModificationForSlot(supabase, cycleId, date, shiftType, cyclePublished),
    })
  }

  if (payload.action === 'move') {
    return moveScheduleShift(supabase, {
      payload,
      cycle,
      managerSiteId,
      actorId: userId,
      preliminaryActive,
      shouldLogPostPublishModification: ({ cycleId, date, shiftType, cyclePublished }) =>
        shouldLogPostPublishModificationForSlot(supabase, cycleId, date, shiftType, cyclePublished),
    })
  }

  if (payload.action === 'remove') {
    return removeScheduleShift(supabase, {
      payload,
      cycle,
      managerSiteId,
      actorId: userId,
      preliminaryActive,
      shouldLogPostPublishModification: ({ cycleId, date, shiftType, cyclePublished }) =>
        shouldLogPostPublishModificationForSlot(supabase, cycleId, date, shiftType, cyclePublished),
    })
  }

  if (payload.action === 'set_lead') {
    return setScheduleMutationLead(supabase, {
      payload,
      cycle,
      managerSiteId,
      actorId: userId,
      preliminaryActive,
      shouldLogPostPublishModification: ({ cycleId, date, shiftType, cyclePublished }) =>
        shouldLogPostPublishModificationForSlot(supabase, cycleId, date, shiftType, cyclePublished),
    })
  }

  return scheduleMutationErrorResponse('Unsupported action', ERROR_CODES.unsupportedAction, 400)
}
