import type { Metadata } from 'next'

import { PublishedSchedulePage } from '@/components/schedule/PublishedSchedulePage'

export const metadata: Metadata = {
  title: 'My Shifts',
}

type StaffMyScheduleSearchParams = Record<string, string | string[] | undefined>

export default async function StaffMySchedulePage({
  searchParams,
}: {
  searchParams?: Promise<StaffMyScheduleSearchParams>
}) {
  const params = searchParams ? await searchParams : undefined
  return (
    <PublishedSchedulePage
      title="My Shifts"
      backHref="/dashboard/staff"
      scheduleHref="/staff/my-schedule"
      searchParams={params}
    />
  )
}
