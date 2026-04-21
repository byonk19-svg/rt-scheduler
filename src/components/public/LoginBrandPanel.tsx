'use client'

import { CalendarDays } from 'lucide-react'

export function LoginBrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-[var(--sidebar)] lg:flex lg:w-[440px] lg:shrink-0 lg:flex-col lg:justify-between lg:p-12">
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(color-mix(in srgb, var(--sidebar-primary) 7%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--sidebar-primary) 7%, transparent) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />
      <div className="relative flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--attention)] shadow-tw-md-soft">
          <CalendarDays className="h-5 w-5 text-accent-foreground" />
        </div>
        <div>
          <p className="font-heading text-base font-bold text-sidebar-primary">Teamwise</p>
          <p className="text-[0.7rem] text-[var(--sidebar-foreground)]">Respiratory Therapy</p>
        </div>
      </div>
      <div className="relative space-y-5 border-l-[4px] border-[var(--attention)]/45 pl-6">
        <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-sidebar-primary/85">
          Scheduling for RT teams
        </p>
        <div className="space-y-3">
          <p className="font-display text-[1.95rem] font-bold leading-[1.06] tracking-[-0.035em] text-sidebar-primary xl:text-[2.35rem]">
            Scheduling that keeps care moving.
          </p>
          <p className="text-sm font-medium leading-relaxed text-[var(--sidebar-foreground)]">
            Coverage planning, availability, and shift management — built for RT departments.
          </p>
        </div>
      </div>
    </aside>
  )
}
