import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Schedule',
  description: 'Redirects to the unified Schedule grid.',
}

export default function TherapistScheduleRedirectPage() {
  redirect('/schedule')
}
