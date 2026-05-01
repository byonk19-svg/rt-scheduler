import type { Metadata } from 'next'

import { CoverageClientPage } from '@/app/coverage/CoverageClientPage'
import { getCoveragePageServerData } from '@/app/(app)/coverage/coverage-page-data'

export const metadata: Metadata = {
  title: 'Schedule Workspace',
  description: 'Edit and manage the respiratory therapy shift schedule.',
}

export default async function CoveragePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const data = await getCoveragePageServerData({
    searchParams: (await searchParams) ?? {},
  })

  return <CoverageClientPage {...data} />
}
