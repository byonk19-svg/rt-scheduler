export function buildCycleRoute(path: '/schedule', cycleId: string | null): string {
  const params = new URLSearchParams()
  if (cycleId) params.set('cycle', cycleId)
  const query = params.toString()
  return query ? `${path}?${query}` : path
}
