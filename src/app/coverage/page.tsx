import { Suspense } from 'react'

import { CoverageClientPage } from '@/app/coverage/CoverageClientPage'
import {
  defaultCoverageShiftTabFromProfileShift,
  normalizeActorShiftType,
  parseCoverageShiftSearchParam,
} from '@/lib/coverage/coverage-shift-tab'
import { createClient } from '@/lib/supabase/server'

function firstSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

export default async function CoveragePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = (await searchParams) ?? {}
  const shiftRaw = firstSearchParam(sp.shift)
  const urlShiftTab = parseCoverageShiftSearchParam(shiftRaw ?? null)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let profileShift: ReturnType<typeof normalizeActorShiftType> = null
  if (user) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('shift_type')
      .eq('id', user.id)
      .maybeSingle()
    profileShift = normalizeActorShiftType(prof?.shift_type)
  }

  const initialShiftTab = urlShiftTab ?? defaultCoverageShiftTabFromProfileShift(profileShift)
  const shiftTabLockedFromUrl = urlShiftTab != null

  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <CoverageClientPage
        initialShiftTab={initialShiftTab}
        shiftTabLockedFromUrl={shiftTabLockedFromUrl}
      />
    </Suspense>
  )
}
