import type { EmploymentType } from '@/lib/shift-types'

export type LotteryCandidate = {
  id: string
  name: string
  employmentType: EmploymentType
  fixedOrder: number | null
  lastLotteriedDate: string | null
}

export type LotteryRequest = {
  therapistId: string
  therapistName: string
  requestedAt: string
}

export type LotteryActionStatus = 'cancelled' | 'on_call'

export type LotteryRecommendationAction = {
  therapistId: string
  therapistName: string
  status: LotteryActionStatus
}

export type LotteryRecommendation = {
  keepToWork: number
  scheduledCount: number
  reductionsNeeded: number
  actions: LotteryRecommendationAction[]
  prnInvolved: boolean
}

type BuildLotteryRecommendationArgs = {
  keepToWork: number
  scheduled: LotteryCandidate[]
  requests: LotteryRequest[]
}

function compareLotteryDates(a: string | null, b: string | null): number {
  if (!a && !b) return 0
  if (!a) return -1
  if (!b) return 1
  return a.localeCompare(b)
}

function compareByName(a: LotteryCandidate, b: LotteryCandidate): number {
  return a.name.localeCompare(b.name)
}

function rankFullTimeCandidates(scheduled: LotteryCandidate[]): LotteryCandidate[] {
  return scheduled
    .filter((candidate) => candidate.employmentType !== 'prn')
    .slice()
    .sort((a, b) => {
      const byDate = compareLotteryDates(a.lastLotteriedDate, b.lastLotteriedDate)
      if (byDate !== 0) return byDate

      const aOrder = a.fixedOrder ?? Number.MAX_SAFE_INTEGER
      const bOrder = b.fixedOrder ?? Number.MAX_SAFE_INTEGER
      if (aOrder !== bOrder) return aOrder - bOrder

      return compareByName(a, b)
    })
}

function sortRequestsBySignupOrder(requests: LotteryRequest[]): LotteryRequest[] {
  return requests
    .slice()
    .sort(
      (a, b) =>
        a.requestedAt.localeCompare(b.requestedAt) || a.therapistName.localeCompare(b.therapistName)
    )
}

function assignStatuses(queue: LotteryCandidate[]): LotteryRecommendationAction[] {
  if (queue.length === 0) return []
  if (queue.length === 1) {
    return [{ therapistId: queue[0].id, therapistName: queue[0].name, status: 'on_call' }]
  }

  return queue.map((candidate, index) => ({
    therapistId: candidate.id,
    therapistName: candidate.name,
    status: index === queue.length - 1 ? 'on_call' : 'cancelled',
  }))
}

export function buildLotteryRecommendation({
  keepToWork,
  scheduled,
  requests,
}: BuildLotteryRecommendationArgs): LotteryRecommendation {
  if (!Number.isInteger(keepToWork) || keepToWork < 0 || keepToWork > scheduled.length) {
    throw new Error('Keep-to-work must be an integer between 0 and the scheduled headcount.')
  }

  const scheduledCount = scheduled.length
  const reductionsNeeded = scheduledCount - keepToWork

  if (reductionsNeeded === 0) {
    return {
      keepToWork,
      scheduledCount,
      reductionsNeeded,
      actions: [],
      prnInvolved: false,
    }
  }

  const scheduledById = new Map(scheduled.map((candidate) => [candidate.id, candidate]))
  const volunteerQueue = sortRequestsBySignupOrder(requests)
    .map((entry) => scheduledById.get(entry.therapistId) ?? null)
    .filter((candidate): candidate is LotteryCandidate => Boolean(candidate))
    .filter((candidate) => candidate.employmentType !== 'prn')

  const volunteerIds = new Set(volunteerQueue.map((candidate) => candidate.id))
  const prnQueue = scheduled
    .filter((candidate) => candidate.employmentType === 'prn')
    .slice()
    .sort(compareByName)
  const rankedQueue = rankFullTimeCandidates(scheduled).filter(
    (candidate) => !volunteerIds.has(candidate.id)
  )

  let selected: LotteryCandidate[] = []

  if (volunteerQueue.length >= reductionsNeeded) {
    selected = volunteerQueue.slice(0, reductionsNeeded)
  } else if (volunteerQueue.length > 0) {
    const remainingNeeded = reductionsNeeded - volunteerQueue.length
    const selectedPrns = prnQueue.slice(0, remainingNeeded)
    const stillNeeded = remainingNeeded - selectedPrns.length
    selected = [
      ...selectedPrns,
      ...volunteerQueue,
      ...rankedQueue.slice(0, Math.max(stillNeeded, 0)),
    ]
  } else {
    selected = [...prnQueue, ...rankedQueue].slice(0, reductionsNeeded)
  }

  return {
    keepToWork,
    scheduledCount,
    reductionsNeeded,
    actions: assignStatuses(selected),
    prnInvolved: selected.some((candidate) => candidate.employmentType === 'prn'),
  }
}
