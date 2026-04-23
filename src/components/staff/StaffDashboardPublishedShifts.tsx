'use client'

import Link from 'next/link'

import { MyScheduleCard } from '@/components/schedule/MyScheduleCard'
import type { MyScheduleShiftRow } from '@/lib/staff-my-schedule'

export function StaffDashboardPublishedShifts({ rows }: { rows: MyScheduleShiftRow[] }) {
  return (
    <section className="rounded-xl border border-border bg-card px-4 py-4 shadow-tw-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold tracking-tight text-foreground">Upcoming shifts</h2>
        <Link
          href="/staff/my-schedule"
          className="text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          View all
        </Link>
      </div>
      {rows.length > 0 ? (
        <div className="space-y-2">
          {rows.map((row) => (
            <MyScheduleCard
              key={row.id}
              date={row.date}
              shiftType={row.shift_type === 'night' ? 'night' : 'day'}
              role={row.role ?? 'staff'}
              status={row.status ?? 'scheduled'}
              assignmentStatus={row.assignment_status}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          No published shifts in this window yet.{' '}
          <Link
            href="/shift-board"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Browse open shifts
          </Link>
        </p>
      )}
    </section>
  )
}
