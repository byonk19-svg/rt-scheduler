export function computeProgress(filled: number, total: number) {
  if (total === 0) return { pct: 0, gaps: 0 }

  return {
    pct: Math.round((filled / total) * 100),
    gaps: Math.max(total - filled, 0),
  }
}
