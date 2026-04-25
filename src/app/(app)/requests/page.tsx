import Link from 'next/link'
import { redirect } from 'next/navigation'
import { KeyRound, Repeat } from 'lucide-react'

import { ManagerWorkspaceHeader } from '@/components/manager/ManagerWorkspaceHeader'
import { Button } from '@/components/ui/button'
import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'

export default async function RequestsPage() {
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
  if (!can(parseRole(profile?.role), 'access_manager_ui')) {
    redirect('/requests/new')
  }

  const { count: pendingCount } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .is('role', null)

  const totalPending = pendingCount ?? 0

  return (
    <div className="space-y-5">
      <ManagerWorkspaceHeader
        title="Requests"
        subtitle="Manage open shift requests and user access requests."
        summary={
          <span className="rounded-full border border-border/70 bg-muted/15 px-3 py-1 text-sm font-medium text-foreground">
            {totalPending} pending access requests
          </span>
        }
      />

      <div className="grid gap-3 md:grid-cols-2">
        <article className="rounded-xl border border-border/70 bg-card p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Repeat className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Shift Swaps & Pickups</p>
              <p className="mt-1 text-sm text-foreground/80">
                Review and manage the shared shift-swaps-and-pickups workflow.
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link href="/shift-board">Shift Swaps & Pickups</Link>
          </Button>
        </article>

        <article className="rounded-xl border border-border/70 bg-card p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <KeyRound className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">User Access Requests</p>
              <p className="mt-1 text-sm text-foreground/80">
                Approve or decline pending account requests.
              </p>
            </div>
          </div>
          <Button asChild size="sm" className="mt-4">
            <Link href="/requests/user-access">User Access Requests</Link>
          </Button>
        </article>
      </div>
    </div>
  )
}
