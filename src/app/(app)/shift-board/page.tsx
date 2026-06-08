import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import ShiftBoardClientPage from '@/components/shift-board/ShiftBoardClientPage'
import { loadShiftBoardSnapshot } from '@/lib/shift-board-snapshot'
import { resolveShiftBoardTab } from '@/lib/shift-board/tabs'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Shift Board',
  description: 'Review and manage trade and coverage requests.',
}

type ShiftBoardSearchParams = { tab?: string | string[] }

function getSearchParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export default async function ShiftBoardPage({
  searchParams,
}: {
  searchParams?: Promise<ShiftBoardSearchParams>
}) {
  const params = searchParams ? await searchParams : undefined
  const initialTab = resolveShiftBoardTab(getSearchParam(params?.tab))
  const supabase = await createClient()
  const snapshot = await loadShiftBoardSnapshot({
    supabase,
    tab: initialTab === 'history' ? 'history' : 'open',
  })

  if (snapshot.unauthorized) {
    redirect('/login')
  }

  return <ShiftBoardClientPage initialSnapshot={snapshot} initialTab={initialTab} />
}
