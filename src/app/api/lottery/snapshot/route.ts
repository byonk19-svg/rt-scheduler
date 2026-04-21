import { NextResponse } from 'next/server'

import { loadLotteryActor, loadLotterySnapshot } from '@/lib/lottery/service'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const actor = await loadLotteryActor(user.id)
  if (!actor) {
    return NextResponse.json({ error: 'Could not load Lottery access.' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const keepToWorkRaw = searchParams.get('keepToWork')
  const keepToWork = keepToWorkRaw == null || keepToWorkRaw.trim() === '' ? null : Number(keepToWorkRaw)

  const snapshot = await loadLotterySnapshot({
    actor,
    shiftDate: searchParams.get('date'),
    shiftType: searchParams.get('shift') === 'night' ? 'night' : 'day',
    keepToWork: Number.isFinite(keepToWork) ? Math.trunc(keepToWork as number) : null,
  })

  return NextResponse.json({ snapshot })
}
