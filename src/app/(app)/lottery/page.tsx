import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import LotteryClientPage from '@/components/lottery/LotteryClientPage'
import { loadLotteryActor, loadLotterySnapshot } from '@/lib/lottery/service'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Lottery',
}

type LotterySearchParams = {
  date?: string | string[]
  shift?: string | string[]
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

export default async function LotteryPage({
  searchParams,
}: {
  searchParams?: Promise<LotterySearchParams>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const actor = await loadLotteryActor(user.id)
  if (!actor) {
    redirect('/dashboard/staff')
  }

  const params = (await searchParams) ?? {}
  const snapshot = await loadLotterySnapshot({
    actor,
    shiftDate: firstParam(params.date) ?? null,
    shiftType: firstParam(params.shift) === 'night' ? 'night' : 'day',
  })

  return <LotteryClientPage initialSnapshot={snapshot} />
}
