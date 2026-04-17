type MyScheduleCardProps = {
  date: string
  shiftType: 'day' | 'night'
  role: string
  status: string
  assignmentStatus: string | null
}

function formatCardDate(isoDate: string): string {
  const parsed = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return isoDate
  return parsed.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function assignmentChipLabel(value: string): string {
  switch (value) {
    case 'scheduled':
      return 'Scheduled'
    case 'call_in':
      return 'Call in'
    case 'cancelled':
      return 'Cancelled'
    case 'on_call':
      return 'On call'
    case 'left_early':
      return 'Left early'
    default:
      return value
  }
}

export function MyScheduleCard({
  date,
  shiftType,
  role,
  status,
  assignmentStatus,
}: MyScheduleCardProps) {
  const showAssignmentChip = Boolean(assignmentStatus) && assignmentStatus !== 'scheduled'

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5 shadow-tw-sm">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-foreground">{formatCardDate(date)}</p>
        <span
          className="inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          style={{
            borderColor: shiftType === 'day' ? 'var(--info-border)' : 'var(--warning-border)',
            backgroundColor: shiftType === 'day' ? 'var(--info-subtle)' : 'var(--warning-subtle)',
            color: shiftType === 'day' ? 'var(--info-text)' : 'var(--warning-text)',
          }}
        >
          {shiftType}
        </span>
        {role === 'lead' ? (
          <span
            className="inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
            style={{
              borderColor: 'var(--attention)',
              backgroundColor: 'var(--warning-subtle)',
              color: 'var(--warning-text)',
            }}
          >
            Lead
          </span>
        ) : null}
        {showAssignmentChip ? (
          <span
            className="inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold"
            style={{
              borderColor: 'var(--info-border)',
              backgroundColor: 'var(--info-subtle)',
              color: 'var(--info-text)',
            }}
          >
            {assignmentChipLabel(assignmentStatus!)}
          </span>
        ) : null}
      </div>
      {status !== 'scheduled' ? (
        <p className="mt-1.5 text-[10px] capitalize text-muted-foreground">
          Coverage:{' '}
          <span className="font-medium text-foreground">{status.replaceAll('_', ' ')}</span>
        </p>
      ) : null}
    </div>
  )
}
