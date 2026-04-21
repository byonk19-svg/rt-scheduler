'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { EmployeeDirectoryRecord } from '@/lib/employee-directory'
import { isFmlaReturnDateEnabled, normalizeFmlaReturnDate } from '@/lib/employee-directory'

export function EmployeeEditProfilePanel({
  editEmployee,
  onFmlaDraft,
  setOnFmlaDraft,
}: {
  editEmployee: EmployeeDirectoryRecord
  onFmlaDraft: boolean
  setOnFmlaDraft: (checked: boolean) => void
}) {
  return (
    <div className="space-y-3 px-6 py-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="edit_name">Name</Label>
          <Input id="edit_name" name="full_name" defaultValue={editEmployee.full_name} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="edit_email">Email</Label>
          <Input
            id="edit_email"
            name="email"
            type="email"
            defaultValue={editEmployee.email}
            required
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="edit_phone">Phone</Label>
        <Input
          id="edit_phone"
          name="phone_number"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          defaultValue={editEmployee.phone_number ?? ''}
          placeholder="(555) 123-4567"
        />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="edit_shift">Shift/Team</Label>
          <select
            id="edit_shift"
            name="shift_type"
            className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm"
            defaultValue={editEmployee.shift_type}
          >
            <option value="day">Day</option>
            <option value="night">Night</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="edit_employment">Employment</Label>
          <select
            id="edit_employment"
            name="employment_type"
            className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm"
            defaultValue={editEmployee.employment_type}
          >
            <option value="full_time">Full-time</option>
            <option value="part_time">Part-time</option>
            <option value="prn">PRN</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="edit_max_week">Max shifts/week</Label>
          <select
            id="edit_max_week"
            name="max_work_days_per_week"
            className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm"
            defaultValue={String(editEmployee.max_work_days_per_week)}
          >
            {Array.from({ length: 7 }, (_, index) => index + 1).map((value) => (
              <option key={`max-${value}`} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="is_lead_eligible"
            defaultChecked={editEmployee.is_lead_eligible}
          />
          Lead eligible
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="on_fmla"
            checked={onFmlaDraft}
            onChange={(event) => setOnFmlaDraft(event.target.checked)}
          />
          On FMLA
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_active" defaultChecked={editEmployee.is_active} />
          Active
        </label>
      </div>

      {isFmlaReturnDateEnabled(onFmlaDraft) ? (
        <div className="space-y-1">
          <Label htmlFor="edit_fmla_return">Potential return date</Label>
          <Input
            id="edit_fmla_return"
            name="fmla_return_date"
            type="date"
            defaultValue={normalizeFmlaReturnDate(editEmployee.fmla_return_date ?? '', true) ?? ''}
          />
        </div>
      ) : null}
    </div>
  )
}
