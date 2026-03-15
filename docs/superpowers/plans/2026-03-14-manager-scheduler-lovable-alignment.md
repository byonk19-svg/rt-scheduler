# Manager Scheduler Lovable Alignment Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the manager `/coverage` experience to use the Lovable modal-plus-popover interaction model while preserving Teamwise scheduling rules, optimistic mutations, and publish behavior.

**Architecture:** Keep [`src/app/coverage/page.tsx`](C:\Users\byonk\OneDrive\Desktop\rt-scheduler\src\app\coverage\page.tsx) as the stateful data owner, but replace the current drawer-driven UI with a Lovable-style calendar grid, a centered shift editor dialog, and an inline assignment status popover. Preserve the current Teamwise selectors and mutation helpers, and isolate new presentation/state-mapping logic into small focused files so UI simplification does not leak into rule enforcement.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, Radix dialog/popover wrappers, Vitest, Playwright

---

## File Structure

### Files to Create

- `src/lib/coverage/status-ui.ts`
  - Single source of truth for coverage UI status labels, popover options, badge/pill metadata, and the mapping needed to keep `call_in` distinct in the new Lovable popover.
- `src/lib/coverage/status-ui.test.ts`
  - Node-safe unit tests for status metadata and status-to-persisted-payload mapping.
- `src/components/coverage/AssignmentStatusPopover.tsx`
  - Lovable-style anchored popover for therapist status changes, including lead badge and optional lead-replacement affordance.
- `src/components/coverage/ShiftEditorDialog.tsx`
  - Lovable-style centered day editor modal for lead/staff assignment toggles.

### Files to Modify

- `src/app/coverage/page.tsx`
  - Replace drawer state with dialog/popover state, wire new components, preserve existing load/mutation/publish flows, and align the top shell with the Lovable page.
- `src/components/coverage/CalendarGrid.tsx`
  - Convert the grid into the primary interaction surface with nested click targets, Lovable card structure, inline status pills, and test IDs for dialog/popover flows.
- `src/lib/coverage/selectors.ts`
  - Stop collapsing `call_in` into generic `cancelled` at the UI layer; expose enough status fidelity for the Lovable popover and cell pills.
- `src/lib/coverage/selectors.test.ts`
  - Update selector expectations for the new `call_in` handling and any changed day-cell summary behavior.
- `src/lib/coverage/updateAssignmentStatus.ts`
  - Extend optimistic status updates so the UI can persist `call_in` distinctly instead of forcing it through the `cancelled` branch.
- `src/lib/coverage/updateAssignmentStatus.test.ts`
  - Cover the new status mapping to `assignment_status` and `status`.
- `e2e/coverage-overlay.spec.ts`
  - Rewrite drawer-centric tests to target the new day dialog and inline popovers.

### Files to Remove or Retire

- `src/components/coverage/ShiftDrawer.tsx`
  - Remove from the active render path once the dialog and popover fully replace it. Delete only after all references and tests are migrated.

## Chunk 1: Status Model And Interaction Contracts

### Task 1: Add a dedicated coverage status UI helper

**Files:**
- Create: `src/lib/coverage/status-ui.ts`
- Test: `src/lib/coverage/status-ui.test.ts`

- [ ] **Step 1: Write the failing unit tests for status metadata and payload mapping**

```ts
import { describe, expect, it } from 'vitest'

import {
  COVERAGE_STATUS_OPTIONS,
  getCoverageStatusLabel,
  toCoverageAssignmentPayload,
} from '@/lib/coverage/status-ui'

describe('coverage status ui', () => {
  it('includes a Call In option separate from Cancelled', () => {
    expect(COVERAGE_STATUS_OPTIONS.map((option) => option.value)).toContain('call_in')
    expect(getCoverageStatusLabel('call_in')).toBe('Call In')
  })

  it('maps call_in to assignment_status call_in and called_off shift status', () => {
    expect(toCoverageAssignmentPayload('call_in')).toEqual({
      assignment_status: 'call_in',
      status: 'called_off',
    })
  })
})
```

- [ ] **Step 2: Run the new unit test file and verify it fails**

Run: `npm.cmd run test:unit -- src/lib/coverage/status-ui.test.ts`
Expected: FAIL because `src/lib/coverage/status-ui.ts` does not exist yet.

- [ ] **Step 3: Implement the helper with explicit status metadata**

```ts
import type { AssignmentStatus, ShiftStatus } from '@/lib/shift-types'

export type CoverageUiStatus = 'active' | 'oncall' | 'leave_early' | 'cancelled' | 'call_in'

export const COVERAGE_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'leave_early', label: 'Leave Early' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'call_in', label: 'Call In' },
  { value: 'oncall', label: 'On Call' },
] as const

export function toCoverageAssignmentPayload(value: CoverageUiStatus): {
  assignment_status: AssignmentStatus
  status: ShiftStatus
} {
  // explicit mapping only; no implicit fallthrough
}
```

- [ ] **Step 4: Re-run the unit test file and verify it passes**

Run: `npm.cmd run test:unit -- src/lib/coverage/status-ui.test.ts`
Expected: PASS

- [ ] **Step 5: Commit the helper**

```bash
git add src/lib/coverage/status-ui.ts src/lib/coverage/status-ui.test.ts
git commit -m "feat: add coverage status ui helpers"
```

### Task 2: Move selectors and optimistic status updates onto the new status helper

**Files:**
- Modify: `src/lib/coverage/selectors.ts`
- Modify: `src/lib/coverage/selectors.test.ts`
- Modify: `src/lib/coverage/updateAssignmentStatus.ts`
- Modify: `src/lib/coverage/updateAssignmentStatus.test.ts`
- Create: `src/lib/coverage/status-ui.ts`

- [ ] **Step 1: Add failing tests for `call_in` fidelity in selectors and optimistic updates**

```ts
it('maps assignment_status call_in to ui status call_in', () => {
  expect(toUiStatus('call_in', 'scheduled')).toBe('call_in')
})

it('persists call_in as call_in plus called_off', async () => {
  const ok = await updateCoverageAssignmentStatus({
    shiftId: 'shift-1',
    nextStatus: 'call_in',
    // existing test harness stubs...
  })
  expect(ok).toBe(true)
  expect(persistAssignmentStatus).toHaveBeenCalledWith('shift-1', {
    assignment_status: 'call_in',
    status: 'called_off',
  })
})
```

- [ ] **Step 2: Run the targeted unit tests and verify they fail**

Run: `npm.cmd run test:unit -- src/lib/coverage/selectors.test.ts src/lib/coverage/updateAssignmentStatus.test.ts`
Expected: FAIL because `call_in` is currently collapsed into `cancelled`.

- [ ] **Step 3: Update the selector and optimistic update pipeline to use the shared helper**

```ts
import {
  type CoverageUiStatus,
  toCoverageAssignmentPayload,
  toCoverageUiStatus,
} from '@/lib/coverage/status-ui'

export function toUiStatus(assignment: AssignmentStatus | null, status: ShiftStatus): UiStatus {
  return toCoverageUiStatus(assignment, status)
}

const payload = toCoverageAssignmentPayload(nextStatus)
```

- [ ] **Step 4: Re-run the targeted unit tests and verify they pass**

Run: `npm.cmd run test:unit -- src/lib/coverage/selectors.test.ts src/lib/coverage/updateAssignmentStatus.test.ts`
Expected: PASS

- [ ] **Step 5: Commit the status-pipeline change**

```bash
git add src/lib/coverage/selectors.ts src/lib/coverage/selectors.test.ts src/lib/coverage/updateAssignmentStatus.ts src/lib/coverage/updateAssignmentStatus.test.ts src/lib/coverage/status-ui.ts
git commit -m "feat: preserve call-in status in coverage ui"
```

## Chunk 2: Replace The Drawer With Lovable Editor Components

### Task 3: Build the Lovable-style shift editor dialog

**Files:**
- Create: `src/components/coverage/ShiftEditorDialog.tsx`
- Modify: `src/app/coverage/page.tsx`
- Test: `e2e/coverage-overlay.spec.ts`

- [ ] **Step 1: Add a failing E2E assertion for day-click opening a dialog instead of the drawer**

```ts
test('clicking a day cell opens the shift editor dialog', async ({ page }) => {
  await openCoveragePage(page, ctx!)
  await getCoverageDayCell(page, ctx!.targetDate).click()

  await expect(page.getByRole('dialog', { name: /Day Shift|Night Shift/ })).toBeVisible()
  await expect(page.getByTestId('coverage-drawer-close')).toHaveCount(0)
})
```

- [ ] **Step 2: Run the single E2E test and verify it fails**

Run: `npm.cmd run test:e2e -- e2e/coverage-overlay.spec.ts --grep "opens the shift editor dialog"`
Expected: FAIL because the page still renders the drawer.

- [ ] **Step 3: Implement `ShiftEditorDialog` with the Lovable layout and existing assign/unassign callbacks**

```tsx
export function ShiftEditorDialog({
  open,
  selectedDay,
  therapists,
  weeklyTherapistCounts,
  assignError,
  onOpenChange,
  onAssignTherapist,
  onUnassign,
}: ShiftEditorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{selectedDay.label} · {selectedDay.shiftType} Shift</DialogTitle>
        </DialogHeader>
        {/* lead section */}
        {/* staff section */}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Re-run the single E2E test and verify it passes**

Run: `npm.cmd run test:e2e -- e2e/coverage-overlay.spec.ts --grep "opens the shift editor dialog"`
Expected: PASS

- [ ] **Step 5: Commit the dialog migration**

```bash
git add src/components/coverage/ShiftEditorDialog.tsx src/app/coverage/page.tsx e2e/coverage-overlay.spec.ts
git commit -m "feat: replace coverage drawer with shift editor dialog"
```

### Task 4: Build the Lovable-style inline assignment status popover

**Files:**
- Create: `src/components/coverage/AssignmentStatusPopover.tsx`
- Modify: `src/components/coverage/CalendarGrid.tsx`
- Modify: `src/app/coverage/page.tsx`
- Test: `e2e/coverage-overlay.spec.ts`

- [ ] **Step 1: Add a failing E2E test for clicking an assigned therapist opening a popover without opening the dialog**

```ts
test('clicking an assigned therapist opens the status popover only', async ({ page }) => {
  await openCoveragePage(page, ctx!)
  await page.getByTestId(`coverage-assignment-trigger-${ctx!.targetDate}-${ctx!.therapist1.id}`).click()

  await expect(page.getByTestId('coverage-status-popover')).toBeVisible()
  await expect(page.getByRole('dialog', { name: /Day Shift|Night Shift/ })).toHaveCount(0)
})
```

- [ ] **Step 2: Run the single E2E test and verify it fails**

Run: `npm.cmd run test:e2e -- e2e/coverage-overlay.spec.ts --grep "status popover only"`
Expected: FAIL because the current UI opens the drawer or has no popover trigger.

- [ ] **Step 3: Implement the popover component and nested trigger handling in the grid**

```tsx
<button
  type="button"
  data-testid={`coverage-assignment-trigger-${day.id}-${shift.userId}`}
  onClick={(event) => {
    event.stopPropagation()
    onOpenStatusPopover(day.id, shift.id, shift.userId, shift.isLead)
  }}
>
  {shift.name}
</button>
```

- [ ] **Step 4: Re-run the single E2E test and verify it passes**

Run: `npm.cmd run test:e2e -- e2e/coverage-overlay.spec.ts --grep "status popover only"`
Expected: PASS

- [ ] **Step 5: Commit the popover work**

```bash
git add src/components/coverage/AssignmentStatusPopover.tsx src/components/coverage/CalendarGrid.tsx src/app/coverage/page.tsx e2e/coverage-overlay.spec.ts
git commit -m "feat: add inline coverage status popovers"
```

## Chunk 3: Align The Page Shell And Remove Drawer Leftovers

### Task 5: Reshape the top shell and calendar cards to Lovable fidelity

**Files:**
- Modify: `src/app/coverage/page.tsx`
- Modify: `src/components/coverage/CalendarGrid.tsx`
- Test: `e2e/coverage-overlay.spec.ts`

- [ ] **Step 1: Add or update E2E assertions for Lovable shell controls**

```ts
test('coverage shell shows Lovable action layout and issue chip', async ({ page }) => {
  await openCoveragePage(page, ctx!)
  await expect(page.getByRole('button', { name: 'Print' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Auto-draft/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /Publish|Published/ })).toBeVisible()
  await expect(page.getByText(/issue|issues/)).toBeVisible()
})
```

- [ ] **Step 2: Run the targeted E2E assertions and verify any missing shell expectations fail**

Run: `npm.cmd run test:e2e -- e2e/coverage-overlay.spec.ts --grep "Lovable action layout"`
Expected: FAIL if the shell still reflects the older Teamwise layout.

- [ ] **Step 3: Update the top bar and day cards to match the approved Lovable shell**

```tsx
<div className="flex items-start justify-between gap-4">
  <div>
    <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">Coverage</h1>
    <p className="text-sm text-muted-foreground">{cycleSummaryLabel}</p>
  </div>
  <div className="flex items-center gap-3">{/* print / auto-draft / publish */}</div>
</div>
```

- [ ] **Step 4: Re-run the targeted E2E assertions and verify they pass**

Run: `npm.cmd run test:e2e -- e2e/coverage-overlay.spec.ts --grep "Lovable action layout"`
Expected: PASS

- [ ] **Step 5: Commit the shell alignment**

```bash
git add src/app/coverage/page.tsx src/components/coverage/CalendarGrid.tsx e2e/coverage-overlay.spec.ts
git commit -m "feat: align coverage shell with lovable scheduler"
```

### Task 6: Remove the drawer render path and finish regression coverage

**Files:**
- Modify: `src/app/coverage/page.tsx`
- Delete: `src/components/coverage/ShiftDrawer.tsx`
- Modify: `e2e/coverage-overlay.spec.ts`

- [ ] **Step 1: Add a final regression test that the old drawer is gone and dialog/popover paths still work**

```ts
test('coverage no longer renders the legacy drawer controls', async ({ page }) => {
  await openCoveragePage(page, ctx!)
  await expect(page.getByTestId('coverage-drawer-close')).toHaveCount(0)
})
```

- [ ] **Step 2: Run the targeted regression test and verify it fails before removal**

Run: `npm.cmd run test:e2e -- e2e/coverage-overlay.spec.ts --grep "legacy drawer controls"`
Expected: FAIL while the old drawer component remains mounted or imported.

- [ ] **Step 3: Remove the drawer import/render path and delete the obsolete component**

```tsx
// delete:
import { ShiftDrawer } from '@/components/coverage/ShiftDrawer'

// replace render with:
<ShiftEditorDialog ... />
<AssignmentStatusPopover ... />
```

- [ ] **Step 4: Run the full unit suite plus the coverage E2E spec**

Run: `npm.cmd run test:unit`
Expected: PASS

Run: `npm.cmd run test:e2e -- e2e/coverage-overlay.spec.ts`
Expected: PASS, except for any already-known environment login instability documented in `CLAUDE.md`

- [ ] **Step 5: Commit the final migration**

```bash
git add src/app/coverage/page.tsx src/components/coverage/CalendarGrid.tsx src/components/coverage/AssignmentStatusPopover.tsx src/components/coverage/ShiftEditorDialog.tsx src/lib/coverage/status-ui.ts src/lib/coverage/status-ui.test.ts src/lib/coverage/selectors.ts src/lib/coverage/selectors.test.ts src/lib/coverage/updateAssignmentStatus.ts src/lib/coverage/updateAssignmentStatus.test.ts e2e/coverage-overlay.spec.ts
git rm src/components/coverage/ShiftDrawer.tsx
git commit -m "feat: migrate coverage to lovable modal interactions"
```

## Verification Checklist

- `npm.cmd run test:unit`
- `npm.cmd run test:e2e -- e2e/coverage-overlay.spec.ts`
- `npx.cmd tsc --noEmit`
- Manual browser check on `/coverage?cycle=<active-cycle-id>`:
  - click cell background opens dialog
  - click assigned name opens popover only
  - issue chip, tabs, and publish banner render correctly
  - published state still disables the same backend-backed actions

## Notes For Execution

- The current worktree is already dirty; do not revert unrelated user changes while implementing this plan.
- Keep test IDs stable where possible, but add explicit IDs for dialog and popover triggers so E2E coverage does not depend on fragile text-only selectors.
- If deleting `ShiftDrawer.tsx` creates merge risk, leave the file in place temporarily but remove every import and render path before claiming completion.

Plan complete and saved to `docs/superpowers/plans/2026-03-14-manager-scheduler-lovable-alignment.md`. Ready to execute?
