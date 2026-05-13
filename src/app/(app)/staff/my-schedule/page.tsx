import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { buildScheduleRedirectPath } from '@/app/(app)/schedule/legacy-redirect'

export const metadata: Metadata = {
  title: 'Schedule',
  description: 'Redirects to the unified Schedule grid.',
}

export default async function StaffMyScheduleRedirectPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  redirect(buildScheduleRedirectPath((await searchParams) ?? {}))
}
