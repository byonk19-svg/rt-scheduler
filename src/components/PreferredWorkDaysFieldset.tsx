'use client'

import { useState } from 'react'

import type { PreferredWorkDaysMode } from '@/lib/staff-onboarding'
import { cn } from '@/lib/utils'

type WeekdayOption = {
  value: number
  label: string
}

type PreferredWorkDaysFieldsetProps = {
  legend: string
  description: string
  initialMode: PreferredWorkDaysMode
  initialSelectedDays: number[]
  weekdayOptions: readonly WeekdayOption[]
  modeInputName?: string
  dayInputName?: string
}

export function PreferredWorkDaysFieldset({
  legend,
  description,
  initialMode,
  initialSelectedDays,
  weekdayOptions,
  modeInputName = 'preferred_work_days_mode',
  dayInputName = 'preferred_work_days',
}: PreferredWorkDaysFieldsetProps) {
  const [mode, setMode] = useState<PreferredWorkDaysMode>(
    initialMode === 'no_preference' ? 'no_preference' : 'specific_days'
  )
  const [selectedDays, setSelectedDays] = useState<number[]>(initialSelectedDays)

  const usesSpecificDays = mode === 'specific_days'

  function toggleDay(day: number) {
    setSelectedDays((current) =>
      current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day].sort((left, right) => left - right)
    )
  }

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-foreground">{legend}</legend>
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="radio"
            name={modeInputName}
            value="specific_days"
            checked={usesSpecificDays}
            onChange={() => setMode('specific_days')}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          <span>I prefer specific days</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="radio"
            name={modeInputName}
            value="no_preference"
            checked={!usesSpecificDays}
            onChange={() => setMode('no_preference')}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          <span>No preference</span>
        </label>
      </div>
      <div
        className={cn(
          'grid grid-cols-2 gap-2 transition-opacity',
          usesSpecificDays ? 'opacity-100' : 'opacity-60'
        )}
      >
        {weekdayOptions.map((option) => {
          const isChecked = usesSpecificDays && selectedDays.includes(option.value)

          return (
            <label
              key={option.value}
              className={cn(
                'flex min-h-10 items-center gap-2 rounded-md border border-border px-3 py-2 text-sm transition-colors',
                usesSpecificDays ? 'hover:bg-secondary/25' : 'cursor-not-allowed bg-muted/20'
              )}
            >
              <input
                type="checkbox"
                name={dayInputName}
                value={option.value}
                className="h-4 w-4 accent-[var(--primary)]"
                checked={isChecked}
                disabled={!usesSpecificDays}
                onChange={() => toggleDay(option.value)}
              />
              <span>{option.label}</span>
            </label>
          )
        })}
      </div>
      {!usesSpecificDays ? (
        <p className="text-xs text-muted-foreground">
          Weekday boxes are disabled because this will save no preferred work days.
        </p>
      ) : null}
    </fieldset>
  )
}
