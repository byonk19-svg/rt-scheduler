'use client'

import { useMemo, useState } from 'react'

import { EmptyState } from '@/components/EmptyState'
import { FormSubmitButton } from '@/components/form-submit-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type StaffShiftPostType = 'swap' | 'pickup'

type StaffShiftOption = {
  id: string
  date: string
  shiftType: 'day' | 'night'
  status: 'scheduled' | 'on_call' | 'sick' | 'called_off'
  cycleLabel: string
}

type StaffShiftPostComposerProps = {
  shifts: StaffShiftOption[]
  createShiftPostAction: (formData: FormData) => void | Promise<void>
}

function formatDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function StaffShiftPostComposer({
  shifts,
  createShiftPostAction,
}: StaffShiftPostComposerProps) {
  const [selected, setSelected] = useState<{ shiftId: string; type: StaffShiftPostType } | null>(
    null
  )

  const selectedShift = useMemo(
    () => shifts.find((shift) => shift.id === selected?.shiftId) ?? null,
    [selected?.shiftId, shifts]
  )

  if (shifts.length === 0) {
    return (
      <Card id="create-post">
        <CardHeader>
          <CardTitle>Create Post</CardTitle>
          <CardDescription>Pick one of your upcoming shifts to post a request.</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="No shifts available to post yet"
            description="Ask your manager to assign shifts, or view your schedule."
            actions={
              <Button asChild variant="outline" size="sm">
                <a href="/schedule?view=week">View my schedule</a>
              </Button>
            }
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card id="create-post">
      <CardHeader>
        <CardTitle>Create Post</CardTitle>
        <CardDescription>Select an assigned shift, then choose swap or pickup.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {shifts.map((shift) => (
            <div key={shift.id} className="rounded-md border border-border bg-card p-3">
              <p className="text-sm font-semibold text-foreground">{formatDate(shift.date)}</p>
              <p className="mt-1 text-xs capitalize text-muted-foreground">
                {shift.shiftType} - {shift.status.replace('_', ' ')}
              </p>
              <p className="text-xs text-muted-foreground">{shift.cycleLabel}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={
                    selected?.shiftId === shift.id && selected.type === 'swap'
                      ? 'default'
                      : 'outline'
                  }
                  onClick={() => setSelected({ shiftId: shift.id, type: 'swap' })}
                >
                  Post for swap
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={
                    selected?.shiftId === shift.id && selected.type === 'pickup'
                      ? 'default'
                      : 'outline'
                  }
                  onClick={() => setSelected({ shiftId: shift.id, type: 'pickup' })}
                >
                  Post for pickup
                </Button>
              </div>
            </div>
          ))}
        </div>

        {selected && selectedShift && (
          <form
            action={createShiftPostAction}
            className="space-y-3 rounded-md border border-border bg-secondary/20 p-3"
          >
            <input type="hidden" name="shift_id" value={selected.shiftId} />
            <input type="hidden" name="type" value={selected.type} />
            <p className="text-sm font-medium text-foreground">
              {selected.type === 'swap' ? 'Swap request' : 'Pickup request'} for{' '}
              {formatDate(selectedShift.date)} ({selectedShift.shiftType})
            </p>
            <div className="space-y-1">
              <label
                htmlFor="staff-post-message"
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Optional message
              </label>
              <textarea
                id="staff-post-message"
                name="message"
                rows={3}
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
                placeholder="Add context for your team (optional)."
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setSelected(null)}>
                Cancel
              </Button>
              <FormSubmitButton type="submit" size="sm" pendingText="Posting...">
                Submit request
              </FormSubmitButton>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
