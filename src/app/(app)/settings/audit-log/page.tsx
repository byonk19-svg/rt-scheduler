import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { ManagerToolAccessDenied } from '@/components/auth/ManagerToolAccessDenied'
import { ManagerWorkspaceHeader } from '@/components/manager/ManagerWorkspaceHeader'
import { Button } from '@/components/ui/button'
import { resolveManagerToolAccess } from '@/lib/auth/manager-tool-access'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { AuditLogFilters } from './AuditLogFilters'

export const metadata: Metadata = {
  title: 'Audit Log',
  description: 'Manager-visible history for scheduling and staffing actions.',
}

type AuditLogSearchParams = {
  page?: string | string[]
  action?: string | string[]
  actor?: string | string[]
}

type AuditLogRow = {
  id: string
  action: string
  target_type: string
  target_id: string
  created_at: string
  user_id: string
  profiles:
    | {
        full_name: string | null
      }
    | {
        full_name: string | null
      }[]
    | null
}

const PAGE_SIZE = 25
const auditLogDateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function getSearchParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

function formatAuditLogTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return auditLogDateFormatter.format(date)
}

function getAuditLogHref(query: AuditLogSearchParams | undefined, page: number): string {
  const params = new URLSearchParams()
  const action = getSearchParam(query?.action).trim()
  const actor = getSearchParam(query?.actor).trim()
  if (action) params.set('action', action)
  if (actor) params.set('actor', actor)
  if (page > 0) params.set('page', String(page))
  const qs = params.toString()
  return qs ? `/settings/audit-log?${qs}` : '/settings/audit-log'
}

function getActorName(row: AuditLogRow): string {
  const joined = row.profiles
  if (!joined) return row.user_id
  if (Array.isArray(joined)) return joined[0]?.full_name ?? row.user_id
  return joined.full_name ?? row.user_id
}

function targetCell(row: AuditLogRow) {
  if (row.target_type === 'schedule_cycle') {
    return (
      <Link
        className="max-w-[12ch] truncate font-mono text-xs text-primary underline-offset-2 hover:underline"
        href={`/schedule?cycle=${row.target_id}`}
      >
        {row.target_id}
      </Link>
    )
  }
  return <span className="max-w-[12ch] truncate font-mono text-xs">{row.target_id}</span>
}

function actionLabel(action: string) {
  switch (action) {
    case 'post_publish_modification':
      return 'Published schedule changed'
    case 'shift_added':
      return 'Shift added'
    case 'shift_removed':
      return 'Shift removed'
    case 'designated_lead_assigned':
      return 'Lead assigned'
    case 'team_profile_updated':
      return 'Team profile updated'
    default:
      return action.replaceAll('_', ' ')
  }
}

function actionBadgeClass(action: string) {
  if (action === 'post_publish_modification') {
    return 'bg-[var(--warning-subtle)] text-[var(--warning-text)]'
  }
  if (action === 'shift_added') return 'bg-[var(--success-subtle)] text-[var(--success-text)]'
  if (action === 'shift_removed') return 'bg-[var(--error-subtle)] text-[var(--error-text)]'
  if (action === 'team_profile_updated') return 'bg-[var(--info-subtle)] text-[var(--info-text)]'
  return 'bg-muted text-muted-foreground'
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams?: Promise<AuditLogSearchParams>
}) {
  const query = searchParams ? await searchParams : undefined
  const actionFilter = getSearchParam(query?.action).trim()
  const actorFilter = getSearchParam(query?.actor).trim()
  const parsedPage = Number.parseInt(getSearchParam(query?.page) || '0', 10)
  const page = Number.isFinite(parsedPage) && parsedPage >= 0 ? Math.floor(parsedPage) : 0

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

  const access = resolveManagerToolAccess(profile, 'view_audit_log')
  if (access === 'inactive') redirect('/login?error=account_inactive')
  if (access === 'forbidden') return <ManagerToolAccessDenied toolName="Audit Log" />

  const buildCountQuery = (
    client: ReturnType<typeof createAdminClient> | Awaited<ReturnType<typeof createClient>>
  ) => {
    let q = client.from('audit_log').select('*', { count: 'exact', head: true })
    if (actionFilter) q = q.ilike('action', `%${actionFilter}%`)
    if (actorFilter) q = q.eq('user_id', actorFilter)
    return q
  }

  const buildRowsQuery = (
    client: ReturnType<typeof createAdminClient> | Awaited<ReturnType<typeof createClient>>
  ) => {
    let q = client
      .from('audit_log')
      .select(
        'id, action, target_type, target_id, created_at, user_id, profiles!audit_log_user_id_fkey(full_name)'
      )
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + (PAGE_SIZE - 1))
    if (actionFilter) q = q.ilike('action', `%${actionFilter}%`)
    if (actorFilter) q = q.eq('user_id', actorFilter)
    return q
  }

  let [countResult, rowsResult] = await Promise.all([
    buildCountQuery(supabase),
    buildRowsQuery(supabase),
  ])

  const rowsErrorMessage = rowsResult.error?.message ?? ''
  const joinBlocked =
    rowsErrorMessage.length > 0 &&
    /permission|policy|rls|forbidden|not authorized/i.test(rowsErrorMessage)

  if (joinBlocked) {
    const admin = createAdminClient()
    const [adminCountResult, adminRowsResult] = await Promise.all([
      buildCountQuery(admin),
      buildRowsQuery(admin),
    ])
    countResult = adminCountResult
    rowsResult = adminRowsResult
  }

  const totalCount = countResult.error ? 0 : (countResult.count ?? 0)
  const totalPages = totalCount === 0 ? 1 : Math.ceil(totalCount / PAGE_SIZE)
  const currentPage = Math.min(page, totalPages - 1)

  if (currentPage !== page) {
    redirect(getAuditLogHref(query, currentPage))
  }

  const rows = rowsResult.error ? [] : ((rowsResult.data ?? []) as AuditLogRow[])
  const hasPrev = currentPage > 0
  const hasNext = currentPage < totalPages - 1

  return (
    <div className="space-y-6">
      <ManagerWorkspaceHeader
        title="Audit Log"
        subtitle="Manager-visible system history for scheduling and staffing actions."
        summary={
          <span className="rounded-full border border-border/70 bg-muted/15 px-3 py-1 font-medium text-foreground">
            {totalCount} entries
          </span>
        }
      />

      <div className="rounded-xl border border-border bg-card p-4 shadow-tw-sm">
        <AuditLogFilters action={actionFilter} actor={actorFilter} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-tw-sm">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="hidden px-4 py-3 md:table-cell">Target type</th>
              <th className="hidden px-4 py-3 md:table-cell">Target ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-sm text-muted-foreground" colSpan={5}>
                  No audit log entries match the current filters.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-secondary/20">
                  <td className="whitespace-nowrap px-4 py-2.5 text-sm text-foreground">
                    {formatAuditLogTime(row.created_at)}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-muted-foreground">{getActorName(row)}</td>
                  <td className="px-4 py-2.5">
                    <span
                      title={row.action}
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${actionBadgeClass(row.action)}`}
                    >
                      {actionLabel(row.action)}
                    </span>
                  </td>
                  <td className="hidden px-4 py-2.5 text-sm text-muted-foreground md:table-cell">
                    {row.target_type}
                  </td>
                  <td className="hidden px-4 py-2.5 text-sm text-foreground md:table-cell">
                    {targetCell(row)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between pt-3">
        <span className="text-sm text-muted-foreground">
          Page {currentPage + 1} of {totalPages}
        </span>
        <div className="flex gap-2">
          {hasPrev ? (
            <Button asChild size="sm" variant="ghost">
              <Link href={getAuditLogHref(query, currentPage - 1)}>Previous</Link>
            </Button>
          ) : (
            <Button size="sm" variant="ghost" disabled>
              Previous
            </Button>
          )}
          {hasNext ? (
            <Button asChild size="sm" variant="ghost">
              <Link href={getAuditLogHref(query, currentPage + 1)}>Next</Link>
            </Button>
          ) : (
            <Button size="sm" variant="ghost" disabled>
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
