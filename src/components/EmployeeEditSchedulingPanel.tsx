'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { EmployeeDirectoryRecord } from '@/lib/employee-directory'
import { cn } from '@/lib/utils'

export function EmployeeEditSchedulingPanel({
  dayOptions,
  editEmployee,
  onWeekendRotationChange,
  onWorksDowModeChange,
  weekendRotationDraft,
  worksDowModeDraft,
}: {
  dayOptions: Array<{ value: number; label: string }>
  editEmployee: EmployeeDirectoryRecord
  onWeekendRotationChange: (value: 'none' | 'every_other') => void
  onWorksDowModeChange: (value: 'hard' | 'soft') => void
  weekendRotationDraft: 'none' | 'every_other'
  worksDowModeDraft: 'hard' | 'soft'
}) {
  return (
    <div className="space-y-3 px-6 py-4">
      <div className="space-y-2 rounded-md border border-border bg-secondary/20 p-3">
        <Label className="text-sm font-semibold">Works weekdays</Label>
        <p className="text-xs text-muted-foreground">
          Auto-generate uses these as preferred or required depending on the Hard/Soft rule.
        </p>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {dayOptions.map((day) => (
            <label key={`preferred-day-${day.value}`} className="flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                name="works_dow"
                value={String(day.value)}
                defaultChecked={editEmployee.works_dow.includes(day.value)}
              />
              {day.label}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2 rounded-md border border-border bg-secondary/20 p-3">
        <Label className="text-sm font-semibold">Absolutely cannot work these weekdays</Label>
        <p className="text-xs text-muted-foreground">
          Auto-generate will never assign this therapist on checked weekdays.
        </p>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {dayOptions.map((day) => (
            <label key={`blocked-day-${day.value}`} className="flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                name="offs_dow"
                value={String(day.value)}
                defaultChecked={editEmployee.offs_dow.includes(day.value)}
              />
              {day.label}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2 rounded-md border border-border bg-secondary/20 p-3">
        <Label className="text-sm font-semibold">Works days rule</Label>
        <p className="text-xs text-muted-foreground">
          Hard: only works days are allowed. Soft: works days are preferred but other days are
          allowed.
        </p>
        <div className="inline-flex rounded-md border border-border bg-background p-1">
          <label className="cursor-pointer">
            <input
              className="sr-only"
              type="radio"
              name="works_dow_mode"
              value="hard"
              checked={worksDowModeDraft === 'hard'}
              onChange={() => onWorksDowModeChange('hard')}
            />
            <span
              className={cn(
                'rounded px-3 py-1.5 text-sm',
                worksDowModeDraft === 'hard'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground'
              )}
            >
              Hard
            </span>
          </label>
          <label className="cursor-pointer">
            <input
              className="sr-only"
              type="radio"
              name="works_dow_mode"
              value="soft"
              checked={worksDowModeDraft === 'soft'}
              onChange={() => onWorksDowModeChange('soft')}
            />
            <span
              className={cn(
                'rounded px-3 py-1.5 text-sm',
                worksDowModeDraft === 'soft'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground'
              )}
            >
              Soft
            </span>
          </label>
        </div>
      </div>

      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">Weekend rotation</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="weekend_rotation"
            value="none"
            checked={weekendRotationDraft === 'none'}
            onChange={() => onWeekendRotationChange('none')}
          />
          None
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="weekend_rotation"
            value="every_other"
            checked={weekendRotationDraft === 'every_other'}
            onChange={() => onWeekendRotationChange('every_other')}
          />
          Every other weekend
        </label>
      </fieldset>

      {weekendRotationDraft === 'every_other' ? (
        <div className="space-y-1">
          <Label htmlFor="edit_weekend_anchor">Weekend anchor date (Saturday)</Label>
          <Input
            id="edit_weekend_anchor"
            name="weekend_anchor_date"
            type="date"
            defaultValue={editEmployee.weekend_anchor_date ?? ''}
            required
          />
          <p className="text-xs text-muted-foreground">
            Auto-generate assigns this therapist on alternating weekends from this anchor Saturday.
          </p>
        </div>
      ) : null}
    </div>
  )
}
