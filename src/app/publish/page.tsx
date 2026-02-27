import Link from 'next/link'
import { redirect } from 'next/navigation'

import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'

type PublishEventRow = {
  id: string
  cycle_id: string
  published_at: string
  status: 'success' | 'failed'
  recipient_count: number
  channel: string
  queued_count: number
  sent_count: number
  failed_count: number
  error_message: string | null
  schedule_cycles:
    | {
        label: string
      }
    | {
        label: string
      }[]
    | null
  profiles:
    | {
        full_name: string | null
      }
    | {
        full_name: string | null
      }[]
    | null
}

function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export default async function PublishHistoryPage() {
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

  if (!can(parseRole(profile?.role), 'manage_publish')) {
    redirect('/dashboard')
  }

  const { data: eventsData, error: eventsError } = await supabase
    .from('publish_events')
    .select(
      'id, cycle_id, published_at, status, recipient_count, channel, queued_count, sent_count, failed_count, error_message, schedule_cycles(label), profiles!publish_events_published_by_fkey(full_name)'
    )
    .order('published_at', { ascending: false })
    .limit(50)

  if (eventsError) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4 py-6">
        <h1 className="text-2xl font-bold text-foreground">Publish history</h1>
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          Could not load publish history.
        </p>
      </div>
    )
  }

  const events = (eventsData ?? []) as PublishEventRow[]

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Publish history</h1>
        <Link
          href="/schedule?view=week"
          className="rounded-md border border-border bg-white px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary"
        >
          Back to schedule
        </Link>
      </div>

      <div className="overflow-hidden rounded-md border border-border bg-white">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2">Published at</th>
              <th className="px-3 py-2">Cycle</th>
              <th className="px-3 py-2">Published by</th>
              <th className="px-3 py-2">Recipients</th>
              <th className="px-3 py-2">Queued</th>
              <th className="px-3 py-2">Sent</th>
              <th className="px-3 py-2">Failed</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Details</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-sm text-muted-foreground" colSpan={9}>
                  No publish events yet.
                </td>
              </tr>
            ) : (
              events.map((event) => (
                <tr key={event.id} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2 text-sm text-foreground">
                    {new Date(event.published_at).toLocaleString('en-US')}
                  </td>
                  <td className="px-3 py-2 text-sm text-foreground">
                    {getOne(event.schedule_cycles)?.label ?? event.cycle_id}
                  </td>
                  <td className="px-3 py-2 text-sm text-foreground">
                    {getOne(event.profiles)?.full_name ?? 'Manager'}
                  </td>
                  <td className="px-3 py-2 text-sm text-foreground">{event.recipient_count}</td>
                  <td className="px-3 py-2 text-sm text-foreground">{event.queued_count}</td>
                  <td className="px-3 py-2 text-sm text-foreground">{event.sent_count}</td>
                  <td className="px-3 py-2 text-sm text-foreground">{event.failed_count}</td>
                  <td className="px-3 py-2 text-sm text-foreground">{event.status}</td>
                  <td className="px-3 py-2 text-sm">
                    <Link className="text-primary hover:underline" href={`/publish/${event.id}`}>
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
