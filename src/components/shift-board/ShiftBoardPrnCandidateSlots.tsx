'use client'

type PickupGroup = {
  shiftId: string
  shiftLabel: string
  candidates: Array<{
    id: string
    poster: string
    postedAt: string
  }>
}

export function ShiftBoardPrnCandidateSlots({
  groups,
  onSelectCandidate,
  savingState,
}: {
  groups: PickupGroup[]
  onSelectCandidate: (candidateId: string) => void
  savingState: Record<string, boolean>
}) {
  return (
    <section className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        PRN Interest - Multiple Candidates
      </p>
      {groups.map((group) => (
        <div key={group.shiftId} className="rounded-xl border border-border bg-card p-4">
          <p className="mb-3 text-sm font-semibold text-foreground">
            {group.shiftLabel}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {group.candidates.length} interested
            </span>
          </p>
          <div className="space-y-2">
            {group.candidates.map((candidate, index) => (
              <div
                key={candidate.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    #{index + 1}
                  </span>
                  <span className="text-sm font-medium text-foreground">{candidate.poster}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(candidate.postedAt).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={savingState[candidate.id]}
                  onClick={() => onSelectCandidate(candidate.id)}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {savingState[candidate.id] ? 'Selecting...' : 'Select'}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}
