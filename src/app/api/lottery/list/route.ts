import { NextResponse } from 'next/server'

import { addLotteryListEntry, loadLotteryActor, moveLotteryListEntry } from '@/lib/lottery/service'
import { isTrustedMutationRequest } from '@/lib/security/request-origin'
import { createClient } from '@/lib/supabase/server'

type LotteryListPayload = {
  action?: 'add' | 'move_up' | 'move_down'
  therapistId?: string
  entryId?: string
  shiftType?: 'day' | 'night'
}

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }

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

  const payload = (await request.json().catch(() => null)) as LotteryListPayload | null
  const action = payload?.action
  const shiftType = payload?.shiftType === 'night' ? 'night' : 'day'

  if (!action) {
    return NextResponse.json({ error: 'Action is required.' }, { status: 400 })
  }

  const result =
    action === 'add'
      ? await addLotteryListEntry({
          actor,
          therapistId: String(payload?.therapistId ?? '').trim(),
          shiftType,
        })
      : await moveLotteryListEntry({
          actor,
          entryId: String(payload?.entryId ?? '').trim(),
          shiftType,
          direction: action === 'move_up' ? 'up' : 'down',
        })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
