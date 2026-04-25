type SupabaseLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- shared cleanup helper only relies on a small fluent subset.
  from: (table: string) => any
}

export async function closePendingShiftPostsForShiftIds(
  supabase: SupabaseLike,
  shiftIds: string[],
  reason: string
): Promise<void> {
  const targetShiftIds = Array.from(new Set(shiftIds.filter(Boolean)))
  if (targetShiftIds.length === 0) return

  const { data: pendingPosts, error: pendingPostsError } = await supabase
    .from('shift_posts')
    .select('id')
    .in('shift_id', targetShiftIds)
    .eq('status', 'pending')

  if (pendingPostsError) {
    console.error('Could not load pending shift posts for cleanup:', pendingPostsError)
    return
  }

  const postIds = ((pendingPosts ?? []) as Array<{ id: string | null }>)
    .map((row) => row.id)
    .filter((id): id is string => Boolean(id))

  if (postIds.length === 0) return

  const nowIso = new Date().toISOString()
  const { error: postUpdateError } = await supabase
    .from('shift_posts')
    .update({
      status: 'denied',
      override_reason: reason,
    })
    .in('id', postIds)

  if (postUpdateError) {
    console.error('Could not close stale shift posts during cleanup:', postUpdateError)
    return
  }

  const { error: interestUpdateError } = await supabase
    .from('shift_post_interests')
    .update({
      status: 'declined',
      responded_at: nowIso,
    })
    .in('shift_post_id', postIds)
    .in('status', ['pending', 'selected'])

  if (interestUpdateError) {
    console.error('Could not close stale pickup interests during cleanup:', interestUpdateError)
  }
}

export async function preserveShiftPostHistoryBeforeShiftDeletion(
  supabase: SupabaseLike,
  shiftIds: string[],
  reason: string
): Promise<void> {
  const targetShiftIds = Array.from(new Set(shiftIds.filter(Boolean)))
  if (targetShiftIds.length === 0) return

  const { data: linkedPosts, error: linkedPostsError } = await supabase
    .from('shift_posts')
    .select('id, status')
    .in('shift_id', targetShiftIds)

  if (linkedPostsError) {
    console.error('Could not load shift posts before shift deletion:', linkedPostsError)
    return
  }

  const allPostIds = ((linkedPosts ?? []) as Array<{ id: string | null; status: string | null }>)
    .map((row) => row.id)
    .filter((id): id is string => Boolean(id))

  if (allPostIds.length === 0) return

  const pendingPostIds = (
    (linkedPosts ?? []) as Array<{ id: string | null; status: string | null }>
  )
    .filter((row) => row.status === 'pending' && Boolean(row.id))
    .map((row) => row.id as string)

  if (pendingPostIds.length > 0) {
    const { error: pendingUpdateError } = await supabase
      .from('shift_posts')
      .update({
        status: 'denied',
        override_reason: reason,
        shift_id: null,
      })
      .in('id', pendingPostIds)

    if (pendingUpdateError) {
      console.error(
        'Could not preserve pending shift posts before shift deletion:',
        pendingUpdateError
      )
      return
    }

    const { error: interestUpdateError } = await supabase
      .from('shift_post_interests')
      .update({
        status: 'declined',
        responded_at: new Date().toISOString(),
      })
      .in('shift_post_id', pendingPostIds)
      .in('status', ['pending', 'selected'])

    if (interestUpdateError) {
      console.error('Could not close pickup interests before shift deletion:', interestUpdateError)
    }
  }

  const historicalPostIds = allPostIds.filter((id) => !pendingPostIds.includes(id))
  if (historicalPostIds.length === 0) return

  const { error: historyUpdateError } = await supabase
    .from('shift_posts')
    .update({ shift_id: null })
    .in('id', historicalPostIds)

  if (historyUpdateError) {
    console.error(
      'Could not preserve shift post history before shift deletion:',
      historyUpdateError
    )
  }
}
