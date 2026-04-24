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
} | null {
  if (request.claimedById) return null

  const candidates = request.interestCandidates.slice().sort((left, right) => {
    if (left.status === right.status) {
      return left.createdAt.localeCompare(right.createdAt)
    }
    return left.status === 'selected' ? -1 : 1
  })
  if (candidates.length === 0) return null

  const candidate =
    (selectedInterestId ? candidates.find((item) => item.id === selectedInterestId) : null) ??
    candidates.find((item) => item.status === 'selected') ??
    candidates[0]

  return {
    interestId: candidate.id,
    therapistId: candidate.therapistId,
    therapistName: candidate.therapistName,
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
} | null {
  const remaining = candidates.filter((candidate) => candidate.id !== removedInterestId)
  if (remaining.length === 0) return null

  const alreadySelected = remaining.find((candidate) => candidate.status === 'selected')
  if (alreadySelected) {
    return {
      interestId: alreadySelected.id,
      therapistId: alreadySelected.therapistId,
      therapistName: alreadySelected.therapistName,
    }
  }

  const nextCandidate = remaining
    .slice()
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))[0]

  if (!nextCandidate) return null

  return {
    interestId: nextCandidate.id,
    therapistId: nextCandidate.therapistId,
    therapistName: nextCandidate.therapistName,
  }
}
