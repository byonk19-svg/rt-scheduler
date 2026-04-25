import { partitionPickupInterestQueue } from '@/lib/pickup-interest-presentation'

// This file defines a ShiftBoardRequest type that is structurally compatible with
// the local type in page.tsx. Verify before using: page.tsx defines
// `type RequestType = 'swap' | 'pickup'`. If that ever changes,
// update this file to match. The two types are intentionally kept in sync rather than
// one importing from the other, because page.tsx is a 'use client' file and the helper
// is used in tests that run outside of Next.js.

export type ShiftBoardRequest = {
  id: string
  type: 'swap' | 'pickup'
  visibility?: 'team' | 'direct'
  pendingInterestCount?: number
  interestCandidates?: Array<{
    id: string
    therapistId: string
    therapistName: string
    createdAt: string
    status?: 'pending' | 'selected'
  }>
  poster: string
  avatar: string
  shift: string
  shiftDate: string | null
  shiftId: string | null
  message: string
  status: 'pending' | 'approved' | 'denied' | 'expired' | 'withdrawn'
  posted: string
  postedAt: string
  swapWithName: string | null
  swapWithId: string | null
  shiftType: 'day' | 'night' | null
  shiftRole: 'lead' | 'staff' | null
  overrideReason: string | null
}

export type SlotCandidateGroup = {
  shiftId: string
  shiftLabel: string
  primaryCandidate: {
    id: string
    therapistId: string
    poster: string
    postedAt: string
    status: 'pending' | 'selected'
  } | null
  backupCandidates: Array<{
    id: string
    therapistId: string
    poster: string
    postedAt: string
    status: 'pending' | 'selected'
  }>
  candidates: Array<{
    id: string
    therapistId: string
    poster: string
    postedAt: string
    status: 'pending' | 'selected'
  }>
  requestId: string
}

/**
 * Groups pending pickup posts by shiftId and sorts candidates within each group
 * by postedAt ascending (earliest submission first - PRD §6.1).
 * Only includes pending pickup requests.
 */
export function groupPickupsBySlot(requests: ShiftBoardRequest[]): SlotCandidateGroup[] {
  const groups: SlotCandidateGroup[] = []

  for (const req of requests) {
    if (req.type !== 'pickup' || req.status !== 'pending') continue
    if (!req.shiftId) continue
    const { orderedCandidates, primaryCandidate, backupCandidates } = partitionPickupInterestQueue(
      (req.interestCandidates ?? []).map((candidate) => ({
        ...candidate,
        status: candidate.status ?? 'pending',
      }))
    )
    const pendingCandidates = orderedCandidates
    if (pendingCandidates.length === 0) continue
    groups.push({
      shiftId: req.shiftId,
      shiftLabel: req.shift,
      primaryCandidate: primaryCandidate
        ? {
            id: primaryCandidate.id,
            therapistId: primaryCandidate.therapistId,
            poster: primaryCandidate.therapistName,
            postedAt: primaryCandidate.createdAt,
            status: primaryCandidate.status,
          }
        : null,
      backupCandidates: backupCandidates.map((candidate) => ({
        id: candidate.id,
        therapistId: candidate.therapistId,
        poster: candidate.therapistName,
        postedAt: candidate.createdAt,
        status: candidate.status,
      })),
      requestId: req.id,
      candidates: pendingCandidates.map((candidate) => ({
        id: candidate.id,
        therapistId: candidate.therapistId,
        poster: candidate.therapistName,
        postedAt: candidate.createdAt,
        status: candidate.status ?? 'pending',
      })),
    })
  }

  return groups
}
