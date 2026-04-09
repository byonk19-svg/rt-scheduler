# Manager Dashboard Layout Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the manager Inbox dashboard with a true two-column layout, cycle date range in the header, and Schedule Completion moved up above Coverage Risks.

**Architecture:** All changes are confined to `ManagerTriageDashboard.tsx` (layout + prop addition) and `dashboard/manager/page.tsx` (compute + pass the date range string). The data layer, `ScheduleProgress`, and `InboxRow` are untouched. The 4th metric card ("Publish Readiness") is removed — it duplicates the `ScheduleProgress` overall %.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, framer-motion, Vitest (renderToStaticMarkup tests)

---

## File Map

| File                                                    | Change                                                                                                                                                                                                |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/manager/ManagerTriageDashboard.tsx`     | Add `activeCycleDateRange?` prop; remove 4th metric card; restructure to `[2fr\|1fr]` grid; move `ScheduleProgress` above Coverage Risks; move Manager Inbox + Upcoming Days into sticky right column |
| `src/app/dashboard/manager/page.tsx`                    | Compute `activeCycleDateRange` from `activeCycle` dates; pass it to `ManagerTriageDashboard`                                                                                                          |
| `src/components/manager/ManagerTriageDashboard.test.ts` | Add `activeCycleDateRange` to all `createElement` calls; update the empty-state test that checked for removed "Publish Readiness" copy                                                                |

---

## Task 1: Update tests first (TDD anchor)

**Files:**

- Modify: `src/components/manager/ManagerTriageDashboard.test.ts`

- [ ] **Step 1: Read the current test file**

  Confirm the four existing test cases and note line 122 which checks for `'Assign shifts and leads before publishing.'` (4th card copy being removed) and line 123 which checks for `'text-lg font-semibold text-muted-foreground'` (empty state dim style on the 4th card value).

- [ ] **Step 2: Update the empty-state test (test 3, lines 92–125)**

  Remove the assertion for the removed 4th card's empty-state copy. Note: `text-lg font-semibold text-muted-foreground` still appears on the other three empty cards so do NOT remove that assertion — only remove the Publish Readiness copy:

  ```ts
  // DELETE only this line:
  expect(html).toContain('Assign shifts and leads before publishing.')
  ```

  Replace with an assertion that the 4th card title is gone:

  ```ts
  expect(html).not.toContain('Publish Readiness')
  ```

- [ ] **Step 3: Add `activeCycleDateRange` prop to all four `createElement` calls**

  Each call to `createElement(ManagerTriageDashboard, { ... })` needs the new optional prop. Since it is optional (`?`), you may omit it entirely or pass `undefined`. For consistency, add it explicitly to all four:

  For tests 1, 3, and 4 (with real data):

  ```ts
  activeCycleDateRange: 'Mar 17 \u2013 Apr 13',
  ```

  For test 2 (loading state):

  ```ts
  activeCycleDateRange: undefined,
  ```

  **Note:** `formatCycleDate` in `page.tsx` uses `{ month: 'short', day: 'numeric' }` — no year. Test fixture strings must match this format (`'Mar 17 \u2013 Apr 13'`, not `'Mar 17 \u2013 Apr 13, 2026'`).

- [ ] **Step 4: Add a test that the date range renders when provided**

  Append inside the `describe` block. Use year-free date strings to match `formatCycleDate` output:

  ```ts
  it('renders cycle date range pill when provided', () => {
    const html = renderToStaticMarkup(
      createElement(ManagerTriageDashboard, {
        todayCoverageCovered: 15,
        todayCoverageTotal: 17,
        upcomingShiftCount: 12,
        upcomingShiftDays: [],
        todayActiveShifts: [],
        recentActivity: [],
        pendingRequests: 0,
        approvalsWaiting: 0,
        currentCycleStatus: 'Published',
        currentCycleDetail: 'Live',
        nextCycleLabel: 'Collect availability Apr 1',
        nextCycleDetail: 'Publish by May 11',
        needsReviewCount: 0,
        needsReviewDetail: 'You are caught up.',
        dayShiftsFilled: 18,
        dayShiftsTotal: 21,
        nightShiftsFilled: 15,
        nightShiftsTotal: 21,
        approvalsHref: '/approvals',
        scheduleHref: '/coverage',
        reviewHref: '/approvals',
        activeCycleDateRange: 'Mar 17 \u2013 Apr 13',
      })
    )
    expect(html).toContain('Mar 17 \u2013 Apr 13')
  })
  ```

- [ ] **Step 5: Run tests — expect failures because the component hasn't changed yet**

  ```bash
  npx vitest run src/components/manager/ManagerTriageDashboard.test.ts
  ```

  Expected: the new "date range" test fails (prop not accepted yet); the updated empty-state test may also fail if the component still renders the 4th card. That's correct — red before green.

---

## Task 2: Rebuild `ManagerTriageDashboard.tsx`

**Files:**

- Modify: `src/components/manager/ManagerTriageDashboard.tsx`

### 2a — Add the new prop and remove the 4th metric card

- [ ] **Step 1: Add `activeCycleDateRange?: string` to the props type**

  In the `ManagerTriageDashboardProps` type (around line 23), add:

  ```ts
  activeCycleDateRange?: string
  ```

- [ ] **Step 2: Destructure the new prop in the function signature**

  Add `activeCycleDateRange` to the destructured params of `ManagerTriageDashboard`.

- [ ] **Step 3: Remove the 4th metric card from the `metricCards` array**

  Delete the entire `Publish Readiness` entry (the object with `title: 'Publish Readiness'`). The array shrinks from 4 to 3 entries.

- [ ] **Step 4: Remove `coveragePercent` — it was only used by the 4th card**

  Delete:

  ```ts
  const coveragePercent = getCoveragePercent(todayCoverageCovered, todayCoverageTotal)
  ```

  And delete the `getCoveragePercent` helper function at the bottom of the file.

### 2b — Rebuild the layout

- [ ] **Step 5: Update the header section to include the date range pill**

  In the aurora hero `<div>` (starts around line 144), find the flex row that holds the `h1` + subtext + badges. Add the date range pill after the badge strip, only when `activeCycleDateRange` is present:

  ```tsx
  {
    activeCycleDateRange && (
      <span className="rounded-full border border-border/70 bg-muted/20 px-3 py-1 text-xs text-muted-foreground">
        {activeCycleDateRange}
      </span>
    )
  }
  ```

  Place this inside the `<div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">` alongside the existing badge chips.

- [ ] **Step 6: Wrap everything below the header in a two-column grid**

  Replace the current structure (metric card grid + two lower sections + ScheduleProgress + Recent Activity) with:

  ```tsx
  <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
    {/* LEFT COLUMN */}
    <div className="space-y-4">
      {/* DO NOT add an "Operations Bulletin" eyebrow here — it already exists
          inside the aurora hero card above and would duplicate */}
      {/* 3 metric cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        {metricCards.map(...)}
      </div>

      {/* Schedule Completion — moved up */}
      {dayShiftsFilled !== '--' && dayShiftsTotal !== '--' &&
       nightShiftsFilled !== '--' && nightShiftsTotal !== '--' && (
        <ScheduleProgress ... />
      )}

      {/* Coverage Risks */}
      <Card ...>...</Card>

      {/* Recent Activity */}
      <Card ...>...</Card>
    </div>

    {/* RIGHT SIDEBAR */}
    <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
      {/* Manager Inbox */}
      <Card ...>...</Card>
      {/* Upcoming Days */}
      <Card ...>...</Card>
    </div>
  </div>
  ```

  Key Tailwind classes:
  - Outer grid: `grid gap-4 xl:grid-cols-[2fr_1fr]`
  - Metric cards inner grid: `grid gap-3 sm:grid-cols-3` (was `lg:grid-cols-4`)
  - Right sidebar sticky: `xl:sticky xl:top-4 xl:self-start`

- [ ] **Step 7: Move `ScheduleProgress` into the left column, above Coverage Risks**

  Remove `ScheduleProgress` from wherever it currently appears (after the two-column section at the bottom). Place it inside the left column `space-y-4` div, after the metric cards grid and before the Coverage Risks card. Keep the same null guard.

- [ ] **Step 8: Move Manager Inbox and Upcoming Days into the right sidebar div**

  The two `<Card>` blocks that currently live in `<div className="space-y-3">` on the right side of `xl:grid-cols-[2fr_1fr]` (Coverage Risks | sidebar) should now move into the new right sidebar div in the outer two-column grid.

---

## Task 3: Pass `activeCycleDateRange` from the page

**Files:**

- Modify: `src/app/dashboard/manager/page.tsx`

- [ ] **Step 1: Compute `activeCycleDateRange` after `activeCycle` is resolved**

  In `loadDashboard()`, after `activeCycle` is derived (around line 252), add:

  ```ts
  const activeCycleDateRange = activeCycle
    ? `${formatCycleDate(activeCycle.start_date)} – ${formatCycleDate(activeCycle.end_date)}`
    : null
  ```

- [ ] **Step 2: Store it in component state**

  Add `activeCycleDateRange: string | null` to `DashboardData` type and `INITIAL_DATA`:

  ```ts
  // in DashboardData type:
  activeCycleDateRange: string | null

  // in INITIAL_DATA:
  activeCycleDateRange: null
  ```

  Set it in `setData(...)`:

  ```ts
  activeCycleDateRange,
  ```

- [ ] **Step 3: Pass it to `<ManagerTriageDashboard>`**

  Add the prop in the JSX (around line 438):

  ```tsx
  activeCycleDateRange={loading ? undefined : (data.activeCycleDateRange ?? undefined)}
  ```

---

## Task 4: Verify all checks pass

- [ ] **Step 1: Run the component tests**

  ```bash
  npx vitest run src/components/manager/ManagerTriageDashboard.test.ts
  ```

  Expected: all 5 tests pass (4 original updated + 1 new).

- [ ] **Step 2: Run full test suite**

  ```bash
  npx vitest run
  ```

  Expected: all tests pass (453+ total).

- [ ] **Step 3: TypeScript check**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 4: Lint**

  ```bash
  npm run lint
  ```

  Expected: no errors.

- [ ] **Step 5: Commit**

  ```bash
  git add src/components/manager/ManagerTriageDashboard.tsx \
          src/app/dashboard/manager/page.tsx \
          src/components/manager/ManagerTriageDashboard.test.ts
  git commit -m "feat: rebuild manager dashboard with two-column layout and cycle date range"
  ```
