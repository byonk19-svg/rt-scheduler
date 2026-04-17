import { redirect } from 'next/navigation'

type ScheduleSearchParams = Record<string, string | string[] | undefined>

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

/** Canonical staff schedule UI lives on `/coverage` (permission-gated actions). */
export default async function TherapistSchedulePage({
  searchParams,
}: {
  searchParams?: Promise<ScheduleSearchParams>
}) {
  const params = searchParams ? await searchParams : {}
  const passthrough = new URLSearchParams()

  for (const [key, rawValue] of Object.entries(params ?? {})) {
    const value = firstValue(rawValue)
    if (!value) continue
    passthrough.set(key, value)
  }

  const query = passthrough.toString()
  redirect(query ? `/coverage?${query}` : '/coverage')
}
