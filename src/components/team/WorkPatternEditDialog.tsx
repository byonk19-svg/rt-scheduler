'use client'

import { type FormEvent, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FormSubmitButton } from '@/components/form-submit-button'
import type { WorkPatternRecord } from '@/components/team/team-directory-model'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type Props = {
  therapistId: string
  therapistName: string
  initialPattern: WorkPatternRecord | null
  saveWorkPatternAction: (formData: FormData) => void | Promise<void>
}

const DOW_OPTIONS = [
  { label: 'Su', value: 0 },
  { label: 'Mo', value: 1 },
  { label: 'Tu', value: 2 },
  { label: 'We', value: 3 },
  { label: 'Th', value: 4 },
  { label: 'Fr', value: 5 },
  { label: 'Sa', value: 6 },
]

function normalizeDowValues(values: number[]): number[] {
  return Array.from(new Set(values)).sort((a, b) => a - b)
}

export function validateWeekendAnchorDate(value: string): string | null {
  const parsed = new Date(`${value}T12:00:00`)
  if (Number.isNaN(parsed.getTime()) || parsed.getDay() !== 6) {
    return 'Weekend anchor date must be a Saturday.'
  }
  return null
}

export function WorkPatternEditDialog({
  therapistId,
  therapistName,
  initialPattern,
  saveWorkPatternAction,
}: Props) {
  const [open, setOpen] = useState(false)
  const [worksDow, setWorksDow] = useState<number[]>(initialPattern?.works_dow ?? [])
  const [offsDow, setOffsDow] = useState<number[]>(initialPattern?.offs_dow ?? [])
  const [worksDowMode, setWorksDowMode] = useState<'hard' | 'soft'>(
    initialPattern?.works_dow_mode ?? 'hard'
  )
  const [weekendRotation, setWeekendRotation] = useState<'none' | 'every_other'>(
    initialPattern?.weekend_rotation ?? 'none'
  )
  const [weekendAnchorDate, setWeekendAnchorDate] = useState(
    initialPattern?.weekend_anchor_date ?? ''
  )
  const [validationError, setValidationError] = useState<string | null>(null)

  function openDialog() {
    setWorksDow(initialPattern?.works_dow ?? [])
    setOffsDow(initialPattern?.offs_dow ?? [])
    setWorksDowMode(initialPattern?.works_dow_mode ?? 'hard')
    setWeekendRotation(initialPattern?.weekend_rotation ?? 'none')
    setWeekendAnchorDate(initialPattern?.weekend_anchor_date ?? '')
    setValidationError(null)
    setOpen(true)
  }

  function toggleDay(value: number) {
    setWorksDow((current) =>
      current.includes(value)
        ? current.filter((day) => day !== value)
        : normalizeDowValues([...current, value])
    )
  }

  function toggleOffDay(value: number) {
    setOffsDow((current) =>
      current.includes(value)
        ? current.filter((day) => day !== value)
        : normalizeDowValues([...current, value])
    )
  }

  function handleWeekendRotationChange(next: 'none' | 'every_other') {
    setWeekendRotation(next)
    if (next === 'none') {
      setWeekendAnchorDate('')
      setValidationError(null)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (weekendRotation !== 'every_other') {
      setValidationError(null)
      return
    }

    const nextError =
      weekendAnchorDate.trim().length === 0
        ? 'Weekend anchor date must be a Saturday.'
        : validateWeekendAnchorDate(weekendAnchorDate)

    if (nextError) {
      event.preventDefault()
      setValidationError(nextError)
      return
    }

    setValidationError(null)
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={openDialog}>
        Edit
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-[560px]">
          <form action={saveWorkPatternAction} onSubmit={handleSubmit} className="space-y-5">
            <DialogHeader>
              <DialogTitle>Edit work pattern</DialogTitle>
              <DialogDescription>
                Update recurring work days and weekend rotation for {therapistName}.
              </DialogDescription>
            </DialogHeader>

            <input type="hidden" name="therapist_id" value={therapistId} />

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-foreground">Days they never work</p>
              <p className="text-xs text-muted-foreground">
                Auto-draft will never assign them on these days.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {DOW_OPTIONS.map((day) => (
                  <button
                    key={`off-${day.value}`}
                    type="button"
                    onClick={() => toggleOffDay(day.value)}
                    className={cn(
                      'h-9 w-10 rounded-lg border text-xs font-semibold transition-colors',
                      offsDow.includes(day.value)
                        ? 'border-[var(--error-border)] bg-[var(--error-subtle)] text-[var(--error-text)]'
                        : 'border-border bg-card text-muted-foreground hover:border-[var(--error-border)]/40 hover:text-foreground'
                    )}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
              {offsDow.map((day) => (
                <input key={`offs-${day}`} type="hidden" name="offs_dow" value={String(day)} />
              ))}
            </div>

            <div className="h-px bg-border/60" />

            <div className="space-y-3">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-foreground">Days they work</p>
                <div className="flex flex-wrap gap-1.5">
                  {DOW_OPTIONS.map((day) => (
                    <button
                      key={`work-${day.value}`}
                      type="button"
                      onClick={() => toggleDay(day.value)}
                      className={cn(
                        'h-9 w-10 rounded-lg border text-xs font-semibold transition-colors',
                        worksDow.includes(day.value)
                          ? 'border-[var(--success-border)] bg-[var(--success-subtle)] text-[var(--success-text)]'
                          : 'border-border bg-card text-muted-foreground hover:border-[var(--success-border)]/40 hover:text-foreground'
                      )}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
                {worksDow.map((day) => (
                  <input key={`works-${day}`} type="hidden" name="works_dow" value={String(day)} />
                ))}
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-foreground">How strict?</p>
                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-sm has-[:checked]:border-primary/40 has-[:checked]:bg-primary/5">
                  <input
                    type="radio"
                    name="works_dow_mode"
                    value="hard"
                    className="mt-0.5 h-4 w-4 shrink-0"
                    checked={worksDowMode === 'hard'}
                    onChange={() => setWorksDowMode('hard')}
                  />
                  <span>
                    <span className="font-medium text-foreground">Only these days</span>
                    <span className="ml-1 text-muted-foreground">
                      — will not be scheduled on other days
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-sm has-[:checked]:border-primary/40 has-[:checked]:bg-primary/5">
                  <input
                    type="radio"
                    name="works_dow_mode"
                    value="soft"
                    className="mt-0.5 h-4 w-4 shrink-0"
                    checked={worksDowMode === 'soft'}
                    onChange={() => setWorksDowMode('soft')}
                  />
                  <span>
                    <span className="font-medium text-foreground">Usually these days</span>
                    <span className="ml-1 text-muted-foreground">
                      — preferred but can flex when needed
                    </span>
                  </span>
                </label>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-medium text-foreground">Weekend rotation</p>
                <div className="space-y-1">
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-sm has-[:checked]:border-primary/40 has-[:checked]:bg-primary/5">
                    <input
                      type="radio"
                      name="weekend_rotation"
                      value="none"
                      className="h-4 w-4 shrink-0"
                      checked={weekendRotation === 'none'}
                      onChange={() => handleWeekendRotationChange('none')}
                    />
                    <span className="font-medium text-foreground">Works every weekend</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-sm has-[:checked]:border-primary/40 has-[:checked]:bg-primary/5">
                    <input
                      type="radio"
                      name="weekend_rotation"
                      value="every_other"
                      className="h-4 w-4 shrink-0"
                      checked={weekendRotation === 'every_other'}
                      onChange={() => handleWeekendRotationChange('every_other')}
                    />
                    <span className="font-medium text-foreground">Every other weekend</span>
                  </label>
                </div>

                {weekendRotation === 'every_other' ? (
                  <div className="mt-2 space-y-1">
                    <Label htmlFor={`weekend_anchor_date_${therapistId}`}>
                      Pick a Saturday for their next on-weekend block
                    </Label>
                    <Input
                      id={`weekend_anchor_date_${therapistId}`}
                      name="weekend_anchor_date"
                      type="date"
                      value={weekendAnchorDate}
                      onChange={(event) => {
                        setWeekendAnchorDate(event.target.value)
                        if (validationError) {
                          setValidationError(validateWeekendAnchorDate(event.target.value))
                        }
                      }}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Auto-draft alternates weekends from this date.
                    </p>
                    {validationError ? (
                      <p className="text-xs font-medium text-[var(--error-text)]">
                        {validationError}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <DialogFooter className="gap-2 sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <FormSubmitButton type="submit" pendingText="Saving...">
                Save pattern
              </FormSubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
