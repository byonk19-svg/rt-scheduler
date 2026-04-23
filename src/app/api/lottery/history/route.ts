import { NextResponse } from 'next/server'

import { loadLotteryActor, loadLotteryHistory } from '@/lib/lottery/service'
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
  const therapistId = String(searchParams.get('therapistId') ?? '').trim()
  const shiftType = searchParams.get('shift') === 'night' ? 'night' : 'day'

  if (!therapistId) {
    return NextResponse.json({ error: 'Therapist is required.' }, { status: 400 })
  }

  const history = await loadLotteryHistory({
    actor,
    therapistId,
    shiftType,
  })

  return NextResponse.json({ history })
}
