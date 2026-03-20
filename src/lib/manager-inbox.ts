const SIX_WEEK_CYCLE_DAYS = 42

function addDays(dateKey: string, days: number): string {
  const parsed = new Date(`${dateKey}T00:00:00Z`)
  parsed.setUTCDate(parsed.getUTCDate() + days)
  return parsed.toISOString().slice(0, 10)
}

export function getNextCyclePlanningWindow(nextCycleStart: string | null): {
  collectAvailabilityOn: string | null
  publishBy: string | null
} {
  if (!nextCycleStart) {
    return {
      collectAvailabilityOn: null,
      publishBy: null,
    }
  }

  return {
    collectAvailabilityOn: addDays(nextCycleStart, -SIX_WEEK_CYCLE_DAYS),
    publishBy: addDays(nextCycleStart, -1),
  }
}
