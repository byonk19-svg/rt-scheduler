'use client'

import { useState } from 'react'
import { CheckCircle2, Clock, Trash2, UserPlus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormSubmitButton } from '@/components/form-submit-button'
import type { RosterEntry } from '@/app/team/roster-actions'
import { cn } from '@/lib/utils'

const ROLE_LABELS: Record<string, string> = {
  therapist: 'Therapist',
  lead: 'Lead Therapist',
  manager: 'Manager',
}

const EMPLOYMENT_LABELS: Record<string, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  prn: 'PRN',
}

type EmployeeRosterPanelProps = {
  entries: RosterEntry[]
  addRosterEmployeeAction: (formData: FormData) => void | Promise<void>
  removeRosterEmployeeAction: (formData: FormData) => void | Promise<void>
}

export function EmployeeRosterPanel({
  entries,
  addRosterEmployeeAction,
  removeRosterEmployeeAction,
}: EmployeeRosterPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false)

  const matched = entries.filter((e) => e.matched_profile_id !== null)
  const pending = entries.filter((e) => e.matched_profile_id === null)

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="app-section-title">Employee Roster</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Add employees here before they sign up. When they create an account with a matching
            name, they&apos;ll be provisioned automatically with the right role and shift — no
            manager approval needed.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setDialogOpen(true)}
          className="shrink-0"
        >
          <UserPlus className="mr-1.5 h-4 w-4" />
          Add employee
        </Button>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/10 px-6 py-10 text-center">
          <UserPlus className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm font-medium text-foreground">No employees on the roster yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add your team members so they&apos;re ready to go the moment they sign up.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Awaiting signup ({pending.length})
              </p>
              <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
                {pending.map((entry) => (
                  <RosterRow
                    key={entry.id}
                    entry={entry}
                    removeRosterEmployeeAction={removeRosterEmployeeAction}
                  />
                ))}
              </div>
            </div>
          )}

          {matched.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Signed up ({matched.length})
              </p>
              <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
                {matched.map((entry) => (
                  <RosterRow
                    key={entry.id}
                    entry={entry}
                    removeRosterEmployeeAction={removeRosterEmployeeAction}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <AddRosterDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        addRosterEmployeeAction={addRosterEmployeeAction}
      />
    </section>
  )
}

function RosterRow({
  entry,
  removeRosterEmployeeAction,
}: {
  entry: RosterEntry
  removeRosterEmployeeAction: (formData: FormData) => void | Promise<void>
}) {
  const isMatched = entry.matched_profile_id !== null

  return (
    <div className="flex items-center gap-3 bg-card px-4 py-3">
      {/* Status icon */}
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isMatched
            ? 'bg-[var(--success-subtle)] text-[var(--success-text)]'
            : 'bg-muted/40 text-muted-foreground'
        )}
      >
        {isMatched ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
      </div>

      {/* Name + details */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{entry.full_name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {ROLE_LABELS[entry.role] ?? entry.role}
          {' · '}
          {entry.shift_type === 'day' ? 'Day' : 'Night'} shift
          {' · '}
          {EMPLOYMENT_LABELS[entry.employment_type] ?? entry.employment_type}
          {entry.is_lead_eligible ? ' · Lead eligible' : ''}
          {isMatched && entry.matched_at
            ? ` · Signed up ${new Date(entry.matched_at).toLocaleDateString()}`
            : ''}
        </p>
      </div>

      {/* Remove — only for unmatched entries */}
      {!isMatched && (
        <form action={removeRosterEmployeeAction}>
          <input type="hidden" name="roster_id" value={entry.id} />
          <button
            type="submit"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            aria-label={`Remove ${entry.full_name} from roster`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </form>
      )}
    </div>
  )
}

function AddRosterDialog({
  open,
  onOpenChange,
  addRosterEmployeeAction,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  addRosterEmployeeAction: (formData: FormData) => void | Promise<void>
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Add employee to roster</DialogTitle>
        </DialogHeader>
        <form action={addRosterEmployeeAction} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="roster-full-name">
              Full name{' '}
              <span className="text-[var(--error-text)]" aria-hidden>
                *
              </span>
            </Label>
            <Input
              id="roster-full-name"
              name="full_name"
              placeholder="e.g. Jordan Smith"
              required
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Must match exactly what they enter when they sign up (case and spacing are ignored).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="roster-role">
                Role{' '}
                <span className="text-[var(--error-text)]" aria-hidden>
                  *
                </span>
              </Label>
              <select
                id="roster-role"
                name="role"
                required
                defaultValue="therapist"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring"
              >
                <option value="therapist">Therapist</option>
                <option value="lead">Lead Therapist</option>
                <option value="manager">Manager</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="roster-shift">
                Shift{' '}
                <span className="text-[var(--error-text)]" aria-hidden>
                  *
                </span>
              </Label>
              <select
                id="roster-shift"
                name="shift_type"
                required
                defaultValue="day"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring"
              >
                <option value="day">Day</option>
                <option value="night">Night</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="roster-employment">Employment type</Label>
              <select
                id="roster-employment"
                name="employment_type"
                defaultValue="full_time"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring"
              >
                <option value="full_time">Full-time</option>
                <option value="part_time">Part-time</option>
                <option value="prn">PRN</option>
              </select>
            </div>

            <div className="space-y-1.5">
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

          <div className="flex items-center gap-2">
            <input
              id="roster-lead-eligible"
              name="is_lead_eligible"
              type="checkbox"
              value="true"
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <Label htmlFor="roster-lead-eligible" className="font-normal">
              Lead eligible
            </Label>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="roster-email">Email address (optional)</Label>
            <Input
              id="roster-email"
              name="email"
              type="email"
              placeholder="for your reference only"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <FormSubmitButton>Add to roster</FormSubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
