import Link from 'next/link'
import { redirect } from 'next/navigation'

import { ManagerAttentionPanel } from '@/components/ManagerAttentionPanel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { dateKeyFromDate } from '@/lib/schedule-helpers'
import { getManagerAttentionSnapshot } from '@/lib/manager-workflow'
import { createClient } from '@/lib/supabase/server'

export default async function ManagerDashboardPage() {
  const supabase = await createClient()
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

  const isManager = profile?.role === 'manager' || user.user_metadata?.role === 'manager'
  if (!isManager) {
    redirect('/dashboard/staff')
  }

  const fullName = profile?.full_name ?? user.user_metadata?.full_name ?? 'Manager'
  const attentionSnapshot = await getManagerAttentionSnapshot(supabase)

  const todayKey = dateKeyFromDate(new Date())
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const startOfTomorrow = new Date(startOfToday)
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1)

  const { count: newRequestsTodayCount } = await supabase
    .from('availability_requests')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startOfToday.toISOString())
    .lt('created_at', startOfTomorrow.toISOString())

  const newRequestsToday = newRequestsTodayCount ?? 0
  const newRequestsLink = `/availability?sort=newest&startDate=${todayKey}&endDate=${todayKey}`
  const cycleBadgeLabel = attentionSnapshot.activeCycle
    ? `Cycle: ${attentionSnapshot.activeCycle.label}`
    : 'Team: Respiratory Therapy'

  return (
    <div className="space-y-6">
      <div className="teamwise-surface rounded-2xl border border-border p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <h1 className="app-page-title">Manager Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Welcome, {fullName}. Move through approvals, coverage checks, and publish in one flow.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge>Role: manager</Badge>
          <Badge variant="outline">{cycleBadgeLabel}</Badge>
        </div>
      </div>

      <ManagerAttentionPanel snapshot={attentionSnapshot} />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card className="transition-colors hover:border-primary/40">
          <CardContent className="space-y-3 pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">1. Approvals</p>
            <p className="text-2xl font-bold">{attentionSnapshot.pendingApprovals}</p>
            <p className="text-xs text-muted-foreground">Pending swap and pickup decisions waiting for manager review.</p>
            <Button asChild size="sm">
              <Link href={attentionSnapshot.links.approvals}>Open approvals</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="transition-colors hover:border-primary/40">
          <CardContent className="space-y-3 pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">2. Coverage gaps</p>
            <p
              className={
                attentionSnapshot.unfilledShiftSlots > 0 ? 'text-2xl font-bold text-destructive' : 'text-2xl font-bold'
              }
            >
              {attentionSnapshot.unfilledShiftSlots}
            </p>
            <p className="text-xs text-muted-foreground">Shift slots below minimum coverage target in the active cycle.</p>
            <Button asChild size="sm" variant="outline">
              <Link href={attentionSnapshot.links.coverage}>Assign coverage</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="transition-colors hover:border-primary/40">
          <CardContent className="space-y-3 pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">3. Coverage confirmation</p>
            <p className={attentionSnapshot.coverageConfirmed ? 'text-2xl font-bold text-primary' : 'text-2xl font-bold'}>
              {attentionSnapshot.coverageConfirmed ? 'Confirmed' : 'Needs review'}
            </p>
            <p className="text-xs text-muted-foreground">
              {attentionSnapshot.coverageConfirmed
                ? 'Current coverage is on target for all day/night slots.'
                : 'Resolve open gaps before publishing this cycle.'}
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href={attentionSnapshot.links.coverage}>Check coverage</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="transition-colors hover:border-primary/40">
          <CardContent className="space-y-3 pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">4. Publish</p>
            <p className={attentionSnapshot.publishReady ? 'text-2xl font-bold text-primary' : 'text-2xl font-bold'}>
              {attentionSnapshot.activeCycle?.published ? 'Published' : attentionSnapshot.publishReady ? 'Ready' : 'Blocked'}
            </p>
            <p className="text-xs text-muted-foreground">
              {attentionSnapshot.activeCycle?.published
                ? 'The active cycle is already published.'
                : attentionSnapshot.publishReady
                  ? 'Coverage and approvals are clear. Publish when ready.'
                  : 'Clear approvals and coverage gaps before publishing.'}
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href={attentionSnapshot.links.publish}>Go to publish</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-4">
          <h3 className="app-section-title">Quick actions</h3>
          <p className="text-sm text-muted-foreground">Handle approvals, fill coverage, and publish from one action row.</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild>
              <Link href={attentionSnapshot.links.approvals}>Approve requests</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={attentionSnapshot.links.coverage}>Assign shifts</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={attentionSnapshot.links.publish}>Publish cycle</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href={newRequestsLink}>New requests today ({newRequestsToday})</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="space-y-3 pt-4">
            <h3 className="app-section-title">Build schedule</h3>
            <p className="text-sm text-muted-foreground">Generate drafts, assign shifts, and move cycles to publish-ready.</p>
            <Button asChild variant="outline" size="sm">
              <Link href="/schedule">Build schedule</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 pt-4">
            <h3 className="app-section-title">Review availability</h3>
            <p className="text-sm text-muted-foreground">Check daily request volume and reconcile staff blackout dates.</p>
            <Button asChild variant="outline" size="sm">
              <Link href="/availability">Review availability</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 pt-4">
            <h3 className="app-section-title">Approve swaps</h3>
            <p className="text-sm text-muted-foreground">Approve or deny open pickup and swap requests from the shift board.</p>
            <Button asChild variant="outline" size="sm">
              <Link href="/shift-board">Approve swaps</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
