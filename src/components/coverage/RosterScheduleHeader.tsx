'use client'

type RosterScheduleHeaderProps = {
  cycleLabel?: string | null
  heading: string
  showTitleBlock: boolean
}

export function RosterScheduleHeader({
  cycleLabel,
  heading,
  showTitleBlock,
}: RosterScheduleHeaderProps) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-muted/15 px-3 py-2 text-[11px] text-muted-foreground">
        <span className="font-semibold text-foreground">Roster matrix legend</span>
        <span className="rounded border border-border/70 bg-background px-1.5 py-0.5 font-semibold text-foreground">
          +
        </span>
        <span>Open day editor to add coverage</span>
        <span className="rounded border border-border/70 bg-background px-1.5 py-0.5 font-semibold text-foreground">
          1
        </span>
        <span>Scheduled</span>
        <span className="rounded border border-border/70 bg-background px-1.5 py-0.5 font-semibold text-foreground">
          OC/LE/CX/CI
        </span>
        <span>Operational status</span>
      </div>

      {showTitleBlock ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/12 px-3 py-2 text-xs">
          <span className="font-semibold text-foreground">{heading}</span>
          {cycleLabel ? <span className="text-muted-foreground">{cycleLabel}</span> : null}
        </div>
      ) : null}
    </>
  )
}
