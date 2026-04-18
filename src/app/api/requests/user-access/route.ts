import { NextResponse } from 'next/server'

import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { linkEmployeeRosterToProfile } from '@/lib/employee-roster-link'
import { isTrustedMutationRequest } from '@/lib/security/request-origin'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

type ApproveRole = 'therapist' | 'lead'

type PendingProfileRow = {
  id: string
  email: string | null
  full_name: string | null
}

type AccessRequestMutationBody = {
  action?: 'approve' | 'decline'
  profileId?: string
  role?: ApproveRole
}

function isApproveRole(value: string): value is ApproveRole {
  return value === 'therapist' || value === 'lead'
}

async function assertManagerAccess() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { ok: false as const, status: 401, error: 'unauthorized' as const }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active, archived_at')
    .eq('id', user.id)
    .maybeSingle()

  if (
    !can(parseRole(profile?.role), 'access_manager_ui', {
      isActive: profile?.is_active !== false,
      archivedAt: profile?.archived_at ?? null,
    })
  ) {
    return { ok: false as const, status: 403, error: 'forbidden' as const }
  }

  return { ok: true as const }
}

export async function GET(request: Request) {
  const access = await assertManagerAccess()
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  const requestUrl = new URL(request.url)
  const summaryOnly = requestUrl.searchParams.get('summary') === '1'

  const admin = createAdminClient()
  const pendingQuery = admin
    .from('profiles')
    .select('id', { count: 'exact', head: summaryOnly })
    .is('role', null)

  const pendingResult = await pendingQuery
  if (pendingResult.error) {
    return NextResponse.json({ error: 'request_load_failed' }, { status: 500 })
  }

  if (summaryOnly) {
    return NextResponse.json({ pendingCount: pendingResult.count ?? 0 })
  }

  const { data: pendingRows, count } = await admin
    .from('profiles')
    .select('id, full_name, email, phone_number, created_at', { count: 'exact' })
    .is('role', null)
    .order('created_at', { ascending: false })

  if (!pendingRows) {
    return NextResponse.json({ error: 'request_load_failed' }, { status: 500 })
  }

  return NextResponse.json({ pendingCount: count ?? 0, requests: pendingRows })
}

async function sendApprovalEmail(email: string, fullName: string | null) {
  const resendApiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.PUBLISH_EMAIL_FROM
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.teamwise.work'

  if (!resendApiKey || !fromEmail) {
    throw new Error('Missing RESEND_API_KEY or PUBLISH_EMAIL_FROM for approval emails.')
  }

  const recipientName = fullName?.trim() || 'Teamwise user'
  const subject = 'Your Teamwise account has been approved'
  const html = `
    <p>Hi ${recipientName},</p>
    <p>Your Teamwise account is now approved. You can sign in and access schedules, availability, and open shifts.</p>
    <p><a href="${appUrl}/login">Sign in to Teamwise</a></p>
  `

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [email],
      subject,
      html,
    }),
  })

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`Approval email send failed (${response.status}): ${details}`)
  }
}

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) {
    return NextResponse.json({ error: 'invalid_origin' }, { status: 403 })
  }

  const access = await assertManagerAccess()
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  const payload = (await request.json().catch(() => null)) as AccessRequestMutationBody | null
  const action = payload?.action
  const profileId = String(payload?.profileId ?? '').trim()

  if (!profileId || (action !== 'approve' && action !== 'decline')) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const admin = createAdminClient()

  if (action === 'approve') {
    const assignedRole = String(payload?.role ?? '').trim()
    if (!isApproveRole(assignedRole)) {
      return NextResponse.json({ error: 'invalid_approval' }, { status: 400 })
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, email, full_name')
      .eq('id', profileId)
      .is('role', null)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'request_not_found' }, { status: 404 })
    }

    const { error: updateError } = await admin
      .from('profiles')
      .update({
        role: assignedRole,
        is_active: true,
        archived_at: null,
      })
      .eq('id', profileId)
      .is('role', null)

    if (updateError) {
      console.error('Failed to approve access request:', updateError)
      return NextResponse.json({ error: 'approve_failed' }, { status: 500 })
    }

    const pendingProfile = profile as PendingProfileRow
    if (!pendingProfile.email) {
      return NextResponse.json({ error: 'approve_failed' }, { status: 500 })
    }

    await linkEmployeeRosterToProfile({
      id: pendingProfile.id,
      full_name: pendingProfile.full_name,
      email: pendingProfile.email,
    })

    try {
      await sendApprovalEmail(pendingProfile.email, pendingProfile.full_name)
    } catch (emailError) {
      console.error('Failed to send access approval email:', emailError)
      return NextResponse.json({ error: 'email_failed' }, { status: 500 })
    }

    return NextResponse.json({ success: 'approved' as const })
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id')
    .eq('id', profileId)
    .is('role', null)
    .maybeSingle()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'request_not_found' }, { status: 404 })
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(profileId)
  if (deleteError) {
    console.error('Failed to delete declined pending user:', deleteError)
    return NextResponse.json({ error: 'decline_failed' }, { status: 500 })
  }

  return NextResponse.json({ success: 'declined' as const })
}
