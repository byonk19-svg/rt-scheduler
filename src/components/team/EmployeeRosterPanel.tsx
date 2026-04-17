'use client'

import { useState } from 'react'
import { AlertTriangle, ChevronDown, Plus } from 'lucide-react'

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
    <section className="rounded-xl border border-border/70 bg-card/60">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-start gap-2 px-3 py-2.5 [&_summary::-webkit-details-marker]:hidden">
          <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">Import tools</h3>
            <p className="text-xs text-muted-foreground">
              Bulk paste rows when you need to load many employees quickly.
            </p>
          </div>
        </summary>
        <form
          action={bulkUpsertEmployeeRosterAction}
          className="grid gap-2 border-t border-border/60 px-3 pb-3 pt-2.5"
        >
          <div className="grid gap-1.5">
            <Label htmlFor="bulk-roster-text">Bulk paste</Label>
            <textarea
              id="bulk-roster-text"
              name="bulk_roster_text"
              rows={5}
              placeholder={'Jane Doe\nJane Doe\tlead\tday\tfull_time\t3\ty'}
              className={cn(
                'placeholder:text-muted-foreground border-input min-h-[108px] w-full min-w-0 rounded-lg border bg-[var(--input-background)] px-3 py-2 text-base transition-[color,box-shadow] outline-none md:text-sm',
                'focus-visible:border-[var(--ring)] focus-visible:ring-[var(--ring)]/50 focus-visible:ring-[3px]'
              )}
            />
            <p className="text-xs text-muted-foreground">
              One line per person. Use name only, or tab-separated values: name, role, shift,
              employment, max days/week, lead eligibility.
            </p>
          </div>
          <div className="flex justify-end">
            <FormSubmitButton variant="secondary" className="h-8 px-3 text-xs">
              Import lines
            </FormSubmitButton>
          </div>
        </form>
      </details>
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
    <section className="rounded-xl border border-destructive/40 bg-destructive/5">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-start gap-2 px-3 py-2.5 [&_summary::-webkit-details-marker]:hidden">
          <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-destructive transition-transform group-open:rotate-180" />
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
          <div>
            <h3 className="text-sm font-semibold text-destructive">
              Advanced tools · Replace therapist roster
            </h3>
            <p className="text-xs text-muted-foreground">
              High-risk bulk replacement for therapist/lead rows only.
            </p>
          </div>
        </summary>
        <div className="border-t border-destructive/30 px-3 pb-3 pt-2.5">
          <p className="text-xs text-muted-foreground">
            This replaces therapist and lead roster rows from pasted lines and may archive active
            profiles that are no longer listed. Manager rows are preserved. This is irreversible
            without manual recovery.
          </p>
          <form
            action={replaceTherapistRosterAction}
            className="mt-2.5 grid gap-2.5"
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
                rows={5}
                placeholder={'Brooks, Tannie 903-217-7833\nSmith, Jane (214)555-1212'}
                className={cn(
                  'placeholder:text-muted-foreground border-input min-h-[108px] w-full min-w-0 rounded-lg border bg-[var(--input-background)] px-3 py-2 text-base transition-[color,box-shadow] outline-none md:text-sm',
                  'focus-visible:border-[var(--ring)] focus-visible:ring-[var(--ring)]/50 focus-visible:ring-[3px]'
                )}
              />
              <p className="text-xs text-muted-foreground">
                Format each line as Last, First Phone.
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
                I understand this will replace therapist roster data and may archive staff who are
                not in the list.
              </span>
            </label>
            <div className="flex justify-end">
              <FormSubmitButton
                type="submit"
                variant="destructive"
                className="h-8 px-3 text-xs"
                disabled={!confirmed}
              >
                Replace therapist roster
              </FormSubmitButton>
            </div>
          </form>
        </div>
      </details>
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="app-section-title">Roster administration</h2>
          <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
            Preload employee names for signup auto-match.
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

      <section className="rounded-xl border border-border/70 bg-card/60 p-4">
        <h3 className="text-sm font-semibold text-foreground">Employee roster</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Use search and quick filters to narrow rows fast.
        </p>
        <div className="mt-2.5">
          <EmployeeRosterTable
            roster={roster}
            deleteEmployeeRosterEntryAction={deleteEmployeeRosterEntryAction}
          />
        </div>
      </section>

      <ImportToolsPanel bulkUpsertEmployeeRosterAction={bulkUpsertEmployeeRosterAction} />

      <DangerZoneRosterReplace replaceTherapistRosterAction={replaceTherapistRosterAction} />
    </div>
  )
}
