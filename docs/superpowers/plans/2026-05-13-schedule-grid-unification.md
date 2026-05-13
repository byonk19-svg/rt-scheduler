# Schedule Grid Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the confusing Coverage/Roster View split with a single `/schedule` route that is the live truth for all roles — editable grid for managers/leads, read-only pinned-row view for therapists.

**Architecture:** Build a new `ScheduleGrid` client component with its own data loader and types, wire it into the existing `/schedule` server route, then redirect `/coverage` and retire the old block board. All existing mutation APIs (`drag-drop`, `assignment-status`) are reused unchanged.

**Spec:** `docs/superpowers/specs/2026-05-13-schedule-grid-unification-design.md`

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (server client), Tailwind, shadcn/ui, Vitest

---

## File Map

### New files

| File                                                       | Purpose                                                 |
| ---------------------------------------------------------- | ------------------------------------------------------- |
| `src/components/schedule-grid/schedule-grid-types.ts`      | `GridCell`, `TherapistGridRow`, `GridDataset` types     |
| `src/components/schedule-grid/schedule-grid-utils.ts`      | `buildGridDataset()`, `getCellDisplay()` pure helpers   |
| `src/components/schedule-grid/schedule-grid-utils.test.ts` | Unit tests for utils                                    |
| `src/components/schedule-grid/ScheduleGridTable.tsx`       | Pure rendering grid (rows × dates)                      |
| `src/components/schedule-grid/ScheduleGridTable.test.tsx`  | Rendering tests                                         |
| `src/components/schedule-grid/AssignCellPopover.tsx`       | Assign + conflict-warning popover                       |
| `src/components/schedule-grid/StatusCellPopover.tsx`       | Post-publish status + lead designation popover          |
| `src/components/schedule-grid/ScheduleGridToolbar.tsx`     | Toolbar (cycle, Day/Night, Draft badge, actions)        |
| `src/components/schedule-grid/ScheduleGrid.tsx`            | Main client component wiring everything                 |
| `src/app/(app)/schedule/schedule-grid-data.ts`             | Server data loader (replaces schedule-roster-live-data) |

### Modified files

| File                                        | Change                                                                              |
| ------------------------------------------- | ----------------------------------------------------------------------------------- |
| `src/components/shell/app-shell-config.ts`  | Nav: Coverage→Schedule, remove Roster View; Staff: My Shifts+Team Schedule→Schedule |
| `src/app/(app)/schedule/page.tsx`           | Use `ScheduleGrid` instead of `ScheduleRosterScreen`                                |
| `src/app/(app)/coverage/page.tsx`           | Redirect to `/schedule` (preserve `?shift=`)                                        |
| `src/app/(app)/therapist/schedule/page.tsx` | Redirect to `/schedule`                                                             |

### Deleted files (Task 10 only — after everything works)

- `src/app/(app)/coverage/CoverageClientPage.tsx`
- `src/components/coverage/CalendarGrid.tsx`
- `src/components/coverage/RosterScheduleView.tsx`
- `src/components/coverage/ShiftEditorDialog.tsx` (and `shift-editor-dialog-layout.ts`)
- `src/components/schedule-roster/ScheduleRosterScreen.tsx`
- `src/components/schedule-roster/PaperScheduleGrid.tsx`
- `src/components/schedule-roster/live-schedule-dataset.ts`
- `src/components/schedule-roster/ScheduleCycleSelect.tsx` (if not used elsewhere)
- `src/app/(app)/schedule/schedule-roster-live-data.ts`

> **Before deleting anything in Task 10**, run `npx knip` to verify nothing outside the replaced surfaces still imports those files.

---

## Task 1: Nav Config

**Files:**

- Modify: `src/components/shell/app-shell-config.ts`
- Modify: `src/components/shell/app-shell-config.test.ts` (if exists) or create

- [ ] **Step 1: Update `buildManagerSections()`**

In `src/components/shell/app-shell-config.ts`, change the `schedule` section:

```typescript
// Change the section href from '/coverage' to '/schedule'
{
  key: 'schedule',
  label: 'Schedule',
  href: '/schedule',                            // was '/coverage'
  isActive: (pathname) => isManagerScheduleRoute(pathname),
  subItems: [
    {
      href: '/schedule',
      label: 'Schedule',                        // was 'Coverage', href was '/coverage'
      active: (pathname) => pathname === '/schedule',
    },
    // DELETE the 'Roster View' sub-item entirely
    {
      href: '/analytics',
      label: 'Analytics',
      active: (pathname) => pathname === '/analytics',
    },
    // ... rest unchanged (Availability, Lottery, Publish, Approvals)
  ],
},
```

- [ ] **Step 2: Update `getStaffNavItems()`**

Replace the two schedule items with one:

```typescript
// DELETE:
// { href: '/therapist/schedule', label: 'My Shifts', active: ... }
// { href: '/coverage', label: 'Team Schedule', active: ... }

// ADD (in same position after Dashboard):
{
  href: '/schedule',
  label: 'Schedule',
  active: (pathname) =>
    pathname === '/schedule' ||
    pathname === '/therapist/schedule' ||
    pathname === '/staff/my-schedule' ||
    pathname === '/coverage' ||
    pathname === '/preliminary',
},
```

- [ ] **Step 3: Update `isManagerScheduleRoute()`**

```typescript
function isManagerScheduleRoute(pathname: string): boolean {
  return (
    pathname === '/schedule' || // add; was '/coverage' and '/schedule' separately
    pathname === '/analytics' ||
    pathname === '/availability' ||
    pathname === '/lottery' ||
    pathname === '/publish' ||
    pathname.startsWith('/publish/') ||
    pathname === '/approvals'
    // remove '/coverage' — it will redirect to /schedule
  )
}
```

- [ ] **Step 4: Run nav tests**

```bash
npx vitest run src/components/shell/app-shell-config.test.ts
```

Fix any failures — the test likely asserts on "Coverage" label or `/coverage` href. Update assertions to "Schedule" and `/schedule`.

- [ ] **Step 5: Commit**

```bash
git add src/components/shell/app-shell-config.ts
git commit -m "feat: unify schedule nav — single Schedule tab for manager and staff"
```

---

## Task 2: Route Redirects

**Files:**

- Modify: `src/app/(app)/coverage/page.tsx`
- Modify: `src/app/(app)/therapist/schedule/page.tsx`

- [ ] **Step 1: Redirect `/coverage` → `/schedule`**

Replace the full contents of `src/app/(app)/coverage/page.tsx`:

```typescript
import { redirect } from 'next/navigation'

export const metadata = { title: 'Schedule' }

export default async function CoverageRedirectPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await (searchParams ?? Promise.resolve({}))
  const shift = typeof params.shift === 'string' ? params.shift : null
  const dest = shift ? `/schedule?shift=${shift}` : '/schedule'
  redirect(dest)
}
```

- [ ] **Step 2: Redirect `/therapist/schedule` → `/schedule`**

Replace the full contents of `src/app/(app)/therapist/schedule/page.tsx`:

```typescript
import { redirect } from 'next/navigation'

export default function TherapistScheduleRedirectPage() {
  redirect('/schedule')
}
```

- [ ] **Step 3: Build check**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no TypeScript errors on the changed files.

- [ ] **Step 4: Commit**

```bash
git add src/app/(app)/coverage/page.tsx src/app/(app)/therapist/schedule/page.tsx
git commit -m "feat: redirect /coverage and /therapist/schedule to /schedule"
```

---

## Task 3: Grid Types and Utilities

**Files:**

- Create: `src/components/schedule-grid/schedule-grid-types.ts`
- Create: `src/components/schedule-grid/schedule-grid-utils.ts`
- Create: `src/components/schedule-grid/schedule-grid-utils.test.ts`

- [ ] **Step 1: Write the types file**

```typescript
// src/components/schedule-grid/schedule-grid-types.ts

export type GridCellStatus =
  | 'lead' // yellow 1 — designated lead shift
  | 'staff' // blue 1 — scheduled staff
  | 'on_call' // OC
  | 'cancelled' // CX
  | 'call_in' // CI
  | 'left_early' // LE
  | 'off' // · — not scheduled

export type GridCell = {
  shiftId: string | null
  status: GridCellStatus
  hasNeedsOff: boolean // shows * asterisk — therapist has force_off for this date
  isIneligible: boolean // cell not clickable (FMLA, inactive, force_off, at weekly max)
}

export type TherapistGridRow = {
  userId: string
  name: string
  isOnFmla: boolean
  isActive: boolean
  shiftType: 'day' | 'night'
  cells: Record<string, GridCell> // keyed by isoDate
}

export type GridDataset = {
  cycleId: string
  cycleDates: string[] // sorted isoDate[] for the cycle range
  cycleDateRangeLabel: string // "May 3 – Jun 13, 2026"
  isPublished: boolean
  therapistRows: TherapistGridRow[]
  dailyTotals: Record<string, number> // isoDate → count of scheduled/call_in
  viewerUserId: string
  viewerRole: string | null
  canManageCoverage: boolean
  canUpdateAssignmentStatus: boolean
}
```

- [ ] **Step 2: Write failing tests**

```typescript
// src/components/schedule-grid/schedule-grid-utils.test.ts
import { describe, it, expect } from 'vitest'
import { getCellDisplay, buildDailyTotals } from './schedule-grid-utils'
import type { GridCell } from './schedule-grid-types'

describe('getCellDisplay', () => {
  it('returns yellow chip for lead cell', () => {
    const cell: GridCell = {
      shiftId: 's1',
      status: 'lead',
      hasNeedsOff: false,
      isIneligible: false,
    }
    const display = getCellDisplay(cell)
    expect(display.code).toBe('1')
    expect(display.colorClass).toContain('bg-yellow')
    expect(display.asterisk).toBe(false)
  })

  it('returns blue chip for staff cell', () => {
    const cell: GridCell = {
      shiftId: 's2',
      status: 'staff',
      hasNeedsOff: false,
      isIneligible: false,
    }
    const display = getCellDisplay(cell)
    expect(display.code).toBe('1')
    expect(display.colorClass).toContain('bg-blue')
  })

  it('appends asterisk when hasNeedsOff', () => {
    const cell: GridCell = { shiftId: null, status: 'off', hasNeedsOff: true, isIneligible: false }
    const display = getCellDisplay(cell)
    expect(display.asterisk).toBe(true)
    expect(display.code).toBe('·')
  })

  it('returns correct code for each status', () => {
    const cases: Array<[GridCell['status'], string]> = [
      ['on_call', 'OC'],
      ['cancelled', 'CX'],
      ['call_in', 'CI'],
      ['left_early', 'LE'],
      ['off', '·'],
    ]
    for (const [status, expectedCode] of cases) {
      const cell: GridCell = { shiftId: null, status, hasNeedsOff: false, isIneligible: false }
      expect(getCellDisplay(cell).code).toBe(expectedCode)
    }
  })
})

describe('buildDailyTotals', () => {
  it('counts scheduled and call_in shifts per date', () => {
    const rows: import('./schedule-grid-types').TherapistGridRow[] = [
      {
        userId: 'u1',
        name: 'A',
        isOnFmla: false,
        isActive: true,
        shiftType: 'day',
        cells: {
          '2026-05-04': { shiftId: 's1', status: 'staff', hasNeedsOff: false, isIneligible: false },
          '2026-05-05': { shiftId: null, status: 'off', hasNeedsOff: false, isIneligible: false },
        },
      },
      {
        userId: 'u2',
        name: 'B',
        isOnFmla: false,
        isActive: true,
        shiftType: 'day',
        cells: {
          '2026-05-04': {
            shiftId: 's2',
            status: 'call_in',
            hasNeedsOff: false,
            isIneligible: false,
          },
        },
      },
    ]
    const totals = buildDailyTotals(rows, ['2026-05-04', '2026-05-05'])
    expect(totals['2026-05-04']).toBe(2)
    expect(totals['2026-05-05']).toBe(0)
  })
})
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
npx vitest run src/components/schedule-grid/schedule-grid-utils.test.ts
```

Expected: FAIL — `schedule-grid-utils` doesn't exist yet.

- [ ] **Step 4: Implement the utils**

```typescript
// src/components/schedule-grid/schedule-grid-utils.ts
import type { GridCell, GridCellStatus, TherapistGridRow } from './schedule-grid-types'

export type CellDisplay = {
  code: string
  colorClass: string // Tailwind bg + text classes for the chip
  asterisk: boolean // show bold black * superscript
  isEmpty: boolean // true when status === 'off'
}

const STATUS_CODE: Record<GridCellStatus, string> = {
  lead: '1',
  staff: '1',
  on_call: 'OC',
  cancelled: 'CX',
  call_in: 'CI',
  left_early: 'LE',
  off: '·',
}

// Tailwind classes for each status chip
const STATUS_COLOR: Record<GridCellStatus, string> = {
  lead: 'bg-yellow-200 text-yellow-900', // #fef08a / #713f12
  staff: 'bg-blue-100 text-blue-700', // #dbeafe / #1d4ed8
  on_call: 'bg-yellow-50 text-yellow-700', // #fef9c3 / #a16207
  cancelled: 'bg-red-100 text-red-800', // #fee2e2 / #991b1b
  call_in: 'bg-green-100 text-green-800',
  left_early: 'bg-orange-100 text-orange-800',
  off: '',
}

export function getCellDisplay(cell: GridCell): CellDisplay {
  return {
    code: STATUS_CODE[cell.status],
    colorClass: STATUS_COLOR[cell.status],
    asterisk: cell.hasNeedsOff,
    isEmpty: cell.status === 'off',
  }
}

export function buildDailyTotals(
  rows: TherapistGridRow[],
  dates: string[]
): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const date of dates) {
    totals[date] = rows.reduce((count, row) => {
      const cell = row.cells[date]
      if (!cell) return count
      return cell.status === 'staff' || cell.status === 'lead' || cell.status === 'call_in'
        ? count + 1
        : count
    }, 0)
  }
  return totals
}
```

- [ ] **Step 5: Run tests and confirm they pass**

```bash
npx vitest run src/components/schedule-grid/schedule-grid-utils.test.ts
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/schedule-grid/
git commit -m "feat: add schedule grid types and cell display utils"
```

---

## Task 4: Server Data Loader

**Files:**

- Create: `src/app/(app)/schedule/schedule-grid-data.ts`

This loader combines the snapshot pattern from `coverage-page-data.ts` with a new `availability_overrides` force_off query. It does NOT duplicate the coverage loader — it is a separate, slimmer loader focused on what the new grid needs.

- [ ] **Step 1: Write the data loader**

```typescript
// src/app/(app)/schedule/schedule-grid-data.ts
import { createServerClient } from '@/lib/supabase/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { formatCycleDate } from '@/lib/calendar-utils'
import {
  parseCoverageShiftSearchParam,
  defaultCoverageShiftTabFromProfileShift,
  shiftTabToQueryValue,
} from '@/lib/coverage/coverage-shift-tab'
import type {
  GridCell,
  GridDataset,
  TherapistGridRow,
} from '@/components/schedule-grid/schedule-grid-types'
import type { AssignmentStatus } from '@/app/(app)/schedule/types'

function assignmentStatusToGridStatus(
  isLead: boolean,
  assignmentStatus: AssignmentStatus | null
): GridCell['status'] {
  if (!assignmentStatus || assignmentStatus === 'scheduled') {
    return isLead ? 'lead' : 'staff'
  }
  const map: Record<AssignmentStatus, GridCell['status']> = {
    scheduled: isLead ? 'lead' : 'staff',
    on_call: 'on_call',
    cancelled: 'cancelled',
    call_in: 'call_in',
    left_early: 'left_early',
  }
  return map[assignmentStatus] ?? (isLead ? 'lead' : 'staff')
}

export type ScheduleGridServerData =
  | { error: 'unauthenticated' }
  | { error: 'forbidden' }
  | { error: 'no_cycle' }
  | { dataset: GridDataset; initialShiftTab: 'Day' | 'Night' }

export async function loadScheduleGridData(
  searchParams?: Record<string, string | string[] | undefined>
): Promise<ScheduleGridServerData> {
  const supabase = createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'unauthenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, shift_type, is_active')
    .eq('id', user.id)
    .single()

  if (!profile?.is_active) return { error: 'forbidden' }
  const role = profile.role ?? null
  if (!role) return { error: 'forbidden' }

  const canManage = role === 'manager'
  const canUpdateStatus = role === 'manager' || role === 'lead'

  // Resolve shift tab from URL or profile
  const rawShift = typeof searchParams?.shift === 'string' ? searchParams.shift : undefined
  const urlTab = parseCoverageShiftSearchParam(rawShift ?? null)
  const initialShiftTab: 'Day' | 'Night' =
    urlTab ?? defaultCoverageShiftTabFromProfileShift(profile.shift_type ?? null)
  const shiftType = shiftTabToQueryValue(initialShiftTab) // 'day' | 'night'

  // Load active cycle
  const { data: cycle } = await supabase
    .from('schedule_cycles')
    .select('id, start_date, end_date, status, archived_at')
    .is('archived_at', null)
    .order('start_date', { ascending: false })
    .limit(1)
    .single()

  if (!cycle) return { error: 'no_cycle' }

  const isPublished = cycle.status === 'published'

  // Load all active therapist profiles
  const { data: therapists } = await supabase
    .from('profiles')
    .select('id, full_name, shift_type, on_fmla, is_active, role')
    .eq('is_active', true)
    .not('role', 'is', null)
    .in('role', ['therapist', 'lead'])
    .order('full_name')

  // Load shifts for this cycle + shift type
  const { data: shifts } = await supabase
    .from('shifts')
    .select('id, user_id, date, role, status, assignment_status')
    .eq('cycle_id', cycle.id)
    .eq('shift_type', shiftType)
    .not('user_id', 'is', null)

  // Load force_off overrides for this cycle (for asterisk rendering)
  const { data: forceOffOverrides } = await supabase
    .from('availability_overrides')
    .select('therapist_id, date')
    .eq('cycle_id', cycle.id)
    .eq('override_type', 'force_off')

  // Build lookup: Set<`${userId}:${isoDate}`> for O(1) conflict checks
  const forceOffSet = new Set<string>(
    (forceOffOverrides ?? []).map((r) => `${r.therapist_id}:${r.date}`)
  )

  // Build per-therapist shift lookup
  const shiftsByTherapist = new Map<string, typeof shifts>()
  for (const shift of shifts ?? []) {
    if (!shift.user_id) continue
    const list = shiftsByTherapist.get(shift.user_id) ?? []
    list.push(shift)
    shiftsByTherapist.set(shift.user_id, list)
  }

  // Build cycle date range
  const startDate = new Date(cycle.start_date)
  const endDate = new Date(cycle.end_date)
  const cycleDates: string[] = []
  const cursor = new Date(startDate)
  while (cursor <= endDate) {
    cycleDates.push(cursor.toISOString().slice(0, 10))
    cursor.setDate(cursor.getDate() + 1)
  }

  const cycleDateRangeLabel = `${formatCycleDate(new Date(cycle.start_date))} – ${formatCycleDate(new Date(cycle.end_date))}`

  // Build therapist rows
  const therapistRows: TherapistGridRow[] = (therapists ?? [])
    .filter((t) => t.shift_type === shiftType || t.shift_type === 'both')
    .map((therapist) => {
      const myShifts = shiftsByTherapist.get(therapist.id) ?? []
      const shiftByDate = new Map(myShifts.map((s) => [s.date, s]))

      const cells: Record<string, GridCell> = {}
      for (const date of cycleDates) {
        const shift = shiftByDate.get(date)
        const hasNeedsOff = forceOffSet.has(`${therapist.id}:${date}`)
        if (shift) {
          cells[date] = {
            shiftId: shift.id,
            status: assignmentStatusToGridStatus(shift.role === 'lead', shift.assignment_status),
            hasNeedsOff,
            isIneligible: false,
          }
        } else {
          cells[date] = {
            shiftId: null,
            status: 'off',
            hasNeedsOff,
            // Ineligible when FMLA or has force_off override
            isIneligible: therapist.on_fmla || hasNeedsOff,
          }
        }
      }

      return {
        userId: therapist.id,
        name: therapist.full_name ?? '',
        isOnFmla: therapist.on_fmla ?? false,
        isActive: therapist.is_active ?? true,
        shiftType: (therapist.shift_type ?? 'day') as 'day' | 'night',
        cells,
      }
    })

  const { buildDailyTotals } = await import('@/components/schedule-grid/schedule-grid-utils')
  const dailyTotals = buildDailyTotals(therapistRows, cycleDates)

  return {
    initialShiftTab,
    dataset: {
      cycleId: cycle.id,
      cycleDates,
      cycleDateRangeLabel,
      isPublished,
      therapistRows,
      dailyTotals,
      viewerUserId: user.id,
      viewerRole: role,
      canManageCoverage: canManage,
      canUpdateAssignmentStatus: canUpdateStatus,
    },
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep "schedule-grid-data" | head -20
```

Fix any type errors before proceeding.

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/schedule/schedule-grid-data.ts
git commit -m "feat: add schedule grid server data loader with force_off asterisk support"
```

---

## Task 5: ScheduleGridTable Component

**Files:**

- Create: `src/components/schedule-grid/ScheduleGridTable.tsx`
- Create: `src/components/schedule-grid/ScheduleGridTable.test.tsx`

- [ ] **Step 1: Write failing rendering tests**

```typescript
// src/components/schedule-grid/ScheduleGridTable.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScheduleGridTable } from './ScheduleGridTable'
import type { GridDataset } from './schedule-grid-types'

function makeDataset(overrides?: Partial<GridDataset>): GridDataset {
  return {
    cycleId: 'c1',
    cycleDates: ['2026-05-04', '2026-05-05'],
    cycleDateRangeLabel: 'May 4 – May 5, 2026',
    isPublished: false,
    therapistRows: [
      {
        userId: 'u1',
        name: 'Alice Johnson',
        isOnFmla: false,
        isActive: true,
        shiftType: 'day',
        cells: {
          '2026-05-04': { shiftId: 's1', status: 'lead', hasNeedsOff: false, isIneligible: false },
          '2026-05-05': { shiftId: null, status: 'off', hasNeedsOff: true, isIneligible: false },
        },
      },
    ],
    dailyTotals: { '2026-05-04': 1, '2026-05-05': 0 },
    viewerUserId: 'mgr1',
    viewerRole: 'manager',
    canManageCoverage: true,
    canUpdateAssignmentStatus: true,
    ...overrides,
  }
}

describe('ScheduleGridTable', () => {
  it('renders therapist name', () => {
    render(<ScheduleGridTable dataset={makeDataset()} onCellClick={vi.fn()} />)
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument()
  })

  it('renders lead cell with yellow style', () => {
    render(<ScheduleGridTable dataset={makeDataset()} onCellClick={vi.fn()} />)
    const chip = screen.getByTestId('cell-u1-2026-05-04')
    expect(chip).toHaveClass('bg-yellow-200')
    expect(chip).toHaveTextContent('1')
  })

  it('renders asterisk on needs-off cell', () => {
    render(<ScheduleGridTable dataset={makeDataset()} onCellClick={vi.fn()} />)
    const asterisk = screen.getByTestId('asterisk-u1-2026-05-05')
    expect(asterisk).toBeInTheDocument()
  })

  it('pins viewer row to top with You label when therapist', () => {
    const dataset = makeDataset({
      viewerUserId: 'u1',
      viewerRole: 'therapist',
      canManageCoverage: false,
      canUpdateAssignmentStatus: false,
    })
    render(<ScheduleGridTable dataset={dataset} onCellClick={vi.fn()} />)
    expect(screen.getByText('You (Alice Johnson)')).toBeInTheDocument()
  })

  it('shows daily total in totals row', () => {
    render(<ScheduleGridTable dataset={makeDataset()} onCellClick={vi.fn()} />)
    // Total for May 4 = 1 (lead counts)
    expect(screen.getByTestId('total-2026-05-04')).toHaveTextContent('1')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/components/schedule-grid/ScheduleGridTable.test.tsx
```

Expected: FAIL — component doesn't exist yet.

- [ ] **Step 3: Implement ScheduleGridTable**

```typescript
// src/components/schedule-grid/ScheduleGridTable.tsx
'use client'

import { cn } from '@/lib/utils'
import { getCellDisplay } from './schedule-grid-utils'
import type { GridDataset, TherapistGridRow, GridCell } from './schedule-grid-types'

type Props = {
  dataset: GridDataset
  onCellClick?: (userId: string, date: string, cell: GridCell) => void
}

function totalColorClass(count: number): string {
  if (count < 3) return 'text-red-600 font-bold'
  if (count <= 5) return 'text-[var(--primary)] font-bold'
  if (count > 5) return 'text-amber-600 font-bold'
  return 'text-muted-foreground'
}

export function ScheduleGridTable({ dataset, onCellClick }: Props) {
  const { cycleDates, therapistRows, dailyTotals, viewerUserId, viewerRole, canManageCoverage } = dataset
  const isTherapist = viewerRole === 'therapist' || viewerRole === 'lead'

  // Pin viewer's own row to top for therapists
  const sortedRows = isTherapist
    ? [
        ...therapistRows.filter((r) => r.userId === viewerUserId),
        ...therapistRows.filter((r) => r.userId !== viewerUserId),
      ]
    : therapistRows

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 min-w-[120px] bg-card px-3 py-2 text-left text-muted-foreground font-medium" />
            {cycleDates.map((date) => {
              const d = new Date(date)
              const day = d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1)
              const num = d.getDate()
              return (
                <th key={date} className="min-w-[32px] px-1 py-2 text-center text-muted-foreground font-medium">
                  {day}<br /><span className="text-[10px]">{num}</span>
                </th>
              )
            })}
            <th className="min-w-[40px] px-2 py-2 text-center text-muted-foreground font-medium">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <TherapistRow
              key={row.userId}
              row={row}
              cycleDates={cycleDates}
              isViewer={row.userId === viewerUserId && isTherapist}
              canClick={canManageCoverage || dataset.canUpdateAssignmentStatus}
              onCellClick={onCellClick}
            />
          ))}
          {/* Totals row */}
          <tr className="border-t-2 border-border bg-muted/40">
            <td className="sticky left-0 z-10 bg-muted/40 px-3 py-2 text-[11px] font-semibold text-muted-foreground">
              TOTAL
            </td>
            {cycleDates.map((date) => (
              <td key={date} className="px-1 py-2 text-center">
                <span className={totalColorClass(dailyTotals[date] ?? 0)}>
                  <span data-testid={`total-${date}`}>{dailyTotals[date] ?? 0}</span>
                </span>
              </td>
            ))}
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function TherapistRow({
  row,
  cycleDates,
  isViewer,
  canClick,
  onCellClick,
}: {
  row: TherapistGridRow
  cycleDates: string[]
  isViewer: boolean
  canClick: boolean
  onCellClick?: (userId: string, date: string, cell: GridCell) => void
}) {
  const scheduledCount = cycleDates.reduce((n, d) => {
    const s = row.cells[d]?.status
    return s && s !== 'off' && s !== 'cancelled' ? n + 1 : n
  }, 0)

  return (
    <tr className={cn(isViewer && 'border-b-2 border-[var(--primary)] bg-[var(--primary)]/5')}>
      <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium text-foreground">
        {isViewer ? `You (${row.name})` : row.name}
        {row.isOnFmla && (
          <span className="ml-2 text-[10px] text-muted-foreground italic">FMLA</span>
        )}
      </td>
      {cycleDates.map((date) => {
        const cell = row.cells[date] ?? { shiftId: null, status: 'off' as const, hasNeedsOff: false, isIneligible: false }
        const display = getCellDisplay(cell)
        const clickable = canClick && !cell.isIneligible

        return (
          <td key={date} className="px-1 py-1.5 text-center">
            {display.isEmpty ? (
              <span
                className={cn('cursor-default select-none text-muted-foreground', clickable && 'cursor-pointer hover:text-foreground')}
                onClick={clickable && onCellClick ? () => onCellClick(row.userId, date, cell) : undefined}
              >
                ·{cell.hasNeedsOff && (
                  <sup data-testid={`asterisk-${row.userId}-${date}`} className="font-black text-foreground text-[9px]">*</sup>
                )}
              </span>
            ) : (
              <span
                data-testid={`cell-${row.userId}-${date}`}
                className={cn(
                  'inline-flex min-w-[22px] cursor-pointer items-center justify-center rounded px-1 py-0.5 font-bold',
                  display.colorClass,
                  !canClick && 'cursor-default'
                )}
                onClick={canClick && onCellClick ? () => onCellClick(row.userId, date, cell) : undefined}
              >
                {display.code}
                {cell.hasNeedsOff && (
                  <sup data-testid={`asterisk-${row.userId}-${date}`} className="font-black text-foreground text-[9px] ml-px">*</sup>
                )}
              </span>
            )}
          </td>
        )
      })}
      <td className="px-2 py-1.5 text-center font-semibold text-foreground">{scheduledCount}</td>
    </tr>
  )
}
```

- [ ] **Step 4: Run tests and fix**

```bash
npx vitest run src/components/schedule-grid/ScheduleGridTable.test.tsx
```

Fix any failures. Common issue: `@testing-library/react` setup — check `vitest.setup.ts` already imports it.

- [ ] **Step 5: Commit**

```bash
git add src/components/schedule-grid/ScheduleGridTable.tsx src/components/schedule-grid/ScheduleGridTable.test.tsx
git commit -m "feat: add ScheduleGridTable with lead/staff cell styles and asterisk indicators"
```

---

## Task 6: Cell Popovers

**Files:**

- Create: `src/components/schedule-grid/AssignCellPopover.tsx`
- Create: `src/components/schedule-grid/StatusCellPopover.tsx`

- [ ] **Step 1: Implement AssignCellPopover**

```typescript
// src/components/schedule-grid/AssignCellPopover.tsx
'use client'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { formatCycleDate } from '@/lib/calendar-utils'
import type { GridCell } from './schedule-grid-types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  therapistName: string
  date: string
  cell: GridCell
  onAssign: () => Promise<void>
  isPending: boolean
  children: React.ReactNode
}

export function AssignCellPopover({ open, onOpenChange, therapistName, date, cell, onAssign, isPending, children }: Props) {
  const label = formatCycleDate(new Date(date))

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-52 p-3">
        <p className="mb-1 text-sm font-semibold text-foreground">
          {therapistName} · {label}
        </p>
        {cell.hasNeedsOff && (
          <div className="mb-3 rounded border border-red-200 bg-red-50 px-2 py-1.5">
            <p className="text-xs text-red-700">⚠ Requested this day off</p>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Button size="sm" className="w-full" onClick={onAssign} disabled={isPending}>
            {cell.hasNeedsOff ? 'Assign anyway' : 'Assign'}
          </Button>
          <Button size="sm" variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 2: Implement StatusCellPopover**

```typescript
// src/components/schedule-grid/StatusCellPopover.tsx
'use client'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { formatCycleDate } from '@/lib/calendar-utils'
import { cn } from '@/lib/utils'
import type { GridCell, GridCellStatus } from './schedule-grid-types'

type AssignmentStatus = 'scheduled' | 'on_call' | 'cancelled' | 'call_in' | 'left_early'

const STATUS_LABELS: Array<{ value: AssignmentStatus; label: string }> = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'on_call', label: 'On call' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'call_in', label: 'Call-in' },
  { value: 'left_early', label: 'Left early' },
]

function cellStatusToAssignment(status: GridCellStatus): AssignmentStatus {
  const map: Partial<Record<GridCellStatus, AssignmentStatus>> = {
    lead: 'scheduled',
    staff: 'scheduled',
    on_call: 'on_call',
    cancelled: 'cancelled',
    call_in: 'call_in',
    left_early: 'left_early',
  }
  return map[status] ?? 'scheduled'
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  therapistName: string
  date: string
  cell: GridCell
  canDesignateLead: boolean
  isCurrentlyLead: boolean
  onStatusChange: (status: AssignmentStatus) => Promise<void>
  onUnassign: () => Promise<void>
  onDesignateLead: () => Promise<void>
  isPending: boolean
  children: React.ReactNode
}

export function StatusCellPopover({
  open, onOpenChange, therapistName, date, cell, canDesignateLead,
  isCurrentlyLead, onStatusChange, onUnassign, onDesignateLead, isPending, children,
}: Props) {
  const label = formatCycleDate(new Date(date))
  const currentAssignment = cellStatusToAssignment(cell.status)

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-52 p-3">
        <p className="mb-0.5 text-sm font-semibold text-foreground">{therapistName} · {label}</p>
        {cell.hasNeedsOff && (
          <div className="mb-2 rounded border border-red-200 bg-red-50 px-2 py-1">
            <p className="text-xs text-red-700">⚠ Requested this day off</p>
          </div>
        )}
        <div className="flex flex-col gap-1 mb-2">
          {STATUS_LABELS.map(({ value, label }) => (
            <button
              key={value}
              className={cn(
                'flex items-center justify-between rounded px-2 py-1.5 text-sm text-left hover:bg-muted',
                currentAssignment === value && 'bg-[var(--primary)] text-white hover:bg-[var(--primary)]'
              )}
              onClick={() => onStatusChange(value)}
              disabled={isPending}
            >
              {label}
              {currentAssignment === value && <span>✓</span>}
            </button>
          ))}
        </div>
        <div className="border-t border-border pt-2 flex flex-col gap-1">
          {canDesignateLead && !isCurrentlyLead && (
            <button
              className="rounded px-2 py-1.5 text-sm text-left hover:bg-muted text-[var(--primary)]"
              onClick={onDesignateLead}
              disabled={isPending}
            >
              Designate as lead
            </button>
          )}
          <button
            className="rounded px-2 py-1.5 text-sm text-left text-destructive hover:bg-red-50"
            onClick={onUnassign}
            disabled={isPending}
          >
            Unassign
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -E "AssignCellPopover|StatusCellPopover" | head -10
```

- [ ] **Step 4: Commit**

```bash
git add src/components/schedule-grid/AssignCellPopover.tsx src/components/schedule-grid/StatusCellPopover.tsx
git commit -m "feat: add assign and status cell popovers for schedule grid"
```

---

## Task 7: ScheduleGridToolbar

**Files:**

- Create: `src/components/schedule-grid/ScheduleGridToolbar.tsx`

- [ ] **Step 1: Implement toolbar**

```typescript
// src/components/schedule-grid/ScheduleGridToolbar.tsx
'use client'

import { Printer, Zap, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Props = {
  cycleDateRangeLabel: string
  isPublished: boolean
  shiftTab: 'Day' | 'Night'
  canManageCoverage: boolean
  onShiftTabChange: (tab: 'Day' | 'Night') => void
  onAutoDraft?: () => void
  onPreFlight?: () => void
  onPrint: () => void
  onPublish?: () => void
}

export function ScheduleGridToolbar({
  cycleDateRangeLabel, isPublished, shiftTab, canManageCoverage,
  onShiftTabChange, onAutoDraft, onPreFlight, onPrint, onPublish,
}: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-foreground">{cycleDateRangeLabel}</span>
        <span className={cn(
          'rounded-full border px-2.5 py-0.5 text-xs font-medium',
          isPublished
            ? 'border-green-200 bg-green-50 text-green-700'
            : 'border-yellow-200 bg-yellow-50 text-yellow-700'
        )}>
          {isPublished ? 'Published' : 'Draft'}
        </span>
        {/* Day / Night toggle */}
        <div className="flex gap-1 rounded-md border border-border p-0.5">
          {(['Day', 'Night'] as const).map((tab) => (
            <button
              key={tab}
              className={cn(
                'rounded px-3 py-1 text-xs font-medium transition-colors',
                shiftTab === tab
                  ? 'bg-[var(--primary)] text-white'
                  : 'text-muted-foreground hover:bg-muted'
              )}
              onClick={() => onShiftTabChange(tab)}
            >
              {tab} shift
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {canManageCoverage && !isPublished && (
          <>
            {onAutoDraft && (
              <Button size="sm" variant="outline" onClick={onAutoDraft}>
                <Zap className="mr-1.5 h-3.5 w-3.5" />
                Auto-draft
              </Button>
            )}
            {onPreFlight && (
              <Button size="sm" variant="outline" onClick={onPreFlight}>
                <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                Pre-flight
              </Button>
            )}
          </>
        )}
        <Button size="sm" variant="outline" onClick={onPrint}>
          <Printer className="mr-1.5 h-3.5 w-3.5" />
          Print
        </Button>
        {canManageCoverage && !isPublished && onPublish && (
          <Button size="sm" onClick={onPublish}>
            Publish →
          </Button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck and commit**

```bash
npx tsc --noEmit 2>&1 | grep "ScheduleGridToolbar" | head -5
git add src/components/schedule-grid/ScheduleGridToolbar.tsx
git commit -m "feat: add ScheduleGridToolbar with shift toggle, draft badge, action buttons"
```

---

## Task 8: ScheduleGrid Client Component

**Files:**

- Create: `src/components/schedule-grid/ScheduleGrid.tsx`

This wires together the toolbar, table, and popovers. It reuses the existing `createCoverageShiftMutator()` from `src/lib/coverage/mutations.ts` for all mutation calls.

- [ ] **Step 1: Implement ScheduleGrid**

```typescript
// src/components/schedule-grid/ScheduleGrid.tsx
'use client'

import { useCallback, useState, useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { createCoverageShiftMutator } from '@/lib/coverage/mutations'
import { shiftTabToQueryValue } from '@/lib/coverage/coverage-shift-tab'
import { ScheduleGridToolbar } from './ScheduleGridToolbar'
import { ScheduleGridTable } from './ScheduleGridTable'
import { AssignCellPopover } from './AssignCellPopover'
import { StatusCellPopover } from './StatusCellPopover'
import type { GridCell, GridDataset } from './schedule-grid-types'

type CellTarget = {
  userId: string
  date: string
  cell: GridCell
  therapistName: string
  anchorEl?: HTMLElement
}

type Props = {
  initialDataset: GridDataset
  cycleId: string
}

export function ScheduleGrid({ initialDataset, cycleId }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [shiftTab, setShiftTab] = useState<'Day' | 'Night'>(initialDataset.canManageCoverage ? 'Day' : 'Day')
  const [activeCellTarget, setActiveCellTarget] = useState<CellTarget | null>(null)
  const mutator = createCoverageShiftMutator()

  const handleShiftTabChange = useCallback((tab: 'Day' | 'Night') => {
    setShiftTab(tab)
    const params = new URLSearchParams(searchParams.toString())
    params.set('shift', shiftTabToQueryValue(tab))
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [pathname, router, searchParams])

  const handleCellClick = useCallback((userId: string, date: string, cell: GridCell) => {
    // Find therapist name from dataset
    const row = initialDataset.therapistRows.find((r) => r.userId === userId)
    if (!row) return
    setActiveCellTarget({ userId, date, cell, therapistName: row.name })
  }, [initialDataset.therapistRows])

  const handleAssign = useCallback(async () => {
    if (!activeCellTarget) return
    const { userId, date } = activeCellTarget
    await mutator.assign({ cycleId, userId, date, shiftType: shiftTabToQueryValue(shiftTab), role: 'staff' })
    setActiveCellTarget(null)
    startTransition(() => router.refresh())
  }, [activeCellTarget, cycleId, mutator, router, shiftTab])

  const handleUnassign = useCallback(async () => {
    if (!activeCellTarget?.cell.shiftId) return
    await mutator.unassign({ cycleId, shiftId: activeCellTarget.cell.shiftId })
    setActiveCellTarget(null)
    startTransition(() => router.refresh())
  }, [activeCellTarget, cycleId, mutator, router])

  const handleStatusChange = useCallback(async (status: 'scheduled' | 'on_call' | 'cancelled' | 'call_in' | 'left_early') => {
    if (!activeCellTarget?.cell.shiftId) return
    await mutator.updateStatus(activeCellTarget.cell.shiftId, { status })
    setActiveCellTarget(null)
    startTransition(() => router.refresh())
  }, [activeCellTarget, mutator, router])

  const handleDesignateLead = useCallback(async () => {
    if (!activeCellTarget?.cell.shiftId) return
    await mutator.setDesignatedLead({ cycleId, shiftId: activeCellTarget.cell.shiftId, userId: activeCellTarget.userId, date: activeCellTarget.date, shiftType: shiftTabToQueryValue(shiftTab) })
    setActiveCellTarget(null)
    startTransition(() => router.refresh())
  }, [activeCellTarget, cycleId, mutator, router, shiftTab])

  const dataset = initialDataset  // In a future iteration this can be optimistically updated

  const isAssignTarget = activeCellTarget?.cell.status === 'off'
  const isStatusTarget = activeCellTarget && activeCellTarget.cell.status !== 'off'

  return (
    <div className="flex flex-col rounded-[18px] border border-border bg-card shadow-sm overflow-hidden">
      <ScheduleGridToolbar
        cycleDateRangeLabel={dataset.cycleDateRangeLabel}
        isPublished={dataset.isPublished}
        shiftTab={shiftTab}
        canManageCoverage={dataset.canManageCoverage}
        onShiftTabChange={handleShiftTabChange}
        onPrint={() => window.print()}
      />
      <ScheduleGridTable
        dataset={dataset}
        onCellClick={dataset.canManageCoverage || dataset.canUpdateAssignmentStatus ? handleCellClick : undefined}
      />
      {/* Assign popover */}
      {isAssignTarget && activeCellTarget && (
        <AssignCellPopover
          open
          onOpenChange={(open) => { if (!open) setActiveCellTarget(null) }}
          therapistName={activeCellTarget.therapistName}
          date={activeCellTarget.date}
          cell={activeCellTarget.cell}
          onAssign={handleAssign}
          isPending={isPending}
        >
          <span />
        </AssignCellPopover>
      )}
      {/* Status popover */}
      {isStatusTarget && activeCellTarget && (
        <StatusCellPopover
          open
          onOpenChange={(open) => { if (!open) setActiveCellTarget(null) }}
          therapistName={activeCellTarget.therapistName}
          date={activeCellTarget.date}
          cell={activeCellTarget.cell}
          canDesignateLead={dataset.canManageCoverage}
          isCurrentlyLead={activeCellTarget.cell.status === 'lead'}
          onStatusChange={handleStatusChange}
          onUnassign={handleUnassign}
          onDesignateLead={handleDesignateLead}
          isPending={isPending}
        >
          <span />
        </StatusCellPopover>
      )}
    </div>
  )
}
```

> **Note:** The popover trigger approach here uses a controlled `open` without an anchor element — this works for the initial implementation. For a polished UX, a follow-up can position the popover relative to the clicked cell using a ref passed through `onCellClick`.

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep "ScheduleGrid\b" | head -10
```

Fix any type errors — common issues: `mutator.assign` signature mismatch, missing `shiftType` parameter.

- [ ] **Step 3: Commit**

```bash
git add src/components/schedule-grid/ScheduleGrid.tsx
git commit -m "feat: add ScheduleGrid client component wiring toolbar, table, and cell popovers"
```

---

## Task 9: Wire the Server Page

**Files:**

- Modify: `src/app/(app)/schedule/page.tsx`

- [ ] **Step 1: Rewrite the server page**

```typescript
// src/app/(app)/schedule/page.tsx
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { loadScheduleGridData } from './schedule-grid-data'
import { ScheduleGrid } from '@/components/schedule-grid/ScheduleGrid'
import { ManagerWorkspaceHeader } from '@/components/manager/ManagerWorkspaceHeader'

export const metadata: Metadata = { title: 'Schedule' }
export const dynamic = 'force-dynamic'

export default async function SchedulePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await (searchParams ?? Promise.resolve({}))
  const result = await loadScheduleGridData(params)

  if ('error' in result) {
    if (result.error === 'unauthenticated') redirect('/login')
    if (result.error === 'forbidden') redirect('/dashboard/staff')
    // no_cycle: fall through to empty state below
  }

  if ('error' in result && result.error === 'no_cycle') {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 text-center">
        <p className="text-muted-foreground">No active schedule cycle. Create one from Coverage.</p>
      </div>
    )
  }

  const { dataset, initialShiftTab } = result as Exclude<typeof result, { error: string }>

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
      <ManagerWorkspaceHeader title="Schedule" />
      <ScheduleGrid
        initialDataset={{ ...dataset }}
        cycleId={dataset.cycleId}
      />
    </div>
  )
}
```

- [ ] **Step 2: Start dev server and verify**

```bash
npm run dev
```

Navigate to `http://localhost:3000/schedule`. Confirm:

- Grid renders with therapist rows and dates
- Day/Night shift toggle works (URL updates to `?shift=night`)
- Toolbar shows correct Draft/Published badge
- `/coverage` redirects to `/schedule`

- [ ] **Step 3: Run full test suite**

```bash
npm run test:unit 2>&1 | tail -20
```

Fix any failures from the nav config or schedule page changes.

- [ ] **Step 4: Commit**

```bash
git add src/app/(app)/schedule/page.tsx
git commit -m "feat: wire /schedule server page to new ScheduleGrid component"
```

---

## Task 10: Remove Old Code

> **Do this last** — only after Task 9 is working and tests pass.

- [ ] **Step 1: Verify nothing imports the old files**

```bash
npx knip 2>&1 | grep -E "CoverageClientPage|ScheduleRosterScreen|PaperScheduleGrid|CalendarGrid|ShiftEditorDialog|RosterScheduleView|live-schedule-dataset|schedule-roster-live-data" | head -20
```

If any non-test files import them, resolve those first.

- [ ] **Step 2: Delete old files**

```bash
rm src/app/(app)/coverage/CoverageClientPage.tsx
rm src/components/coverage/CalendarGrid.tsx
rm src/components/coverage/RosterScheduleView.tsx
rm src/components/coverage/ShiftEditorDialog.tsx
rm src/lib/coverage/shift-editor-dialog-layout.ts
rm src/components/schedule-roster/ScheduleRosterScreen.tsx
rm src/components/schedule-roster/PaperScheduleGrid.tsx
rm src/components/schedule-roster/live-schedule-dataset.ts
rm src/app/(app)/schedule/schedule-roster-live-data.ts
```

Also check and remove `src/components/schedule-roster/ScheduleCycleSelect.tsx` only if `knip` confirms nothing else uses it.

- [ ] **Step 3: Run tests and build**

```bash
npm run test:unit 2>&1 | tail -10
npm run build 2>&1 | grep -E "error|Error" | head -20
```

Fix any import errors (likely test files asserting old components).

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: remove old Coverage block board and ScheduleRosterScreen (replaced by ScheduleGrid)"
```

---

## Verification

After all tasks complete:

```bash
# Full quality gate
npm run lint
npm run typecheck
npm run test:unit
npm run build
```

**Manual smoke checks:**

1. Manager: navigate to `/schedule` — grid renders, Day/Night toggle works, cells are clickable
2. Manager: click an empty cell — AssignCellPopover appears; asterisk cells show warning
3. Manager: click an assigned cell — StatusCellPopover appears with status options
4. Manager: `?shift=night` in URL shows Night therapists
5. Therapist: navigate to `/schedule` — read-only, own row pinned at top with "You" label
6. Lead: can update status on published schedule, cannot assign new therapists
7. Navigate to `/coverage` — confirms redirect to `/schedule`
8. Navigate to `/therapist/schedule` — confirms redirect to `/schedule`
9. Manager top nav "Schedule" section shows: Schedule · Analytics · Availability · Lottery · Publish · Approvals (no "Roster View", no "Coverage")
10. Staff nav shows single "Schedule" tab
