import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

const ASSIGNMENT_STATUS_VALUES = [
  'scheduled',
  'call_in',
  'cancelled',
  'on_call',
  'left_early',
] as const

type AssignmentStatus = (typeof ASSIGNMENT_STATUS_VALUES)[number]

type UpdateAssignmentStatusRequest = {
  assignmentId?: string
  status?: AssignmentStatus
  note?: string | null
  leftEarlyTime?: string | null
}

type ActorProfile = {
  role: string
  is_lead_eligible: boolean | null
}

type RpcAssignmentStatusRow = {
  id: string
  assignment_status: AssignmentStatus
  status_note: string | null
  left_early_time: string | null
  status_updated_at: string | null
  status_updated_by: string | null
  status_updated_by_name: string | null
}

function isAllowedAssignmentStatus(value: string): value is AssignmentStatus {
  return ASSIGNMENT_STATUS_VALUES.includes(value as AssignmentStatus)
}

function canUpdateAssignmentStatus(profile: ActorProfile | null): boolean {
  if (!profile) return false
  if (profile.role === 'manager' || profile.role === 'lead') return true
  return (profile.role === 'therapist' || profile.role === 'staff') && profile.is_lead_eligible === true
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = (await request.json().catch(() => null)) as UpdateAssignmentStatusRequest | null
  const assignmentId = String(payload?.assignmentId ?? '').trim()
  const status = String(payload?.status ?? '').trim()
  const note = typeof payload?.note === 'string' ? payload.note : null
  const leftEarlyTimeRaw = typeof payload?.leftEarlyTime === 'string' ? payload.leftEarlyTime : null

  if (!assignmentId || !status || !isAllowedAssignmentStatus(status)) {
    return NextResponse.json({ error: 'Invalid status update payload.' }, { status: 400 })
  }

  if (leftEarlyTimeRaw && !/^\d{2}:\d{2}(:\d{2})?$/.test(leftEarlyTimeRaw)) {
    return NextResponse.json({ error: 'Left early time must be HH:MM or HH:MM:SS.' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_lead_eligible')
    .eq('id', user.id)
    .maybeSingle()

  if (!canUpdateAssignmentStatus((profile ?? null) as ActorProfile | null)) {
    return NextResponse.json(
      { error: 'Only leads or managers can update assignment statuses.' },
      { status: 403 }
    )
  }

  const { data, error } = await supabase.rpc('update_assignment_status', {
    p_assignment_id: assignmentId,
    p_status: status,
    p_note: note,
    p_left_early_time: status === 'left_early' ? leftEarlyTimeRaw : null,
  })

  if (error) {
    if (error.code === '42501') {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    if (error.code === 'P0002') {
      return NextResponse.json({ error: 'Assignment not found.' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Could not update assignment status.' }, { status: 500 })
  }

  const row = Array.isArray(data) ? ((data[0] ?? null) as RpcAssignmentStatusRow | null) : null
  if (!row) {
    return NextResponse.json({ error: 'Assignment status response was empty.' }, { status: 500 })
  }

  return NextResponse.json({ assignment: row })
}
