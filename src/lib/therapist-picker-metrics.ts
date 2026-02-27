export type WorkloadShift = {
  userId: string
  date: string
  status: 'scheduled' | 'on_call' | 'sick' | 'called_off'
}

export type WorkloadCount = {
  weekShiftCount: number
  cycleShiftCount: number
}

function keyFromDate(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function countsTowardWorkload(status: WorkloadShift['status']): boolean {
  return status === 'scheduled' || status === 'on_call'
}

export function getWeekBoundsForDate(value: string): { weekStart: string; weekEnd: string } | null {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return null

  const weekStart = new Date(parsed)
  weekStart.setDate(parsed.getDate() - parsed.getDay())

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)

  return {
    weekStart: keyFromDate(weekStart),
    weekEnd: keyFromDate(weekEnd),
  }
}

export function buildTherapistWorkloadCounts({
  shifts,
  weekStart,
  weekEnd,
  cycleStart,
  cycleEnd,
}: {
  shifts: WorkloadShift[]
  weekStart: string
  weekEnd: string
  cycleStart: string
  cycleEnd: string
}): Map<string, WorkloadCount> {
  const weekDatesByUser = new Map<string, Set<string>>()
  const cycleDatesByUser = new Map<string, Set<string>>()

  for (const shift of shifts) {
    if (!countsTowardWorkload(shift.status)) continue
    if (shift.date < cycleStart || shift.date > cycleEnd) continue

    const cycleSet = cycleDatesByUser.get(shift.userId) ?? new Set<string>()
    cycleSet.add(shift.date)
    cycleDatesByUser.set(shift.userId, cycleSet)

    if (shift.date < weekStart || shift.date > weekEnd) continue
    const weekSet = weekDatesByUser.get(shift.userId) ?? new Set<string>()
    weekSet.add(shift.date)
    weekDatesByUser.set(shift.userId, weekSet)
  }

  const result = new Map<string, WorkloadCount>()
  const allUserIds = new Set<string>([
    ...Array.from(weekDatesByUser.keys()),
    ...Array.from(cycleDatesByUser.keys()),
  ])

  for (const userId of allUserIds) {
    result.set(userId, {
      weekShiftCount: weekDatesByUser.get(userId)?.size ?? 0,
      cycleShiftCount: cycleDatesByUser.get(userId)?.size ?? 0,
    })
  }

  return result
}
