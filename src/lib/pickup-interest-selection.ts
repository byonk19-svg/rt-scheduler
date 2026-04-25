import { sortPickupInterestCandidates } from '@/lib/pickup-interest-presentation'

export function resolvePickupApprovalCandidate(
  request: {
    claimedById: string | null
    interestCandidates: Array<{
      id: string
      therapistId: string
      therapistName: string
      createdAt: string
      status: 'pending' | 'selected'
    }>
  },
  selectedInterestId: string | null
): {
  interestId: string
  therapistId: string
  therapistName: string
  status: 'pending' | 'selected'
} | null {
  if (request.claimedById) return null

  const candidates = sortPickupInterestCandidates(request.interestCandidates)
  if (candidates.length === 0) return null

  const candidate =
    (selectedInterestId ? candidates.find((item) => item.id === selectedInterestId) : null) ??
    candidates.find((item) => item.status === 'selected') ??
    candidates[0]

  return {
    interestId: candidate.id,
    therapistId: candidate.therapistId,
    therapistName: candidate.therapistName,
    status: candidate.status,
  }
}

export function resolveNextPickupQueueCandidate(
  candidates: Array<{
    id: string
    therapistId: string
    therapistName: string
    createdAt: string
    status: 'pending' | 'selected'
  }>,
  removedInterestId: string
): {
  interestId: string
  therapistId: string
  therapistName: string
  status: 'pending' | 'selected'
} | null {
  const remaining = candidates.filter((candidate) => candidate.id !== removedInterestId)
  if (remaining.length === 0) return null

  const alreadySelected = remaining.find((candidate) => candidate.status === 'selected')
  if (alreadySelected) {
    return {
      interestId: alreadySelected.id,
      therapistId: alreadySelected.therapistId,
      therapistName: alreadySelected.therapistName,
      status: alreadySelected.status,
    }
  }

  const nextCandidate = sortPickupInterestCandidates(remaining)[0]

  if (!nextCandidate) return null

  return {
    interestId: nextCandidate.id,
    therapistId: nextCandidate.therapistId,
    therapistName: nextCandidate.therapistName,
    status: nextCandidate.status,
  }
}
