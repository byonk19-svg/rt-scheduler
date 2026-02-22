import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

export default async function StaffDashboardPage() {
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
  if (isManager) {
    redirect('/dashboard/manager')
  }

  const fullName = profile?.full_name ?? user.user_metadata?.full_name ?? 'Staff member'

  return (
    <div className="space-y-6">
      <div className="teamwise-surface rounded-2xl border border-border p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <h1 className="app-page-title">Staff Home</h1>
        <p className="mt-1 text-sm text-muted-foreground">Welcome, {fullName}. Your self-service tools are prioritized below.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge>Role: therapist</Badge>
          <Badge variant="outline">Team: Respiratory Therapy</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="space-y-3 pt-4">
            <h3 className="app-section-title">My Schedule</h3>
            <p className="text-sm text-muted-foreground">View your upcoming and published shifts.</p>
            <Button asChild variant="outline" size="sm">
              <Link href="/schedule">Open schedule</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 pt-4">
            <h3 className="app-section-title">Availability Requests</h3>
            <p className="text-sm text-muted-foreground">Submit days you cannot work in upcoming cycles.</p>
            <Button asChild variant="outline" size="sm">
              <Link href="/availability">Open requests</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 pt-4">
            <h3 className="app-section-title">Shift Board</h3>
            <p className="text-sm text-muted-foreground">Post swap or pickup requests and track claims.</p>
            <Button asChild variant="outline" size="sm">
              <Link href="/shift-board">Open shift board</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
