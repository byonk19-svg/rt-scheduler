'use client'

import type { ReactNode } from 'react'
import { AlertCircle, CalendarDays, CheckCircle2, ChevronLeft, CircleX, Clock3 } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { ManagerWorkspaceHeader } from '@/components/manager/ManagerWorkspaceHeader'

type PublishEventDetailRow = {
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
        start_date: string
        end_date: string
      }
    | {
        label: string
        start_date: string
        end_date: string
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

function StatRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-sm">
      <span className="pt-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-right font-semibold text-foreground tabular-nums">{value}</span>
    </div>
  )
}

function StatusChip({ status }: { status: 'success' | 'failed' }) {
  if (status === 'success') {
    return (
      <span
        className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
        style={{
          borderColor: 'var(--success-border)',
          backgroundColor: 'var(--success-subtle)',
          color: 'var(--success-text)',
        }}
      >
        Success
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
      style={{
        borderColor: 'var(--error-border)',
        backgroundColor: 'var(--error-subtle)',
        color: 'var(--error-text)',
      }}
    >
      Failed
    </span>
  )
}

export function PublishEventSummaryCard({
  cycle,
  event,
  publishedScheduleHref,
}: {
  cycle: {
    label: string
    start_date: string
    end_date: string
  } | null
  event: PublishEventDetailRow
  publishedScheduleHref: string
}) {
  return (
    <>
      <ManagerWorkspaceHeader
        title="Publish Details"
        subtitle={
          cycle
            ? `${cycle.label} | ${new Date(event.published_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
            : 'Schedule email delivery details.'
        }
        summary={
          <div className="flex flex-wrap items-center gap-2 text-foreground">
            <StatusChip status={event.status} />
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card/90 px-2.5 py-1 text-[11px] font-semibold text-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-[var(--success-text)]" />
              {event.sent_count} sent
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card/90 px-2.5 py-1 text-[11px] font-semibold text-foreground">
              <CircleX className="h-3.5 w-3.5 text-[var(--error-text)]" />
              {event.failed_count} failed
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card/90 px-2.5 py-1 text-[11px] font-semibold text-foreground">
              <Clock3 className="h-3.5 w-3.5 text-[var(--warning-text)]" />
              {event.queued_count} queued
            </span>
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={publishedScheduleHref}>
                <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
                View schedule
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/publish/history">
                <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                Delivery history
              </Link>
            </Button>
          </div>
        }
      />

      <div className="rounded-xl border border-border bg-card shadow-tw-sm">
        <div className="border-b border-border px-5 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Event summary
          </p>
        </div>
        <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          <div className="divide-y divide-border px-5">
            <StatRow label="Cycle" value={cycle?.label ?? event.cycle_id} />
            {cycle ? (
              <StatRow label="Cycle range" value={`${cycle.start_date} -> ${cycle.end_date}`} />
            ) : null}
            <StatRow
              label="Published by"
              value={
                'profiles' in event
                  ? (() => {
                      const profile = Array.isArray(event.profiles)
                        ? event.profiles[0]
                        : event.profiles
                      return profile?.full_name ?? 'Manager'
                    })()
                  : 'Manager'
              }
            />
            <StatRow label="Channel" value={event.channel} />
          </div>
          <div className="divide-y divide-border px-5">
            <StatRow label="Recipients" value={event.recipient_count} />
            <StatRow label="Queued" value={event.queued_count} />
            <StatRow
              label="Sent"
              value={
                <span style={{ color: 'var(--success-text)' }} className="font-semibold">
                  {event.sent_count}
                </span>
              }
            />
            <StatRow
              label="Failed"
              value={
                event.failed_count > 0 ? (
                  <span style={{ color: 'var(--error-text)' }} className="font-semibold">
                    {event.failed_count}
                  </span>
                ) : (
                  <span className="text-muted-foreground">0</span>
                )
              }
            />
          </div>
        </div>

        {event.error_message ? (
          <div
            className="m-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm"
            style={{
              borderColor: 'var(--warning-border)',
              backgroundColor: 'var(--warning-subtle)',
              color: 'var(--warning-text)',
            }}
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{event.error_message}</span>
          </div>
        ) : null}
      </div>
    </>
  )
}
