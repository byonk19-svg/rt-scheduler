import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import RequestsWorkspacePage from '@/app/(app)/requests/new/page'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Trade & Coverage Requests',
  description: 'Create and track your trade and coverage requests.',
}

export default async function TherapistSwapsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return <RequestsWorkspacePage />
}
