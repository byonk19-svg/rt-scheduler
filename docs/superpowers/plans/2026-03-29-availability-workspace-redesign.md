# Availability Workspace Redesign Implementation Plan

## Completion Status

Status: Completed on 2026-03-29

Implemented outcomes:

- rebuilt the availability UI around a shared workspace shell and shared calendar surface
- delivered a manager availability hub with a combined staffing/calendar panel, response roster, and aligned request review table
- replaced the therapist route re-export with a dedicated therapist availability page and personal workspace
- replaced the broken therapist schedule redirect loop with a real single-page published schedule view that shows the full team schedule while highlighting the signed-in therapist's own shifts
- rerouted staff navigation and dashboard CTAs to `/therapist/availability`
- fixed staff dashboard coworker-name resolution for the published schedule preview
- fixed the manager publish workflow so weekly and shift override actions can be applied sequentially without losing override state between redirects
- added route-level and component-level regression coverage for the split manager/therapist workflows
- tightened the visual system against the `teamwise-staffing-hub.zip` reference without exposing manager controls on therapist screens

Verification run:

- `npm run test:unit -- src/components/availability/availability-workspace-shell.test.ts src/components/availability/availability-calendar-panel.test.ts src/components/availability/ManagerSchedulingInputs.test.ts src/components/availability/AvailabilityStatusSummary.test.ts src/components/availability/TherapistAvailabilityWorkspace.test.ts src/app/therapist/availability/page.test.ts src/app/availability/availability-requests-table.test.ts src/components/AppShell.test.ts src/app/dashboard/staff/page.test.ts src/app/availability/page.test.ts`
- `npm run test:unit -- src/app/dashboard/staff/page.test.ts src/app/therapist/schedule/page.test.ts src/app/coverage/page.test.ts`
- `npm run build`

Live checks completed:

- therapist sidebar and staff dashboard now route to `/therapist/availability`
- therapist availability page renders without manager-only controls
- therapist empty-state flow was verified live
- manager publish flow was verified live through the override path from `/coverage`
- therapist published schedule was verified live with full-team visibility and highlighted personal assignments
- staff dashboard preview was verified live with coworker names rendered correctly

Notes:

- the initial `next build` failure came from a locked `.next` entry under OneDrive while `next dev` was running; the stale lock was cleared and the build then passed cleanly
- unrelated local changes in `.gitignore`, `CLAUDE.md`, and `.codex-dev.log` were intentionally left out of the implementation commit

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `/availability` into a manager-focused availability hub that matches the approved reference direction, and build a separate therapist-only availability page with the same visual system but no manager controls.

**Architecture:** Keep the current Supabase queries and server actions as the source of truth, but split the UI into a shared availability workspace composition plus role-specific panels. Refactor the current manager page into reusable availability workspace pieces, then replace the therapist route re-export with a real therapist page that only renders personal controls, personal status, and personal history.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind, shadcn/ui, Vitest

---

## File Map

### New files

- Create: `src/components/availability/availability-workspace-shell.tsx`
  - shared three-column workspace frame for both availability routes
- Create: `src/components/availability/availability-calendar-panel.tsx`
  - shared month navigation and calendar surface used by manager and therapist views
- Create: `src/components/availability/TherapistAvailabilityWorkspace.tsx`
  - therapist-only left, center, and right availability panels
- Create: `src/components/availability/TherapistAvailabilityWorkspace.test.ts`
  - therapist workspace rendering and permission-safety coverage
- Create: `src/components/availability/availability-workspace-shell.test.ts`
  - shared shell layout regression coverage
- Create: `src/app/therapist/availability/page.test.ts`
  - route-level regression proving the therapist route no longer aliases manager UI

### Existing files to modify

- Modify: `src/app/availability/page.tsx`
  - keep manager data loading, but restructure the render tree around the new shared workspace
- Modify: `src/app/therapist/availability/page.tsx`
  - replace the manager page re-export with a real therapist page
- Modify: `src/components/availability/ManagerSchedulingInputs.tsx`
  - split or simplify into manager-specific workspace controls that fit the new shell
- Modify: `src/components/availability/AvailabilityStatusSummary.tsx`
  - reshape response status into a roster panel that fits the right side of the manager workspace
- Modify: `src/app/availability/availability-requests-table.tsx`
  - align the lower review/history section with the redesigned workspace framing
- Modify: `src/components/availability/ManagerSchedulingInputs.test.ts`
  - update expectations to match the new panel composition
- Modify: `src/components/availability/AvailabilityStatusSummary.test.ts`
  - update expectations to match the new roster presentation
- Modify: `src/app/availability/availability-requests-table.test.ts`
  - keep role-based scope expectations aligned with the new copy and framing

### Existing files to inspect while implementing

- Inspect: `src/components/availability/AvailabilityOverviewHeader.tsx`
- Inspect: `src/components/manager/ManagerWorkspaceHeader.tsx`
- Inspect: `src/lib/availability-planner.ts`
- Inspect: `src/lib/calendar-utils.ts`
- Inspect: `src/lib/employee-directory.ts`

---

## Chunk 1: Shared Workspace Structure

### Task 1: Add a shared availability workspace shell

**Files:**

- Create: `src/components/availability/availability-workspace-shell.tsx`
- Create: `src/components/availability/availability-workspace-shell.test.ts`

- [ ] **Step 1: Write the failing test**

Write a static-markup test that proves the shell renders:

- one primary workspace section
- three named regions
- a lower secondary section

Example:

```ts
it('renders a three-panel workspace plus a lower content region', () => {
  const html = renderToStaticMarkup(
    <AvailabilityWorkspaceShell
      controls={<div>Controls</div>}
      calendar={<div>Calendar</div>}
      aside={<div>Aside</div>}
      lower={<div>Lower</div>}
    />
  )

  expect(html).toContain('Controls')
  expect(html).toContain('Calendar')
  expect(html).toContain('Aside')
  expect(html).toContain('Lower')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/components/availability/availability-workspace-shell.test.ts`
Expected: FAIL because the shell file does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create a focused shell component with:

- a responsive three-panel main row
- desktop-first manager composition that collapses cleanly on mobile
- a separate lower slot for the requests table or history surface

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/components/availability/availability-workspace-shell.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/availability/availability-workspace-shell.tsx src/components/availability/availability-workspace-shell.test.ts
git commit -m "feat: add shared availability workspace shell"
```

### Task 2: Extract a shared calendar panel

**Files:**

- Create: `src/components/availability/availability-calendar-panel.tsx`
- Create: `src/components/availability/availability-calendar-panel.test.ts`
- Inspect: `src/components/availability/ManagerSchedulingInputs.tsx`
- Inspect: `src/lib/calendar-utils.ts`

- [ ] **Step 1: Write the failing test**

Write a pure rendering test that covers:

- month label rendering
- weekday headings
- disabled dates outside the selected cycle
- selected date styling input from props

Example:

```ts
it('disables dates outside the selected cycle while keeping saved dates visible', () => {
  const html = renderToStaticMarkup(
    <AvailabilityCalendarPanel
      monthStart="2026-03-01"
      cycleStart="2026-03-22"
      cycleEnd="2026-05-02"
      selectedDates={['2026-03-24']}
    />
  )

  expect(html).toContain('March 2026')
  expect(html).toContain('Mar 24, 2026')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/components/availability/availability-calendar-panel.test.ts`
Expected: FAIL because the shared calendar panel does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Move the month navigation and calendar-grid rendering into a shared component that accepts:

- `monthStart`
- cycle date bounds
- selected dates
- save-state annotations by date
- callbacks for navigation and date toggling

Keep the panel presentational. Do not move server actions into it.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/components/availability/availability-calendar-panel.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/availability/availability-calendar-panel.tsx src/components/availability/availability-calendar-panel.test.ts
git commit -m "feat: add shared availability calendar panel"
```

---

## Chunk 2: Manager Workspace Redesign

### Task 3: Refactor manager planning controls into the new workspace shape

**Files:**

- Modify: `src/components/availability/ManagerSchedulingInputs.tsx`
- Modify: `src/components/availability/ManagerSchedulingInputs.test.ts`
- Inspect: `src/components/availability/availability-workspace-shell.tsx`
- Inspect: `src/components/availability/availability-calendar-panel.tsx`

- [ ] **Step 1: Update the failing manager component test**

Extend the current test so it expects the refactored manager planner to render:

- left-side planning controls
- the shared calendar panel
- saved will-work and cannot-work groupings without stacked card clutter

Example additions:

```ts
expect(html).toContain('Plan staffing')
expect(html).toContain('Schedule cycle')
expect(html).toContain('Therapist')
expect(html).toContain('Will work')
expect(html).toContain('Cannot work')
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm run test:unit -- src/components/availability/ManagerSchedulingInputs.test.ts`
Expected: FAIL once the test expects the new structure.

- [ ] **Step 3: Write minimal implementation**

Refactor `ManagerSchedulingInputs` so it becomes the manager-specific workspace content:

- left panel owns therapist/cycle/mode controls and save actions
- center uses the shared calendar panel
- saved date summaries stay compact and operational
- remove unnecessary nested card framing

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/components/availability/ManagerSchedulingInputs.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/availability/ManagerSchedulingInputs.tsx src/components/availability/ManagerSchedulingInputs.test.ts src/components/availability/availability-calendar-panel.tsx
git commit -m "refactor: reshape manager availability controls into workspace panels"
```

### Task 4: Turn the response summary into a manager roster panel

**Files:**

- Modify: `src/components/availability/AvailabilityStatusSummary.tsx`
- Modify: `src/components/availability/AvailabilityStatusSummary.test.ts`

- [ ] **Step 1: Update the failing roster-panel test**

Change the test so it verifies:

- missing responses remain first
- submitted responses remain secondary
- the component reads as a right-side roster panel, not a stacked summary section

- [ ] **Step 2: Run test to verify failure**

Run: `npm run test:unit -- src/components/availability/AvailabilityStatusSummary.test.ts`
Expected: FAIL after the new copy or structure expectations are added.

- [ ] **Step 3: Write minimal implementation**

Refactor the component into a tighter roster panel:

- stronger missing-response emphasis
- compact submitted state
- layout sized to sit beside the calendar

Do not change the data contract unless tests require it.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/components/availability/AvailabilityStatusSummary.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/availability/AvailabilityStatusSummary.tsx src/components/availability/AvailabilityStatusSummary.test.ts
git commit -m "refactor: turn availability summary into roster panel"
```

### Task 5: Recompose the manager route around the shared workspace

**Files:**

- Modify: `src/app/availability/page.tsx`
- Modify: `src/app/availability/availability-requests-table.tsx`
- Modify: `src/app/availability/availability-requests-table.test.ts`
- Inspect: `src/components/availability/AvailabilityOverviewHeader.tsx`

- [ ] **Step 1: Write or extend the failing requests-table test**

Keep the existing manager review expectations, then add expectations that support the redesigned framing and copy.

- [ ] **Step 2: Run test to verify failure**

Run: `npm run test:unit -- src/app/availability/availability-requests-table.test.ts`
Expected: FAIL if the new copy or structure is not implemented yet.

- [ ] **Step 3: Update the manager page composition**

Refactor `src/app/availability/page.tsx` so the manager route renders:

- the existing overview header
- the shared workspace shell
- `ManagerSchedulingInputs` in the controls and calendar positions
- `AvailabilityStatusSummary` in the aside position
- the requests table in the lower region

Do not remove the existing server data queries unless they become dead code.

- [ ] **Step 4: Restyle the lower request review section**

Update `AvailabilityEntriesTable` to feel like part of the new workspace system:

- cleaner framing
- review-first manager language preserved
- therapist scope behavior unchanged

- [ ] **Step 5: Run targeted tests to verify they pass**

Run:

```bash
npm run test:unit -- src/components/availability/ManagerSchedulingInputs.test.ts src/components/availability/AvailabilityStatusSummary.test.ts src/app/availability/availability-requests-table.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/availability/page.tsx src/app/availability/availability-requests-table.tsx src/app/availability/availability-requests-table.test.ts src/components/availability/AvailabilityOverviewHeader.tsx
git commit -m "feat: rebuild manager availability workspace"
```

---

## Chunk 3: Therapist Route Split

### Task 6: Add a therapist-only availability workspace component

**Files:**

- Create: `src/components/availability/TherapistAvailabilityWorkspace.tsx`
- Create: `src/components/availability/TherapistAvailabilityWorkspace.test.ts`
- Inspect: `src/app/availability/page.tsx`
- Inspect: `src/app/availability/actions.ts`

- [ ] **Step 1: Write the failing therapist workspace test**

Cover:

- personal cycle picker
- request type and shift controls
- shared calendar rendering
- personal saved status content
- no therapist picker
- no response roster

Example:

```ts
expect(html).toContain('Save request')
expect(html).toContain('Need off')
expect(html).not.toContain('Therapist')
expect(html).not.toContain('Not submitted yet')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/components/availability/TherapistAvailabilityWorkspace.test.ts`
Expected: FAIL because the therapist workspace component does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create the therapist workspace with:

- left panel for request details and save action
- center shared calendar panel
- right panel for personal status and saved selections

Wire it to the existing therapist availability create/delete actions rather than introducing new persistence paths.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/components/availability/TherapistAvailabilityWorkspace.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/availability/TherapistAvailabilityWorkspace.tsx src/components/availability/TherapistAvailabilityWorkspace.test.ts
git commit -m "feat: add therapist availability workspace"
```

### Task 7: Replace the therapist route re-export with a real page

**Files:**

- Modify: `src/app/therapist/availability/page.tsx`
- Create: `src/app/therapist/availability/page.test.ts`
- Modify: `src/app/availability/availability-requests-table.tsx`

- [ ] **Step 1: Write the failing route-level regression test**

Add a test that proves the therapist route is no longer just:

```ts
export { default } from '../../availability/page'
```

The test should instead expect therapist-scoped render output and the absence of manager-only controls.

- [ ] **Step 2: Run test to verify failure**

Run: `npm run test:unit -- src/app/therapist/availability/page.test.ts`
Expected: FAIL because the route is still a re-export.

- [ ] **Step 3: Implement the therapist page**

Create a real server page that:

- authenticates the user
- loads only the signed-in therapist's cycle and override data
- renders `AvailabilityOverviewHeader`
- renders `TherapistAvailabilityWorkspace`
- renders `AvailabilityEntriesTable` with therapist-only rows

Do not reuse the manager page tree.

- [ ] **Step 4: Keep lower-table permissions strict**

Make sure `AvailabilityEntriesTable` still allows delete only on that therapist's own rows and still hides manager-specific scope toggles in therapist mode.

- [ ] **Step 5: Run targeted tests to verify they pass**

Run:

```bash
npm run test:unit -- src/components/availability/TherapistAvailabilityWorkspace.test.ts src/app/therapist/availability/page.test.ts src/app/availability/availability-requests-table.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/therapist/availability/page.tsx src/app/therapist/availability/page.test.ts src/app/availability/availability-requests-table.tsx
git commit -m "feat: split therapist availability route from manager workspace"
```

---

## Chunk 4: Final Verification

### Task 8: Run focused verification and manual UI review

**Files:**

- Test: `src/components/availability/availability-workspace-shell.test.ts`
- Test: `src/components/availability/availability-calendar-panel.test.ts`
- Test: `src/components/availability/ManagerSchedulingInputs.test.ts`
- Test: `src/components/availability/AvailabilityStatusSummary.test.ts`
- Test: `src/components/availability/TherapistAvailabilityWorkspace.test.ts`
- Test: `src/app/therapist/availability/page.test.ts`
- Test: `src/app/availability/availability-requests-table.test.ts`

- [ ] **Step 1: Run the focused unit-test set**

Run:

```bash
npm run test:unit -- src/components/availability/availability-workspace-shell.test.ts src/components/availability/availability-calendar-panel.test.ts src/components/availability/ManagerSchedulingInputs.test.ts src/components/availability/AvailabilityStatusSummary.test.ts src/components/availability/TherapistAvailabilityWorkspace.test.ts src/app/therapist/availability/page.test.ts src/app/availability/availability-requests-table.test.ts
```

Expected: PASS

- [ ] **Step 2: Run the production build**

Run:

```bash
npm run build
```

Expected: PASS

Windows note:

- if `.next` is locked, stop the repo-local `next dev` process before rerunning

- [ ] **Step 3: Manually review both routes in the browser**

Confirm:

- manager route matches the approved reference direction
- therapist route feels visually related but personal-only
- therapist route contains no manager controls
- mobile layout still works when the three-panel row collapses

- [ ] **Step 4: Commit the verification pass if any final glue changes were required**

```bash
git add src/app/availability/page.tsx src/app/therapist/availability/page.tsx src/components/availability
git commit -m "test: verify availability workspace redesign"
```

---

## Execution Notes

- Follow TDD strictly for every new component or route split.
- Keep business logic in the existing actions and pure helper layers, not in presentational components.
- Prefer shared workspace composition over duplicated manager and therapist markup.
- Preserve current availability persistence, redirects, and feedback toasts unless a test proves the redesign needs a change.
- Keep the therapist route fully isolated from manager-only render paths.

## Suggested Commit Order

1. `feat: add shared availability workspace shell`
2. `feat: add shared availability calendar panel`
3. `refactor: reshape manager availability controls into workspace panels`
4. `refactor: turn availability summary into roster panel`
5. `feat: rebuild manager availability workspace`
6. `feat: add therapist availability workspace`
7. `feat: split therapist availability route from manager workspace`
8. `test: verify availability workspace redesign`
