import { redirect } from 'next/navigation'

import { CycleFillRateChart } from '@/components/analytics/CycleFillRateChart'
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
        subtitle="Cycle fill rates, submission compliance, and forced-date miss patterns."
      />

      <CycleFillRateChart rows={fillRates} idealCoveragePerShift={idealCoveragePerShift} />
      <SubmissionComplianceTable rows={submissionCompliance} />
      <ForcedDateMissTable rows={forcedDateMisses} />
    </div>
  )
}
