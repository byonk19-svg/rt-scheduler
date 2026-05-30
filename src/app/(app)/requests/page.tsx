import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { KeyRound, Repeat } from 'lucide-react'

import { ManagerToolAccessDenied } from '@/components/auth/ManagerToolAccessDenied'
import { ManagerWorkspaceHeader } from '@/components/manager/ManagerWorkspaceHeader'
import { Button } from '@/components/ui/button'
import { resolveManagerToolAccess } from '@/lib/auth/manager-tool-access'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Requests',
  description: 'Manage trade, coverage, and user access requests.',
}

export default async function RequestsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active, archived_at')
    .eq('id', user.id)
    .maybeSingle()
  const access = resolveManagerToolAccess(profile)
  if (access === 'inactive') redirect('/login?error=account_inactive')
  if (access === 'forbidden') return <ManagerToolAccessDenied toolName="Requests" />

  const { count: pendingCount } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('access_status', 'pending')

  const totalPending = pendingCount ?? 0

  return (
    <div className="space-y-5">
      <ManagerWorkspaceHeader
        title="Requests"
        subtitle="Manage open coverage requests and user access requests."
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
              <p className="text-sm font-semibold text-foreground">Trade & Coverage Requests</p>
              <p className="mt-1 text-sm text-foreground/80">
                Review and manage the shared trade-and-coverage workflow.
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link href="/shift-board">Trade & Coverage Requests</Link>
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
