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
  const rawShift = params.shift
  const shift = typeof rawShift === 'string' ? rawShift : null
  redirect(shift ? `/schedule?shift=${encodeURIComponent(shift)}` : '/schedule')
}
