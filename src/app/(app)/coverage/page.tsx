import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

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
  const query = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') {
      query.set(key, value)
      continue
    }
    if (Array.isArray(value)) {
      for (const item of value) query.append(key, item)
    }
  }

  redirect(query.size > 0 ? `/schedule?${query.toString()}` : '/schedule')
}
