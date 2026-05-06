import { NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

type ShiftPostCounterpartyRow = {
  posted_by: string | null
  claimed_by: string | null
}

type ShiftPostInterestRow = {
  shift_post_id: string
}

type ProfileNameRow = {
  id: string
  full_name: string | null
}

function parseRequestedIds(request: Request) {
  const requestUrl = new URL(request.url)
  const rawIds = requestUrl.searchParams.get('ids') ?? ''
  return Array.from(
    new Set(
      rawIds
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    )
  ).slice(0, 50)
}

function addPostParties(allowedIds: Set<string>, rows: ShiftPostCounterpartyRow[] | null) {
  for (const row of rows ?? []) {
    if (row.posted_by) allowedIds.add(row.posted_by)
    if (row.claimed_by) allowedIds.add(row.claimed_by)
  }
}

export async function GET(request: Request) {
  const requestedIds = parseRequestedIds(request)
  if (requestedIds.length === 0) {
    return NextResponse.json({ profiles: [] })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const [ownPostsResult, interestRowsResult] = await Promise.all([
    admin
      .from('shift_posts')
      .select('posted_by, claimed_by')
      .or(`posted_by.eq.${user.id},claimed_by.eq.${user.id}`),
    admin.from('shift_post_interests').select('shift_post_id').eq('therapist_id', user.id),
  ])

  if (ownPostsResult.error || interestRowsResult.error) {
    return NextResponse.json({ error: 'counterparties_load_failed' }, { status: 500 })
  }

  const allowedIds = new Set<string>([user.id])
  addPostParties(allowedIds, ownPostsResult.data as ShiftPostCounterpartyRow[] | null)

  const interestPostIds = Array.from(
    new Set(
      ((interestRowsResult.data ?? []) as ShiftPostInterestRow[]).map((row) => row.shift_post_id)
    )
  )
  if (interestPostIds.length > 0) {
    const { data: interestPosts, error: interestPostsError } = await admin
      .from('shift_posts')
      .select('posted_by, claimed_by')
      .in('id', interestPostIds)

    if (interestPostsError) {
      return NextResponse.json({ error: 'counterparties_load_failed' }, { status: 500 })
    }

    addPostParties(allowedIds, interestPosts as ShiftPostCounterpartyRow[] | null)
  }

  const visibleIds = requestedIds.filter((id) => allowedIds.has(id))
  if (visibleIds.length === 0) {
    return NextResponse.json({ profiles: [] })
  }

  const { data: profiles, error: profilesError } = await admin
    .from('profiles')
    .select('id, full_name')
    .in('id', visibleIds)

  if (profilesError) {
    return NextResponse.json({ error: 'counterparties_load_failed' }, { status: 500 })
  }

  return NextResponse.json({
    profiles: ((profiles ?? []) as ProfileNameRow[]).map((profile) => ({
      id: profile.id,
      fullName: profile.full_name ?? 'Unknown therapist',
    })),
  })
}
