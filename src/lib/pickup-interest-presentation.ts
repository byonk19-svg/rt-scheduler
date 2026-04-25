export type PickupInterestStatus = 'pending' | 'selected'

export type PickupInterestCandidate = {
  id: string
  therapistId: string
  therapistName: string
  createdAt: string
  status: PickupInterestStatus
}

export function sortPickupInterestCandidates<
  T extends { id: string; createdAt: string; status: PickupInterestStatus },
>(candidates: T[]): T[] {
  return candidates.slice().sort((left, right) => {
    if (left.status === right.status) {
      const createdAtComparison = left.createdAt.localeCompare(right.createdAt)
      if (createdAtComparison !== 0) {
        return createdAtComparison
      }

      return left.id.localeCompare(right.id)
    }
    return left.status === 'selected' ? -1 : 1
  })
}

export function partitionPickupInterestQueue<
  T extends { id: string; createdAt: string; status: PickupInterestStatus },
>(
  candidates: T[]
): {
  orderedCandidates: T[]
  primaryCandidate: T | null
  backupCandidates: T[]
} {
  const orderedCandidates = sortPickupInterestCandidates(candidates)
  const primaryCandidate =
    orderedCandidates.find((candidate) => candidate.status === 'selected') ?? null
  const backupCandidates = primaryCandidate
    ? orderedCandidates.filter((candidate) => candidate.id !== primaryCandidate.id)
    : orderedCandidates

  return {
    orderedCandidates,
    primaryCandidate,
    backupCandidates,
  }
}

export function getPickupInterestTherapistCopy(status: PickupInterestStatus): {
  roleLabel: 'Primary claimant' | 'Backup interest'
  helperText: string
} {
  if (status === 'selected') {
    return {
      roleLabel: 'Primary claimant',
      helperText: 'You are currently first in line for this pickup request.',
    }
  }

  return {
    roleLabel: 'Backup interest',
    helperText: 'You are still interested and listed as a backup for this pickup request.',
  }
}
