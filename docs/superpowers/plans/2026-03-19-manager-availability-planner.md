# Manager Availability Planner Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a manager-only scheduling-input workspace on `/availability` where managers can mark cycle-scoped `Will work` and `Cannot work` dates for each therapist, and make auto-draft honor those dates as hard constraints.

**Architecture:** Reuse the existing `availability_overrides` table and current cycle-scoped override model instead of creating a second staffing-input system. Add a dedicated manager planner UI on `/availability`, move the relevant save/delete logic into focused server actions, and update the scheduling resolver and picker so manager `force_on` / `force_off` inputs become the strongest planning signals without breaking weekly caps, lead rules, or inactive/FMLA blocks.

**Tech Stack:** Next.js App Router, Supabase Auth/Postgres, server actions, Tailwind/shadcn UI, Vitest, Playwright.

---

## File Map

### New route-support files

- Create: `src/app/availability/actions.ts`
  - shared server actions for therapist self-service and manager planner mutations
- Create: `src/components/availability/ManagerSchedulingInputs.tsx`
  - manager-only planner workspace with therapist picker, mode toggle, calendar, and saved-date review
- Create: `src/lib/availability-planner.ts`
  - pure helpers for manager planner labels, date grouping, and override mapping
- Create: `src/lib/availability-planner.test.ts`
- Create: `src/components/availability/ManagerSchedulingInputs.test.tsx`

### Existing route files to modify

- Modify: `src/app/availability/page.tsx`
  - stop inlining all availability mutations
  - load manager planner data
  - render the new manager workspace above the existing requests table/form
- Modify: `src/app/availability/availability-requests-table.tsx`
  - adjust manager-facing copy or grouping if needed once the planner is primary

### Existing shared scheduling files to modify

- Modify: `src/lib/employee-directory.ts`
  - reuse / extend `buildManagerOverrideInput` and any date-range validation helpers
- Modify: `src/lib/coverage/resolve-availability.ts`
  - encode manager `force_on` / `force_off` precedence explicitly
- Modify: `src/lib/coverage/resolve-availability.test.ts`
- Modify: `src/lib/schedule-helpers.ts`
  - prioritize forced dates correctly during auto-draft candidate picking
- Modify: `src/lib/schedule-helpers.test.ts`
- Modify: `src/lib/coverage/generator-slot.ts`
  - preserve ideal/min coverage behavior while honoring forced picks
- Modify: `src/lib/coverage/generator-slot.test.ts`
- Modify: `src/app/schedule/actions.ts`
  - surface forced-date misses in auto-draft feedback if required by the resolver updates
- Modify: `src/app/schedule/preliminary-actions.test.ts` only if shared helpers are touched by existing draft send behavior

### Existing manager-override files to inspect and possibly simplify

- Inspect/possibly modify: `src/components/EmployeeDirectory.tsx`
  - de-emphasize or retire the older buried override entry point so `/availability` becomes the obvious manager workflow
- Inspect/possibly modify: `src/lib/employee-directory.test.ts`

### End-to-end and docs files

- Create: `e2e/manager-availability-planner.spec.ts`
  - manager enters hard dates, auto-draft honors them
- Modify: `CLAUDE.md`
  - document the new planner workflow and hard-constraint behavior

---

## Chunk 1: Shared Planner Model And Server Actions

### Task 1: Add pure planner helpers for manager-facing override mapping

**Files:**

- Create: `src/lib/availability-planner.ts`
- Create: `src/lib/availability-planner.test.ts`
- Inspect: `src/lib/employee-directory.ts`

- [ ] **Step 1: Write failing helper tests**

Cover:

- grouping overrides by date for a selected therapist + cycle
- translating `force_on` / `force_off` into `Will work` / `Cannot work`
- preserving `source: manager` vs `source: therapist`
- rejecting duplicate date entries in the same mode

Example:

```ts
it('maps manager force_on overrides to will-work dates', () => {
  expect(getManagerPlannerDates(fixtures).willWork).toEqual(['2026-03-28'])
})
```

- [ ] **Step 2: Run the helper tests to verify failure**

Run: `npm run test:unit -- src/lib/availability-planner.test.ts`

Expected: FAIL because the helper file does not exist yet

- [ ] **Step 3: Implement minimal planner helpers**

Add focused pure functions such as:

- `toManagerPlannerOverrides(...)`
- `splitPlannerDatesByMode(...)`
- `buildPlannerSavePayload(...)`
- `getPlannerDateValidationError(...)`

- [ ] **Step 4: Re-run the helper tests**

Run: `npm run test:unit -- src/lib/availability-planner.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/availability-planner.ts src/lib/availability-planner.test.ts
git commit -m "feat: add manager availability planner helpers"
```

### Task 2: Extract availability mutations into dedicated server actions

**Files:**

- Create: `src/app/availability/actions.ts`
- Modify: `src/app/availability/page.tsx`
- Inspect: `src/lib/employee-directory.ts`

- [ ] **Step 1: Write failing action tests**

Create:

- `src/app/availability/actions.test.ts`

Cover:

- therapist can still save their own availability request
- therapist can still delete only their own therapist-sourced request
- manager can save batch planner dates for a selected therapist and cycle
- manager planner writes `source: manager`
- manager clear/remove deletes only the targeted manager override rows

- [ ] **Step 2: Run the action tests to verify failure**

Run: `npm run test:unit -- src/app/availability/actions.test.ts`

Expected: FAIL

- [ ] **Step 3: Implement focused route actions**

Move the inline page actions into `src/app/availability/actions.ts`:

- `submitAvailabilityEntryAction`
- `deleteAvailabilityEntryAction`
- `saveManagerPlannerDatesAction`
- `deleteManagerPlannerDateAction`

Keep auth, redirects, and `revalidatePath('/availability')` in the actions, not in UI components.

- [ ] **Step 4: Update the page to import the extracted actions**

`src/app/availability/page.tsx` should stop defining server actions inline and instead wire in the new exported actions.

- [ ] **Step 5: Re-run the action tests**

Run: `npm run test:unit -- src/app/availability/actions.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/availability/actions.ts src/app/availability/actions.test.ts src/app/availability/page.tsx
git commit -m "refactor: extract availability actions"
```

## Chunk 2: Manager Planner UI On /availability

### Task 3: Build the manager-only scheduling-input workspace

**Files:**

- Create: `src/components/availability/ManagerSchedulingInputs.tsx`
- Create: `src/components/availability/ManagerSchedulingInputs.test.tsx`
- Modify: `src/app/availability/page.tsx`

- [ ] **Step 1: Write failing component tests**

Cover:

- manager sees therapist picker, cycle picker, and mode toggle
- therapist users do not see the manager planner
- clicking dates adds them to the selected mode
- saved `Will work` and `Cannot work` dates render with distinct styles
- removing a selected chip clears that date from the draft selection

- [ ] **Step 2: Run the component tests to verify failure**

Run: `npm run test:unit -- src/components/availability/ManagerSchedulingInputs.test.tsx`

Expected: FAIL

- [ ] **Step 3: Implement the planner component**

Build a focused UI with:

- `Staff Scheduling Inputs` header
- cycle picker
- therapist picker
- mode toggle for `Will work` / `Cannot work`
- cycle-scoped month calendar with click-to-toggle date selection
- saved-date chips/list grouped by mode
- clear-selected action

The component should submit through the new manager actions instead of mutating local-only state.

- [ ] **Step 4: Wire the manager planner into `/availability`**

`src/app/availability/page.tsx` should:

- load the manager-visible therapist list
- pass cycle data and override rows into the planner
- render the planner above the request list for managers
- keep the existing therapist request form intact below it

- [ ] **Step 5: Re-run the component tests**

Run: `npm run test:unit -- src/components/availability/ManagerSchedulingInputs.test.tsx`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/availability/ManagerSchedulingInputs.tsx src/components/availability/ManagerSchedulingInputs.test.tsx src/app/availability/page.tsx
git commit -m "feat: add manager availability planner ui"
```

### Task 4: Clean up manager-facing copy and old duplicate entry points

**Files:**

- Modify: `src/app/availability/page.tsx`
- Modify: `src/app/availability/availability-requests-table.tsx`
- Inspect/possibly modify: `src/components/EmployeeDirectory.tsx`
- Inspect/possibly modify: `src/lib/employee-directory.test.ts`

- [ ] **Step 1: Write or extend copy-level regression tests**

Cover:

- manager copy says `Will work` / `Cannot work`
- therapist copy keeps `Need off` / `Available to work`
- if the old Employee Directory override drawer remains, it points managers back to `/availability` instead of pretending to be the primary workflow

- [ ] **Step 2: Run the targeted tests**

Run: `npm run test:unit -- src/lib/employee-directory.test.ts src/components/availability/ManagerSchedulingInputs.test.tsx`

Expected: at least one FAIL before the copy/UI cleanup lands

- [ ] **Step 3: Implement the copy cleanup**

Ensure:

- manager-facing language is operational, not therapist-self-service language
- `/availability` is the obvious planner surface
- older override UI is either simplified or explicitly secondary

- [ ] **Step 4: Re-run the targeted tests**

Run: `npm run test:unit -- src/lib/employee-directory.test.ts src/components/availability/ManagerSchedulingInputs.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/availability/page.tsx src/app/availability/availability-requests-table.tsx src/components/EmployeeDirectory.tsx src/lib/employee-directory.test.ts
git commit -m "feat: center manager scheduling inputs on availability"
```

## Chunk 3: Auto-Draft Hard-Constraint Behavior

### Task 5: Encode manager hard-date precedence in availability resolution

**Files:**

- Modify: `src/lib/coverage/resolve-availability.ts`
- Modify: `src/lib/coverage/resolve-availability.test.ts`

- [ ] **Step 1: Write failing resolver tests**

Cover:

- manager `force_off` blocks assignment even if therapist entered availability
- manager `force_on` marks the date as a forced positive signal
- PRN remains ineligible without explicit `force_on`
- inactive and FMLA still beat all planner inputs

Example:

```ts
it('treats manager force_on as an explicit offered date for PRN', () => {
  expect(resolveAvailability(/* ... */).offeredByOverride).toBe(true)
})
```

- [ ] **Step 2: Run the resolver tests to verify failure**

Run: `npm run test:unit -- src/lib/coverage/resolve-availability.test.ts`

Expected: FAIL

- [ ] **Step 3: Implement the precedence changes**

Update the resolver so the result model can distinguish:

- blocked by hard manager date
- forced-eligible by hard manager date
- ordinary availability / default eligibility

Keep the current inactive, FMLA, and PRN safeguards intact.

- [ ] **Step 4: Re-run the resolver tests**

Run: `npm run test:unit -- src/lib/coverage/resolve-availability.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/coverage/resolve-availability.ts src/lib/coverage/resolve-availability.test.ts
git commit -m "feat: add manager hard-date precedence to availability resolution"
```

### Task 6: Make auto-draft prioritize forced dates without breaking weekly caps

**Files:**

- Modify: `src/lib/schedule-helpers.ts`
- Modify: `src/lib/schedule-helpers.test.ts`
- Modify: `src/lib/coverage/generator-slot.ts`
- Modify: `src/lib/coverage/generator-slot.test.ts`
- Modify: `src/app/schedule/actions.ts`

- [ ] **Step 1: Write failing scheduling tests**

Cover:

- a therapist with a legal `Will work` date is chosen before ordinary candidates
- a forced full-time therapist is still blocked at the weekly hard cap of 3
- PRN with `Will work` can be selected
- forced dates do not allow two shifts on the same day
- auto-draft still leaves only one designated lead per slot

- [ ] **Step 2: Run the scheduling tests to verify failure**

Run:

```bash
npm run test:unit -- src/lib/schedule-helpers.test.ts src/lib/coverage/generator-slot.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement forced-date prioritization**

Update `pickTherapistForDate(...)` and related helpers so candidate ranking prefers legal forced dates before normal candidates, while still respecting:

- one shift per day
- weekly cap
- inactive/FMLA blocks
- lead coverage rules

- [ ] **Step 4: Surface forced-date misses in auto-draft feedback**

If the best legal draft cannot satisfy every `Will work` date, update `src/app/schedule/actions.ts` so the manager gets a clear warning payload instead of a silent miss.

- [ ] **Step 5: Re-run the scheduling tests**

Run:

```bash
npm run test:unit -- src/lib/schedule-helpers.test.ts src/lib/coverage/generator-slot.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/schedule-helpers.ts src/lib/schedule-helpers.test.ts src/lib/coverage/generator-slot.ts src/lib/coverage/generator-slot.test.ts src/app/schedule/actions.ts
git commit -m "feat: honor forced manager dates in auto draft"
```

## Chunk 4: Full Workflow Verification And Documentation

### Task 7: Add end-to-end coverage for the manager planner and auto-draft

**Files:**

- Create: `e2e/manager-availability-planner.spec.ts`

- [ ] **Step 1: Write the E2E scenario**

Seed:

- one manager
- one full-time therapist
- one lead therapist
- one PRN therapist
- one draft cycle

Scenario:

1. manager opens `/availability`
2. manager selects the cycle and therapist
3. manager marks one `Will work` date and one `Cannot work` date
4. manager marks an explicit PRN `Will work` date
5. manager runs auto-draft
6. draft includes the forced legal dates
7. draft excludes the blocked date
8. PRN is scheduled only on the explicit date

- [ ] **Step 2: Run the E2E test and confirm failure first**

Run: `npm run test:e2e -- e2e/manager-availability-planner.spec.ts`

Expected: FAIL before the flow is fully wired

- [ ] **Step 3: Fix only the remaining integration gaps**

Do not add unrelated polish here. Only close the gaps exposed by the test.

- [ ] **Step 4: Re-run the E2E test**

Run: `npm run test:e2e -- e2e/manager-availability-planner.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add e2e/manager-availability-planner.spec.ts
git commit -m "test: cover manager availability planner flow"
```

### Task 8: Final verification, docs, and handoff

**Files:**

- Modify: `CLAUDE.md`

- [ ] **Step 1: Update handoff docs**

Document:

- `/availability` as the manager scheduling-input workspace
- `Will work` / `Cannot work` mapping to `force_on` / `force_off`
- PRN explicit-date-only auto-draft rule
- forced-date warning behavior when auto-draft cannot honor all hard dates

- [ ] **Step 2: Run the focused verification set**

Run:

```bash
npm run test:unit -- src/lib/availability-planner.test.ts src/app/availability/actions.test.ts src/components/availability/ManagerSchedulingInputs.test.tsx src/lib/coverage/resolve-availability.test.ts src/lib/schedule-helpers.test.ts src/lib/coverage/generator-slot.test.ts
npm run test:e2e -- e2e/manager-availability-planner.spec.ts
```

Expected:

- all targeted tests PASS

- [ ] **Step 3: Run the production build**

Run:

```bash
npm run build
```

Expected:

- PASS

Windows note:

- if `.next` is locked, stop the repo-local `next dev` process before rerunning

- [ ] **Step 4: Commit final docs and glue changes**

```bash
git add CLAUDE.md
git commit -m "docs: record manager availability planner workflow"
```

---

## Execution Notes

- Follow TDD strictly for each task.
- Keep the planner state and date-mapping logic in pure helpers, not in the page file.
- Reuse the existing `availability_overrides` table and `source` field instead of introducing a second manager-input store.
- Do not let forced dates bypass weekly caps, FMLA, or inactive blocks.
- Keep `/availability` readable for therapists; the manager planner should be clearly manager-only.

## Suggested Commit Order

1. `feat: add manager availability planner helpers`
2. `refactor: extract availability actions`
3. `feat: add manager availability planner ui`
4. `feat: center manager scheduling inputs on availability`
5. `feat: add manager hard-date precedence to availability resolution`
6. `feat: honor forced manager dates in auto draft`
7. `test: cover manager availability planner flow`
8. `docs: record manager availability planner workflow`
