'use client'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { EmailIntakePanelItemRow } from '@/components/availability/EmailIntakePanel'

export function EmailIntakeMatchForm({
  cycleOptions,
  item,
  therapistOptions,
  updateEmailIntakeTherapistAction,
}: {
  cycleOptions: Array<{ id: string; label: string }>
  item: EmailIntakePanelItemRow
  therapistOptions: Array<{ id: string; fullName: string }>
  updateEmailIntakeTherapistAction: (formData: FormData) => void | Promise<void>
}) {
  return (
    <div className="mt-3 border-l-2 border-warning pl-3">
      <p className="mb-2 text-xs font-medium text-warning-text">Action needed</p>
      <form action={updateEmailIntakeTherapistAction} className="flex flex-wrap gap-3">
        <input type="hidden" name="item_id" value={item.id} />
        <div className="min-w-60 flex-1 space-y-1">
          <Label htmlFor={`item_match_${item.id}`}>Match therapist</Label>
          <select
            id={`item_match_${item.id}`}
            name="therapist_id"
            required
            defaultValue={item.matchedTherapistId ?? ''}
            className="border-input bg-[var(--input-background)] focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"
          >
            <option value="" disabled>
              Select therapist
            </option>
            {therapistOptions.map((option) => (
              <option key={`${item.id}-${option.id}`} value={option.id}>
                {option.fullName}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-60 flex-1 space-y-1">
          <Label htmlFor={`item_cycle_${item.id}`}>Match schedule block</Label>
          <select
            id={`item_cycle_${item.id}`}
            name="cycle_id"
            required
            defaultValue={item.matchedCycleId ?? ''}
            className="border-input bg-[var(--input-background)] focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"
          >
            <option value="" disabled>
              Select schedule block
            </option>
            {cycleOptions.map((option) => (
              <option key={`${item.id}-${option.id}`} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <Button size="sm" type="submit">
            Save matches
          </Button>
        </div>
      </form>
    </div>
  )
}
