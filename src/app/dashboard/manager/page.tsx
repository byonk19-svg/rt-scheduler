import Link from 'next/link'
import { redirect } from 'next/navigation'

import { AttentionBar } from '@/components/AttentionBar'
import { FeedbackToast } from '@/components/feedback-toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getManagerAttentionSnapshot } from '@/lib/manager-workflow'
import { createClient } from '@/lib/supabase/server'

type TherapistSummaryRow = {
  is_active: boolean | null
  on_fmla: boolean | null
}

type ManagerDashboardSearchParams = {
  success?: string | string[]
  error?: string | string[]
}

function getSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function getManagerDashboardFeedback(params?: ManagerDashboardSearchParams): {
  message: string
  variant: 'success' | 'error'
} | null {
  const success = getSearchParam(params?.success)
  const error = getSearchParam(params?.error)

  if (success === 'signed_in') return { message: 'Signed in successfully.', variant: 'success' }
  if (success === 'access_requested') return { message: 'Access request submitted and signed in.', variant: 'success' }
  if (error === 'session_failed') return { message: 'Could not verify your session. Please sign in again.', variant: 'error' }
  return null
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

export default async function ManagerDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<ManagerDashboardSearchParams>
}) {
  const supabase = await createClient()
  const params = searchParams ? await searchParams : undefined
  const feedback = getManagerDashboardFeedback(params)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .maybeSingle()

  const isManager = profile?.role === 'manager'
  if (!isManager) {
    redirect('/dashboard/staff')
  }

  const { data: therapistSummaryData } = await supabase
    .from('profiles')
    .select('is_active, on_fmla')
    .eq('role', 'therapist')

  const therapistSummary = (therapistSummaryData ?? []) as TherapistSummaryRow[]
  const totalActiveEmployees = therapistSummary.filter((row) => row.is_active !== false).length
  const employeesOnFmla = therapistSummary.filter((row) => row.is_active !== false && row.on_fmla === true).length

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

      <AttentionBar snapshot={summary} variant="full" context="dashboard" />

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
              <Link href={summary.links.coverageNeedsAttention}>Go to coverage</Link>
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
            {checklistItem(
              'Coverage',
              coverageClear,
              coverageClear ? 'clear' : `${summary.coverageIssues} issues (includes lead)`
            )}
            {checklistItem('Lead', leadClear, leadClear ? 'clear' : `${summary.missingLeadShifts} shifts missing lead`)}

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

      <Card>
        <CardHeader>
          <CardTitle>Team summary</CardTitle>
          <CardDescription>Directory management moved to the Team page.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">Active employees: {totalActiveEmployees}</p>
          <p className="text-sm text-muted-foreground">On FMLA: {employeesOnFmla}</p>
          <Button asChild variant="outline" size="sm">
            <Link href="/directory">Manage team</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
