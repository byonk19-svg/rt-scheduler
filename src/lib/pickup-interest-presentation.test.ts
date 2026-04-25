import { describe, expect, it } from 'vitest'

import {
  getPickupInterestTherapistCopy,
  partitionPickupInterestQueue,
} from '@/lib/pickup-interest-presentation'

describe('partitionPickupInterestQueue', () => {
  it('surfaces the selected therapist as the current primary claimant and keeps others as backups', () => {
    const queue = partitionPickupInterestQueue([
      {
        id: 'backup-2',
        therapistId: 'ther-3',
        therapistName: 'Casey',
        createdAt: '2026-04-24T09:00:00.000Z',
        status: 'pending' as const,
      },
      {
        id: 'primary',
        therapistId: 'ther-1',
        therapistName: 'Alex',
        createdAt: '2026-04-24T08:00:00.000Z',
        status: 'selected' as const,
      },
      {
        id: 'backup-1',
        therapistId: 'ther-2',
        therapistName: 'Blair',
        createdAt: '2026-04-24T08:30:00.000Z',
        status: 'pending' as const,
      },
    ])

    expect(queue.primaryCandidate?.id).toBe('primary')
    expect(queue.backupCandidates.map((candidate) => candidate.id)).toEqual([
      'backup-1',
      'backup-2',
    ])
    expect(queue.orderedCandidates.map((candidate) => candidate.id)).toEqual([
      'primary',
      'backup-1',
      'backup-2',
    ])
  })

  it('treats all interested therapists as backups when no primary claimant is selected yet', () => {
    const queue = partitionPickupInterestQueue([
      {
        id: 'interest-2',
        therapistId: 'ther-2',
        therapistName: 'Blair',
        createdAt: '2026-04-24T09:00:00.000Z',
        status: 'pending' as const,
      },
      {
        id: 'interest-1',
        therapistId: 'ther-1',
        therapistName: 'Alex',
        createdAt: '2026-04-24T08:00:00.000Z',
        status: 'pending' as const,
      },
    ])

    expect(queue.primaryCandidate).toBeNull()
    expect(queue.backupCandidates.map((candidate) => candidate.id)).toEqual([
      'interest-1',
      'interest-2',
    ])
  })

  it('breaks equal-timestamp ties by id so queue ordering stays deterministic', () => {
    const queue = partitionPickupInterestQueue([
      {
        id: 'interest-b',
        therapistId: 'ther-2',
        therapistName: 'Blair',
        createdAt: '2026-04-24T08:00:00.000Z',
        status: 'pending' as const,
      },
      {
        id: 'interest-a',
        therapistId: 'ther-1',
        therapistName: 'Alex',
        createdAt: '2026-04-24T08:00:00.000Z',
        status: 'pending' as const,
      },
    ])

    expect(queue.orderedCandidates.map((candidate) => candidate.id)).toEqual([
      'interest-a',
      'interest-b',
    ])
  })
})

describe('getPickupInterestTherapistCopy', () => {
  it('uses consistent therapist-facing wording for the current primary claimant', () => {
    expect(getPickupInterestTherapistCopy('selected')).toEqual({
      roleLabel: 'Primary claimant',
      helperText: 'You are currently first in line for this pickup request.',
    })
  })

  it('uses consistent therapist-facing wording for backup interest', () => {
    expect(getPickupInterestTherapistCopy('pending')).toEqual({
      roleLabel: 'Backup interest',
      helperText: 'You are still interested and listed as a backup for this pickup request.',
    })
  })
})
