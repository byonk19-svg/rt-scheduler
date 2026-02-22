import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { FeedbackToast } from '@/components/feedback-toast'
import { ManagerAttentionPanel } from '@/components/ManagerAttentionPanel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getManagerAttentionSnapshot } from '@/lib/manager-workflow'
import { createClient } from '@/lib/supabase/server'

type TherapistDirectoryRow = {
  id: string
  full_name: string
  email: string
  phone_number: string | null
  shift_type: 'day' | 'night'
}

type ManagerDashboardSearchParams = {
  success?: string | string[]
  error?: string | string[]
}

function getSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function getFeedback(params?: ManagerDashboardSearchParams): { message: string; variant: 'success' | 'error' } | null {
  const success = getSearchParam(params?.success)
  const error = getSearchParam(params?.error)

  if (success === 'employee_contact_updated') {
    return { message: 'Employee contact information updated.', variant: 'success' }
  }
  if (error === 'employee_contact_update_failed') {
    return { message: 'Could not update employee contact information.', variant: 'error' }
  }
  if (error === 'employee_contact_validation') {
    return { message: 'Name and email are required to save employee contact details.', variant: 'error' }
  }
  if (error === 'employee_contact_unauthorized') {
    return { message: 'Manager access is required to edit employee contacts.', variant: 'error' }
  }
  if (error === 'employee_contact_phone_invalid') {
    return { message: 'Phone number must be 10 digits (US format).', variant: 'error' }
  }

  return null
}

function normalizePhoneNumber(raw: string): string | null {
  const digitsOnly = raw.replace(/\D/g, '')
  if (!digitsOnly) return null

  const normalizedDigits =
    digitsOnly.length === 11 && digitsOnly.startsWith('1') ? digitsOnly.slice(1) : digitsOnly

  if (normalizedDigits.length !== 10) {
    return 'INVALID'
  }

  return `(${normalizedDigits.slice(0, 3)}) ${normalizedDigits.slice(3, 6)}-${normalizedDigits.slice(6)}`
}

function formatPhoneForDisplay(value: string | null): string {
  if (!value) return ''
  const normalized = normalizePhoneNumber(value)
  return normalized && normalized !== 'INVALID' ? normalized : value
}

function checklistItem(label: string, passed: boolean, detail: string) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-foreground">{label}</span>
      <span className={passed ? 'text-[var(--success-text)]' : 'text-[var(--warning-text)]'}>
        {passed ? `\u2705 ${detail}` : `\u274c ${detail}`}
      </span>
    </div>
  )
}

async function updateEmployeeContactAction(formData: FormData) {
  'use server'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'manager') {
    redirect('/dashboard/manager?error=employee_contact_unauthorized')
  }

  const profileId = String(formData.get('profile_id') ?? '').trim()
  const fullName = String(formData.get('full_name') ?? '').trim()
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase()
  const phoneNumber = String(formData.get('phone_number') ?? '').trim()
  const shiftType = String(formData.get('shift_type') ?? '').trim()

  if (!profileId || !fullName || !email) {
    redirect('/dashboard/manager?error=employee_contact_validation')
  }

  const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber)
  if (normalizedPhoneNumber === 'INVALID') {
    redirect('/dashboard/manager?error=employee_contact_phone_invalid')
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: fullName,
      email,
      phone_number: normalizedPhoneNumber,
    })
    .eq('id', profileId)
    .eq('role', 'therapist')

  if (error) {
    console.error('Failed to update employee contact:', error)
    redirect('/dashboard/manager?error=employee_contact_update_failed')
  }

  revalidatePath('/dashboard/manager')
  redirect(`/dashboard/manager?success=employee_contact_updated#${shiftType === 'night' ? 'night-team' : 'day-team'}`)
}

function TeamDirectorySection({
  title,
  anchorId,
  rows,
}: {
  title: string
  anchorId: string
  rows: TherapistDirectoryRow[]
}) {
  return (
    <Card id={anchorId}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Edit contact information if profile data needs correction.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">No signed-up employees in this shift yet.</p>
        )}

        {rows.map((employee) => (
          <form key={employee.id} action={updateEmployeeContactAction} className="rounded-md border border-border p-3">
            <input type="hidden" name="profile_id" value={employee.id} />
            <input type="hidden" name="shift_type" value={employee.shift_type} />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor={`full_name_${employee.id}`}>Name</Label>
                <Input id={`full_name_${employee.id}`} name="full_name" defaultValue={employee.full_name} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`email_${employee.id}`}>Email</Label>
                <Input id={`email_${employee.id}`} name="email" type="email" defaultValue={employee.email} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`phone_${employee.id}`}>Phone</Label>
                <Input
                  id={`phone_${employee.id}`}
                  name="phone_number"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  defaultValue={formatPhoneForDisplay(employee.phone_number)}
                  placeholder="(555) 123-4567"
                  title="Enter a 10-digit phone number"
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <Button type="submit" size="sm" variant="outline">
                Save
              </Button>
            </div>
          </form>
        ))}
      </CardContent>
    </Card>
  )
}

export default async function ManagerDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<ManagerDashboardSearchParams>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const params = searchParams ? await searchParams : undefined
  const feedback = getFeedback(params)

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .maybeSingle()

  const isManager = profile?.role === 'manager' || user.user_metadata?.role === 'manager'
  if (!isManager) {
    redirect('/dashboard/staff')
  }

  const { data: therapistsData } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone_number, shift_type')
    .eq('role', 'therapist')
    .order('shift_type', { ascending: true })
    .order('full_name', { ascending: true })

  const therapists = (therapistsData ?? []) as TherapistDirectoryRow[]
  const dayTherapists = therapists.filter((employee) => employee.shift_type === 'day')
  const nightTherapists = therapists.filter((employee) => employee.shift_type === 'night')

  const fullName = profile?.full_name ?? user.user_metadata?.full_name ?? 'Manager'
  const summary = await getManagerAttentionSnapshot(supabase)
  const cycleBadgeLabel = summary.activeCycle ? `Cycle: ${summary.activeCycle.label}` : 'Cycle: Not set'
  const publishBlocked = !summary.publishReady
  const approvalsClear = summary.pendingApprovals === 0
  const coverageClear = summary.coverageIssues === 0
  const leadClear = summary.missingLeadShifts === 0

  return (
    <div className="space-y-6">
      {feedback && <FeedbackToast message={feedback.message} variant={feedback.variant} />}

      <div className="teamwise-surface rounded-2xl border border-border p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <h1 className="app-page-title">Manager Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Welcome, {fullName}. Fix blockers, then publish confidently.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="outline">{cycleBadgeLabel}</Badge>
        </div>
      </div>

      <ManagerAttentionPanel snapshot={summary} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Approvals</CardTitle>
            <CardDescription>
              {summary.pendingApprovals === 0
                ? 'No approvals waiting.'
                : `${summary.pendingApprovals} requests awaiting review.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link href={summary.links.approvalsPending}>Open approvals</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Coverage</CardTitle>
            <CardDescription>Resolve lead and staffing gaps before publishing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">Missing lead: {summary.missingLeadShifts}</p>
            <p className="text-sm text-muted-foreground">Under coverage: {summary.underCoverageSlots}</p>
            <p className="text-sm text-muted-foreground">Over coverage: {summary.overCoverageSlots}</p>
            <Button asChild variant="outline" size="sm">
              <Link href={summary.links.fixCoverage}>Assign coverage</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Publish</CardTitle>
            <CardDescription>Checklist must be clear before publish.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {checklistItem('Approvals', approvalsClear, approvalsClear ? 'clear' : `${summary.pendingApprovals} pending`)}
            {checklistItem('Coverage', coverageClear, coverageClear ? 'clear' : `${summary.coverageIssues} issues`)}
            {checklistItem('Lead', leadClear, leadClear ? 'clear' : `${summary.missingLeadShifts} missing`)}

            {publishBlocked ? (
              <Button asChild size="sm">
                <Link href={summary.resolveBlockersLink}>Resolve blockers</Link>
              </Button>
            ) : (
              <Button asChild size="sm">
                <Link href={summary.links.publish}>Publish cycle</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-3 pt-4">
          <h3 className="app-section-title">Quick actions</h3>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <Link href={summary.links.approvalsPending}>Review approvals</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={summary.links.fixCoverage}>Assign coverage</Link>
            </Button>
            {publishBlocked ? (
              <span title="Publishing is blocked until approvals and coverage issues are resolved.">
                <Button variant="outline" disabled>
                  Publish cycle
                </Button>
              </span>
            ) : (
              <Button asChild>
                <Link href={summary.links.publish}>Publish cycle</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <TeamDirectorySection title="Day Shift Directory" anchorId="day-team" rows={dayTherapists} />
        <TeamDirectorySection title="Night Shift Directory" anchorId="night-team" rows={nightTherapists} />
      </div>
    </div>
  )
}
