import {
  type PickupInterestCandidate,
  sortPickupInterestCandidates,
} from '@/lib/pickup-interest-presentation'

type PickupApprovalCandidate = {
  interestId: string
  therapistId: string
  therapistName: string
  status: 'pending' | 'selected'
}

function toApprovalCandidate(candidate: PickupInterestCandidate): PickupApprovalCandidate {
  return {
    interestId: candidate.id,
    therapistId: candidate.therapistId,
    therapistName: candidate.therapistName,
    status: candidate.status,
  }
}

export function resolvePickupApprovalCandidate(
  request: {
    claimedById: string | null
    interestCandidates: PickupInterestCandidate[]
  },
  selectedInterestId: string | null
): PickupApprovalCandidate | null {
  if (request.claimedById) return null

  const candidates = sortPickupInterestCandidates(request.interestCandidates)
  if (candidates.length === 0) return null

  const candidate =
    (selectedInterestId ? candidates.find((item) => item.id === selectedInterestId) : null) ??
    candidates.find((item) => item.status === 'selected') ??
    candidates[0]

  return toApprovalCandidate(candidate)
}

export function resolveNextPickupQueueCandidate(
  candidates: PickupInterestCandidate[],
  removedInterestId: string
): PickupApprovalCandidate | null {
  const remaining = candidates.filter((candidate) => candidate.id !== removedInterestId)
  if (remaining.length === 0) return null

  const alreadySelected = remaining.find((candidate) => candidate.status === 'selected')
  if (alreadySelected) {
    return toApprovalCandidate(alreadySelected)
  }

  const nextCandidate = sortPickupInterestCandidates(remaining)[0]

  if (!nextCandidate) return null

  return toApprovalCandidate(nextCandidate)
}
