import type { ReactNode } from 'react'

type AvailabilityWorkspaceShellProps = {
  primaryHeader?: ReactNode
  controls: ReactNode
  calendar: ReactNode
  aside: ReactNode
  lower: ReactNode
  /**
   * When set (e.g. manager “Review requests” table), on xl+ screens the aside + lower stack
   * stays in the left column and this panel sits on the right — matching dashboard-style mocks.
   */
  trailing?: ReactNode
}

export function AvailabilityWorkspaceShell({
  primaryHeader,
  controls,
  calendar,
  aside,
  lower,
  trailing,
}: AvailabilityWorkspaceShellProps) {
  const asideAndLower = (
    <div className="space-y-6">
      <section
        data-slot="availability-workspace-aside"
        className="overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-[0_1px_3px_rgba(15,23,42,0.08)]"
      >
        {aside}
      </section>
      <section data-slot="availability-workspace-lower">{lower}</section>
    </div>
  )

  return (
    <div className="space-y-6">
      <section
        data-slot="availability-workspace-primary"
        className="overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-[0_1px_3px_rgba(15,23,42,0.08)]"
      >
        {primaryHeader ? (
          <div className="border-b border-border/80 px-6 py-4">{primaryHeader}</div>
        ) : null}
        <div className="grid lg:grid-cols-[18.5rem_minmax(0,1fr)]">
          <div className="border-b border-border/80 bg-muted/30 px-5 py-5 lg:border-b-0 lg:border-r">
            {controls}
          </div>
          <div className="px-5 py-5">{calendar}</div>
        </div>
      </section>

      {trailing ? (
        <div
          data-slot="availability-workspace-split"
          className="xl:grid xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] xl:items-start xl:gap-6"
        >
          <div className="min-w-0">{asideAndLower}</div>
          <div className="min-w-0 xl:pt-0">{trailing}</div>
        </div>
      ) : (
        asideAndLower
      )}
    </div>
  )
}
