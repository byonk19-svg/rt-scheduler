import type { Metadata } from 'next'

import { PublishedSchedulePage } from '@/components/schedule/PublishedSchedulePage'

export const metadata: Metadata = {
  title: 'My Shifts',
}

export default async function StaffMySchedulePage() {
  return <PublishedSchedulePage title="My Shifts" backHref="/dashboard/staff" />
}
