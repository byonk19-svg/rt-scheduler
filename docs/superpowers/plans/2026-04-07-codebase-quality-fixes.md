# Codebase Quality Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three quality issues: a date-sensitive test bug in `therapist-availability-submission.ts`, extract the 600-line scheduling algorithm from `generateDraftScheduleAction` into a testable pure function, and split the 2,183-line `actions.ts` into focused per-responsibility modules.

**Architecture:** Fix 1 is a pure function signature change (no logic change). Fix 2 extracts the scheduling loop from the server action into `src/lib/coverage/generate-draft.ts` — the action becomes a thin loader + saver. Fix 3 splits `actions.ts` into `src/app/schedule/actions/` sub-modules with a barrel re-export, so all 4 callers need zero changes.

**Tech Stack:** Next.js 16 App Router (server actions), TypeScript, Vitest

---

## File Map

### Fix 1 — Inject `today` into `resolveAvailabilityDueSupportLine`

| Action | File                                                                                      |
| ------ | ----------------------------------------------------------------------------------------- |
| Modify | `src/lib/therapist-availability-submission.ts` — add optional `today?: string` param      |
| Modify | `src/lib/therapist-availability-submission.test.ts` — pin `today` in time-sensitive tests |

### Fix 2 — Extract scheduling algorithm

| Action | File                                                                                      |
| ------ | ----------------------------------------------------------------------------------------- |
| Create | `src/lib/coverage/generate-draft.ts` — pure `generateDraftForCycle` function + types      |
| Create | `src/lib/coverage/generate-draft.test.ts` — unit tests for the pure function              |
| Modify | `src/app/schedule/actions.ts` — `generateDraftScheduleAction` becomes a thin loader/saver |

### Fix 3 — Split `actions.ts`

| Action | File                                                                                                           |
| ------ | -------------------------------------------------------------------------------------------------------------- |
| Create | `src/app/schedule/actions/helpers.ts` — private helpers shared across action files                             |
| Create | `src/app/schedule/actions/cycle-actions.ts` — `createCycleAction`, `deleteCycleAction`                         |
| Create | `src/app/schedule/actions/publish-actions.ts` — `toggleCyclePublishedAction`                                   |
| Create | `src/app/schedule/actions/shift-actions.ts` — `addShiftAction`, `deleteShiftAction`, `setDesignatedLeadAction` |
| Create | `src/app/schedule/actions/draft-actions.ts` — `generateDraftScheduleAction`, `resetDraftScheduleAction`        |
| Create | `src/app/schedule/actions/preliminary-actions.ts` — `sendPreliminaryScheduleAction`                            |
| Create | `src/app/schedule/actions/index.ts` — re-exports all public actions                                            |
| Modify | `src/app/schedule/actions.ts` — replace body with `export * from './actions/index'`                            |

---

## Task 1: Fix the date-sensitive test bug

The function `resolveAvailabilityDueSupportLine` in `src/lib/therapist-availability-submission.ts` calls `new Date()` internally. Any test that uses a hardcoded `start_date` to assert a specific "Due ..." string will silently break when the clock passes that date. The fix is an optional `today?: string` parameter (ISO date string, e.g. `'2026-04-07'`) that defaults to the real current date.

**Files:**

- Modify: `src/lib/therapist-availability-submission.ts`
- Modify: `src/lib/therapist-availability-submission.test.ts`

- [ ] **Step 1: Update the function signature and internal `todayKey` line**

In `src/lib/therapist-availability-submission.ts`, change the function signature from:

```ts
export function resolveAvailabilityDueSupportLine(
  cycle: TherapistAvailabilityCycleDeadlineInput,
  submitted: boolean
): string | null {
  if (submitted) return null
  const todayKey = new Date().toISOString().slice(0, 10)
```

to:

```ts
export function resolveAvailabilityDueSupportLine(
  cycle: TherapistAvailabilityCycleDeadlineInput,
  submitted: boolean,
  today?: string
): string | null {
  if (submitted) return null
  const todayKey = today ?? new Date().toISOString().slice(0, 10)
```

- [ ] **Step 2: Run the existing tests to establish a baseline**

```bash
npx vitest run src/lib/therapist-availability-submission.test.ts
```

Expected: all pass (they may pass now because today is still before Apr 14, but this confirms the suite is healthy before we touch it).

- [ ] **Step 3: Update the time-sensitive tests to pin `today`**

In `src/lib/therapist-availability-submission.test.ts`, update the three tests that call `resolveAvailabilityDueSupportLine` to pass a pinned `today` string that will never be in the past:

```ts
it('uses explicit availability_due_at date for Due line when present', () => {
  const line = resolveAvailabilityDueSupportLine(
    { start_date: '2026-04-01', availability_due_at: '2026-04-10T23:59:59.000Z' },
    false,
    '2026-04-07' // pinned: well before the due date
  )
  expect(line).toMatch(/^Due /)
})

it('falls back to day-before-start when availability_due_at is absent', () => {
  const line = resolveAvailabilityDueSupportLine(
    { start_date: '2026-04-15' },
    false,
    '2026-04-07' // pinned: before Apr 14
  )
  expect(line).toBe('Due Apr 14, 2026')
})

it('returns null for due line when submitted', () => {
  expect(
    resolveAvailabilityDueSupportLine(
      { start_date: '2026-04-01', availability_due_at: null },
      true,
      '2026-04-07'
    )
  ).toBeNull()
})
```

Also add one test for the "past due" branch, so it's covered:

```ts
it('returns past-due message when due date is in the past', () => {
  const line = resolveAvailabilityDueSupportLine(
    { start_date: '2026-03-01' }, // day-before = Feb 28
    false,
    '2026-04-07' // today is after Feb 28
  )
  expect(line).toMatch(/Submit as soon as you can/)
})
```

- [ ] **Step 4: Run the tests and confirm all pass**

```bash
npx vitest run src/lib/therapist-availability-submission.test.ts
```

Expected: 7 tests pass. The original 6 tests remain (3 are modified to pin `today`, 3 are unchanged), plus 1 new "past due" test.

- [ ] **Step 5: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/therapist-availability-submission.ts src/lib/therapist-availability-submission.test.ts
git commit -m "fix: inject today param into resolveAvailabilityDueSupportLine to prevent time-sensitive test failures"
```

---

## Task 2: Extract `generateDraftForCycle` into a pure function

The scheduling algorithm in `generateDraftScheduleAction` (lines 1405–1857 of `src/app/schedule/actions.ts`) has no DB calls and no side effects — it maps inputs to a draft result. Extract it as `generateDraftForCycle` in `src/lib/coverage/generate-draft.ts`. The server action becomes: load data from DB → call pure function → save results → redirect.

**Files:**

- Create: `src/lib/coverage/generate-draft.ts`
- Create: `src/lib/coverage/generate-draft.test.ts`
- Modify: `src/app/schedule/actions.ts` (lines 1405–1857 replaced with single call)

### Task 2.1: Define the types and write a failing test

- [ ] **Step 1: Create `src/lib/coverage/generate-draft.ts` with types only**

```ts
import type {
  AutoScheduleShiftRow,
  AvailabilityOverrideRow,
  ShiftLimitRow,
  ShiftRole,
  Therapist,
} from '@/app/schedule/types'
import {
  MAX_SHIFT_COVERAGE_PER_DAY,
  MIN_SHIFT_COVERAGE_PER_DAY,
  getDefaultWeeklyLimitForEmploymentType,
  getWeeklyMinimumForEmploymentType,
  sanitizeWeeklyLimit,
} from '@/lib/scheduling-constants'
import {
  buildDateRange,
  coverageSlotKey,
  countsTowardWeeklyLimit,
  pickTherapistForDate,
  weeklyCountKey,
  getWeekBoundsForDate,
} from '@/lib/schedule-helpers'
import { fillCoverageSlot, NO_ELIGIBLE_CANDIDATES_REASON } from '@/lib/coverage/generator-slot'
import { getAutoDraftCoveragePolicy } from '@/lib/coverage/auto-draft-policy'
import { shiftTypeMatches } from '@/lib/coverage/work-patterns'

export type DraftShiftInsert = {
  cycle_id: string
  user_id: string
  date: string
  shift_type: 'day' | 'night'
  status: 'scheduled'
  role: ShiftRole
}

export type GenerateDraftInput = {
  cycleId: string
  cycleStartDate: string
  cycleEndDate: string
  therapists: Therapist[]
  existingShifts: AutoScheduleShiftRow[]
  allAvailabilityOverrides: AvailabilityOverrideRow[]
  weeklyShifts: ShiftLimitRow[]
}

export type GenerateDraftResult = {
  draftShiftsToInsert: DraftShiftInsert[]
  pendingLeadUpdates: Array<{ date: string; shiftType: 'day' | 'night'; therapistId: string }>
  unfilledConstraintSlots: Array<{ date: string; shiftType: 'day' | 'night'; missingCount: number }>
  unfilledSlots: number
  constraintsUnfilledSlots: number
  missingLeadSlots: number
  forcedMustWorkMisses: number
}

export function generateDraftForCycle(_input: GenerateDraftInput): GenerateDraftResult {
  throw new Error('not implemented')
}
```

- [ ] **Step 2: Write a failing test for the empty-input case**

Create `src/lib/coverage/generate-draft.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { generateDraftForCycle } from '@/lib/coverage/generate-draft'

const BASE_INPUT = {
  cycleId: 'cycle-1',
  cycleStartDate: '2026-04-07',
  cycleEndDate: '2026-04-07', // single day for simplicity
  therapists: [],
  existingShifts: [],
  allAvailabilityOverrides: [],
  weeklyShifts: [],
}

describe('generateDraftForCycle', () => {
  it('returns empty result when there are no therapists', () => {
    const result = generateDraftForCycle(BASE_INPUT)
    expect(result.draftShiftsToInsert).toHaveLength(0)
    expect(result.unfilledSlots).toBeGreaterThan(0) // no coverage possible
    expect(result.missingLeadSlots).toBeGreaterThan(0)
    expect(result.forcedMustWorkMisses).toBe(0)
  })
})
```

- [ ] **Step 3: Run the test and confirm it fails**

```bash
npx vitest run src/lib/coverage/generate-draft.test.ts
```

Expected: FAIL — "not implemented"

### Task 2.2: Implement `generateDraftForCycle`

- [ ] **Step 4: Move the algorithm body into the function**

Replace the `throw new Error('not implemented')` stub in `generate-draft.ts` with the extracted algorithm. The function body is the code currently at lines 1385–1857 of `actions.ts` (from `const weeklyLimitByTherapist` through `const forcedMustWorkMisses = ...`), adapted to use `input.*` instead of local variables from the server action.

The complete implementation:

```ts
export function generateDraftForCycle(input: GenerateDraftInput): GenerateDraftResult {
  const {
    cycleId,
    cycleStartDate,
    cycleEndDate,
    therapists,
    existingShifts,
    allAvailabilityOverrides,
    weeklyShifts,
  } = input

  const AUTO_GENERATE_TARGET = getAutoDraftCoveragePolicy().idealCoveragePerShift

  const weeklyLimitByTherapist = new Map<string, number>(
    therapists.map((t) => [
      t.id,
      sanitizeWeeklyLimit(
        t.max_work_days_per_week,
        getDefaultWeeklyLimitForEmploymentType(t.employment_type)
      ),
    ])
  )
  const weeklyMinimumByTherapist = new Map<string, number>(
    therapists.map((t) => {
      const limit = weeklyLimitByTherapist.get(t.id) ?? 7
      return [t.id, Math.min(limit, getWeeklyMinimumForEmploymentType(t.employment_type))]
    })
  )

  const cycleDates = buildDateRange(cycleStartDate, cycleEndDate)

  const availabilityOverridesByTherapist = new Map<string, AvailabilityOverrideRow[]>()
  for (const row of allAvailabilityOverrides) {
    const rows = availabilityOverridesByTherapist.get(row.therapist_id) ?? []
    rows.push(row)
    availabilityOverridesByTherapist.set(row.therapist_id, rows)
  }

  const weeklyWorkedDatesByUserWeek = new Map<string, Set<string>>()
  for (const row of weeklyShifts) {
    if (!countsTowardWeeklyLimit(row.status)) continue
    const bounds = getWeekBoundsForDate(row.date)
    if (!bounds) continue
    const key = weeklyCountKey(row.user_id, bounds.weekStart)
    const dates = weeklyWorkedDatesByUserWeek.get(key) ?? new Set<string>()
    dates.add(row.date)
    weeklyWorkedDatesByUserWeek.set(key, dates)
  }

  const coverageBySlot = new Map<string, number>()
  const assignedUserIdsByDate = new Map<string, Set<string>>()
  const leadAssignedBySlot = new Map<string, boolean>()
  const shiftsBySlot = new Map<string, AutoScheduleShiftRow[]>()
  const therapistById = new Map(therapists.map((t) => [t.id, t]))

  for (const shift of existingShifts) {
    const slotKey = coverageSlotKey(shift.date, shift.shift_type)
    const slotShifts = shiftsBySlot.get(slotKey) ?? []
    slotShifts.push(shift)
    shiftsBySlot.set(slotKey, slotShifts)
    if (shift.role === 'lead') leadAssignedBySlot.set(slotKey, true)
    if (countsTowardWeeklyLimit(shift.status)) {
      coverageBySlot.set(slotKey, (coverageBySlot.get(slotKey) ?? 0) + 1)
    }
    const forDate = assignedUserIdsByDate.get(shift.date) ?? new Set<string>()
    forDate.add(shift.user_id)
    assignedUserIdsByDate.set(shift.date, forDate)
  }

  const dayTherapists = therapists.filter((t) => t.shift_type === 'day')
  const nightTherapists = therapists.filter((t) => t.shift_type === 'night')
  const dayLeadTherapists = dayTherapists.filter((t) => t.is_lead_eligible)
  const nightLeadTherapists = nightTherapists.filter((t) => t.is_lead_eligible)

  let dayCursor = 0,
    nightCursor = 0,
    dayLeadCursor = 0,
    nightLeadCursor = 0
  let unfilledSlots = 0,
    constraintsUnfilledSlots = 0,
    missingLeadSlots = 0
  const pendingLeadUpdates: GenerateDraftResult['pendingLeadUpdates'] = []
  const unfilledConstraintSlots: GenerateDraftResult['unfilledConstraintSlots'] = []
  const draftShiftsToInsert: DraftShiftInsert[] = []

  for (const date of cycleDates) {
    const assignedForDate = assignedUserIdsByDate.get(date) ?? new Set<string>()
    assignedUserIdsByDate.set(date, assignedForDate)

    // --- Day shift ---
    const daySlotKey = coverageSlotKey(date, 'day')
    let dayCoverage = coverageBySlot.get(daySlotKey) ?? 0
    let dayHasLead = leadAssignedBySlot.get(daySlotKey) === true

    if (!dayHasLead) {
      const existing = (shiftsBySlot.get(daySlotKey) ?? []).find(
        (s) => countsTowardWeeklyLimit(s.status) && therapistById.get(s.user_id)?.is_lead_eligible
      )
      if (existing) {
        pendingLeadUpdates.push({ date, shiftType: 'day', therapistId: existing.user_id })
        dayHasLead = true
        leadAssignedBySlot.set(daySlotKey, true)
      }
    }

    if (!dayHasLead) {
      const pick = pickTherapistForDate(
        dayLeadTherapists,
        dayLeadCursor,
        date,
        'day',
        availabilityOverridesByTherapist,
        cycleId,
        assignedForDate,
        weeklyWorkedDatesByUserWeek,
        weeklyLimitByTherapist,
        weeklyMinimumByTherapist
      )
      dayLeadCursor = pick.nextCursor
      if (pick.therapist) {
        draftShiftsToInsert.push({
          cycle_id: cycleId,
          user_id: pick.therapist.id,
          date,
          shift_type: 'day',
          status: 'scheduled',
          role: 'lead',
        })
        assignedForDate.add(pick.therapist.id)
        const wb = getWeekBoundsForDate(date)
        if (wb) {
          const k = weeklyCountKey(pick.therapist.id, wb.weekStart)
          const d = weeklyWorkedDatesByUserWeek.get(k) ?? new Set<string>()
          d.add(date)
          weeklyWorkedDatesByUserWeek.set(k, d)
        }
        dayCoverage += 1
        coverageBySlot.set(daySlotKey, dayCoverage)
        dayHasLead = true
        leadAssignedBySlot.set(daySlotKey, true)
      }
    }

    const dayFill = fillCoverageSlot({
      therapists: dayTherapists,
      cursor: dayCursor,
      date,
      shiftType: 'day',
      cycleId,
      availabilityOverridesByTherapist,
      assignedUserIdsForDate: assignedForDate,
      weeklyWorkedDatesByUserWeek,
      weeklyLimitByTherapist,
      weeklyMinimumByTherapist,
      currentCoverage: dayCoverage,
      targetCoverage: AUTO_GENERATE_TARGET,
      minCoverage: MIN_SHIFT_COVERAGE_PER_DAY,
    })
    dayCursor = dayFill.nextCursor
    for (const t of dayFill.pickedTherapists) {
      const role: ShiftRole = !dayHasLead && t.is_lead_eligible ? 'lead' : 'staff'
      draftShiftsToInsert.push({
        cycle_id: cycleId,
        user_id: t.id,
        date,
        shift_type: 'day',
        status: 'scheduled',
        role,
      })
      if (role === 'lead') {
        dayHasLead = true
        leadAssignedBySlot.set(daySlotKey, true)
      }
    }
    dayCoverage = dayFill.coverage
    coverageBySlot.set(daySlotKey, dayCoverage)
    if (dayFill.unfilledCount > 0) {
      unfilledSlots += dayFill.unfilledCount
      constraintsUnfilledSlots += dayFill.unfilledCount
      if (dayFill.unfilledReason === NO_ELIGIBLE_CANDIDATES_REASON) {
        unfilledConstraintSlots.push({
          date,
          shiftType: 'day',
          missingCount: dayFill.unfilledCount,
        })
      }
    }
    if (!dayHasLead) missingLeadSlots += 1

    // --- Night shift ---
    const nightSlotKey = coverageSlotKey(date, 'night')
    let nightCoverage = coverageBySlot.get(nightSlotKey) ?? 0
    let nightHasLead = leadAssignedBySlot.get(nightSlotKey) === true

    if (!nightHasLead) {
      const existing = (shiftsBySlot.get(nightSlotKey) ?? []).find(
        (s) => countsTowardWeeklyLimit(s.status) && therapistById.get(s.user_id)?.is_lead_eligible
      )
      if (existing) {
        pendingLeadUpdates.push({ date, shiftType: 'night', therapistId: existing.user_id })
        nightHasLead = true
        leadAssignedBySlot.set(nightSlotKey, true)
      }
    }

    if (!nightHasLead) {
      const pick = pickTherapistForDate(
        nightLeadTherapists,
        nightLeadCursor,
        date,
        'night',
        availabilityOverridesByTherapist,
        cycleId,
        assignedForDate,
        weeklyWorkedDatesByUserWeek,
        weeklyLimitByTherapist,
        weeklyMinimumByTherapist
      )
      nightLeadCursor = pick.nextCursor
      if (pick.therapist) {
        draftShiftsToInsert.push({
          cycle_id: cycleId,
          user_id: pick.therapist.id,
          date,
          shift_type: 'night',
          status: 'scheduled',
          role: 'lead',
        })
        assignedForDate.add(pick.therapist.id)
        const wb = getWeekBoundsForDate(date)
        if (wb) {
          const k = weeklyCountKey(pick.therapist.id, wb.weekStart)
          const d = weeklyWorkedDatesByUserWeek.get(k) ?? new Set<string>()
          d.add(date)
          weeklyWorkedDatesByUserWeek.set(k, d)
        }
        nightCoverage += 1
        coverageBySlot.set(nightSlotKey, nightCoverage)
        nightHasLead = true
        leadAssignedBySlot.set(nightSlotKey, true)
      }
    }

    const nightFill = fillCoverageSlot({
      therapists: nightTherapists,
      cursor: nightCursor,
      date,
      shiftType: 'night',
      cycleId,
      availabilityOverridesByTherapist,
      assignedUserIdsForDate: assignedForDate,
      weeklyWorkedDatesByUserWeek,
      weeklyLimitByTherapist,
      weeklyMinimumByTherapist,
      currentCoverage: nightCoverage,
      targetCoverage: AUTO_GENERATE_TARGET,
      minCoverage: MIN_SHIFT_COVERAGE_PER_DAY,
    })
    nightCursor = nightFill.nextCursor
    for (const t of nightFill.pickedTherapists) {
      const role: ShiftRole = !nightHasLead && t.is_lead_eligible ? 'lead' : 'staff'
      draftShiftsToInsert.push({
        cycle_id: cycleId,
        user_id: t.id,
        date,
        shift_type: 'night',
        status: 'scheduled',
        role,
      })
      if (role === 'lead') {
        nightHasLead = true
        leadAssignedBySlot.set(nightSlotKey, true)
      }
    }
    nightCoverage = nightFill.coverage
    coverageBySlot.set(nightSlotKey, nightCoverage)
    if (nightFill.unfilledCount > 0) {
      unfilledSlots += nightFill.unfilledCount
      constraintsUnfilledSlots += nightFill.unfilledCount
      if (nightFill.unfilledReason === NO_ELIGIBLE_CANDIDATES_REASON) {
        unfilledConstraintSlots.push({
          date,
          shiftType: 'night',
          missingCount: nightFill.unfilledCount,
        })
      }
    }
    if (!nightHasLead) missingLeadSlots += 1
  }

  const finalAssignedShifts = [...existingShifts, ...draftShiftsToInsert]
  const forcedMustWorkMisses = allAvailabilityOverrides.filter((o) => {
    if (o.override_type !== 'force_on') return false
    if (o.source !== 'manager' && o.source !== 'therapist') return false
    return !finalAssignedShifts.some(
      (s) =>
        s.user_id === o.therapist_id &&
        s.date === o.date &&
        countsTowardWeeklyLimit(s.status) &&
        shiftTypeMatches(o.shift_type, s.shift_type)
    )
  }).length

  return {
    draftShiftsToInsert,
    pendingLeadUpdates,
    unfilledConstraintSlots,
    unfilledSlots,
    constraintsUnfilledSlots,
    missingLeadSlots,
    forcedMustWorkMisses,
  }
}
```

- [ ] **Step 5: Run the test and confirm it passes**

```bash
npx vitest run src/lib/coverage/generate-draft.test.ts
```

Expected: PASS

- [ ] **Step 6: Add coverage for a therapist actually being scheduled**

Add to `generate-draft.test.ts`:

```ts
it('assigns a lead therapist to both day and night on a single day', () => {
  const therapist: Therapist = {
    id: 't1',
    full_name: 'Jane Doe',
    shift_type: 'day',
    is_lead_eligible: true,
    employment_type: 'full_time',
    max_work_days_per_week: 5,
    works_dow: [0, 1, 2, 3, 4, 5, 6],
    offs_dow: [],
    weekend_rotation: 'none',
    weekend_anchor_date: null,
    works_dow_mode: 'hard',
    shift_preference: 'day',
    on_fmla: false,
    fmla_return_date: null,
    is_active: true,
  }
  const result = generateDraftForCycle({
    ...BASE_INPUT,
    therapists: [therapist],
  })
  expect(result.draftShiftsToInsert.some((s) => s.shift_type === 'day' && s.role === 'lead')).toBe(
    true
  )
  expect(result.missingLeadSlots).toBe(1) // night still has no lead
})

it('counts forced-on override as a miss when therapist is not scheduled', () => {
  const override: AvailabilityOverrideRow = {
    therapist_id: 'nobody',
    cycle_id: 'cycle-1',
    date: '2026-04-07',
    shift_type: 'day',
    override_type: 'force_on',
    source: 'manager',
  }
  const result = generateDraftForCycle({
    ...BASE_INPUT,
    allAvailabilityOverrides: [override],
  })
  expect(result.forcedMustWorkMisses).toBe(1)
})
```

```bash
npx vitest run src/lib/coverage/generate-draft.test.ts
```

Expected: all pass.

### Task 2.3: Wire the action to call the pure function

- [ ] **Step 7: Replace the algorithm block in `generateDraftScheduleAction`**

In `src/app/schedule/actions.ts`, add the import at the top:

```ts
import { generateDraftForCycle } from '@/lib/coverage/generate-draft'
```

Then replace lines 1385–1857 (from `const weeklyLimitByTherapist =` through `const forcedMustWorkMisses = ...`). The true start is line 1385 where `weeklyLimitByTherapist` is built. The `cycleDates` variable at line 1405, the `therapists.length === 0` guard at ~line 1401, and `firstWeekBounds`/`lastWeekBounds` checks were computed before the extracted block — but the `therapists.length === 0` guard must be retained in the action (it's a pre-condition that causes a redirect, not part of the pure algorithm). Place it explicitly before the `generateDraftForCycle` call:

```ts
if (therapists.length === 0) {
  redirect(buildReturnUrl(cycleId, { ...viewParams, error: 'auto_no_therapists' }))
}

const cycleDates = buildDateRange(cycle.start_date, cycle.end_date)
if (cycleDates.length === 0) {
  redirect(buildReturnUrl(cycleId, { ...viewParams, error: 'auto_generate_failed' }))
}

const draft = generateDraftForCycle({
  cycleId,
  cycleStartDate: cycle.start_date,
  cycleEndDate: cycle.end_date,
  therapists,
  existingShifts,
  allAvailabilityOverrides,
  weeklyShifts: (weeklyShiftsResult.data ?? []) as ShiftLimitRow[],
})

const {
  draftShiftsToInsert,
  pendingLeadUpdates,
  unfilledConstraintSlots,
  unfilledSlots,
  constraintsUnfilledSlots,
  missingLeadSlots,
  forcedMustWorkMisses,
} = draft
```

The `firstWeekBounds`/`lastWeekBounds` checks and the `weeklyShifts` DB query that uses them remain above this block — they are data-loading steps, not part of the algorithm. The `generateDraftForCycle` call receives the loaded `weeklyShifts` data directly.

- [ ] **Step 8: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 9: Run the full test suite**

```bash
npx vitest run
```

Expected: 415+ tests pass, 0 failures.

- [ ] **Step 10: Commit**

```bash
git add src/lib/coverage/generate-draft.ts src/lib/coverage/generate-draft.test.ts src/app/schedule/actions.ts
git commit -m "refactor: extract generateDraftForCycle into pure function in src/lib/coverage/generate-draft"
```

---

## Task 3: Split `actions.ts` into per-responsibility modules

`src/app/schedule/actions.ts` is 2,183 lines with 9 exported server actions and 8 private helpers. Split into focused files under `src/app/schedule/actions/`. All 4 callers import from `@/app/schedule/actions` — keep that path working via a barrel re-export, so zero callers need updating.

**Important Next.js rule:** Every file containing server actions must have `'use server'` at the top. The barrel `index.ts` and `helpers.ts` do NOT need it — they're just re-exports / utilities.

**Files:**

- Callers that must keep working without changes: `src/app/publish/page.tsx`, `src/app/coverage/page.tsx`, `src/app/schedule/delete-cycle-action.test.ts`, `src/app/schedule/preliminary-actions.test.ts`

### Task 3.1: Create shared helpers module

- [ ] **Step 1: Create `src/app/schedule/actions/helpers.ts`**

This file holds all private helpers currently at the top of `actions.ts` that are shared across multiple action files. No `'use server'` here — these are plain utilities:

```ts
// src/app/schedule/actions/helpers.ts
// Private helpers shared across schedule action modules. No 'use server' — not server actions.

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { parseRole } from '@/lib/auth/roles'
import {
  MAX_WORK_DAYS_PER_WEEK,
  getDefaultWeeklyLimitForEmploymentType,
  sanitizeWeeklyLimit,
} from '@/lib/scheduling-constants'
import { fetchActiveOperationalCodeMap } from '@/lib/operational-codes'
import { buildScheduleUrl, coverageSlotKey, countsTowardWeeklyLimit } from '@/lib/schedule-helpers'
import { MIN_SHIFT_COVERAGE_PER_DAY } from '@/lib/scheduling-constants'
import type { ShiftStatus } from '@/app/schedule/types'

export async function getRoleForUser(userId: string) {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()
  return parseRole(profile?.role)
}

export type TherapistWeeklyLimitProfile = {
  max_work_days_per_week: number | null
  employment_type: string | null
}

export function getWeeklyLimitFromProfile(
  profile: TherapistWeeklyLimitProfile | null | undefined
): number {
  const employmentDefault = getDefaultWeeklyLimitForEmploymentType(profile?.employment_type)
  return sanitizeWeeklyLimit(profile?.max_work_days_per_week, employmentDefault)
}

export async function getTherapistWeeklyLimit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  therapistId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('profiles')
    .select('max_work_days_per_week, employment_type')
    .eq('id', therapistId)
    .maybeSingle()
  if (error) return MAX_WORK_DAYS_PER_WEEK
  return getWeeklyLimitFromProfile((data ?? null) as TherapistWeeklyLimitProfile | null)
}

export async function countWorkingScheduledForSlot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  slotRows: Array<{ id: string }>
): Promise<number> {
  const activeOperationalCodesByShiftId = await fetchActiveOperationalCodeMap(
    supabase,
    slotRows.map((row) => row.id)
  )
  return slotRows.filter((row) => !activeOperationalCodesByShiftId.has(row.id)).length
}

export function buildCoverageUrl(
  cycleId?: string,
  params?: Record<string, string | undefined>
): string {
  const search = new URLSearchParams()
  if (cycleId) search.set('cycle', cycleId)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value) search.set(key, value)
    }
  }
  const query = search.toString()
  return query.length > 0 ? `/coverage?${query}` : '/coverage'
}

export function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export function getPanelParam(formData: FormData): 'setup' | 'new-cycle' | 'add-shift' | undefined {
  const panel = String(formData.get('panel') ?? '').trim()
  if (panel === 'setup' || panel === 'new-cycle' || panel === 'add-shift')
    return panel as 'setup' | 'new-cycle' | 'add-shift'
  return undefined
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors (the file isn't imported yet, but it must be valid TypeScript).

### Task 3.2: Create `preliminary-actions.ts`

- [ ] **Step 3: Create `src/app/schedule/actions/preliminary-actions.ts`**

Move `sendPreliminaryScheduleAction` (lines 221–392 of the current `actions.ts`) into this file. Copy all imports it needs from the top of `actions.ts`. Add `'use server'` at the top:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { can } from '@/lib/auth/can'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPreliminarySnapshot } from '@/lib/preliminary-schedule/mutations'
import { buildDateRange, coverageSlotKey, countsTowardWeeklyLimit } from '@/lib/schedule-helpers'
import { MIN_SHIFT_COVERAGE_PER_DAY } from '@/lib/scheduling-constants'
import type {
  PreliminaryShiftLookupRow,
  PreliminaryShiftInsertRow,
  ShiftRole,
  ShiftStatus,
} from '@/app/schedule/types'
import { getRoleForUser, buildCoverageUrl } from './helpers'

// [paste sendPreliminaryScheduleAction + buildPreliminaryOpenShiftRows here]
```

- [ ] **Step 4: Create `src/app/schedule/actions/cycle-actions.ts`**

Move `createCycleAction` (lines 487–691) and `deleteCycleAction` (lines 393–485):

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { can } from '@/lib/auth/can'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getRoleForUser, buildCoverageUrl, getPanelParam } from './helpers'

// [paste createCycleAction and deleteCycleAction here]
```

- [ ] **Step 5: Create `src/app/schedule/actions/publish-actions.ts`**

Move `toggleCyclePublishedAction` (lines 692–1083):

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { can } from '@/lib/auth/can'
import { createClient } from '@/lib/supabase/server'
import { getPublishEmailConfig } from '@/lib/publish-events'
import { notifyUsers } from '@/lib/notifications'
import { buildScheduleUrl } from '@/lib/schedule-helpers'
import { getRoleForUser, buildCoverageUrl } from './helpers'

// [paste toggleCyclePublishedAction here]
```

- [ ] **Step 6: Create `src/app/schedule/actions/shift-actions.ts`**

Move `addShiftAction` (lines 1084–1249), `deleteShiftAction` (lines 1932–2002), and `setDesignatedLeadAction` (lines 2003–end):

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { can } from '@/lib/auth/can'
import { createClient } from '@/lib/supabase/server'
import { writeAuditLog } from '@/lib/audit-log'
import {
  notifyPublishedShiftAdded,
  notifyPublishedShiftRemoved,
} from '@/lib/published-schedule-notifications'
import { setDesignatedLeadMutation } from '@/lib/set-designated-lead'
import {
  buildScheduleUrl,
  coverageSlotKey,
  countsTowardWeeklyLimit,
  getWeekBoundsForDate,
} from '@/lib/schedule-helpers'
import { MAX_SHIFT_COVERAGE_PER_DAY } from '@/lib/scheduling-constants'
import type { ShiftRole, ShiftStatus, AssignmentStatus } from '@/app/schedule/types'
import {
  getRoleForUser,
  buildCoverageUrl,
  getOne,
  getPanelParam,
  getTherapistWeeklyLimit,
  countWorkingScheduledForSlot,
} from './helpers'

// [paste addShiftAction, deleteShiftAction, setDesignatedLeadAction here]
```

- [ ] **Step 7: Create `src/app/schedule/actions/draft-actions.ts`**

Move `generateDraftScheduleAction` (now lean after Fix 2) and `resetDraftScheduleAction` (lines 1861–1931):

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { can } from '@/lib/auth/can'
import { createClient } from '@/lib/supabase/server'
import { normalizeWorkPattern, shiftTypeMatches } from '@/lib/coverage/work-patterns'
import { insertAutoGeneratedShifts } from '@/lib/coverage/auto-generated-shifts'
import { setDesignatedLeadMutation } from '@/lib/set-designated-lead'
import { generateDraftForCycle } from '@/lib/coverage/generate-draft'
import { buildDateRange, buildScheduleUrl, getWeekBoundsForDate } from '@/lib/schedule-helpers'
import {
  sanitizeWeeklyLimit,
  getDefaultWeeklyLimitForEmploymentType,
  getWeeklyMinimumForEmploymentType,
} from '@/lib/scheduling-constants'
import type {
  AutoScheduleShiftRow,
  AvailabilityOverrideRow,
  ShiftLimitRow,
  Therapist,
} from '@/app/schedule/types'
import { getRoleForUser, buildCoverageUrl } from './helpers'

// [paste generateDraftScheduleAction and resetDraftScheduleAction here]
```

### Task 3.3: Create the barrel and update `actions.ts`

- [ ] **Step 8: Create `src/app/schedule/actions/index.ts`**

```ts
// Re-export all public schedule server actions. No 'use server' needed here.
export * from './preliminary-actions'
export * from './cycle-actions'
export * from './publish-actions'
export * from './shift-actions'
export * from './draft-actions'
```

- [ ] **Step 9: Replace the body of `src/app/schedule/actions.ts`**

The original file becomes a one-line barrel so existing callers (`src/app/publish/page.tsx`, `src/app/coverage/page.tsx`, the two test files) continue to work without changes:

```ts
export * from './actions/index'
```

Remove the `'use server'` directive from the top. This is safe because Next.js treats `'use server'` as a per-file directive — the directive in each individual action file (`cycle-actions.ts`, `shift-actions.ts`, etc.) marks those functions as server actions at their source. A re-exporting barrel does not need its own `'use server'` for the re-exported functions to remain server actions.

### Task 3.4: Verify

- [ ] **Step 10: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 11: Run the full test suite**

```bash
npx vitest run
```

Expected: 415+ tests pass, 0 failures.

- [ ] **Step 12: Lint the new files**

```bash
npm run lint -- src/app/schedule/actions/
```

Expected: no errors.

- [ ] **Step 13: Commit**

```bash
git add src/app/schedule/actions/ src/app/schedule/actions.ts
git commit -m "refactor: split actions.ts into per-responsibility modules under src/app/schedule/actions/"
```

---

## Final Verification

- [ ] **Run full suite one more time**

```bash
npx tsc --noEmit && npm run lint && npx vitest run
```

Expected: 0 TypeScript errors, 0 lint errors, 415+ tests passing.

- [ ] **Confirm callers still import cleanly** — spot-check that `src/app/coverage/page.tsx` and `src/app/publish/page.tsx` compile without import errors.
