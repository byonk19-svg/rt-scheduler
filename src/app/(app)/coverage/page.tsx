import { CoverageClientPage } from '@/app/(app)/coverage/CoverageClientPage'
import { getCoveragePageServerData } from '@/app/(app)/coverage/coverage-page-data'

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
