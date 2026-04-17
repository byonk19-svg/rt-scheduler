'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { linkEmployeeRosterToProfile } from '@/lib/employee-roster-link'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

type ApproveRole = 'therapist' | 'lead'

type PendingProfileRow = {
  id: string
  email: string | null
  full_name: string | null
}

function isApproveRole(value: string): value is ApproveRole {
  return value === 'therapist' || value === 'lead'
}

async function assertManagerAccess() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (!can(parseRole(profile?.role), 'access_manager_ui')) redirect('/dashboard')
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

export async function approvePendingAccessRequestAction(formData: FormData) {
  await assertManagerAccess()

  const profileId = String(formData.get('profile_id') ?? '').trim()
  const assignedRole = String(formData.get('role') ?? '').trim()

  if (!profileId || !isApproveRole(assignedRole)) {
    redirect('/requests/user-access?error=invalid_approval')
  }

  const admin = createAdminClient()
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, email, full_name')
    .eq('id', profileId)
    .is('role', null)
    .maybeSingle()

  if (profileError || !profile) {
    redirect('/requests/user-access?error=request_not_found')
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
    redirect('/requests/user-access?error=approve_failed')
  }

  const pendingProfile = profile as PendingProfileRow
  if (!pendingProfile.email) {
    redirect('/requests/user-access?error=approve_failed')
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
    redirect('/requests/user-access?error=email_failed')
  }

  revalidatePath('/requests')
  revalidatePath('/requests/user-access')
  revalidatePath('/dashboard/manager')
  redirect('/requests/user-access?success=approved')
}

export async function declinePendingAccessRequestAction(formData: FormData) {
  await assertManagerAccess()

  const profileId = String(formData.get('profile_id') ?? '').trim()
  if (!profileId) {
    redirect('/requests/user-access?error=invalid_decline')
  }

  const admin = createAdminClient()
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id')
    .eq('id', profileId)
    .is('role', null)
    .maybeSingle()

  if (profileError || !profile) {
    redirect('/requests/user-access?error=request_not_found')
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(profileId)
  if (deleteError) {
    console.error('Failed to delete declined pending user:', deleteError)
    redirect('/requests/user-access?error=decline_failed')
  }

  revalidatePath('/requests')
  revalidatePath('/requests/user-access')
  revalidatePath('/dashboard/manager')
  redirect('/requests/user-access?success=declined')
}
