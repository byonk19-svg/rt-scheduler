import Link from 'next/link'
import { redirect } from 'next/navigation'

import { ManagerWorkspaceHeader } from '@/components/manager/ManagerWorkspaceHeader'
import { Button } from '@/components/ui/button'
import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { AuditLogFilters } from './AuditLogFilters'

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

function getSearchParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
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
        className="text-primary underline-offset-2 hover:underline"
        href={`/coverage?cycle=${row.target_id}`}
      >
        {row.target_id}
      </Link>
    )
  }
  return <span>{row.target_id}</span>
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
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!can(parseRole(profile?.role), 'view_audit_log')) {
    redirect('/dashboard/staff')
  }

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

  let countResult = await buildCountQuery(supabase)
  let rowsResult = await buildRowsQuery(supabase)

  const rowsErrorMessage = rowsResult.error?.message ?? ''
  const joinBlocked =
    rowsErrorMessage.length > 0 &&
    /permission|policy|rls|forbidden|not authorized/i.test(rowsErrorMessage)

  if (joinBlocked) {
    const admin = createAdminClient()
    countResult = await buildCountQuery(admin)
    rowsResult = await buildRowsQuery(admin)
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
            <tr className="border-b border-border bg-secondary/40 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Target type</th>
              <th className="px-4 py-3">Target ID</th>
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
                    {new Date(row.created_at).toLocaleString('en-US', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-muted-foreground">{getActorName(row)}</td>
                  <td className="px-4 py-2.5 text-sm font-medium text-foreground">{row.action}</td>
                  <td className="px-4 py-2.5 text-sm text-muted-foreground">{row.target_type}</td>
                  <td className="px-4 py-2.5 text-sm text-foreground">{targetCell(row)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Page {currentPage + 1} of {totalPages}
        </p>
        <div className="flex items-center gap-2">
          {hasPrev ? (
            <Button asChild size="sm" variant="outline">
              <Link href={getAuditLogHref(query, currentPage - 1)}>Previous</Link>
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled>
              Previous
            </Button>
          )}
          {hasNext ? (
            <Button asChild size="sm" variant="outline">
              <Link href={getAuditLogHref(query, currentPage + 1)}>Next</Link>
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled>
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
