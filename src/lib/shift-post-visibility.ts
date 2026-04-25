type ViewerRole = 'manager' | 'therapist' | 'lead'

export function canUserSeeShiftPost(
  post: {
    visibility: 'team' | 'direct' | null | undefined
    posted_by: string | null
    claimed_by: string | null
  },
  userId: string,
  role: ViewerRole
): boolean {
  if (role === 'manager') return true
  if ((post.visibility ?? 'team') !== 'direct') return true
  return post.posted_by === userId || post.claimed_by === userId
}
