import { redirect } from 'next/navigation'

type ScheduleSearchParams = Record<string, string | string[] | undefined>

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

/**
 * Legacy `/therapist/schedule` URL — redirects to the shared team calendar (`/coverage`), preserving
 * query params (for example `?date=`). Nav and product copy use “Team schedule” for this surface;
 * personal published assignments live under `/staff/my-schedule` (“My shifts”). The redirect target
 * stays `/coverage` so existing bookmarks and shared links keep working; change only with an
 * explicit product decision.
 */
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
