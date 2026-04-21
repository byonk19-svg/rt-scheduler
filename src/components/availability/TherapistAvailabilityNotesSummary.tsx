'use client'

import { therapistDayStatusLabel } from '@/components/availability/TherapistAvailabilityCalendar'
import { formatDateLabel } from '@/lib/calendar-utils'
import { cn } from '@/lib/utils'

type DayStatus = 'none' | 'force_on' | 'force_off'

type TherapistAvailabilityNotesSummaryProps = {
  daysWithNoteText: string[]
  draftNotesByDate: Record<string, string>
  draftStatusByDate: Record<string, DayStatus>
}

export function TherapistAvailabilityNotesSummary({
  daysWithNoteText,
  draftNotesByDate,
  draftStatusByDate,
}: TherapistAvailabilityNotesSummaryProps) {
  return (
    <div className="border-t border-border/70 px-5 py-4 sm:px-6">
      <div className="space-y-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Day Notes</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Review notes you&apos;ve added for this cycle. Edit them by selecting the day in the
            calendar above.
          </p>
        </div>
        {daysWithNoteText.length === 0 ? (
          <p className="text-sm text-muted-foreground">No day-specific notes yet.</p>
        ) : (
          <ul className="space-y-2">
            {daysWithNoteText.map((date) => {
              const status = draftStatusByDate[date] ?? 'none'
              const preview = (draftNotesByDate[date] ?? '').trim()
              return (
                <li
                  key={`note-summary-${date}`}
                  className="flex flex-col gap-0.5 rounded-xl border border-border/70 bg-muted/10 px-3 py-2 text-sm sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-2"
                >
                  <span className="font-medium text-foreground">{formatDateLabel(date)}</span>
                  <span className="text-muted-foreground">·</span>
                  <span
                    className={cn(
                      'font-medium',
                      status === 'force_off' && 'text-[var(--error-text)]',
                      status === 'force_on' && 'text-[var(--info-text)]',
                      status === 'none' && 'text-muted-foreground'
                    )}
                  >
                    {therapistDayStatusLabel(status)}
                  </span>
                  <span className="hidden text-muted-foreground sm:inline">—</span>
                  <span className="line-clamp-2 text-muted-foreground sm:min-w-0 sm:flex-1">
                    &ldquo;{preview}&rdquo;
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
