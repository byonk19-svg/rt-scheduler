import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { ManagerToolAccessDenied } from '@/components/auth/ManagerToolAccessDenied'
import LotteryClientPage from '@/components/lottery/LotteryClientPage'
import { loadLotteryActor, loadLotterySnapshot } from '@/lib/lottery/service'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Lottery',
}

type LotterySearchParams = {
  date?: string | string[]
  shift?: string | string[]
  keepToWork?: string | string[]
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
    return <ManagerToolAccessDenied toolName="Lottery" />
  }

  const params = (await searchParams) ?? {}
  const keepToWorkRaw = firstParam(params.keepToWork)
  const keepToWork =
    keepToWorkRaw == null || keepToWorkRaw.trim() === '' ? null : Number(keepToWorkRaw)
  const snapshot = await loadLotterySnapshot({
    actor,
    shiftDate: firstParam(params.date) ?? null,
    shiftType: firstParam(params.shift) === 'night' ? 'night' : 'day',
    keepToWork: Number.isFinite(keepToWork) ? Math.trunc(keepToWork as number) : null,
  })

  return <LotteryClientPage initialSnapshot={snapshot} />
}
