import { redirect } from 'next/navigation'

export default async function SchedulePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = searchParams ? await searchParams : undefined
  const nextParams = new URLSearchParams()
  const cycle = Array.isArray(params?.cycle) ? params?.cycle[0] : params?.cycle
  const shift = Array.isArray(params?.shift) ? params?.shift[0] : params?.shift

  nextParams.set('view', 'roster')
  if (cycle) nextParams.set('cycle', cycle)
  if (shift) nextParams.set('shift', shift)

  redirect(`/coverage?${nextParams.toString()}`)
}
