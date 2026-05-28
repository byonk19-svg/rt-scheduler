import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  buildManagerReviewSummary,
  countManagerActionableShiftPosts,
  type ManagerActionShiftPostInterestRow,
  type ManagerActionShiftPostRow,
} from '@/lib/manager-action-work'

const basePost = {
  status: 'pending',
  created_at: '2026-04-28T12:00:00.000Z',
  claimed_by: null,
  visibility: 'team',
  recipient_response: null,
} satisfies Omit<ManagerActionShiftPostRow, 'id' | 'type'>

describe('manager action work', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-29T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('counts only pending shift posts that are ready for manager review', () => {
    const posts: ManagerActionShiftPostRow[] = [
      {
        ...basePost,
        id: 'pickup-with-interest',
        type: 'pickup',
      },
      {
        ...basePost,
        id: 'pickup-without-interest',
        type: 'pickup',
      },
      {
        ...basePost,
        id: 'direct-accepted-pickup',
        type: 'pickup',
        visibility: 'direct',
        recipient_response: 'accepted',
        claimed_by: 'therapist-2',
      },
      {
        ...basePost,
        id: 'direct-pending-swap',
        type: 'swap',
        visibility: 'direct',
        recipient_response: 'pending',
        claimed_by: 'therapist-3',
      },
      {
        ...basePost,
        id: 'swap-with-partner',
        type: 'swap',
        claimed_by: 'therapist-4',
      },
      {
        ...basePost,
        id: 'expired-pickup',
        type: 'pickup',
        created_at: '2026-04-27T11:59:59.000Z',
      },
    ]
    const interests: ManagerActionShiftPostInterestRow[] = [
      { shift_post_id: 'pickup-with-interest', status: 'pending' },
      { shift_post_id: 'expired-pickup', status: 'pending' },
      { shift_post_id: 'pickup-without-interest', status: 'withdrawn' },
    ]

    expect(countManagerActionableShiftPosts({ posts, interests })).toBe(3)
  })

  it('summarizes manager review work without relying on unread notifications', () => {
    expect(
      buildManagerReviewSummary({ shiftPostReviewCount: 2, preliminaryApprovalCount: 1 })
    ).toEqual({
      count: 3,
      detail: '2 Shift Board decisions and 1 preliminary approval waiting.',
      href: '/shift-board',
    })

    expect(
      buildManagerReviewSummary({ shiftPostReviewCount: 0, preliminaryApprovalCount: 2 })
    ).toEqual({
      count: 2,
      detail: '2 preliminary approvals waiting.',
      href: '/approvals',
    })

    expect(
      buildManagerReviewSummary({ shiftPostReviewCount: 0, preliminaryApprovalCount: 0 })
    ).toEqual({
      count: 0,
      detail: 'You are caught up.',
      href: '/schedule',
    })
  })
})
