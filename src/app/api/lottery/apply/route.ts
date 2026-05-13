import { NextResponse } from 'next/server'

import { applyLotteryDecision, loadLotteryActor } from '@/lib/lottery/service'
import { isTrustedMutationRequest } from '@/lib/security/request-origin'
import { writeAuditLog } from '@/lib/audit-log'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

type ApplyLotteryPayload = {
  shiftDate?: string
  shiftType?: 'day' | 'night'
  keepToWork?: number
  contextSignature?: string
  actions?: Array<{ therapistId: string; status: 'cancelled' | 'on_call' }>
}

type AppliedLotteryShiftRow = {
  id: string
}

async function writeLotteryPostPublishAuditLogs(params: {
  admin: ReturnType<typeof createAdminClient>
  actorId: string
  siteId: string
  shiftDate: string
  shiftType: 'day' | 'night'
  therapistIds: string[]
}): Promise<void> {
  const therapistIds = [...new Set(params.therapistIds.filter(Boolean))]
  if (therapistIds.length === 0) return

  const { data, error } = await params.admin
    .from('shifts')
    .select('id')
    .eq('site_id', params.siteId)
    .eq('date', params.shiftDate)
    .eq('shift_type', params.shiftType)
    .in('user_id', therapistIds)

  if (error) {
    console.error('Failed to load Lottery-modified shifts for audit:', error.message)
    return
  }

  for (const shift of (data ?? []) as AppliedLotteryShiftRow[]) {
    await writeAuditLog(params.admin as never, {
      userId: params.actorId,
      action: 'post_publish_modification',
      targetType: 'shift',
      targetId: shift.id,
    })
  }
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
    return NextResponse.json(
      { error: 'Shift date, keep-to-work, and preview context are required.' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()
  const sanitizedActions = actions.map((action) => ({
    therapistId: String(action.therapistId ?? '').trim(),
    status: action.status,
  }))
  const result = await applyLotteryDecision({
    actor,
    authClient: {
      rpc: admin.rpc.bind(admin),
    },
    shiftDate,
    shiftType: payload?.shiftType === 'night' ? 'night' : 'day',
    keepToWork,
    contextSignature,
    actions: sanitizedActions,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  await writeLotteryPostPublishAuditLogs({
    admin,
    actorId: user.id,
    siteId: actor.siteId,
    shiftDate,
    shiftType: payload?.shiftType === 'night' ? 'night' : 'day',
    therapistIds: sanitizedActions.map((action) => action.therapistId),
  })

  return NextResponse.json({ ok: true })
}
