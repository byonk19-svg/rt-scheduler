import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { AnalyticsSummaryStrip } from '@/components/analytics/AnalyticsSummaryStrip'
import { CycleFillRateChart } from '@/components/analytics/CycleFillRateChart'

export const metadata: Metadata = {
  title: 'Analytics',
  description: 'Schedule Block fill rates, submission compliance, and forced-date miss patterns.',
}
import { ForcedDateMissTable } from '@/components/analytics/ForcedDateMissTable'
import { SubmissionComplianceTable } from '@/components/analytics/SubmissionComplianceTable'
import { ManagerWorkspaceHeader } from '@/components/manager/ManagerWorkspaceHeader'
import { can } from '@/lib/auth/can'
import {
  getCycleFillRates,
  getForcedDateMisses,
  getSubmissionCompliance,
} from '@/lib/analytics-queries'
import { parseRole } from '@/lib/auth/roles'
import { getAutoDraftCoveragePolicy } from '@/lib/coverage/auto-draft-policy'
import { createClient } from '@/lib/supabase/server'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

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
    redirect('/dashboard/staff')
  }

  const { idealCoveragePerShift } = getAutoDraftCoveragePolicy()
  const [fillRates, submissionCompliance, forcedDateMisses] = await Promise.all([
    getCycleFillRates(supabase as never),
    getSubmissionCompliance(supabase as never),
    getForcedDateMisses(supabase as never),
  ])

  return (
    <div className="space-y-6">
      <ManagerWorkspaceHeader
        title="Analytics"
        subtitle="Schedule Block fill rates, submission compliance, and forced-date miss patterns."
      />

      <AnalyticsSummaryStrip
        fillRates={fillRates}
        submissionCompliance={submissionCompliance}
        forcedDateMisses={forcedDateMisses}
      />

      <CycleFillRateChart rows={fillRates} idealCoveragePerShift={idealCoveragePerShift} />

      <div className="flex items-center gap-3 px-1">
        <div className="h-px flex-1 bg-border" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Compliance tracking
        </p>
        <div className="h-px flex-1 bg-border" />
      </div>

      <SubmissionComplianceTable rows={submissionCompliance} />
      <ForcedDateMissTable rows={forcedDateMisses} />
    </div>
  )
}
