import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import {
  UserAccessRequestsList,
  type PendingAccessRequest,
} from '@/app/requests/user-access/UserAccessRequestsList'
import { ManagerWorkspaceHeader } from '@/components/manager/ManagerWorkspaceHeader'
import { Button } from '@/components/ui/button'
import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Access Requests',
}

type SearchParams = Record<string, string | string[] | undefined>

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function formatSignupDate(value: string | null): string {
  if (!value) return 'Unknown'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Unknown'
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

type PendingRow = {
  id: string
  full_name: string | null
  email: string | null
  phone_number: string | null
  created_at: string | null
}

export default async function UserAccessRequestsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>
}) {
  const params = searchParams ? await searchParams : undefined
  const success = firstParam(params?.success)
  const error = firstParam(params?.error)

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

  const { data: pendingRows, error: pendingError } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone_number, created_at')
    .is('role', null)
    .order('created_at', { ascending: false })

  const requests: PendingAccessRequest[] = ((pendingRows ?? []) as PendingRow[]).map((row) => ({
    id: row.id,
    fullName: row.full_name ?? 'Pending user',
    email: row.email ?? 'No email',
    phoneNumber: row.phone_number,
    signupDateLabel: formatSignupDate(row.created_at),
  }))

  return (
    <div className="space-y-5">
      <ManagerWorkspaceHeader
        title="Access requests"
        subtitle="Approve or decline pending account requests."
        summary={
          <span className="rounded-full border border-border/70 bg-muted/15 px-3 py-1 text-sm font-medium text-foreground">
            {requests.length} pending
          </span>
        }
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/team">Back to team</Link>
          </Button>
        }
      />

      {pendingError && (
        <div className="rounded-md border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-sm text-[var(--error-text)]">
          Could not load user access requests.
        </div>
      )}
      {success === 'approved' && (
        <div className="rounded-md border border-[var(--success-border)] bg-[var(--success-subtle)] px-3 py-2 text-sm text-[var(--success-text)]">
          User approved successfully.
        </div>
      )}
      {success === 'declined' && (
        <div className="rounded-md border border-[var(--success-border)] bg-[var(--success-subtle)] px-3 py-2 text-sm text-[var(--success-text)]">
          Request declined and pending account deleted.
        </div>
      )}
      {error && (
        <div className="rounded-md border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-sm text-[var(--error-text)]">
          {error === 'email_failed'
            ? 'Account approved, but approval email failed to send. Check email configuration.'
            : 'Could not complete that request.'}
        </div>
      )}

      <UserAccessRequestsList requests={requests} />
    </div>
  )
}
