import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { buildScheduleRedirectPath } from '@/app/(app)/schedule/legacy-redirect'

export const metadata: Metadata = {
  title: 'Schedule',
  description: 'Open the unified respiratory therapy schedule grid.',
}

export default async function CoverageRedirectPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = (await searchParams) ?? {}
  redirect(buildScheduleRedirectPath(params, { preserveAll: true }))
}
