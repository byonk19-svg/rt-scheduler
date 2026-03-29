import type { ReactNode } from 'react'

type AvailabilityWorkspaceShellProps = {
  primaryHeader?: ReactNode
  controls: ReactNode
  calendar: ReactNode
  aside: ReactNode
  lower: ReactNode
}

export function AvailabilityWorkspaceShell({
  primaryHeader,
  controls,
  calendar,
  aside,
  lower,
}: AvailabilityWorkspaceShellProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <section
          data-slot="availability-workspace-primary"
          className="overflow-hidden rounded-[1.75rem] border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.08)]"
        >
          {primaryHeader ? (
            <div className="border-b border-slate-200/80 px-6 py-4">{primaryHeader}</div>
          ) : null}
          <div className="grid lg:grid-cols-[18.5rem_minmax(0,1fr)]">
            <div className="border-b border-slate-200/80 bg-slate-50/60 px-5 py-5 lg:border-b-0 lg:border-r">
              {controls}
            </div>
            <div className="px-5 py-5">{calendar}</div>
          </div>
        </section>
        <section
          data-slot="availability-workspace-aside"
          className="overflow-hidden rounded-[1.75rem] border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.08)]"
        >
          {aside}
        </section>
      </div>
      <section data-slot="availability-workspace-lower">{lower}</section>
    </div>
  )
}
