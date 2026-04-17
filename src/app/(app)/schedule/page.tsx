import Link from 'next/link'
import { redirect } from 'next/navigation'

import { loadScheduleRosterPageData } from '@/app/(app)/schedule/schedule-roster-live-data'
import { ScheduleRosterScreen } from '@/components/schedule-roster/ScheduleRosterScreen'

function ScheduleNoCycle() {
  return (
    <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-4 px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="app-page-title text-foreground">No active schedule cycle</h1>
      <p className="max-w-xl text-sm leading-6 text-muted-foreground">
        There is no non-archived cycle with an end date on or after today. Create or select a cycle
        from Coverage to view the roster here.
      </p>
      <Link
        href="/coverage"
        className="inline-flex w-fit rounded-full border border-border/80 bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/60 hover:no-underline"
      >
        Open Coverage
      </Link>
    </div>
  )
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = searchParams ? await searchParams : undefined
  const result = await loadScheduleRosterPageData(params)

  if (result.status === 'forbidden') {
    redirect('/dashboard/staff')
  }

  if (result.status === 'no_cycle') {
    return <ScheduleNoCycle />
  }

  return <ScheduleRosterScreen key={result.data.cycleId} live={result.data} />
}
