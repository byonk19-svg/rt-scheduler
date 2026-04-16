'use client'

import { useRouter } from 'next/navigation'

type ScheduleCycleSelectProps = {
  cycles: Array<{ id: string; label: string }>
  activeCycleId: string
}

export function ScheduleCycleSelect({ cycles, activeCycleId }: ScheduleCycleSelectProps) {
  const router = useRouter()

  if (cycles.length < 2) return null

  return (
    <label className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      <span className="font-medium text-foreground">Cycle</span>
      <select
        className="rounded-full border border-border/80 bg-card px-3 py-1.5 text-sm font-medium text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        value={activeCycleId}
        onChange={(event) => {
          const next = event.target.value
          router.replace(next ? `/schedule?cycle=${encodeURIComponent(next)}` : '/schedule')
        }}
      >
        {cycles.map((cycle) => (
          <option key={cycle.id} value={cycle.id}>
            {cycle.label}
          </option>
        ))}
      </select>
    </label>
  )
}
