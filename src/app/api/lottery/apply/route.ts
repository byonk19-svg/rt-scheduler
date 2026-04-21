import { NextResponse } from 'next/server'

import { applyLotteryDecision, loadLotteryActor } from '@/lib/lottery/service'
import { isTrustedMutationRequest } from '@/lib/security/request-origin'
import { createClient } from '@/lib/supabase/server'

type ApplyLotteryPayload = {
  shiftDate?: string
  shiftType?: 'day' | 'night'
  keepToWork?: number
  contextSignature?: string
  actions?: Array<{ therapistId: string; status: 'cancelled' | 'on_call' }>
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

  const payload = (await request.json().catch(() => null)) as ApplyLotteryPayload | null
  const shiftDate = String(payload?.shiftDate ?? '').trim()
  const keepToWork =
    typeof payload?.keepToWork === 'number' && Number.isFinite(payload.keepToWork)
      ? Math.trunc(payload.keepToWork)
      : null
  const contextSignature = String(payload?.contextSignature ?? '').trim()
  const actions = Array.isArray(payload?.actions) ? payload.actions : []

  if (!shiftDate || keepToWork == null || !contextSignature) {
    return NextResponse.json({ error: 'Shift date, keep-to-work, and preview context are required.' }, { status: 400 })
  }

  const result = await applyLotteryDecision({
    actor,
    authClient: {
      rpc: supabase.rpc.bind(supabase),
    },
    shiftDate,
    shiftType: payload?.shiftType === 'night' ? 'night' : 'day',
    keepToWork,
    contextSignature,
    actions: actions.map((action) => ({
      therapistId: String(action.therapistId ?? '').trim(),
      status: action.status,
    })),
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
