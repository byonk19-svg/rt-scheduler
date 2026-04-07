# Inbox & Availability Layout Fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two layout defects visible in the Apr 3 screenshots — the availability response roster grows unboundedly making header/tabs scroll out of view, and the Schedule Completion widget sits orphaned after Recent Activity in the manager Inbox.

**Architecture:** Both fixes are isolated single-file JSX/className edits with no new components, no new props, and no data changes. Each fix has a targeted test assertion added to the existing test file for that component.

**Tech Stack:** Next.js App Router · React · Tailwind CSS · Vitest (`renderToStaticMarkup`) · framer-motion (no changes needed)

---

## Investigation context (read before touching any file)

### Fix A — Availability response roster height

**File:** `src/components/availability/AvailabilityStatusSummary.tsx`

The inner list div is:

```tsx
<div className="min-h-[25rem] flex-1 overflow-y-auto p-4">
```

`flex-1` on this div means it tries to fill remaining flex-parent height. The parent `<section>` has `flex flex-col h-full` but no explicit height — so `flex-1` expands infinitely, rendering all 30+ therapist rows without any scroll boundary. The "Response roster" heading and tab bar scroll out of view.

**Fix:** Replace `min-h-[25rem] flex-1` with `max-h-[560px]` so the list is capped and scrolls internally. The heading and tabs sit above the scrollable area naturally.

### Fix B — ScheduleProgress widget position in Manager Inbox

**File:** `src/components/manager/ManagerTriageDashboard.tsx`

Current render order at the bottom of the JSX (lines ~288–321):

1. `<Card>` — Recent Activity (full-width)
2. `{dayShiftsFilled !== '--' && ...}` — ScheduleProgress (full-width, conditional)

ScheduleProgress after Recent Activity looks orphaned, especially when Recent Activity is an empty state. The widget belongs above Recent Activity so the page reads: grid → operational details → schedule signal → activity log.

**Fix:** Cut the `ScheduleProgress` conditional block and paste it between the `xl:grid-cols-[2fr_1fr]` section and the Recent Activity card.

---

## Files changed

| File                                                            | Action                              |
| --------------------------------------------------------------- | ----------------------------------- |
| `src/components/availability/AvailabilityStatusSummary.tsx`     | Modify: cap list height             |
| `src/components/availability/AvailabilityStatusSummary.test.ts` | Modify: add max-h assertion         |
| `src/components/manager/ManagerTriageDashboard.tsx`             | Modify: move ScheduleProgress block |
| `src/components/manager/ManagerTriageDashboard.test.ts`         | Modify: add order assertion         |

---

## Task 1 — Cap the availability response roster list height

**Files:**

- Modify: `src/components/availability/AvailabilityStatusSummary.tsx` (line 107)
- Test: `src/components/availability/AvailabilityStatusSummary.test.ts`

- [ ] **Step 1: Write a failing test asserting the list is bounded**

Add this test to the existing `describe` block in `AvailabilityStatusSummary.test.ts`:

```ts
it('renders the list container with a max-height class so it scrolls internally', () => {
  const html = renderToStaticMarkup(
    createElement(AvailabilityStatusSummary, {
      submittedRows: Array.from({ length: 30 }, (_, i) => ({
        therapistId: `t-${i}`,
        therapistName: `Therapist ${i}`,
        overridesCount: 1,
      })),
      missingRows: [],
    })
  )

  // The list container must NOT use flex-1 (unbounded growth)
  // and MUST have max-h-* so the header stays visible
  expect(html).toContain('max-h-[560px]')
  expect(html).not.toMatch(/flex-1.*overflow-y-auto|overflow-y-auto.*flex-1/)
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/components/availability/AvailabilityStatusSummary.test.ts
```

Expected: FAIL — `expected string to contain 'max-h-[560px]'`

- [ ] **Step 3: Apply the fix**

In `src/components/availability/AvailabilityStatusSummary.tsx`, find line 107:

```tsx
      <div className="min-h-[25rem] flex-1 overflow-y-auto p-4">
```

Change it to:

```tsx
      <div className="max-h-[560px] overflow-y-auto p-4">
```

That's the only change in this file.

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/components/availability/AvailabilityStatusSummary.test.ts
```

Expected: all tests PASS (existing test + new test).

- [ ] **Step 5: Run full unit suite to check for regressions**

```bash
npm run test:unit
```

Expected: all tests pass (was 364 before this session).

- [ ] **Step 6: Commit**

```bash
git add src/components/availability/AvailabilityStatusSummary.tsx \
        src/components/availability/AvailabilityStatusSummary.test.ts
git commit -m "fix: cap availability response roster height so header stays visible"
```

---

## Task 2 — Move ScheduleProgress before Recent Activity in manager Inbox

**Files:**

- Modify: `src/components/manager/ManagerTriageDashboard.tsx`
- Test: `src/components/manager/ManagerTriageDashboard.test.ts`

- [ ] **Step 1: Write a failing test asserting render order**

Open `src/components/manager/ManagerTriageDashboard.test.ts`. Add the following test inside the existing `describe('ManagerTriageDashboard', ...)` block:

```ts
it('renders Schedule Completion before Recent Activity', () => {
  const html = renderToStaticMarkup(
    createElement(ManagerTriageDashboard, {
      todayCoverageCovered: 15,
      todayCoverageTotal: 17,
      upcomingShiftCount: 12,
      upcomingShiftDays: [],
      todayActiveShifts: [],
      recentActivity: [{ title: 'Some activity', timeLabel: '1 hour ago', href: '/coverage' }],
      pendingRequests: 0,
      approvalsWaiting: 0,
      currentCycleStatus: 'Draft cycle',
      currentCycleDetail: 'Publish by Apr 27',
      nextCycleLabel: 'Collect availability Apr 1',
      nextCycleDetail: 'Publish by Apr 27',
      needsReviewCount: 0,
      needsReviewDetail: 'You are caught up.',
      dayShiftsFilled: 18,
      dayShiftsTotal: 21,
      nightShiftsFilled: 15,
      nightShiftsTotal: 21,
      approvalsHref: '/approvals',
      scheduleHref: '/coverage?view=week',
      reviewHref: '/approvals',
    })
  )

  const scheduleProgressIndex = html.indexOf('Schedule Completion')
  const recentActivityIndex = html.indexOf('Recent Activity')

  expect(scheduleProgressIndex).toBeGreaterThan(-1)
  expect(recentActivityIndex).toBeGreaterThan(-1)
  expect(scheduleProgressIndex).toBeLessThan(recentActivityIndex)
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/components/manager/ManagerTriageDashboard.test.ts
```

Expected: FAIL — `expected X to be less than Y` (ScheduleProgress currently renders after Recent Activity)

- [ ] **Step 3: Apply the fix**

Open `src/components/manager/ManagerTriageDashboard.tsx`.

Find the block that starts around line 288 — the full-width Recent Activity `<Card>`:

```tsx
      <Card className="rounded-2xl border-border/70 bg-card shadow-[0_1px_8px_rgba(15,23,42,0.04)]">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm font-medium text-foreground">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5 pb-4">
          {recentActivity.length > 0 ? (
            ...
          ) : (
            ...
          )}
        </CardContent>
      </Card>

      {dayShiftsFilled !== '--' &&
        dayShiftsTotal !== '--' &&
        nightShiftsFilled !== '--' &&
        nightShiftsTotal !== '--' && (
          <ScheduleProgress
            dayFilled={dayShiftsFilled}
            dayTotal={dayShiftsTotal}
            nightFilled={nightShiftsFilled}
            nightTotal={nightShiftsTotal}
          />
        )}
```

**Move** the `ScheduleProgress` conditional block so it appears BEFORE the Recent Activity card. The result should be:

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

;<Card className="rounded-2xl border-border/70 bg-card shadow-[0_1px_8px_rgba(15,23,42,0.04)]">
  <CardHeader className="pb-2 pt-4">
    <CardTitle className="text-sm font-medium text-foreground">Recent Activity</CardTitle>
  </CardHeader>
  <CardContent className="space-y-2.5 pb-4">...</CardContent>
</Card>
```

No other changes — do not touch props, data queries, or any other sections.

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/components/manager/ManagerTriageDashboard.test.ts
```

Expected: all tests PASS (existing tests + new order test).

- [ ] **Step 5: Run full unit suite**

```bash
npm run test:unit
```

Expected: all tests pass.

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/manager/ManagerTriageDashboard.tsx \
        src/components/manager/ManagerTriageDashboard.test.ts
git commit -m "fix: move Schedule Completion before Recent Activity in manager Inbox"
```

---

## Final verification

- [ ] Run `npm run lint` — expect 0 errors
- [ ] Run `npm run build` — expect success
- [ ] Run `npm run test:unit` — expect all tests pass (≥364)

---

## What was NOT changed (and why)

- **Coverage calendar red badge density** — Not a bug. The count badges (`X/Y`) correctly show red when fewer than 3 therapists are assigned. The demo data has sparse coverage, so most cells show 0–1 assigned. The code in `CalendarGrid.tsx` and `coverage/page.tsx` is correct. The `constraintBlocked` / "Needs attention" badge logic is also correct.
- **Staff dashboard availability warning card** — Not a bug. The warning border/bg IS applied when `!availabilitySubmitted` (lines 333–337 of `src/app/dashboard/staff/page.tsx`). The demo user has submitted availability so the card correctly shows "Ready" in neutral styling.
