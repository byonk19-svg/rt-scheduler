'use client'

import { ChevronDown, ChevronRight } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type MissingAvailabilityRow = {
  therapistId: string
  therapistName: string
  overridesCount: number
  lastUpdatedAt: string | null
  submitted: boolean
}

type MissingAvailabilityPanelProps = {
  collapsed: boolean
  cycles: Array<{ id: string; label: string }>
  rows: MissingAvailabilityRow[]
  selectedCycleId: string
  formatDateTime: (value: string | null) => string
  onCycleChange: (value: string) => void
  onEditAvailability: (therapistId: string) => void
  onToggleCollapsed: () => void
}

export function MissingAvailabilityPanel({
  collapsed,
  cycles,
  rows,
  selectedCycleId,
  formatDateTime,
  onCycleChange,
  onEditAvailability,
  onToggleCollapsed,
}: MissingAvailabilityPanelProps) {
  return (
    <div className="space-y-2 rounded-md border border-border bg-secondary/20 p-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="inline-flex items-center gap-1 text-sm font-semibold text-foreground hover:text-muted-foreground"
          >
            {collapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            Missing availability ({rows.length})
          </button>
          {collapsed ? (
            <span className="text-xs text-muted-foreground">
              {rows.filter((row) => !row.submitted).length} not submitted
            </span>
          ) : null}
        </div>
        {!collapsed ? (
          <div className="w-full md:w-72">
            <Label htmlFor="missing_cycle_id" className="text-xs">
              Selected cycle
            </Label>
            <select
              id="missing_cycle_id"
              className="mt-1 h-9 w-full rounded-md border border-border bg-card px-3 text-sm"
              value={selectedCycleId}
              onChange={(event) => onCycleChange(event.target.value)}
            >
              {cycles.map((cycle) => (
                <option key={`missing-cycle-${cycle.id}`} value={cycle.id}>
                  {cycle.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      {!collapsed ? (
        <div className="overflow-x-auto rounded-md border border-border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Therapist</TableHead>
                <TableHead>Overrides</TableHead>
                <TableHead>Last updated</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    No therapists available for this cycle.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={`missing-${row.therapistId}`} className="hover:bg-secondary/20">
                    <TableCell className="font-medium">{row.therapistName}</TableCell>
                    <TableCell>{row.overridesCount}</TableCell>
                    <TableCell>{formatDateTime(row.lastUpdatedAt)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={row.submitted ? 'outline' : 'destructive'}
                        className="whitespace-nowrap"
                      >
                        {row.submitted ? 'Submitted' : 'Not submitted'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onEditAvailability(row.therapistId)}
                      >
                        Enter availability
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  )
}
