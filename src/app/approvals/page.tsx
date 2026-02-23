import { redirect } from 'next/navigation'

type ApprovalsSearchParams = Record<string, string | string[] | undefined>

function getSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams?: Promise<ApprovalsSearchParams>
}) {
  const params = searchParams ? await searchParams : undefined
  const urlParams = new URLSearchParams()

  for (const [key, value] of Object.entries(params ?? {})) {
    const normalized = getSearchParam(value)
    if (normalized) urlParams.set(key, normalized)
  }

  if (!urlParams.get('status')) {
    urlParams.set('status', 'pending')
  }

  redirect(`/shift-board?${urlParams.toString()}#open-posts`)
}
