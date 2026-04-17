import type { ReactNode } from 'react'

export type AvailabilityWorkspaceShellProps = {
  primaryHeader?: ReactNode
  controls: ReactNode
  calendar: ReactNode
  context: ReactNode
  secondaryContent?: ReactNode
}

export function AvailabilityWorkspaceShell({
  primaryHeader,
  controls,
  calendar,
  context,
  secondaryContent,
}: AvailabilityWorkspaceShellProps) {
  return (
    <div className="space-y-3">
      <section
        data-slot="availability-workspace-primary"
        className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-muted/[0.04] shadow-tw-md"
      >
        {primaryHeader ? (
          <div className="border-b border-border/60 px-5 py-3">{primaryHeader}</div>
        ) : null}
        <div className="grid gap-3 p-3 xl:grid-cols-[17.5rem_minmax(0,1.18fr)_19rem]">
          <div className="rounded-[1.15rem] bg-muted/[0.18] px-3.5 py-3.5">{controls}</div>
          <div className="rounded-[1.25rem] border border-border/60 bg-card px-4 py-4 shadow-[0_10px_26px_rgba(15,23,42,0.05)]">
            {calendar}
          </div>
          <section
            data-slot="availability-workspace-context"
            className="min-w-0 rounded-[1.15rem] bg-background/75 px-3.5 py-3.5"
          >
            {context}
          </section>
        </div>
      </section>

      {secondaryContent ? (
        <section
          data-slot="availability-workspace-secondary"
          className="overflow-hidden rounded-[1.35rem] border border-border/70 bg-card shadow-tw-sm"
        >
          {secondaryContent}
        </section>
      ) : null}
    </div>
  )
}
