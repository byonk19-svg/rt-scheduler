import { toRequestUiStatus, type PersistedRequestStatus } from '@/lib/request-workflow'

export type ManagerActionShiftPostRow = {
  id: string
  type: 'swap' | 'pickup'
  status: PersistedRequestStatus
  created_at: string
  claimed_by: string | null
  visibility: 'team' | 'direct' | null
  recipient_response: 'pending' | 'accepted' | 'declined' | null
}

export type ManagerActionShiftPostInterestRow = {
  shift_post_id: string
  status: 'pending' | 'selected' | 'declined' | 'withdrawn'
}

export function countManagerActionableShiftPosts({
  posts,
  interests,
}: {
  posts: ManagerActionShiftPostRow[]
  interests: ManagerActionShiftPostInterestRow[]
}): number {
  const activeInterestCountByPostId = new Map<string, number>()

  for (const interest of interests) {
    if (interest.status !== 'pending' && interest.status !== 'selected') continue
    activeInterestCountByPostId.set(
      interest.shift_post_id,
      (activeInterestCountByPostId.get(interest.shift_post_id) ?? 0) + 1
    )
  }

  return posts.filter((post) => {
    if (toRequestUiStatus(post.status, post.created_at) !== 'pending') return false

    const visibility = post.visibility ?? 'team'
    const activeInterestCount = activeInterestCountByPostId.get(post.id) ?? 0

    if (visibility === 'direct' && post.recipient_response !== 'accepted') return false
    if (post.type === 'pickup' && visibility === 'team') return activeInterestCount > 0
    if (post.type === 'pickup' && visibility === 'direct') return Boolean(post.claimed_by)
    if (post.type === 'swap') return Boolean(post.claimed_by)

    return false
  }).length
}

export function buildManagerReviewSummary({
  shiftPostReviewCount,
  preliminaryApprovalCount,
}: {
  shiftPostReviewCount: number
  preliminaryApprovalCount: number
}): {
  count: number
  detail: string
  href: string
} {
  const count = shiftPostReviewCount + preliminaryApprovalCount

  if (count === 0) {
    return {
      count,
      detail: 'You are caught up.',
      href: '/schedule',
    }
  }

  const parts = []
  if (shiftPostReviewCount > 0) {
    parts.push(
      `${shiftPostReviewCount} Shift Board ${shiftPostReviewCount === 1 ? 'decision' : 'decisions'}`
    )
  }
  if (preliminaryApprovalCount > 0) {
    parts.push(
      `${preliminaryApprovalCount} preliminary ${preliminaryApprovalCount === 1 ? 'approval' : 'approvals'}`
    )
  }

  return {
    count,
    detail: `${parts.join(' and ')} waiting.`,
    href: shiftPostReviewCount > 0 ? '/shift-board' : '/approvals',
  }
}
