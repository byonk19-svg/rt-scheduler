'use client'

import { FormSubmitButton } from '@/components/form-submit-button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type WeekdayOption = {
  value: number
  label: string
}

export function PreferredWorkDaysCard({
  preferredDayLabels,
  preferredWorkDays,
  savePreferredWorkDaysAction,
  weekdayOptions,
}: {
  preferredDayLabels: string[]
  preferredWorkDays: number[]
  savePreferredWorkDaysAction: (formData: FormData) => void | Promise<void>
  weekdayOptions: WeekdayOption[]
}) {
  return (
    <Card className="border-border/90">
      <CardHeader>
        <CardTitle>Preferred Work Days</CardTitle>
        <CardDescription>
          Auto-generate will prioritize these weekdays when possible. Leave all unchecked if you
          have no day-of-week preference.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={savePreferredWorkDaysAction} className="space-y-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {weekdayOptions.map((option) => (
              <label
                key={option.value}
                className="flex min-h-10 items-center gap-2 rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-secondary/25"
              >
                <input
                  type="checkbox"
                  name="preferred_work_days"
                  value={option.value}
                  className="h-4 w-4 accent-[var(--primary)]"
                  defaultChecked={preferredWorkDays.includes(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FormSubmitButton type="submit" pendingText="Saving...">
              Save preferred days
            </FormSubmitButton>
            <p className="text-xs font-medium text-muted-foreground">
              Current:{' '}
              {preferredDayLabels.length > 0 ? preferredDayLabels.join(', ') : 'None selected'}
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
