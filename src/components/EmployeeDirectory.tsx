'use client'

import { useMemo, useState } from 'react'

import {
  filterEmployeeDirectoryRecords,
  formatEmployeeDate,
  isFmlaReturnDateEnabled,
  normalizeFmlaReturnDate,
  type EmployeeDirectoryRecord,
  type EmployeeDirectoryTab,
} from '@/lib/employee-directory'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type EmployeeDirectoryProps = {
  employees: EmployeeDirectoryRecord[]
  saveEmployeeAction: (formData: FormData) => void | Promise<void>
  setEmployeeActiveAction: (formData: FormData) => void | Promise<void>
}

const TABS: Array<{ value: EmployeeDirectoryTab; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'day', label: 'Day' },
  { value: 'night', label: 'Night' },
]

function employmentLabel(value: EmployeeDirectoryRecord['employment_type']): string {
  if (value === 'part_time') return 'Part-time'
  if (value === 'prn') return 'PRN'
  return 'Full-time'
}

function ShiftBadge({ shiftType }: { shiftType: EmployeeDirectoryRecord['shift_type'] }) {
  return (
    <Badge variant="outline" className={cn('capitalize', shiftType === 'day' ? 'text-sky-700' : 'text-indigo-700')}>
      {shiftType}
    </Badge>
  )
}

function EmployeeActionsMenu({
  employee,
  onEdit,
  onDeactivate,
  setEmployeeActiveAction,
}: {
  employee: EmployeeDirectoryRecord
  onEdit: () => void
  onDeactivate: () => void
  setEmployeeActiveAction: (formData: FormData) => void | Promise<void>
}) {
  return (
    <details className="relative" onClick={(event) => event.stopPropagation()}>
      <summary className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-md border border-border bg-white text-sm hover:bg-secondary">
        ...
      </summary>
      <div className="absolute right-0 z-20 mt-1 min-w-40 rounded-md border border-border bg-white p-1 shadow-sm">
        <button
          type="button"
          className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-secondary"
          onClick={(event) => {
            event.preventDefault()
            onEdit()
          }}
        >
          Edit
        </button>
        {employee.is_active ? (
          <button
            type="button"
            className="block w-full rounded px-2 py-1.5 text-left text-sm text-[var(--warning-text)] hover:bg-secondary"
            onClick={(event) => {
              event.preventDefault()
              onDeactivate()
            }}
          >
            Deactivate
          </button>
        ) : (
          <form action={setEmployeeActiveAction}>
            <input type="hidden" name="profile_id" value={employee.id} />
            <input type="hidden" name="set_active" value="true" />
            <button
              type="submit"
              className="block w-full rounded px-2 py-1.5 text-left text-sm text-[var(--success-text)] hover:bg-secondary"
            >
              Reactivate
            </button>
          </form>
        )}
        <div className="my-1 h-px bg-border" />
        <span className="block px-2 py-1 text-xs text-muted-foreground">Delete is replaced by deactivate.</span>
      </div>
    </details>
  )
}

export function EmployeeDirectory({ employees, saveEmployeeAction, setEmployeeActiveAction }: EmployeeDirectoryProps) {
  const [tab, setTab] = useState<EmployeeDirectoryTab>('all')
  const [searchText, setSearchText] = useState('')
  const [leadOnly, setLeadOnly] = useState(false)
  const [fmlaOnly, setFmlaOnly] = useState(false)
  const [includeInactive, setIncludeInactive] = useState(false)
  const [editState, setEditState] = useState<{ employeeId: string; onFmla: boolean } | null>(null)
  const [deactivateEmployeeId, setDeactivateEmployeeId] = useState<string | null>(null)

  const filteredEmployees = useMemo(
    () =>
      filterEmployeeDirectoryRecords(employees, {
        tab,
        searchText,
        leadOnly,
        fmlaOnly,
        includeInactive,
      }),
    [employees, tab, searchText, leadOnly, fmlaOnly, includeInactive]
  )

  const editEmployee = useMemo(
    () => employees.find((employee) => employee.id === editState?.employeeId) ?? null,
    [employees, editState?.employeeId]
  )
  const onFmlaDraft = editState?.onFmla ?? false

  const deactivateEmployee = useMemo(
    () => employees.find((employee) => employee.id === deactivateEmployeeId) ?? null,
    [employees, deactivateEmployeeId]
  )

  return (
    <Card id="employee-directory">
      <CardHeader>
        <CardTitle>Employee Directory</CardTitle>
        <CardDescription>Search, filter, and maintain active staffing profiles in one place.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {TABS.map((item) => (
            <Button
              key={item.value}
              type="button"
              variant={tab === item.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTab(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <Input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search name or email"
            className="w-full"
          />
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-border px-3 py-2">
            <span className="text-sm font-medium text-muted-foreground">Filters:</span>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={leadOnly} onChange={(event) => setLeadOnly(event.target.checked)} />
              Lead eligible
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={fmlaOnly} onChange={(event) => setFmlaOnly(event.target.checked)} />
              FMLA
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(event) => setIncludeInactive(event.target.checked)}
              />
              Include inactive
            </label>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">{filteredEmployees.length} employee(s)</p>

        <div className="hidden rounded-md border border-border md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Shift/Team</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead className="w-[64px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    No employees match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredEmployees.map((employee) => (
                  <TableRow
                    key={employee.id}
                    onClick={() => setEditState({ employeeId: employee.id, onFmla: employee.on_fmla })}
                    className="cursor-pointer hover:bg-secondary/50"
                  >
                    <TableCell>
                      <div className="font-medium text-foreground">{employee.full_name}</div>
                      <div className="text-xs text-muted-foreground">{employee.email}</div>
                    </TableCell>
                    <TableCell>
                      <ShiftBadge shiftType={employee.shift_type} />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{employmentLabel(employee.employment_type)}</Badge>
                    </TableCell>
                    <TableCell>
                      {employee.is_lead_eligible || employee.on_fmla || (includeInactive && !employee.is_active) ? (
                        <div className="space-y-1">
                          <div className="flex flex-wrap gap-1.5">
                            {employee.is_lead_eligible && <Badge>Lead eligible</Badge>}
                            {employee.on_fmla && (
                              <Badge
                                variant="outline"
                                title={
                                  employee.fmla_return_date
                                    ? `Potential return: ${formatEmployeeDate(employee.fmla_return_date)}`
                                    : undefined
                                }
                              >
                                FMLA
                              </Badge>
                            )}
                            {includeInactive && !employee.is_active && <Badge variant="outline">Inactive</Badge>}
                          </div>
                          {employee.on_fmla && employee.fmla_return_date && (
                            <p className="text-xs text-muted-foreground">Return: {formatEmployeeDate(employee.fmla_return_date)}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <EmployeeActionsMenu
                        employee={employee}
                        onEdit={() => setEditState({ employeeId: employee.id, onFmla: employee.on_fmla })}
                        onDeactivate={() => setDeactivateEmployeeId(employee.id)}
                        setEmployeeActiveAction={setEmployeeActiveAction}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="space-y-3 md:hidden">
          {filteredEmployees.length === 0 ? (
            <p className="rounded-md border border-border p-3 text-sm text-muted-foreground">No employees match the current filters.</p>
          ) : (
            filteredEmployees.map((employee) => (
              <div
                key={employee.id}
                className="rounded-md border border-border p-3"
                onClick={() => setEditState({ employeeId: employee.id, onFmla: employee.on_fmla })}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-foreground">{employee.full_name}</p>
                    <p className="text-xs text-muted-foreground">{employee.email}</p>
                  </div>
                  <EmployeeActionsMenu
                    employee={employee}
                    onEdit={() => setEditState({ employeeId: employee.id, onFmla: employee.on_fmla })}
                    onDeactivate={() => setDeactivateEmployeeId(employee.id)}
                    setEmployeeActiveAction={setEmployeeActiveAction}
                  />
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  <ShiftBadge shiftType={employee.shift_type} />
                  <Badge variant="outline">{employmentLabel(employee.employment_type)}</Badge>
                  {employee.is_lead_eligible && <Badge>Lead eligible</Badge>}
                  {includeInactive && !employee.is_active && <Badge variant="outline">Inactive</Badge>}
                  {employee.on_fmla && <Badge variant="outline">FMLA</Badge>}
                </div>
                {employee.on_fmla && employee.fmla_return_date && (
                  <p className="mt-1 text-xs text-muted-foreground">Return: {formatEmployeeDate(employee.fmla_return_date)}</p>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>

      <Dialog open={Boolean(editEmployee)} onOpenChange={(open) => !open && setEditState(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit employee</DialogTitle>
            <DialogDescription>Update profile details and scheduling eligibility settings.</DialogDescription>
          </DialogHeader>
          {editEmployee && (
            <form key={editEmployee.id} action={saveEmployeeAction} className="space-y-4">
              <input type="hidden" name="profile_id" value={editEmployee.id} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="edit_name">Name</Label>
                  <Input id="edit_name" name="full_name" defaultValue={editEmployee.full_name} required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit_email">Email</Label>
                  <Input id="edit_email" name="email" type="email" defaultValue={editEmployee.email} required />
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

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="edit_shift">Shift/Team</Label>
                  <select
                    id="edit_shift"
                    name="shift_type"
                    className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm"
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
                    className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm"
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
                    className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm"
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
                  <input type="checkbox" name="is_lead_eligible" defaultChecked={editEmployee.is_lead_eligible} />
                  Lead eligible
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="on_fmla"
                    checked={onFmlaDraft}
                    onChange={(event) =>
                      setEditState((current) =>
                        current
                          ? {
                              ...current,
                              onFmla: event.target.checked,
                            }
                          : current
                      )
                    }
                  />
                  On FMLA
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="is_active" defaultChecked={editEmployee.is_active} />
                  Active
                </label>
              </div>

              {isFmlaReturnDateEnabled(onFmlaDraft) && (
                <div className="space-y-1">
                  <Label htmlFor="edit_fmla_return">Potential return date</Label>
                  <Input
                    id="edit_fmla_return"
                    name="fmla_return_date"
                    type="date"
                    defaultValue={normalizeFmlaReturnDate(editEmployee.fmla_return_date ?? '', true) ?? ''}
                  />
                </div>
              )}

              <DialogFooter>
                <Button type="submit">Save</Button>
                <Button type="submit" variant="outline" name="realign_future_shifts" value="true">
                  Save + realign shifts
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deactivateEmployee)} onOpenChange={(open) => !open && setDeactivateEmployeeId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate employee</DialogTitle>
            <DialogDescription>
              {deactivateEmployee
                ? `${deactivateEmployee.full_name} will be marked inactive and hidden by default.`
                : 'Confirm deactivation.'}
            </DialogDescription>
          </DialogHeader>
          {deactivateEmployee && (
            <form action={setEmployeeActiveAction}>
              <input type="hidden" name="profile_id" value={deactivateEmployee.id} />
              <input type="hidden" name="set_active" value="false" />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDeactivateEmployeeId(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="destructive">
                  Deactivate
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}

