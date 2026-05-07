import type { Metadata } from 'next'

import { PublishedSchedulePage } from '@/components/schedule/PublishedSchedulePage'

export const metadata: Metadata = {
  title: 'My Shifts',
  description: 'View upcoming published shifts on your schedule.',
}

type TherapistScheduleSearchParams = Record<string, string | string[] | undefined>

export default async function TherapistSchedulePage({
  searchParams,
}: {
  searchParams?: Promise<TherapistScheduleSearchParams>
}) {
  const params = searchParams ? await searchParams : undefined
  return (
    <PublishedSchedulePage title="My Shifts" backHref="/dashboard/staff" searchParams={params} />
  )
}
