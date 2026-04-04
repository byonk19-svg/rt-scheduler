# Design Audit Fixes — Session 20 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix five visual issues identified in the session 20 design audit: over-eager coverage calendar warning treatment, lightweight preliminary week dividers, cramped/misaligned availability page layout, manager dashboard title/concept mismatch, and flat staff availability stat card.

**Architecture:** All changes are isolated to UI components and one page file. No data model, API, or action changes required. Each task is independently deployable — commit after every task.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS with CSS custom properties (`var(--warning-*)` etc.), Vitest unit tests via `renderToStaticMarkup`.

---

## File Map

| File                                                           | Task | Change                                                   |
| -------------------------------------------------------------- | ---- | -------------------------------------------------------- |
| `src/components/coverage/CalendarGrid.tsx`                     | 1    | Decouple `missingLead` from full yellow card treatment   |
| `src/components/preliminary/PreliminaryScheduleView.tsx`       | 2    | Heavier week-divider styling                             |
| `src/components/availability/availability-workspace-shell.tsx` | 3    | Stack layout + design-token cleanup                      |
| `src/app/availability/page.tsx`                                | 3    | Remove hardcoded `slate/white` button classes            |
| `src/components/manager/ManagerTriageDashboard.tsx`            | 4    | Rename h1 + subtitle; update nav label                   |
| `src/components/AppShell.tsx`                                  | 4    | Rename manager "Dashboard" nav label to "Inbox"          |
| `src/app/dashboard/staff/page.tsx`                             | 5    | Conditional highlight on pending Availability card       |
| `src/components/manager/ManagerTriageDashboard.test.ts`        | 4    | Update test assertion from "Manager Dashboard" → "Inbox" |
| `src/components/AppShell.test.ts`                              | 4    | Add test that manager nav uses "Inbox" label             |

---

## Task 1 — Coverage calendar: decouple missing-lead from constraint warning

**Problem:** `hasCoverageIssue = missingLead || day.constraintBlocked` applies the full yellow card background whenever a lead is unassigned — which is almost every day in the demo data. The calendar looks permanently alarmed.

**Fix:** The full yellow treatment should only fire when `day.constraintBlocked`. Missing-lead-only days already show their own warning through the lead sub-section widget inside each card (which uses `day.leadShift` directly) — no extra card-level background needed.

**Files:**

- Modify: `src/components/coverage/CalendarGrid.tsx:97`

- [ ] **Step 1: Update `hasCoverageIssue` to only track constraint-blocked days**

  In `src/components/coverage/CalendarGrid.tsx`, find this block (around line 96–98):

  ```tsx
  const missingLead = !day.leadShift
  const hasCoverageIssue = missingLead || day.constraintBlocked
  const showAttentionBadge = day.constraintBlocked
  ```

  Replace with:

  ```tsx
  const hasCoverageIssue = day.constraintBlocked
  const showAttentionBadge = day.constraintBlocked
  ```

  Remove `const missingLead = !day.leadShift` entirely. The lead sub-section widget at line ~156 uses `day.leadShift` directly (not the `missingLead` variable), so the variable is unused after this change. Keeping it will cause `npm run lint` to fail with `no-unused-vars`.

- [ ] **Step 2: Verify the lead sub-section still shows its own warning color**

  Confirm that around line 154–158, the lead block still uses `day.leadShift` (not `hasCoverageIssue`) to decide its border/background:

  ```tsx
  className={cn(
    'mt-1.75 rounded-[16px] border px-2.75 py-1.5',
    day.leadShift
      ? 'border-[var(--info-border)] bg-[var(--info-subtle)] text-[var(--info-text)]'
      : 'border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]'
  )}
  ```

  This remains unchanged — it gives the correct per-card lead warning without polluting the outer card.

- [ ] **Step 3: Run existing coverage tests**

  ```bash
  npm run test:unit -- src/app/coverage/page.test.ts
  ```

  Expected: all tests pass.

- [ ] **Step 4: Run full unit suite to catch regressions**

  ```bash
  npm run test:unit
  ```

  Expected: all tests pass.

- [ ] **Step 5: Commit**

  ```bash
  git add src/components/coverage/CalendarGrid.tsx
  git commit -m "fix(coverage): only apply full yellow card treatment for constraint-blocked days, not missing-lead"
  ```

---

## Task 2 — Preliminary schedule: heavier week dividers

**Problem:** The week-group section headers in `PreliminaryScheduleView` are very lightweight (`text-[0.68rem] text-muted-foreground`). When a user scrolls through a long preliminary list, the dividers disappear into the noise and the page reads as a flat wall of cards.

**Fix:** Increase the visual weight of week labels and add more vertical breathing room between groups.

**Files:**

- Modify: `src/components/preliminary/PreliminaryScheduleView.tsx:103,116–122`

- [ ] **Step 1: Update week-group section styling**

  In `PreliminaryScheduleView.tsx`, find the `groupedCards.map(...)` section (around line 115–122):

  ```tsx
  groupedCards.map((group) => (
    <section key={group.weekStart} className="space-y-3">
      <div className="flex items-center gap-2">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
          {group.weekLabel}
        </p>
        <div className="h-px flex-1 bg-border/90" />
      </div>
      <div className="grid gap-3">
  ```

  Replace with:

  ```tsx
  groupedCards.map((group) => (
    <section key={group.weekStart} className="space-y-3">
      <div className="flex items-center gap-3 pb-0.5 pt-1">
        <p className="text-[0.78rem] font-bold uppercase tracking-[0.12em] text-foreground/60">
          {group.weekLabel}
        </p>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="grid gap-3">
  ```

  Also change the outer `space-y-5` on the groups wrapper (line 103) to `space-y-7` to add more vertical separation between week groups:

  ```tsx
  <div className="space-y-7">
  ```

- [ ] **Step 2: Run PreliminaryScheduleView test to make sure it still passes**

  ```bash
  npm run test:unit -- src/components/preliminary/PreliminaryScheduleView.test.ts
  ```

  Expected: all tests pass. The test checks for `'Week of Mar 22'` and `'Week of Mar 29'` text content — those strings come from `formatWeekLabel()` and are unaffected by class changes.

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/preliminary/PreliminaryScheduleView.tsx
  git commit -m "fix(preliminary): increase week-divider visual weight to break long preliminary list"
  ```

---

## Task 3 — Availability workspace: stacked layout + design-token cleanup

**Problem 1 (layout):** `availability-workspace-shell.tsx` uses `xl:grid-cols-[minmax(0,1fr)_21rem]` which pins the response roster to a narrow 21rem aside column. With 30+ therapists in the roster, this column scrolls for pages alongside the planning calendar. It reads as two entirely separate experiences crammed side-by-side.

**Problem 2 (tokens):** The shell uses hardcoded `bg-white`, `border-slate-200`, and `bg-slate-50/60` instead of design tokens, which will break in dark mode and diverges from the rest of the app.

**Fix:** Change to a fully stacked layout (aside below primary), widen the aside to full-width, and replace all hardcoded slate/white classes with design tokens.

**Files:**

- Modify: `src/components/availability/availability-workspace-shell.tsx`
- Modify: `src/app/availability/page.tsx:382–387` (one hardcoded button class)

- [ ] **Step 1: Rewrite `availability-workspace-shell.tsx`**

  Replace the entire file content with:

  ```tsx
  import type { ReactNode } from 'react'

  type AvailabilityWorkspaceShellProps = {
    primaryHeader?: ReactNode
    controls: ReactNode
    calendar: ReactNode
    aside: ReactNode
    lower: ReactNode
  }

  export function AvailabilityWorkspaceShell({
    primaryHeader,
    controls,
    calendar,
    aside,
    lower,
  }: AvailabilityWorkspaceShellProps) {
    return (
      <div className="space-y-6">
        <section
          data-slot="availability-workspace-primary"
          className="overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-[0_1px_3px_rgba(15,23,42,0.08)]"
        >
          {primaryHeader ? (
            <div className="border-b border-border/80 px-6 py-4">{primaryHeader}</div>
          ) : null}
          <div className="grid lg:grid-cols-[18.5rem_minmax(0,1fr)]">
            <div className="border-b border-border/80 bg-muted/30 px-5 py-5 lg:border-b-0 lg:border-r">
              {controls}
            </div>
            <div className="px-5 py-5">{calendar}</div>
          </div>
        </section>
        <section
          data-slot="availability-workspace-aside"
          className="overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-[0_1px_3px_rgba(15,23,42,0.08)]"
        >
          {aside}
        </section>
        <section data-slot="availability-workspace-lower">{lower}</section>
      </div>
    )
  }
  ```

  Key changes:
  - Outer wrapper is now `space-y-6` with no side-by-side grid — aside stacks below primary naturally.
  - `bg-white` → `bg-card`
  - `border-slate-200/90` → `border-border`
  - `border-slate-200/80` → `border-border/80`
  - `bg-slate-50/60` → `bg-muted/30`
  - The `lg:grid-cols-[18.5rem_minmax(0,1fr)]` inside the primary section is kept — it governs the controls/calendar split inside the planning card, which is fine.

- [ ] **Step 2: Remove hardcoded slate button classes in `availability/page.tsx`**

  Find this button around line 381–388:

  ```tsx
  <Button
    asChild
    variant="secondary"
    size="sm"
    className="border border-slate-200 bg-white text-xs text-slate-700 hover:bg-slate-100"
  >
    <Link href="/shift-board">Shift board</Link>
  </Button>
  ```

  Replace with:

  ```tsx
  <Button asChild variant="outline" size="sm" className="text-xs">
    <Link href="/shift-board">Shift board</Link>
  </Button>
  ```

- [ ] **Step 3: Run availability workspace shell test**

  ```bash
  npm run test:unit -- src/components/availability/availability-workspace-shell.test.ts
  ```

  Expected: passes. The test only checks that all slot `data-slot` attributes and slot content render — layout classes are not tested.

- [ ] **Step 4: Run full availability test suite**

  ```bash
  npm run test:unit -- src/app/availability/page.test.ts src/components/availability/ManagerSchedulingInputs.test.ts
  ```

  Expected: all pass.

- [ ] **Step 5: Typecheck**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 6: Commit**

  ```bash
  git add src/components/availability/availability-workspace-shell.tsx src/app/availability/page.tsx
  git commit -m "fix(availability): stack response roster below planning card; replace hardcoded slate/white classes with design tokens"
  ```

---

## Task 4 — Manager inbox title rename

**Problem:** The manager dashboard h1 reads "Manager Dashboard" but the page behaves as an inbox (pending approvals, cycle status, needs-review). This title sets an expectation the content doesn't fulfill. The nav also says "Dashboard" — it should match.

**Fix:** Rename the h1 in `ManagerTriageDashboard` to "Inbox" and update its subtitle. Rename the nav label in `AppShell` from "Dashboard" to "Inbox". Update affected tests.

**Files:**

- Modify: `src/components/manager/ManagerTriageDashboard.tsx:83–88`
- Modify: `src/components/AppShell.tsx` (manager nav item label)
- Modify: `src/components/manager/ManagerTriageDashboard.test.ts:39`
- Modify: `src/components/AppShell.test.ts`

- [ ] **Step 1: Update test first (TDD — tests should drive the rename)**

  In `src/components/manager/ManagerTriageDashboard.test.ts`, find:

  ```ts
  expect(html).toContain('Manager Dashboard')
  ```

  Replace with:

  ```ts
  expect(html).toContain('>Inbox</h1>')
  expect(html).not.toContain('Manager Dashboard')
  ```

  Note: The component already has a section sub-heading called "Manager Inbox" (a `CardTitle`). Using `'>Inbox</h1>'` targets the h1 specifically and avoids a false positive from the "Manager Inbox" substring.

- [ ] **Step 2: Run the test to confirm it fails**

  ```bash
  npm run test:unit -- src/components/manager/ManagerTriageDashboard.test.ts
  ```

  Expected: FAIL — `'Manager Dashboard'` is still in the HTML.

- [ ] **Step 3: Update the h1 and subtitle in `ManagerTriageDashboard.tsx`**

  Find around line 83–88:

  ```tsx
  <h1 className="text-[1.85rem] font-semibold tracking-tight text-foreground">
    Manager Dashboard
  </h1>
  <p className="mt-1 text-sm text-muted-foreground">
    Current cycle status, staffing risk, and approval triage in one place.
  </p>
  ```

  Replace with:

  ```tsx
  <h1 className="text-[1.85rem] font-semibold tracking-tight text-foreground">
    Inbox
  </h1>
  <p className="mt-1 text-sm text-muted-foreground">
    Pending approvals, cycle status, and items needing your attention.
  </p>
  ```

- [ ] **Step 4: Run the dashboard test to confirm it passes**

  ```bash
  npm run test:unit -- src/components/manager/ManagerTriageDashboard.test.ts
  ```

  Expected: PASS.

- [ ] **Step 5: Add AppShell test for the Inbox nav label**

  In `src/components/AppShell.test.ts`, add a new test inside the `describe` block:

  ```ts
  it('uses Inbox wording in manager nav instead of Dashboard', () => {
    expect(appShellSource).toContain("label: 'Inbox'")
    expect(appShellSource).not.toContain("label: 'Dashboard'")
  })
  ```

- [ ] **Step 6: Run the AppShell test to confirm it fails**

  ```bash
  npm run test:unit -- src/components/AppShell.test.ts
  ```

  Expected: FAIL on the new assertion.

- [ ] **Step 7: Update the manager nav label in `AppShell.tsx`**

  Find the `MANAGER_NAV_ITEMS` array (around line 65). The first item will be:

  ```tsx
  { href: MANAGER_WORKFLOW_LINKS.dashboard, label: 'Dashboard', icon: LayoutDashboard },
  ```

  Replace with:

  ```tsx
  { href: MANAGER_WORKFLOW_LINKS.dashboard, label: 'Inbox', icon: LayoutDashboard },
  ```

- [ ] **Step 8: Run AppShell test to confirm it passes**

  ```bash
  npm run test:unit -- src/components/AppShell.test.ts
  ```

  Expected: PASS.

- [ ] **Step 9: Run full unit suite**

  ```bash
  npm run test:unit
  ```

  Expected: all pass.

- [ ] **Step 10: Commit**

  ```bash
  git add src/components/manager/ManagerTriageDashboard.tsx src/components/AppShell.tsx src/components/manager/ManagerTriageDashboard.test.ts src/components/AppShell.test.ts
  git commit -m "fix(dashboard): rename Manager Dashboard → Inbox to match page behavior; update nav label"
  ```

---

## Task 5 — Staff dashboard: highlight pending Availability stat card

**Problem:** The three stat cards at the bottom of the staff dashboard (Next shift / Availability / Pending posts) all use the same flat `bg-muted/30` background. When availability is "Pending", it's the most actionable item on the page but it doesn't visually distinguish itself from the neutral cards.

**Fix:** Apply a subtle `warning-subtle` background to the Availability card when `!availabilitySubmitted`.

**Files:**

- Modify: `src/app/dashboard/staff/page.tsx:332–359`

- [ ] **Step 1: Add a test for the conditional highlight**

  In `src/app/dashboard/staff/page.test.ts`, add a new describe block at the bottom of the file:

  ```ts
  describe('staff dashboard availability stat card', () => {
    it('marks the availability card as pending when the source code has conditional warning treatment', () => {
      expect(staffDashboardSource).toContain('availabilitySubmitted')
      expect(staffDashboardSource).toContain('var(--warning-subtle)')
      expect(staffDashboardSource).toContain('var(--warning-border)')
    })
  })
  ```

- [ ] **Step 2: Run the test to confirm it fails**

  ```bash
  npm run test:unit -- src/app/dashboard/staff/page.test.ts
  ```

  Expected: FAIL. The source already contains `availabilitySubmitted` (used for the icon color), but does NOT yet contain `var(--warning-subtle)` or `var(--warning-border)` on the card container div, so two of the three sub-assertions will fail and the overall `it` block fails.

- [ ] **Step 3: Update the Availability stat card in `dashboard/staff/page.tsx`**

  Find the Availability stat card div around line 332:

  ```tsx
  <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
    <div className="flex items-center justify-between text-xs text-muted-foreground">
      <span>Availability</span>
  ```

  Replace just the outer `<div>` opening tag:

  ```tsx
  <div
    className={cn(
      'rounded-xl border px-3 py-2.5',
      availabilitySubmitted
        ? 'border-border bg-muted/30'
        : 'border-[var(--warning-border)] bg-[var(--warning-subtle)]/40'
    )}
  >
    <div className="flex items-center justify-between text-xs text-muted-foreground">
      <span>Availability</span>
  ```

  The `cn` import is already at the top of this file.

- [ ] **Step 4: Run the test to confirm it passes**

  ```bash
  npm run test:unit -- src/app/dashboard/staff/page.test.ts
  ```

  Expected: PASS.

- [ ] **Step 5: Run full unit suite**

  ```bash
  npm run test:unit
  ```

  Expected: all pass.

- [ ] **Step 6: Final lint + typecheck**

  ```bash
  npm run lint && npx tsc --noEmit
  ```

  Expected: clean.

- [ ] **Step 7: Commit**

  ```bash
  git add src/app/dashboard/staff/page.tsx src/app/dashboard/staff/page.test.ts
  git commit -m "fix(staff-dashboard): highlight Availability stat card when pending to draw attention to the actionable state"
  ```

---

## Final Gate

- [ ] Run full suite one last time: `npm run test:unit` — all pass
- [ ] Run build: `npm run build` — no errors
- [ ] Re-capture screenshots and verify:
  - Coverage calendar: mostly white cards; yellow treatment only on constraint-blocked days
  - Preliminary pages: clearly separated week groups
  - Availability: response roster is full-width and readable below the planning card
  - Manager nav: "Inbox" label
  - Staff dashboard: Availability card has warm background when pending
