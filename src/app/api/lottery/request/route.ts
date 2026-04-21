import { NextResponse } from 'next/server'

import { addLotteryRequest, loadLotteryActor, removeLotteryRequest } from '@/lib/lottery/service'
import { isTrustedMutationRequest } from '@/lib/security/request-origin'
import { createClient } from '@/lib/supabase/server'

type LotteryRequestPayload = {
  action?: 'add' | 'remove'
  therapistId?: string
  shiftDate?: string
  shiftType?: 'day' | 'night'
  requestedAt?: string | null
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

  const payload = (await request.json().catch(() => null)) as LotteryRequestPayload | null
  const action = payload?.action
  const therapistId = String(payload?.therapistId ?? actor.userId).trim()
  const shiftDate = String(payload?.shiftDate ?? '').trim()
  const shiftType = payload?.shiftType === 'night' ? 'night' : 'day'

  if (!action || !shiftDate) {
    return NextResponse.json({ error: 'Shift date and action are required.' }, { status: 400 })
  }

  const result =
    action === 'add'
      ? await addLotteryRequest({
          actor,
          therapistId,
          shiftDate,
          shiftType,
          requestedAt: payload?.requestedAt ?? null,
        })
      : await removeLotteryRequest({
          actor,
          therapistId,
          shiftDate,
          shiftType,
        })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
