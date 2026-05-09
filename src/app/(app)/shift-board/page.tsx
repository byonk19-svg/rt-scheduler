import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import ShiftBoardClientPage from '@/components/shift-board/ShiftBoardClientPage'
import { loadShiftBoardSnapshot } from '@/lib/shift-board-snapshot'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Shift Board',
  description: 'Review and manage shift swap and pickup requests.',
}

export default async function ShiftBoardPage() {
  const supabase = await createClient()
  const snapshot = await loadShiftBoardSnapshot({ supabase, tab: 'open' })

  if (snapshot.unauthorized) {
    redirect('/login')
  }

  return <ShiftBoardClientPage initialSnapshot={snapshot} />
}
