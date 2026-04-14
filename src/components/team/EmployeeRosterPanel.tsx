import { FormSubmitButton } from '@/components/form-submit-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type EmployeeRosterRow = {
  id: string
  full_name: string
  role: 'manager' | 'therapist' | 'lead'
  shift_type: 'day' | 'night'
  employment_type: 'full_time' | 'part_time' | 'prn'
  max_work_days_per_week: number
  is_lead_eligible: boolean
  matched_profile_id: string | null
  matched_at: string | null
}

type EmployeeRosterPanelProps = {
  roster: EmployeeRosterRow[]
  upsertEmployeeRosterEntryAction: (formData: FormData) => void | Promise<void>
  bulkUpsertEmployeeRosterAction: (formData: FormData) => void | Promise<void>
  replaceTherapistRosterAction: (formData: FormData) => void | Promise<void>
  deleteEmployeeRosterEntryAction: (formData: FormData) => void | Promise<void>
}

function roleLabel(role: EmployeeRosterRow['role']): string {
  if (role === 'lead') return 'Lead Therapist'
  if (role === 'manager') return 'Manager'
  return 'Therapist'
}

function employmentLabel(type: EmployeeRosterRow['employment_type']): string {
  if (type === 'part_time') return 'Part-time'
  if (type === 'prn') return 'PRN'
  return 'Full-time'
}

export function EmployeeRosterPanel({
  roster,
  upsertEmployeeRosterEntryAction,
  bulkUpsertEmployeeRosterAction,
  replaceTherapistRosterAction,
  deleteEmployeeRosterEntryAction,
}: EmployeeRosterPanelProps) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="app-section-title">Employee roster</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Preload employee names for signup auto-match. Name matching ignores case and extra spaces.
        </p>
      </div>

      <form action={upsertEmployeeRosterEntryAction} className="grid gap-3 rounded-xl border p-4">
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
              className="h-10 rounded-md border px-2 text-sm"
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
              className="h-10 rounded-md border px-2 text-sm"
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
              className="h-10 rounded-md border px-2 text-sm"
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
        <div className="flex justify-end">
          <FormSubmitButton className="h-9 px-4 text-sm">Add employee</FormSubmitButton>
        </div>
      </form>

      <form
        action={bulkUpsertEmployeeRosterAction}
        className="mt-4 grid gap-2 rounded-xl border p-4"
      >
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
            days/week, lead (y/n). Roles: therapist, lead, manager. Lines starting with # are
            ignored. Duplicates merge (last line wins).
          </p>
        </div>
        <div className="flex justify-end">
          <FormSubmitButton variant="secondary" className="h-9 px-4 text-sm">
            Import lines
          </FormSubmitButton>
        </div>
      </form>

      <form
        action={replaceTherapistRosterAction}
        className="mt-4 grid gap-2 rounded-xl border p-4"
      >
        <div className="grid gap-1.5">
          <Label htmlFor="therapist-roster-source">Therapist roster replacement</Label>
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
            Replace therapist and lead roster rows from pasted source lines. Format each line as
            Last, First Phone. Managers stay preserved.
          </p>
        </div>
        <div className="flex justify-end">
          <FormSubmitButton variant="secondary" className="h-9 px-4 text-sm">
            Replace therapist roster
          </FormSubmitButton>
        </div>
      </form>

      <div className="mt-4 space-y-2">
        {roster.length === 0 ? (
          <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
            No roster entries yet.
          </p>
        ) : (
          roster.map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between rounded-lg border px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium">{row.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {roleLabel(row.role)} · {row.shift_type === 'night' ? 'Night' : 'Day'} ·{' '}
                  {employmentLabel(row.employment_type)} · {row.max_work_days_per_week}/week
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {row.matched_profile_id ? 'Signed up' : 'Not signed up'}
                </span>
                <form action={deleteEmployeeRosterEntryAction}>
                  <input type="hidden" name="roster_id" value={row.id} />
                  <Button type="submit" variant="outline" size="sm">
                    Remove
                  </Button>
                </form>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
