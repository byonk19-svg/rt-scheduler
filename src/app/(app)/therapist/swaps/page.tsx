import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import RequestsWorkspacePage from '@/app/(app)/requests/new/page'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Shift Swaps & Pickups',
  description: 'Create and track your shift swap and pickup requests.',
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
