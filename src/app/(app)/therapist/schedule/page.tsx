import type { Metadata } from 'next'

import { PublishedSchedulePage } from '@/components/schedule/PublishedSchedulePage'

export const metadata: Metadata = {
  title: 'My Shifts',
  description: 'View upcoming published shifts on your schedule.',
}

export default async function TherapistSchedulePage() {
  return <PublishedSchedulePage title="My Shifts" backHref="/dashboard/staff" />
}
