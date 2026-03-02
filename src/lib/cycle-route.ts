export function buildCycleRoute(path: '/coverage' | '/schedule', cycleId: string | null): string {
  const params = new URLSearchParams({ view: 'week' })
  if (cycleId) params.set('cycle', cycleId)
  return `${path}?${params.toString()}`
}
