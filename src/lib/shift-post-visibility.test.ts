import { describe, expect, it } from 'vitest'

import { canUserSeeShiftPost } from '@/lib/shift-post-visibility'

describe('canUserSeeShiftPost', () => {
  it('keeps direct requests private to the requester, recipient, and managers', () => {
    const direct = {
      visibility: 'direct' as const,
      posted_by: 'poster-1',
      claimed_by: 'recipient-1',
    }

    expect(canUserSeeShiftPost(direct, 'poster-1', 'therapist')).toBe(true)
    expect(canUserSeeShiftPost(direct, 'recipient-1', 'therapist')).toBe(true)
    expect(canUserSeeShiftPost(direct, 'manager-1', 'manager')).toBe(true)
    expect(canUserSeeShiftPost(direct, 'other-1', 'therapist')).toBe(false)
  })

  it('keeps team posts visible to everyone on the shared board', () => {
    const post = {
      visibility: 'team' as const,
      posted_by: 'poster-1',
      claimed_by: null,
    }

    expect(canUserSeeShiftPost(post, 'other-1', 'therapist')).toBe(true)
  })
})
