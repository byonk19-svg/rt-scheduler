'use client'

import { useMemo, useState } from 'react'

import type { AvailabilityEntryTableRow } from '@/app/availability/availability-requests-table'
import { AvailabilityCalendarPanel } from '@/components/availability/availability-calendar-panel'
import { AvailabilityWorkspaceShell } from '@/components/availability/availability-workspace-shell'
import { FormSubmitButton } from '@/components/form-submit-button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { formatDateLabel, shiftMonthKey, toMonthStartKey } from '@/lib/calendar-utils'

type Cycle = {
  id: string
  label: string
  start_date: string
  end_date: string
  published: boolean
}

type Props = {
  cycles: Cycle[]
  availabilityRows: AvailabilityEntryTableRow[]
  initialCycleId: string
  submitAvailabilityEntryAction: (formData: FormData) => void | Promise<void>
  returnToPath?: '/availability' | '/therapist/availability'
}

export function TherapistAvailabilityWorkspace({
  cycles,
  availabilityRows,
  initialCycleId,
  submitAvailabilityEntryAction,
  returnToPath = '/availability',
}: Props) {
  const [selectedCycleId, setSelectedCycleId] = useState(initialCycleId || cycles[0]?.id || '')
  const [overrideType, setOverrideType] = useState<'force_off' | 'force_on'>('force_off')
  const [shiftType, setShiftType] = useState<'day' | 'night' | 'both'>('both')
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [note, setNote] = useState('')
  const [monthStart, setMonthStart] = useState(() => {
    const cycle = cycles.find((item) => item.id === initialCycleId)
    return toMonthStartKey(cycle?.start_date ?? initialCycleId)
  })

  const selectedCycle = useMemo(
    () => cycles.find((cycle) => cycle.id === selectedCycleId) ?? null,
    [cycles, selectedCycleId]
  )

  const cycleRows = useMemo(
    () => availabilityRows.filter((row) => row.cycleId === selectedCycleId),
    [availabilityRows, selectedCycleId]
  )

  const statusByDate = useMemo(() => {
    const next: Record<string, 'selected' | 'saved' | 'blocked'> = {}
    for (const row of cycleRows) {
      next[row.date] = row.entryType === 'force_off' ? 'blocked' : 'saved'
    }
    if (selectedDate) next[selectedDate] = 'selected'
    return next
  }, [cycleRows, selectedDate])

  const savedOffDates = cycleRows
    .filter((row) => row.entryType === 'force_off')
    .map((row) => row.date)
    .sort((a, b) => a.localeCompare(b))
  const savedOnDates = cycleRows
    .filter((row) => row.entryType === 'force_on')
    .map((row) => row.date)
    .sort((a, b) => a.localeCompare(b))

  function handleCycleChange(nextCycleId: string) {
    setSelectedCycleId(nextCycleId)
    const nextCycle = cycles.find((cycle) => cycle.id === nextCycleId)
    if (nextCycle) {
      setMonthStart(toMonthStartKey(nextCycle.start_date))
    }
    setSelectedDate('')
  }

  if (cycles.length === 0) {
    return (
      <section
        id="therapist-availability-workspace"
        className="rounded-[1.75rem] border border-slate-200/90 bg-white px-6 py-5 shadow-[0_1px_3px_rgba(15,23,42,0.08)]"
      >
        <h2 className="text-lg font-bold tracking-[-0.01em] text-slate-800">Future availability</h2>
        <p className="mt-2 text-sm text-slate-500">
          No upcoming cycle is open for availability yet.
        </p>
      </section>
    )
  }

  return (
    <section id="therapist-availability-workspace" className="space-y-6">
      <AvailabilityWorkspaceShell
        primaryHeader={
          <h2 className="inline-block border-b-2 border-[#2d5a5a] pb-3 text-sm font-bold text-[#2d5a5a]">
            Availability Inputs &amp; Calendar
          </h2>
        }
        controls={
          <div className="space-y-5">
            <div className="space-y-1">
              <h2 className="text-lg font-bold tracking-[-0.01em] text-slate-800">Save request</h2>
              <p className="text-sm text-slate-500">
                Pick one date on the calendar, choose the request type, and save it for this cycle.
              </p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="therapist_cycle_id"
                className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500"
              >
                Schedule cycle
              </Label>
              <select
                id="therapist_cycle_id"
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#2d5a5a] focus:ring-2 focus:ring-[#2d5a5a]/15"
                value={selectedCycleId}
                onChange={(event) => handleCycleChange(event.target.value)}
              >
                {cycles.map((cycle) => (
                  <option key={cycle.id} value={cycle.id}>
                    {cycle.label} ({cycle.start_date} to {cycle.end_date})
                  </option>
                ))}
              </select>
            </div>

            <form action={submitAvailabilityEntryAction} className="space-y-3">
              <input type="hidden" name="cycle_id" value={selectedCycleId} />
              <input type="hidden" name="date" value={selectedDate} />
              <input type="hidden" name="return_to" value={returnToPath} />

              <div className="space-y-2">
                <Label
                  htmlFor="therapist_override_type"
                  className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500"
                >
                  Request type
                </Label>
                <select
                  id="therapist_override_type"
                  name="override_type"
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#2d5a5a] focus:ring-2 focus:ring-[#2d5a5a]/15"
                  value={overrideType}
                  onChange={(event) =>
                    setOverrideType(event.target.value as 'force_off' | 'force_on')
                  }
                >
                  <option value="force_off">Need off</option>
                  <option value="force_on">Available to work</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="therapist_shift_type"
                  className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500"
                >
                  Shift
                </Label>
                <select
                  id="therapist_shift_type"
                  name="shift_type"
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#2d5a5a] focus:ring-2 focus:ring-[#2d5a5a]/15"
                  value={shiftType}
                  onChange={(event) => setShiftType(event.target.value as 'day' | 'night' | 'both')}
                >
                  <option value="both">Both shifts</option>
                  <option value="day">Day shift</option>
                  <option value="night">Night shift</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="therapist_note"
                  className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500"
                >
                  Note (optional)
                </Label>
                <input
                  id="therapist_note"
                  name="note"
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-[#2d5a5a] focus:ring-2 focus:ring-[#2d5a5a]/15"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Vacation, appointment, childcare, etc."
                />
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 rounded bg-[#f87171]" />
                    <span className="text-xs font-medium text-slate-600">Need off</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 rounded bg-[#4ade80]" />
                    <span className="text-xs font-medium text-slate-600">Available to work</span>
                  </div>
                </div>
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-3 py-3">
                  {selectedDate ? (
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                          Selected date
                        </p>
                        <p className="mt-1 text-sm font-medium text-slate-800">
                          {formatDateLabel(selectedDate)}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                        onClick={() => setSelectedDate('')}
                      >
                        Clear
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Select a date in the calendar to prepare this request.
                    </p>
                  )}
                </div>
              </div>

              <FormSubmitButton
                type="submit"
                pendingText="Saving..."
                disabled={!selectedDate}
                className="bg-[#2d5a5a] text-white hover:bg-[#244a4a]"
              >
                Save request
              </FormSubmitButton>
            </form>
          </div>
        }
        calendar={
          <div className="space-y-5">
            <AvailabilityCalendarPanel
              monthStart={monthStart}
              cycleStart={selectedCycle?.start_date ?? monthStart}
              cycleEnd={selectedCycle?.end_date ?? monthStart}
              selectedDates={selectedDate ? [selectedDate] : []}
              statusByDate={statusByDate}
              onPreviousMonth={() => setMonthStart((current) => shiftMonthKey(current, -1))}
              onNextMonth={() => setMonthStart((current) => shiftMonthKey(current, 1))}
              onToggleDate={(date) => setSelectedDate((current) => (current === date ? '' : date))}
            />
            <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
              <Badge className="bg-[#f87171] text-white">Need off</Badge>
              <span className="text-sm text-slate-500">Dates you cannot work.</span>
              <Badge className="bg-[#4ade80] text-white">Available to work</Badge>
              <span className="text-sm text-slate-500">Extra dates you can help cover.</span>
            </div>
          </div>
        }
        aside={
          <div className="space-y-4 px-5 py-5">
            <div className="space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
                Saved for this cycle
              </p>
              <p className="text-sm text-slate-500">
                {cycleRows.length > 0
                  ? `${cycleRows.length} request${cycleRows.length === 1 ? '' : 's'} on file`
                  : 'No requests saved yet for this cycle.'}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">Need off</p>
                {savedOffDates.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {savedOffDates.map((date) => (
                      <Badge key={`off-${date}`} className="bg-[#f87171] text-white">
                        {formatDateLabel(date)}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">No saved blocked dates.</p>
                )}
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-800">Available to work</p>
                {savedOnDates.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {savedOnDates.map((date) => (
                      <Badge key={`on-${date}`} className="bg-[#4ade80] text-white">
                        {formatDateLabel(date)}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">No extra work dates saved.</p>
                )}
              </div>
            </div>
          </div>
        }
        lower={
          <div className="rounded-[1.75rem] border border-slate-200/90 bg-white px-5 py-5 shadow-[0_1px_3px_rgba(15,23,42,0.08)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
              Submission note
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Need off means you cannot work. Available to work means you are open to helping cover
              that date.
            </p>
          </div>
        }
      />
    </section>
  )
}
