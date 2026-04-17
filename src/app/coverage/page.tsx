import { Suspense } from 'react'
import { redirect } from 'next/navigation'

import { CoverageClientPage } from '@/app/coverage/CoverageClientPage'
import {
  defaultCoverageShiftTabFromProfileShift,
  normalizeActorShiftType,
  parseCoverageShiftSearchParam,
} from '@/lib/coverage/coverage-shift-tab'
import { normalizeDefaultScheduleView, normalizeViewMode } from '@/lib/schedule-helpers'
import { createClient } from '@/lib/supabase/server'

function firstSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function buildCoverageLoginRedirectTo(
  sp: Record<string, string | string[] | undefined>
): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(sp)) {
    const v = Array.isArray(value) ? value[0] : value
    if (v) params.set(key, v)
  }
  const qs = params.toString()
  return qs ? `/coverage?${qs}` : '/coverage'
}

export default async function CoveragePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = (await searchParams) ?? {}
  const shiftRaw = firstSearchParam(sp.shift)
  const viewRaw = firstSearchParam(sp.view)
  const urlShiftTab = parseCoverageShiftSearchParam(shiftRaw ?? null)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?redirectTo=${encodeURIComponent(buildCoverageLoginRedirectTo(sp))}`)
  }

  let profileShift: ReturnType<typeof normalizeActorShiftType> = null
  let defaultScheduleView: 'week' | 'roster' = 'week'
  const { data: prof } = await supabase
    .from('profiles')
    .select('shift_type, default_schedule_view')
    .eq('id', user.id)
    .maybeSingle()
  profileShift = normalizeActorShiftType(prof?.shift_type)
  defaultScheduleView = normalizeDefaultScheduleView(
    (prof as { default_schedule_view?: string | null } | null)?.default_schedule_view ?? undefined
  )

  const initialViewMode = viewRaw ? normalizeViewMode(viewRaw) : defaultScheduleView
  const initialShiftTab = urlShiftTab ?? defaultCoverageShiftTabFromProfileShift(profileShift)
  const shiftTabLockedFromUrl = urlShiftTab != null

  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <CoverageClientPage
        initialShiftTab={initialShiftTab}
        shiftTabLockedFromUrl={shiftTabLockedFromUrl}
        initialViewMode={initialViewMode as 'week' | 'calendar' | 'roster'}
      />
    </Suspense>
  )
}
