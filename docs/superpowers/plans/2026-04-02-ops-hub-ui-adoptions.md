# Ops Hub UI Adoptions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adopt four high-value UI patterns from the ops-hub reference codebase into the production Next.js app.

**Architecture:** Four independent, self-contained changes: (1) keyboard navigation on the coverage calendar grid, (2) two-phase confirm+preview dialog for auto-draft, (3) a schedule-completion progress widget on the manager inbox, (4) staggered fade-up animations on the inbox metric cards.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind, shadcn/ui, framer-motion (already installed), Vitest.

---

## File Map

| Task                        | Files Changed                                                                                                                                                                                 |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — Keyboard nav            | `src/components/coverage/CalendarGrid.tsx` (modify)                                                                                                                                           |
| 2 — AutoDraft dialog        | `src/components/coverage/AutoDraftConfirmDialog.tsx` (create), `src/app/coverage/page.tsx` (modify)                                                                                           |
| 3 — ScheduleProgress widget | `src/components/manager/ScheduleProgress.tsx` (create), `src/components/manager/ManagerTriageDashboard.tsx` (modify props + layout), `src/app/dashboard/manager/page.tsx` (modify data fetch) |
| 4 — Staggered animations    | `src/components/manager/ManagerTriageDashboard.tsx` (modify)                                                                                                                                  |

---

## Task 1: Keyboard Navigation on CalendarGrid

**Files:**

- Modify: `src/components/coverage/CalendarGrid.tsx`
- Test: `src/components/coverage/CalendarGrid.test.ts` (create)

### Background

The current grid wraps each day in an `<article>` with an absolutely-positioned `<button>` inside it. Keyboard users can tab to each button but cannot navigate with arrow keys. The pattern from the reference: a `Map<string, HTMLElement>` ref keyed by day ID, a flat index per cell, and `ArrowRight/Left/Down/Up` handlers that call `.focus()` on the next cell.

The grid is 7 columns wide so `ArrowDown` = `index + 7`, `ArrowUp` = `index - 7`.

### Steps

- [ ] **Step 1: Write the failing test**

Create `src/components/coverage/CalendarGrid.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'

// Pure unit test for the keyboard navigation index arithmetic
// (no DOM needed — tests the math that maps arrow keys to cell indices)

function nextIndex(current: number, key: string, total: number): number {
  const cols = 7
  switch (key) {
    case 'ArrowRight':
      return Math.min(current + 1, total - 1)
    case 'ArrowLeft':
      return Math.max(current - 1, 0)
    case 'ArrowDown':
      return Math.min(current + cols, total - 1)
    case 'ArrowUp':
      return Math.max(current - cols, 0)
    default:
      return current
  }
}

describe('CalendarGrid keyboard navigation index', () => {
  it('moves right by 1', () => {
    expect(nextIndex(0, 'ArrowRight', 42)).toBe(1)
  })
  it('clamps at end of row', () => {
    expect(nextIndex(41, 'ArrowRight', 42)).toBe(41)
  })
  it('moves left by 1', () => {
    expect(nextIndex(5, 'ArrowLeft', 42)).toBe(4)
  })
  it('clamps at start', () => {
    expect(nextIndex(0, 'ArrowLeft', 42)).toBe(0)
  })
  it('moves down one row (7 cols)', () => {
    expect(nextIndex(2, 'ArrowDown', 42)).toBe(9)
  })
  it('clamps ArrowDown at last cell', () => {
    expect(nextIndex(39, 'ArrowDown', 42)).toBe(41) // 39+7=46 clamped to 41
  })
  it('moves up one row', () => {
    expect(nextIndex(9, 'ArrowUp', 42)).toBe(2)
  })
  it('clamps ArrowUp at row 0', () => {
    expect(nextIndex(3, 'ArrowUp', 42)).toBe(0) // 3-7=-4 clamped to 0
  })
})
```

- [ ] **Step 2: Run test to confirm it fails (function not yet in component)**

```bash
npx vitest run src/components/coverage/CalendarGrid.test.ts
```

Expected: FAIL — `nextIndex` is not exported yet.

- [ ] **Step 3: Add the `nextIndex` helper and keyboard wiring to `CalendarGrid.tsx`**

At the top of `CalendarGrid.tsx`, add a new React import (the file currently has no React import — do not look for an existing one to modify):

```typescript
import { useCallback, useMemo, useRef } from 'react'
```

Export the helper so the test can import it (add after the `DOW` constant):

```typescript
export function nextIndex(current: number, key: string, total: number): number {
  const cols = 7
  switch (key) {
    case 'ArrowRight':
      return Math.min(current + 1, total - 1)
    case 'ArrowLeft':
      return Math.max(current - 1, 0)
    case 'ArrowDown':
      return Math.min(current + cols, total - 1)
    case 'ArrowUp':
      return Math.max(current - cols, 0)
    default:
      return current
  }
}
```

Inside the `CalendarGrid` function body, add refs, focus helper, and flat ID list:

```typescript
const cellRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

const focusCell = useCallback((id: string) => {
  cellRefs.current.get(id)?.focus()
}, [])

const flatDayIds = useMemo(() => days.map((d) => d.id), [days])
```

On each day's inner `<button>`, add:

- `ref` callback to register/unregister in the map
- `tabIndex`: `0` for first cell, `-1` for the rest (roving tabindex)
- `onKeyDown` handler

Replace the existing inner `<button>` opening tag inside the `.map()`:

```tsx
<button
  type="button"
  ref={(el) => {
    if (el) cellRefs.current.set(day.id, el)
    else cellRefs.current.delete(day.id)
  }}
  tabIndex={absoluteIndex === 0 ? 0 : -1}
  data-testid={`coverage-day-cell-button-${day.id}`}
  aria-label={`${schedulingViewOnly ? 'View' : 'Edit'} ${day.label}`}
  className="absolute inset-0 rounded-[20px]"
  onClick={() => onSelect(day.id)}
  onKeyDown={(e) => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(e.key)) return
    e.preventDefault()
    const next = nextIndex(absoluteIndex, e.key, flatDayIds.length)
    focusCell(flatDayIds[next])
  }}
/>
```

Also add `role="grid"` to the outermost `<div>` and `role="row"` to each week's `.grid` div. Add `role="gridcell"` to each `<article>`. This makes the grid keyboard-accessible per ARIA spec.

The outermost div: change `<div className="overflow-x-auto pb-2">` to:

```tsx
<div role="grid" aria-label="Coverage calendar" className="overflow-x-auto pb-2">
```

Each week's grid div: change `<div className="grid grid-cols-7 gap-2.5">` to:

```tsx
<div role="row" className="grid grid-cols-7 gap-2.5">
```

Each `<article>`: add `role="gridcell"` to the existing props.

- [ ] **Step 4: Update the test to import from the component**

Update the test file to remove the inline `nextIndex` definition and import it instead:

```typescript
import { describe, expect, it } from 'vitest'
import { nextIndex } from './CalendarGrid'
```

Remove the local `function nextIndex` definition from the test.

- [ ] **Step 5: Run tests**

```bash
npx vitest run src/components/coverage/CalendarGrid.test.ts
```

Expected: 8 PASS

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/components/coverage/CalendarGrid.tsx src/components/coverage/CalendarGrid.test.ts
git commit -m "feat: add arrow-key navigation to coverage calendar grid"
```

---

## Task 2: AutoDraft Confirm Dialog

**Files:**

- Create: `src/components/coverage/AutoDraftConfirmDialog.tsx`
- Modify: `src/app/coverage/page.tsx`
- Test: `src/components/coverage/AutoDraftConfirmDialog.test.ts` (create)

### Background

Currently auto-draft is a plain HTML form whose `action` is a Next.js server action. There is no confirmation step — clicking "Auto-draft" immediately runs the algorithm, wipes existing assignments, and redirects back. This is a common source of accidental re-drafts.

The scheduling algorithm is a monolithic inline block inside `generateDraftScheduleAction` in `src/app/schedule/actions.ts` (~600 lines). Extracting it for a dry-run preview would be a significant refactor and is out of scope here.

The goal for this task: add a **single-phase confirm dialog** that replaces the bare form button. The dialog explains what auto-draft does and requires explicit confirmation before submitting. The "Apply Draft" button programmatically submits the hidden real form. The existing feedback banner (query-param driven, already implemented) still shows the results after the page reloads.

### Steps

- [ ] **Step 1: Write the failing test**

Create `src/components/coverage/AutoDraftConfirmDialog.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'

// Pure unit test for the open/close state logic
// The dialog has one meaningful behavior to test: closing resets
// to a stable initial state (open=false guard logic).

export function shouldAllowSubmit(cycleId: string, isPublished: boolean): boolean {
  return cycleId.length > 0 && !isPublished
}

describe('AutoDraftConfirmDialog guard logic', () => {
  it('allows submit when cycleId present and not published', () => {
    expect(shouldAllowSubmit('cycle-abc', false)).toBe(true)
  })
  it('blocks submit when no cycleId', () => {
    expect(shouldAllowSubmit('', false)).toBe(false)
  })
  it('blocks submit when cycle is published', () => {
    expect(shouldAllowSubmit('cycle-abc', true)).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npx vitest run src/components/coverage/AutoDraftConfirmDialog.test.ts
```

Expected: FAIL — `shouldAllowSubmit` not exported.

- [ ] **Step 3: Create `AutoDraftConfirmDialog.tsx`**

Create `src/components/coverage/AutoDraftConfirmDialog.tsx`:

```typescript
'use client'

import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// Export for unit testing
export function shouldAllowSubmit(cycleId: string, isPublished: boolean): boolean {
  return cycleId.length > 0 && !isPublished
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Ref to the hidden auto-draft form — dialog submits it on Apply */
  applyFormRef: React.RefObject<HTMLFormElement>
}

export function AutoDraftConfirmDialog({ open, onOpenChange, applyFormRef }: Props) {
  function handleApply() {
    applyFormRef.current?.requestSubmit()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Auto-Draft Schedule
          </DialogTitle>
          <DialogDescription>
            Generate a draft that respects therapist availability, patterns, and scheduling rules.
            This replaces all current unfinalized assignments.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1.5">
          <p className="font-medium text-foreground text-sm">How it works</p>
          <p>• Hard <strong>force-off</strong> and FMLA blocks are never violated</p>
          <p>• Manager and therapist <strong>force-on</strong> dates are prioritized</p>
          <p>• Shifts are distributed to meet coverage targets (3–5 per slot)</p>
          <p>• PRN therapists are only scheduled on explicit force-on dates</p>
          <p>• Any forced-date misses are reported back after drafting</p>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleApply} className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Apply Draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Update the test to import from the component**

Update `src/components/coverage/AutoDraftConfirmDialog.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { shouldAllowSubmit } from './AutoDraftConfirmDialog'
```

Remove the local `shouldAllowSubmit` definition from the test file.

- [ ] **Step 5: Run the dialog tests**

```bash
npx vitest run src/components/coverage/AutoDraftConfirmDialog.test.ts
```

Expected: 3 PASS

- [ ] **Step 6: Wire the dialog into `src/app/coverage/page.tsx`**

a) Import the dialog:

```typescript
import { AutoDraftConfirmDialog } from '@/components/coverage/AutoDraftConfirmDialog'
```

b) Add state and ref near the other dialog state:

```typescript
const [autoDraftDialogOpen, setAutoDraftDialogOpen] = useState(false)
const autoDraftFormRef = useRef<HTMLFormElement>(null)
```

c) Find the existing auto-draft `<form>` (around line 820). Add `ref={autoDraftFormRef}` to it, hide it visually, and remove its submit button (the dialog will trigger submission):

```tsx
<form
  ref={autoDraftFormRef}
  action={generateDraftScheduleAction}
  className="hidden"
  aria-hidden="true"
>
  <input type="hidden" name="cycle_id" value={activeCycleId ?? ''} />
  <input type="hidden" name="view" value="week" />
  <input type="hidden" name="show_unavailable" value="false" />
  <input type="hidden" name="return_to" value="coverage" />
</form>
```

d) Add a standalone trigger button where the old form's submit button was:

```tsx
<Button
  type="button"
  variant="outline"
  size="sm"
  className="gap-1.5 text-xs"
  disabled={!activeCycleId || activeCyclePublished}
  onClick={() => setAutoDraftDialogOpen(true)}
>
  <Sparkles className="h-3.5 w-3.5" />
  Auto-draft
</Button>
```

e) Add the dialog near the other dialogs in the JSX:

```tsx
<AutoDraftConfirmDialog
  open={autoDraftDialogOpen}
  onOpenChange={setAutoDraftDialogOpen}
  applyFormRef={autoDraftFormRef}
/>
```

- [ ] **Step 7: Type-check and full test run**

```bash
npx tsc --noEmit
npm run test:unit
```

Expected: no type errors, all existing tests pass + 3 new dialog tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/components/coverage/AutoDraftConfirmDialog.tsx \
        src/components/coverage/AutoDraftConfirmDialog.test.ts \
        src/app/coverage/page.tsx
git commit -m "feat: confirm dialog before auto-draft to prevent accidental re-drafts"
```

---

## Task 3: ScheduleProgress Widget on Manager Inbox

**Files:**

- Create: `src/components/manager/ScheduleProgress.tsx`
- Modify: `src/components/manager/ManagerTriageDashboard.tsx`
- Modify: `src/app/dashboard/manager/page.tsx`
- Test: `src/components/manager/ScheduleProgress.test.ts` (create)

### Background

The manager inbox currently shows metric cards but no progress view of schedule completion. The ops-hub reference has a clean widget with animated progress bars per shift type. We'll add it to the bottom of the inbox below the existing `xl:grid-cols-[2fr_1fr]` grid.

The widget takes real props derived from the active cycle's shifts. The manager dashboard page already queries shifts; we'll add day/night filled/total counts to the existing query.

### Steps

- [ ] **Step 1: Write the failing test**

Create `src/components/manager/ScheduleProgress.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'

// Pure logic: compute percentage and gap count from filled/total
function computeProgress(filled: number, total: number) {
  if (total === 0) return { pct: 0, gaps: 0 }
  return {
    pct: Math.round((filled / total) * 100),
    gaps: Math.max(total - filled, 0),
  }
}

describe('ScheduleProgress computations', () => {
  it('returns 0% with no shifts', () => {
    expect(computeProgress(0, 0).pct).toBe(0)
  })
  it('returns 100% when fully filled', () => {
    expect(computeProgress(21, 21).pct).toBe(100)
  })
  it('rounds correctly', () => {
    expect(computeProgress(18, 21).pct).toBe(86)
  })
  it('counts gaps correctly', () => {
    expect(computeProgress(15, 21).gaps).toBe(6)
  })
  it('never returns negative gaps', () => {
    expect(computeProgress(22, 21).gaps).toBe(0)
  })
})
```

- [ ] **Step 2: Run to confirm fail**

```bash
npx vitest run src/components/manager/ScheduleProgress.test.ts
```

Expected: FAIL — `computeProgress` not exported.

- [ ] **Step 3: Install the shadcn Progress primitive**

`@/components/ui/progress` does not yet exist in this codebase. Install it:

```bash
npx shadcn@latest add progress
```

This adds `src/components/ui/progress.tsx`. Verify it was created before continuing.

- [ ] **Step 4: Create `ScheduleProgress.tsx`**

Create `src/components/manager/ScheduleProgress.tsx`:

```typescript
'use client'

import { motion } from 'framer-motion'
import { Progress } from '@/components/ui/progress'

// Export for unit testing
export function computeProgress(filled: number, total: number) {
  if (total === 0) return { pct: 0, gaps: 0 }
  return {
    pct: Math.round((filled / total) * 100),
    gaps: Math.max(total - filled, 0),
  }
}

type Props = {
  dayFilled: number
  dayTotal: number
  nightFilled: number
  nightTotal: number
}

export function ScheduleProgress({ dayFilled, dayTotal, nightFilled, nightTotal }: Props) {
  const day = computeProgress(dayFilled, dayTotal)
  const night = computeProgress(nightFilled, nightTotal)
  const overallFilled = dayFilled + nightFilled
  const overallTotal = dayTotal + nightTotal
  const overall = computeProgress(overallFilled, overallTotal)

  const rows = [
    { label: 'Day Shifts', ...day, filled: dayFilled, total: dayTotal },
    { label: 'Night Shifts', ...night, filled: nightFilled, total: nightTotal },
  ]

  return (
    <div className="rounded-2xl border border-border/70 bg-card shadow-[0_1px_8px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/70">
        <h3 className="text-sm font-medium text-foreground">Schedule Completion</h3>
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Active cycle
        </span>
      </div>

      <div className="px-5 py-4 space-y-5">
        {rows.map((row, i) => (
          <motion.div
            key={row.label}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08, duration: 0.3 }}
          >
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-sm font-medium text-foreground">{row.label}</span>
              <span className="text-xs font-medium text-muted-foreground tabular-nums">
                {row.filled}/{row.total}
              </span>
            </div>
            <Progress value={row.pct} className="h-1.5" />
            <div className="mt-1 flex justify-between">
              <span className="text-[11px] text-muted-foreground">{row.pct}%</span>
              <span className="text-[11px] text-muted-foreground">{row.gaps} remaining</span>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="px-5 py-4 border-t border-border/70">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Overall</p>
            <p className="text-[11px] text-muted-foreground">All shifts</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold tabular-nums text-foreground">{overall.pct}%</p>
            {overall.gaps > 0 && (
              <p className="text-[11px] text-muted-foreground">{overall.gaps} gaps</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

> **Note:** Do NOT use `ease: 'easeOut'` in framer-motion — the `Easing` type rejects string literals; omit `ease` entirely to use framer-motion's default.

- [ ] **Step 5: Update the test to import from the component**

Update `src/components/manager/ScheduleProgress.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { computeProgress } from './ScheduleProgress'
```

Remove the local `computeProgress` definition.

- [ ] **Step 6: Run the test**

```bash
npx vitest run src/components/manager/ScheduleProgress.test.ts
```

Expected: 5 PASS

- [ ] **Step 7: Update existing tests in `ManagerTriageDashboard.test.ts`**

The three existing test cases in `src/components/manager/ManagerTriageDashboard.test.ts` pass a fixed prop set. Adding the four new required props will break them. Update all three `createElement(ManagerTriageDashboard, { ... })` calls to include the new props:

- Loaded test (first): `dayShiftsFilled: 18, dayShiftsTotal: 21, nightShiftsFilled: 15, nightShiftsTotal: 21`
- Loading test (second): `dayShiftsFilled: '--', dayShiftsTotal: '--', nightShiftsFilled: '--', nightShiftsTotal: '--'`
- Empty metrics test (third): `dayShiftsFilled: 0, dayShiftsTotal: 0, nightShiftsFilled: 0, nightShiftsTotal: 0`

Run after editing to confirm all three still pass:

```bash
npx vitest run src/components/manager/ManagerTriageDashboard.test.ts
```

Expected: 3 PASS (same assertions, just with new props added).

- [ ] **Step 8: Add props to `ManagerTriageDashboard` and wire the widget**

In `src/components/manager/ManagerTriageDashboard.tsx`:

a) Add four new props to `ManagerTriageDashboardProps`:

```typescript
dayShiftsFilled: number | '--'
dayShiftsTotal: number | '--'
nightShiftsFilled: number | '--'
nightShiftsTotal: number | '--'
```

b) Add them to the function signature.

c) Import `ScheduleProgress`:

```typescript
import { ScheduleProgress } from '@/components/manager/ScheduleProgress'
```

d) After the closing `</Card>` of the `Recent Activity` card at the bottom, add:

```tsx
{
  dayShiftsFilled !== '--' &&
    dayShiftsTotal !== '--' &&
    nightShiftsFilled !== '--' &&
    nightShiftsTotal !== '--' && (
      <ScheduleProgress
        dayFilled={dayShiftsFilled}
        dayTotal={dayShiftsTotal}
        nightFilled={nightShiftsFilled}
        nightTotal={nightShiftsTotal}
      />
    )
}
```

- [ ] **Step 9: Fetch shift completion data in the manager dashboard page**

In `src/app/dashboard/manager/page.tsx`:

a) Add to the `DashboardData` type:

```typescript
dayShiftsFilled: number
dayShiftsTotal: number
nightShiftsFilled: number
nightShiftsTotal: number
```

b) Add to `INITIAL_DATA`:

```typescript
dayShiftsFilled: 0, dayShiftsTotal: 0,
nightShiftsFilled: 0, nightShiftsTotal: 0,
```

c) In the data-fetch effect where the active cycle is available, add a query for shift counts:

```typescript
const { data: shiftCountData } = await supabase
  .from('shifts')
  .select('shift_type, user_id')
  .eq('cycle_id', activeCycle.id)
  .in('shift_type', ['day', 'night'])

const shiftRows = (shiftCountData ?? []) as Array<{
  shift_type: 'day' | 'night'
  user_id: string | null
}>
const dayRows = shiftRows.filter((r) => r.shift_type === 'day')
const nightRows = shiftRows.filter((r) => r.shift_type === 'night')

setData((prev) => ({
  ...prev,
  dayShiftsFilled: dayRows.filter((r) => r.user_id !== null).length,
  dayShiftsTotal: dayRows.length,
  nightShiftsFilled: nightRows.filter((r) => r.user_id !== null).length,
  nightShiftsTotal: nightRows.length,
}))
```

d) Pass the new props through to `<ManagerTriageDashboard>`:

```tsx
dayShiftsFilled={data.dayShiftsFilled}
dayShiftsTotal={data.dayShiftsTotal}
nightShiftsFilled={data.nightShiftsFilled}
nightShiftsTotal={data.nightShiftsTotal}
```

- [ ] **Step 10: Type-check and full test run**

```bash
npx tsc --noEmit
npm run test:unit
```

Expected: no errors, all tests pass including 5 new ScheduleProgress tests.

- [ ] **Step 11: Commit**

```bash
git add src/components/ui/progress.tsx \
        src/components/manager/ScheduleProgress.tsx \
        src/components/manager/ScheduleProgress.test.ts \
        src/components/manager/ManagerTriageDashboard.tsx \
        src/app/dashboard/manager/page.tsx
git commit -m "feat: add schedule completion progress widget to manager inbox"
```

---

## Task 4: Staggered Fade-Up Animations on Inbox Metric Cards

**Files:**

- Modify: `src/components/manager/ManagerTriageDashboard.tsx`

### Background

framer-motion is already installed. The inbox metric cards (Coverage Issues, Pending Approvals, Upcoming Shifts, Publish Readiness) currently render instantly. The reference uses a `fadeUp` variant with staggered `custom * 0.06s` delays. This is a small change with meaningful perceived-polish impact.

> **IMPORTANT (from CLAUDE.md):** Do NOT use `ease: 'easeOut'` — the framer-motion `Easing` type rejects string literals. Omit `ease` entirely.

### Steps

- [ ] **Step 1: Add the animation variant and wrap the metric cards**

In `src/components/manager/ManagerTriageDashboard.tsx`:

a) Add import at top:

```typescript
import { motion } from 'framer-motion'
```

b) Add the variant object near the top of the component (before the `return`):

```typescript
const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.3 },
    // NOTE: no 'ease' prop — framer-motion's Easing type rejects string literals
  }),
}
```

c) Find the metric cards grid (`<div className="grid gap-3 lg:grid-cols-4">`). Wrap each `<MetricCard .../>` in a `motion.div`:

```tsx
<div className="grid gap-3 lg:grid-cols-4">
  {[
    { title: 'Coverage Issues', ... },
    { title: 'Pending Approvals', ... },
    { title: 'Upcoming Shifts', ... },
    { title: 'Publish Readiness', ... },
  ].map((cardProps, i) => (
    <motion.div key={cardProps.title} custom={i} variants={fadeUp} initial="hidden" animate="show">
      <MetricCard {...cardProps} />
    </motion.div>
  ))}
</div>
```

Since the four MetricCard calls are currently written out individually (not as a map), convert them to a data-driven map. Extract each card's props into an array:

```typescript
const metricCards = [
  {
    title: 'Coverage Issues',
    value: riskCount === '--' ? '--' : String(riskCount),
    detail: riskCountLabel,
    href: scheduleHref,
    icon: <Shield className="h-4 w-4 text-[var(--error-text)]" />,
    emptyPrompt: 'No coverage gaps - review the schedule to confirm.',
  },
  {
    title: 'Pending Approvals',
    value: pendingRequests === '--' ? '--' : String(pendingRequests),
    detail: pendingRequestLabel,
    href: approvalsHref,
    icon: <FileCheck className="h-4 w-4 text-[var(--warning-text)]" />,
    emptyPrompt: 'Send a preliminary schedule to collect staff claims.',
  },
  {
    title: 'Upcoming Shifts',
    value: upcomingShiftCount === '--' ? '--' : String(upcomingShiftCount),
    detail: teamLoadLabel,
    href: scheduleHref,
    icon: <Users className="h-4 w-4 text-primary" />,
    emptyPrompt: 'Auto-draft or manually assign shifts for this cycle.',
  },
  {
    title: 'Publish Readiness',
    value: coveragePercent === null ? '--' : `${coveragePercent}%`,
    detail: coveragePercent === null ? LOADING_LABEL : `${coveragePercent}% ready`,
    href: reviewHref,
    icon: <CheckCircle2 className="h-4 w-4 text-[var(--warning-text)]" />,
    emptyPrompt: 'Assign shifts and leads before publishing.',
  },
]
```

Then render:

```tsx
<div className="grid gap-3 lg:grid-cols-4">
  {metricCards.map((card, i) => (
    <motion.div key={card.title} custom={i} variants={fadeUp} initial="hidden" animate="show">
      <MetricCard {...card} />
    </motion.div>
  ))}
</div>
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors. If `motion` import causes issues, ensure `framer-motion` is in `package.json` (`"framer-motion": "^12.36.0"` — already confirmed present).

- [ ] **Step 3: Run all tests**

```bash
npm run test:unit
```

Expected: all tests pass (no new tests needed — animations are not unit-testable).

- [ ] **Step 4: Commit**

```bash
git add src/components/manager/ManagerTriageDashboard.tsx
git commit -m "feat: staggered fade-up animations on inbox metric cards"
```

---

## Final Verification

- [ ] **Full CI gate**

```bash
npm run lint
npx tsc --noEmit
npm run test:unit
npm run build
```

Expected: all green. Resolve any lint or type errors before declaring done.

- [ ] **Final commit if needed**

If the CI gate required any fixes, commit them:

```bash
git add -p
git commit -m "fix: address lint and type issues from ops-hub UI adoptions"
```
