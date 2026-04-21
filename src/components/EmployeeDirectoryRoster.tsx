'use client'

import { EMPLOYEE_META_BADGE_CLASS, LEAD_ELIGIBLE_BADGE_CLASS } from '@/lib/employee-tag-badges'
import type { EmployeeDirectoryRecord } from '@/lib/employee-directory'
import { Badge } from '@/components/ui/badge'
import {
  EmployeeActionsMenu,
  EmployeeRowBadges,
  ShiftBadge,
  SortHeaderButton,
} from '@/components/EmployeeDirectoryPrimitives'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type DirectorySortKey = 'employee' | 'shift' | 'type' | 'tags'
type SortDirection = 'asc' | 'desc'

export function EmployeeDirectoryRoster({
  employees,
  formatDate,
  formatEmploymentLabel,
  formatWeekdayLabel,
  includeInactive,
  onDeactivateEmployee,
  onEditEmployee,
  onSort,
  setEmployeeActiveAction,
  sortDirection,
  sortKey,
}: {
  employees: EmployeeDirectoryRecord[]
  formatDate: (value: string) => string
  formatEmploymentLabel: (value: EmployeeDirectoryRecord['employment_type']) => string
  formatWeekdayLabel: (values: number[]) => string
  includeInactive: boolean
  onDeactivateEmployee: (employeeId: string) => void
  onEditEmployee: (employeeId: string) => void
  onSort: (key: DirectorySortKey) => void
  setEmployeeActiveAction: (formData: FormData) => void | Promise<void>
  sortDirection: SortDirection
  sortKey: DirectorySortKey
}) {
  return (
    <>
      <div className="hidden rounded-md border border-border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <SortHeaderButton
                  label="Employee"
                  column="employee"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={onSort}
                />
              </TableHead>
              <TableHead>
                <SortHeaderButton
                  label="Shift/Team"
                  column="shift"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={onSort}
                />
              </TableHead>
              <TableHead>
                <SortHeaderButton
                  label="Type"
                  column="type"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={onSort}
                />
              </TableHead>
              <TableHead>
                <SortHeaderButton
                  label="Tags"
                  column="tags"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={onSort}
                />
              </TableHead>
              <TableHead className="w-[64px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  No employees match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              employees.map((employee) => (
                <TableRow
                  key={employee.id}
                  onClick={() => onEditEmployee(employee.id)}
                  className="cursor-pointer hover:bg-secondary/50"
                >
                  <TableCell>
                    <div className="font-medium text-foreground">{employee.full_name}</div>
                    <div className="text-xs text-muted-foreground">{employee.email}</div>
                    <EmployeeRowBadges employee={employee} />
                  </TableCell>
                  <TableCell>
                    <ShiftBadge shiftType={employee.shift_type} />
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={EMPLOYEE_META_BADGE_CLASS}>
                      {formatEmploymentLabel(employee.employment_type)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {employee.is_lead_eligible ||
                    employee.on_fmla ||
                    employee.works_dow.length > 0 ||
                    employee.offs_dow.length > 0 ||
                    employee.weekend_rotation === 'every_other' ||
                    (includeInactive && !employee.is_active) ? (
                      <div className="space-y-1">
                        <div className="flex flex-wrap gap-1.5">
                          {employee.is_lead_eligible ? (
                            <Badge className={LEAD_ELIGIBLE_BADGE_CLASS}>Lead</Badge>
                          ) : null}
                          {employee.on_fmla ? (
                            <Badge
                              variant="outline"
                              title={
                                employee.fmla_return_date
                                  ? `Potential return: ${formatDate(employee.fmla_return_date)}`
                                  : undefined
                              }
                            >
                              FMLA
                            </Badge>
                          ) : null}
                          {employee.works_dow.length > 0 ? (
                            <Badge variant="outline" title={formatWeekdayLabel(employee.works_dow)}>
                              Works: {formatWeekdayLabel(employee.works_dow)}
                            </Badge>
                          ) : null}
                          {employee.offs_dow.length > 0 ? (
                            <Badge variant="outline" title={formatWeekdayLabel(employee.offs_dow)}>
                              Never: {formatWeekdayLabel(employee.offs_dow)}
                            </Badge>
                          ) : null}
                          {employee.weekend_rotation === 'every_other' ? (
                            <Badge
                              variant="outline"
                              title={
                                employee.weekend_anchor_date
                                  ? `Anchor weekend: ${formatDate(employee.weekend_anchor_date)}`
                                  : undefined
                              }
                            >
                              Alt weekend
                            </Badge>
                          ) : null}
                          {employee.works_dow.length > 0 ? (
                            <Badge variant="outline">
                              Works days: {employee.works_dow_mode === 'hard' ? 'Hard' : 'Soft'}
                            </Badge>
                          ) : null}
                          {includeInactive && !employee.is_active ? (
                            <Badge variant="outline">Inactive</Badge>
                          ) : null}
                        </div>
                        {employee.on_fmla && employee.fmla_return_date ? (
                          <p className="text-xs text-muted-foreground">
                            Return: {formatDate(employee.fmla_return_date)}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <EmployeeActionsMenu
                      employee={employee}
                      onEdit={() => onEditEmployee(employee.id)}
                      onDeactivate={() => onDeactivateEmployee(employee.id)}
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
        {employees.length === 0 ? (
          <p className="rounded-md border border-border p-3 text-sm text-muted-foreground">
            No employees match the current filters.
          </p>
        ) : (
          employees.map((employee) => (
            <div
              key={employee.id}
              className="rounded-md border border-border p-3 transition-colors hover:bg-secondary/15"
              onClick={() => onEditEmployee(employee.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">{employee.full_name}</p>
                  <p className="text-xs text-muted-foreground">{employee.email}</p>
                  <EmployeeRowBadges employee={employee} />
                </div>
                <EmployeeActionsMenu
                  employee={employee}
                  onEdit={() => onEditEmployee(employee.id)}
                  onDeactivate={() => onDeactivateEmployee(employee.id)}
                  setEmployeeActiveAction={setEmployeeActiveAction}
                />
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                <ShiftBadge shiftType={employee.shift_type} />
                <Badge variant="outline" className={EMPLOYEE_META_BADGE_CLASS}>
                  {formatEmploymentLabel(employee.employment_type)}
                </Badge>
                {employee.is_lead_eligible ? (
                  <Badge className={LEAD_ELIGIBLE_BADGE_CLASS}>Lead</Badge>
                ) : null}
                {includeInactive && !employee.is_active ? (
                  <Badge variant="outline">Inactive</Badge>
                ) : null}
                {employee.on_fmla ? <Badge variant="outline">FMLA</Badge> : null}
                {employee.works_dow.length > 0 ? (
                  <Badge variant="outline">Works: {formatWeekdayLabel(employee.works_dow)}</Badge>
                ) : null}
                {employee.offs_dow.length > 0 ? (
                  <Badge variant="outline">Never: {formatWeekdayLabel(employee.offs_dow)}</Badge>
                ) : null}
                {employee.weekend_rotation === 'every_other' ? (
                  <Badge variant="outline">Alt weekend</Badge>
                ) : null}
                {employee.works_dow.length > 0 ? (
                  <Badge variant="outline">
                    Works days: {employee.works_dow_mode === 'hard' ? 'Hard' : 'Soft'}
                  </Badge>
                ) : null}
              </div>
              {employee.on_fmla && employee.fmla_return_date ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Return: {formatDate(employee.fmla_return_date)}
                </p>
              ) : null}
            </div>
          ))
        )}
      </div>
    </>
  )
}
