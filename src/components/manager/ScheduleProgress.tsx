'use client'

import { motion } from 'framer-motion'

import { Progress } from '@/components/ui/progress'

export function computeProgress(filled: number, total: number) {
  if (total === 0) return { pct: 0, gaps: 0 }

  return {
    pct: Math.round((filled / total) * 100),
    gaps: Math.max(total - filled, 0),
  }
}

type ScheduleProgressProps = {
  dayFilled: number
  dayTotal: number
  nightFilled: number
  nightTotal: number
}

export function ScheduleProgress({
  dayFilled,
  dayTotal,
  nightFilled,
  nightTotal,
}: ScheduleProgressProps) {
  const day = computeProgress(dayFilled, dayTotal)
  const night = computeProgress(nightFilled, nightTotal)
  const overallFilled = dayFilled + nightFilled
  const overallTotal = dayTotal + nightTotal
  const overall = computeProgress(overallFilled, overallTotal)
  const rows = [
    { label: 'Day Shifts', ...day, filled: dayFilled, total: dayTotal },
    { label: 'Night Shifts', ...night, filled: nightFilled, total: nightTotal },
  ]

  return (
    <div className="rounded-2xl border border-border/70 bg-card shadow-[0_1px_8px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
        <h3 className="text-sm font-medium text-foreground">Schedule Completion</h3>
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Active cycle
        </span>
      </div>

      <div className="space-y-5 px-5 py-4">
        {rows.map((row, index) => (
          <motion.div
            key={row.label}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.08, duration: 0.3 }}
          >
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-sm font-medium text-foreground">{row.label}</span>
              <span className="tabular-nums text-xs font-medium text-muted-foreground">
                {row.filled}/{row.total}
              </span>
            </div>
            <Progress value={row.pct} className="h-1.5" />
            <div className="mt-1 flex justify-between">
              <span className="text-[11px] text-muted-foreground">{row.pct}%</span>
              <span className="text-[11px] text-muted-foreground">{row.gaps} remaining</span>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="border-t border-border/70 px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Overall</p>
            <p className="text-[11px] text-muted-foreground">All shifts</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-foreground tabular-nums">{overall.pct}%</p>
            {overall.gaps > 0 && (
              <p className="text-[11px] text-muted-foreground">{overall.gaps} gaps</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
