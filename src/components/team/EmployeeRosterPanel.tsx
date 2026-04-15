'use client'

import { useState } from 'react'
import { AlertTriangle, Plus } from 'lucide-react'

import { FormSubmitButton } from '@/components/form-submit-button'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  EmployeeRosterTable,
  type EmployeeRosterTableRow,
} from '@/components/team/employee-roster-table'
import { cn } from '@/lib/utils'

type EmployeeRosterPanelProps = {
  roster: EmployeeRosterTableRow[]
  upsertEmployeeRosterEntryAction: (formData: FormData) => void | Promise<void>
  bulkUpsertEmployeeRosterAction: (formData: FormData) => void | Promise<void>
  replaceTherapistRosterAction: (formData: FormData) => void | Promise<void>
  deleteEmployeeRosterEntryAction: (formData: FormData) => void | Promise<void>
}

function ImportToolsPanel({
  bulkUpsertEmployeeRosterAction,
}: {
  bulkUpsertEmployeeRosterAction: (formData: FormData) => void | Promise<void>
}) {
  return (
    <section className="rounded-xl border border-border/70 bg-card/60 p-4">
      <h3 className="text-sm font-semibold text-foreground">Import tools</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Bulk paste is separate from single-employee entry. Lines starting with # are ignored.
      </p>
      <form action={bulkUpsertEmployeeRosterAction} className="mt-3 grid gap-2">
        <div className="grid gap-1.5">
          <Label htmlFor="bulk-roster-text">Bulk paste</Label>
          <textarea
            id="bulk-roster-text"
            name="bulk_roster_text"
            rows={6}
            placeholder={'Jane Doe\nJane Doe\tlead\tday\tfull_time\t3\ty'}
            className={cn(
              'placeholder:text-muted-foreground border-input min-h-[120px] w-full min-w-0 rounded-lg border bg-[var(--input-background)] px-3 py-2 text-base transition-[color,box-shadow] outline-none md:text-sm',
              'focus-visible:border-[var(--ring)] focus-visible:ring-[var(--ring)]/50 focus-visible:ring-[3px]'
            )}
          />
          <p className="text-xs text-muted-foreground">
            One person per line. Name only, or tab-separated: name, role, shift, employment, max
            days/week, lead (y/n). Roles: therapist, lead, manager. Duplicates merge (last line
            wins).
          </p>
        </div>
        <div className="flex justify-end">
          <FormSubmitButton variant="secondary" className="h-9 px-4 text-sm">
            Import lines
          </FormSubmitButton>
        </div>
      </form>
    </section>
  )
}

function DangerZoneRosterReplace({
  replaceTherapistRosterAction,
}: {
  replaceTherapistRosterAction: (formData: FormData) => void | Promise<void>
}) {
  const [confirmed, setConfirmed] = useState(false)

  return (
    <section className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
        <div>
          <h3 className="text-sm font-semibold text-destructive">
            Advanced · Replace therapist roster
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            This replaces therapist and lead roster rows from pasted lines and may archive active
            profiles that are no longer listed. Manager roster rows are preserved. This is
            irreversible without manual recovery.
          </p>
        </div>
      </div>
      <form
        action={replaceTherapistRosterAction}
        className="mt-4 grid gap-3"
        onSubmit={(e) => {
          if (!confirmed) {
            e.preventDefault()
          }
        }}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="therapist-roster-source">Source lines</Label>
          <textarea
            id="therapist-roster-source"
            name="therapist_roster_source"
            rows={6}
            placeholder={'Brooks, Tannie 903-217-7833\nSmith, Jane (214)555-1212'}
            className={cn(
              'placeholder:text-muted-foreground border-input min-h-[120px] w-full min-w-0 rounded-lg border bg-[var(--input-background)] px-3 py-2 text-base transition-[color,box-shadow] outline-none md:text-sm',
              'focus-visible:border-[var(--ring)] focus-visible:ring-[var(--ring)]/50 focus-visible:ring-[3px]'
            )}
          />
          <p className="text-xs text-muted-foreground">
            Format each line as Last, First Phone. Managers stay preserved.
          </p>
        </div>
        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-destructive/30 bg-card px-3 py-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          <span className="text-foreground">
            I understand this will replace therapist roster data and may archive staff who are not
            in the list.
          </span>
        </label>
        <div className="flex justify-end">
          <FormSubmitButton
            type="submit"
            variant="destructive"
            className="h-9 px-4 text-sm"
            disabled={!confirmed}
          >
            Replace therapist roster
          </FormSubmitButton>
        </div>
      </form>
    </section>
  )
}

export function EmployeeRosterPanel({
  roster,
  upsertEmployeeRosterEntryAction,
  bulkUpsertEmployeeRosterAction,
  replaceTherapistRosterAction,
  deleteEmployeeRosterEntryAction,
}: EmployeeRosterPanelProps) {
  const [addOpen, setAddOpen] = useState(false)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="app-section-title">Roster administration</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Preload employee names for signup auto-match. Name matching ignores case and extra
            spaces.
          </p>
        </div>
        <Button type="button" className="h-9 gap-2" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden />
          Add employee
        </Button>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add employee to roster</DialogTitle>
            <DialogDescription>
              Creates or updates a row in the employee roster used for signup name matching.
            </DialogDescription>
          </DialogHeader>
          <form action={upsertEmployeeRosterEntryAction} className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="roster-full-name">Full name</Label>
                <Input id="roster-full-name" name="full_name" required placeholder="Jane Doe" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="roster-phone-number">Phone number</Label>
                <Input
                  id="roster-phone-number"
                  name="phone_number"
                  placeholder="(555) 101-2020"
                  inputMode="tel"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="grid gap-1.5">
                <Label htmlFor="roster-role">Role</Label>
                <select
                  id="roster-role"
                  name="role"
                  className="h-10 rounded-md border border-border bg-card px-2 text-sm"
                  defaultValue="therapist"
                >
                  <option value="therapist">Therapist</option>
                  <option value="lead">Lead Therapist</option>
                  <option value="manager">Manager</option>
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="roster-shift">Shift</Label>
                <select
                  id="roster-shift"
                  name="shift_type"
                  className="h-10 rounded-md border border-border bg-card px-2 text-sm"
                  defaultValue="day"
                >
                  <option value="day">Day</option>
                  <option value="night">Night</option>
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="roster-employment">Employment</Label>
                <select
                  id="roster-employment"
                  name="employment_type"
                  className="h-10 rounded-md border border-border bg-card px-2 text-sm"
                  defaultValue="full_time"
                >
                  <option value="full_time">Full-time</option>
                  <option value="part_time">Part-time</option>
                  <option value="prn">PRN</option>
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="roster-max-days">Max days/week</Label>
                <Input
                  id="roster-max-days"
                  name="max_work_days_per_week"
                  type="number"
                  min={1}
                  max={7}
                  defaultValue={3}
                />
              </div>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" name="is_lead_eligible" className="h-4 w-4" />
              Coverage lead eligible
            </label>
            <DialogFooter className="gap-2 sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <FormSubmitButton className="h-9 px-4 text-sm">Save employee</FormSubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ImportToolsPanel bulkUpsertEmployeeRosterAction={bulkUpsertEmployeeRosterAction} />

      <DangerZoneRosterReplace replaceTherapistRosterAction={replaceTherapistRosterAction} />

      <section className="rounded-xl border border-border/70 bg-card/60 p-4">
        <h3 className="text-sm font-semibold text-foreground">Employee roster</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Dense list of all roster rows. Use search and column headers to sort.
        </p>
        <div className="mt-3">
          <EmployeeRosterTable
            roster={roster}
            deleteEmployeeRosterEntryAction={deleteEmployeeRosterEntryAction}
          />
        </div>
      </section>
    </div>
  )
}
