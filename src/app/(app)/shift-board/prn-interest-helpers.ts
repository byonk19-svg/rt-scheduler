// This file defines a ShiftBoardRequest type that is structurally compatible with
// the local type in page.tsx. Verify before using: page.tsx defines
// `type RequestType = 'swap' | 'pickup'`. If that ever changes,
// update this file to match. The two types are intentionally kept in sync rather than
// one importing from the other, because page.tsx is a 'use client' file and the helper
// is used in tests that run outside of Next.js.

export type ShiftBoardRequest = {
  id: string
  type: 'swap' | 'pickup'
  poster: string
  avatar: string
  shift: string
  shiftDate: string | null
  shiftId: string | null
  message: string
  status: 'pending' | 'approved' | 'denied' | 'expired'
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
  candidates: ShiftBoardRequest[]
}

/**
 * Groups pending pickup posts by shiftId and sorts candidates within each group
 * by postedAt ascending (earliest submission first - PRD §6.1).
 * Only includes pending pickup requests.
 */
export function groupPickupsBySlot(requests: ShiftBoardRequest[]): SlotCandidateGroup[] {
  const byShift = new Map<string, ShiftBoardRequest[]>()

  for (const req of requests) {
    if (req.type !== 'pickup' || req.status !== 'pending') continue
    if (!req.shiftId) continue
    const bucket = byShift.get(req.shiftId) ?? []
    bucket.push(req)
    byShift.set(req.shiftId, bucket)
  }

  return Array.from(byShift.entries()).map(([shiftId, candidates]) => ({
    shiftId,
    shiftLabel: candidates[0]?.shift ?? shiftId,
    candidates: candidates.slice().sort((a, b) => a.postedAt.localeCompare(b.postedAt)),
  }))
}
