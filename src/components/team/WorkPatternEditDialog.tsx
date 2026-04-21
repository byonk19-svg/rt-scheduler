'use client'

import { type FormEvent, useState } from 'react'

import { WorkPatternScheduleFields } from '@/components/team/WorkPatternScheduleFields'
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

type Props = {
  therapistId: string
  therapistName: string
  initialPattern: WorkPatternRecord | null
  saveWorkPatternAction: (formData: FormData) => void | Promise<void>
}

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

            <WorkPatternScheduleFields
              offsDow={offsDow}
              therapistId={therapistId}
              toggleDay={toggleDay}
              toggleOffDay={toggleOffDay}
              validationError={validationError}
              weekendAnchorDate={weekendAnchorDate}
              weekendRotation={weekendRotation}
              worksDow={worksDow}
              worksDowMode={worksDowMode}
              onWeekendAnchorDateChange={(value) => {
                setWeekendAnchorDate(value)
                if (validationError) {
                  setValidationError(validateWeekendAnchorDate(value))
                }
              }}
              onWeekendRotationChange={handleWeekendRotationChange}
              onWorksDowModeChange={setWorksDowMode}
            />

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
