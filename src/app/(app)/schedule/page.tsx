import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { loadScheduleRosterPageData } from '@/app/(app)/schedule/schedule-roster-live-data'
import { ScheduleRosterScreen } from '@/components/schedule-roster/ScheduleRosterScreen'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Roster View',
  description:
    'Review the table and print view of the Team Schedule for the active Schedule Block.',
}

type SchedulePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function SchedulePage(props: SchedulePageProps) {
  const searchParams = (await props.searchParams) ?? {}
  const pageData = await loadScheduleRosterPageData(searchParams)

  if (pageData.status === 'unauthenticated') {
    redirect('/login')
  }

  if (pageData.status === 'forbidden') {
    redirect('/dashboard/staff')
  }

  if (pageData.status === 'no_cycle') {
    return (
      <div className="mx-auto flex w-full max-w-[960px] flex-col px-2 py-2 sm:px-3 lg:px-5">
        <section className="rounded-[26px] border border-border/70 bg-card px-6 py-8 shadow-[0_24px_64px_rgba(15,23,42,0.08)]">
          <h1 className="font-heading text-[1.75rem] font-semibold tracking-[-0.04em] text-foreground sm:text-[1.9rem]">
            Roster View
          </h1>
          <p className="mt-3 text-base font-medium text-foreground">No active Schedule Block yet</p>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Create or reopen a Schedule Block in Coverage, then return here for the Team Schedule
            roster view.
          </p>
          <div className="mt-5">
            <Button asChild>
              <Link href="/coverage">Open Coverage</Link>
            </Button>
          </div>
        </section>
      </div>
    )
  }

  return <ScheduleRosterScreen live={pageData.data} />
}
