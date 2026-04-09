# Copy Availability From Previous Cycle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a manager copy one therapist's manager-entered availability overrides from a previous cycle into the current cycle, with dates automatically shifted forward — eliminating manual re-entry for rotating-shift workers every 6-week block.

**Architecture:** A pure date-shifting function lives in a new `src/lib/copy-cycle-availability.ts` file and is fully unit-tested in isolation. A new server action `copyAvailabilityFromPreviousCycleAction` appended to `src/app/availability/actions.ts` loads the source data, calls the pure function, and upserts only non-conflicting rows. A "Copy from last block" button is added to `ManagerSchedulingInputs` between the therapist info card (line 284) and the planner-mode toggle (line 286).

**Tech Stack:** Next.js App Router server actions, Supabase Postgres, Vitest, TypeScript, React

---

## File Map

| File                                                      | Status     | Responsibility                                                                     |
| --------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------- |
| `src/lib/copy-cycle-availability.ts`                      | **Create** | Pure function: shift override dates from one cycle to another                      |
| `src/lib/copy-cycle-availability.test.ts`                 | **Create** | Unit tests for the pure function (no DB, no mocks)                                 |
| `src/app/availability/actions.ts`                         | **Modify** | Append `copyAvailabilityFromPreviousCycleAction` after the last export (~line 517) |
| `src/app/availability/actions.test.ts`                    | **Modify** | Append a new `describe` block; extend the mock builder                             |
| `src/app/availability/page.tsx`                           | **Modify** | Add `copied` to search-params type; import + pass new action; add toast cases      |
| `src/components/availability/ManagerSchedulingInputs.tsx` | **Modify** | Add prop + "Copy from last block" button between lines 284–286                     |

---

## Task 1: Pure date-shifting function

**Files:**

- Create: `src/lib/copy-cycle-availability.ts`
- Create: `src/lib/copy-cycle-availability.test.ts`

### What this function does

Given overrides from a source cycle and two cycle date ranges, it shifts every date forward by `targetCycleStart − sourceCycleStart` days. Rows outside the target range or already present in the target cycle are excluded.

```
sourceCycleStart = "2026-02-08"   targetCycleStart = "2026-03-22"
gap = 42 days

source row date "2026-02-11" (Wed) → shifted "2026-03-25" (also Wed) ✓
source row date "2026-03-20"       → shifted "2026-05-01" ✓ within range
```

- [ ] **Step 1: Write the failing tests**

Create `src/lib/copy-cycle-availability.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { shiftOverridesToCycle, type SourceOverride } from '@/lib/copy-cycle-availability'

const BASE: SourceOverride = {
  date: '2026-02-11',
  override_type: 'force_on',
  shift_type: 'both',
  note: null,
}

const PARAMS = {
  sourceCycleStart: '2026-02-08',
  targetCycleStart: '2026-03-22',
  targetCycleEnd: '2026-05-02',
  existingTargetDates: new Set<string>(),
}

describe('shiftOverridesToCycle', () => {
  it('shifts dates forward by the gap between cycle starts', () => {
    const result = shiftOverridesToCycle({
      ...PARAMS,
      sourceOverrides: [{ ...BASE, date: '2026-02-11' }],
    })
    // gap = 42 days; 2026-02-11 + 42 = 2026-03-25
    expect(result).toHaveLength(1)
    expect(result[0].date).toBe('2026-03-25')
  })

  it('preserves override_type, shift_type, and note', () => {
    const result = shiftOverridesToCycle({
      ...PARAMS,
      sourceOverrides: [
        { date: '2026-02-12', override_type: 'force_off', shift_type: 'day', note: 'Family event' },
      ],
    })
    expect(result[0]).toMatchObject({
      date: '2026-03-26',
      override_type: 'force_off',
      shift_type: 'day',
      note: 'Family event',
    })
  })

  it('excludes dates that fall outside the target cycle range', () => {
    // 2026-03-21 + 42 = 2026-05-02 — exactly on end date, included
    const onEnd = shiftOverridesToCycle({
      ...PARAMS,
      sourceOverrides: [{ ...BASE, date: '2026-03-21' }],
    })
    expect(onEnd[0].date).toBe('2026-05-02')

    // 2026-03-22 + 42 = 2026-05-03 — one day past end, excluded
    const pastEnd = shiftOverridesToCycle({
      ...PARAMS,
      sourceOverrides: [{ ...BASE, date: '2026-03-22' }],
    })
    expect(pastEnd).toHaveLength(0)
  })

  it('skips dates that already exist in the target cycle', () => {
    const result = shiftOverridesToCycle({
      ...PARAMS,
      sourceOverrides: [{ ...BASE, date: '2026-02-11' }],
      existingTargetDates: new Set(['2026-03-25']), // shifted date already taken
    })
    expect(result).toHaveLength(0)
  })

  it('returns empty when source list is empty', () => {
    expect(shiftOverridesToCycle({ ...PARAMS, sourceOverrides: [] })).toEqual([])
  })

  it('handles a zero-day gap (same cycle start) by passing dates through', () => {
    const result = shiftOverridesToCycle({
      ...PARAMS,
      sourceCycleStart: '2026-03-22',
      targetCycleStart: '2026-03-22',
      sourceOverrides: [{ ...BASE, date: '2026-03-25' }],
    })
    expect(result[0].date).toBe('2026-03-25')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/lib/copy-cycle-availability.test.ts
```

Expected: FAIL — `cannot find module '@/lib/copy-cycle-availability'`

- [ ] **Step 3: Implement the pure function**

Create `src/lib/copy-cycle-availability.ts`:

```typescript
export type SourceOverride = {
  date: string
  override_type: 'force_on' | 'force_off'
  shift_type: 'day' | 'night' | 'both'
  note: string | null
}

export type ShiftedOverride = SourceOverride

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00Z`)
  const b = new Date(`${to}T00:00:00Z`)
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

export function shiftOverridesToCycle(params: {
  sourceOverrides: SourceOverride[]
  sourceCycleStart: string
  targetCycleStart: string
  targetCycleEnd: string
  existingTargetDates: Set<string>
}): ShiftedOverride[] {
  const {
    sourceOverrides,
    sourceCycleStart,
    targetCycleStart,
    targetCycleEnd,
    existingTargetDates,
  } = params
  const gap = daysBetween(sourceCycleStart, targetCycleStart)

  return sourceOverrides.reduce<ShiftedOverride[]>((acc, row) => {
    const shifted = addDays(row.date, gap)
    if (shifted < targetCycleStart || shifted > targetCycleEnd) return acc
    if (existingTargetDates.has(shifted)) return acc
    acc.push({ ...row, date: shifted })
    return acc
  }, [])
}
```

- [ ] **Step 4: Run tests — all should pass**

```bash
npx vitest run src/lib/copy-cycle-availability.test.ts
```

Expected: 6 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/copy-cycle-availability.ts src/lib/copy-cycle-availability.test.ts
git commit -m "feat: add pure shiftOverridesToCycle function for copy-cycle availability"
```

---

## Task 2: Server action

**Files:**

- Modify: `src/app/availability/actions.ts` — append after the last export (currently `deleteManagerPlannerDateAction`, ends ~line 517)
- Modify: `src/app/availability/actions.test.ts` — extend mock builder; append new describe block

### Mock builder extension (critical prerequisite)

The existing `createSupabaseMock` builder (lines 62–161 of `actions.test.ts`) has no `neq`, `order`, or `limit` methods, and its `then()` handler only returns data for one specific select shape (`'id, date'`). The new action makes 3 distinct `.select()` calls. Before writing the new tests, extend the mock builder.

**In `createSupabaseMock`, inside the `builder` object, add these three chainable no-ops right after the `eq` method:**

```typescript
neq(_column: string, _value: unknown) {
  return builder
},
order(_column: string, _options?: unknown) {
  return builder
},
limit(_count: number) {
  return builder
},
```

**Replace the existing `then` handler** with one that handles all three select shapes the new action uses:

```typescript
then(resolve: (value: unknown) => unknown) {
  // existing shape — existingRows query in saveManagerPlannerDatesAction
  if (table === 'availability_overrides' && selected.includes('id, date')) {
    return Promise.resolve(resolve({ data: state.selectRows, error: null }))
  }
  // new shape 1 — source cycle lookup (neq + order + limit chain)
  if (table === 'availability_overrides' && selected.includes('cycle_id')) {
    return Promise.resolve(resolve({ data: state.sourceCycleRows ?? null, error: null }))
  }
  // new shape 2 — source overrides fetch
  if (table === 'availability_overrides' && selected.includes('date, override_type')) {
    return Promise.resolve(resolve({ data: state.sourceOverrideRows ?? null, error: null }))
  }
  // new shape 3 — existing target dates fetch
  if (table === 'availability_overrides' && selected.includes('date') && !selected.includes('override_type')) {
    return Promise.resolve(resolve({ data: state.existingTargetRows ?? null, error: null }))
  }
  return Promise.resolve(resolve({ data: null, error: null }))
},
```

Also add these three new fields to the `state` object at the top of `createSupabaseMock`:

```typescript
const state = {
  upsertPayloads: [] as Array<Record<string, unknown> | Array<Record<string, unknown>>>,
  inserts: [] as Array<{ table: string; payload: Record<string, unknown> }>,
  updates: [] as Array<{
    table: string
    payload: Record<string, unknown>
    filters: Record<string, unknown>
  }>,
  deletes: [] as Array<{ table: string; filters: Record<string, unknown> }>,
  selectRows: [] as Array<Record<string, unknown>>,
  // new fields for copy action tests:
  sourceCycleRows: null as Array<Record<string, unknown>> | null,
  sourceOverrideRows: null as Array<Record<string, unknown>> | null,
  existingTargetRows: null as Array<Record<string, unknown>> | null,
}
```

- [ ] **Step 1: Extend the mock as described above**

Edit `src/app/availability/actions.test.ts` to apply the three changes:

1. Add `sourceCycleRows`, `sourceOverrideRows`, `existingTargetRows` to `state`
2. Add `neq`, `order`, `limit` to `builder`
3. Replace `then()` with the expanded version above

- [ ] **Step 2: Confirm existing tests still pass**

```bash
npx vitest run src/app/availability/actions.test.ts
```

Expected: all existing tests still pass (mock extension is backward-compatible because the fallback `return Promise.resolve(resolve({ data: null, error: null }))` is unchanged for unmatched shapes)

- [ ] **Step 3: Write failing tests for the new action**

Append to the import list at the top of `actions.test.ts`:

```typescript
import {
  copyAvailabilityFromPreviousCycleAction,
  // ... existing imports
} from '@/app/availability/actions'
```

Append this describe block after all existing ones:

```typescript
describe('copyAvailabilityFromPreviousCycleAction', () => {
  function makeCopyFormData() {
    const formData = new FormData()
    formData.set('cycle_id', 'cycle-new')
    formData.set('therapist_id', 'therapist-1')
    return formData
  }

  it('redirects to /availability when called by a non-manager', async () => {
    const mock = createSupabaseMock({ userId: 'therapist-1', role: 'therapist' })
    createClientMock.mockResolvedValue(mock)

    await expect(copyAvailabilityFromPreviousCycleAction(makeCopyFormData())).rejects.toThrow(
      'REDIRECT:/availability'
    )
  })

  it('redirects with copy_no_source when no previous cycle has overrides', async () => {
    const mock = createSupabaseMock({ userId: 'mgr-1', role: 'manager' })
    // sourceCycleRows = null → action hits errorUrl
    mock.state.sourceCycleRows = null
    createClientMock.mockResolvedValue(mock)

    await expect(copyAvailabilityFromPreviousCycleAction(makeCopyFormData())).rejects.toThrow(
      'REDIRECT:/availability?error=copy_no_source&cycle=cycle-new&therapist=therapist-1'
    )
  })

  it('redirects with copy_no_source when source cycle has no overrides', async () => {
    const mock = createSupabaseMock({ userId: 'mgr-1', role: 'manager' })
    mock.state.sourceCycleRows = [
      {
        cycle_id: 'cycle-old',
        schedule_cycles: { start_date: '2026-02-08', end_date: '2026-03-21' },
      },
    ]
    mock.state.sourceOverrideRows = [] // no overrides in source cycle
    createClientMock.mockResolvedValue(mock)

    await expect(copyAvailabilityFromPreviousCycleAction(makeCopyFormData())).rejects.toThrow(
      'REDIRECT:/availability?error=copy_no_source&cycle=cycle-new&therapist=therapist-1'
    )
  })

  it('upserts shifted overrides and redirects with copy_success', async () => {
    const mock = createSupabaseMock({ userId: 'mgr-1', role: 'manager' })
    // Source cycle runs Feb 8 – Mar 21; target (from maybeSingle) is Mar 22 – May 2 (42-day gap)
    mock.state.sourceCycleRows = [
      {
        cycle_id: 'cycle-old',
        schedule_cycles: { start_date: '2026-02-08', end_date: '2026-03-21' },
      },
    ]
    mock.state.sourceOverrideRows = [
      { date: '2026-02-11', override_type: 'force_on', shift_type: 'both', note: null },
      { date: '2026-02-13', override_type: 'force_off', shift_type: 'both', note: 'event' },
    ]
    mock.state.existingTargetRows = [] // nothing yet in current cycle
    createClientMock.mockResolvedValue(mock)

    await expect(copyAvailabilityFromPreviousCycleAction(makeCopyFormData())).rejects.toThrow(
      'REDIRECT:/availability?cycle=cycle-new&therapist=therapist-1&success=copy_success&copied=2'
    )

    // Verify the upsert payload has shifted dates (+42 days)
    expect(mock.state.upsertPayloads).toHaveLength(1)
    const payload = mock.state.upsertPayloads[0] as Array<Record<string, unknown>>
    expect(payload).toHaveLength(2)
    expect(payload[0].date).toBe('2026-03-25') // 2026-02-11 + 42
    expect(payload[1].date).toBe('2026-03-27') // 2026-02-13 + 42
  })

  it('redirects with copy_nothing_new when all shifted dates already exist in target', async () => {
    const mock = createSupabaseMock({ userId: 'mgr-1', role: 'manager' })
    mock.state.sourceCycleRows = [
      {
        cycle_id: 'cycle-old',
        schedule_cycles: { start_date: '2026-02-08', end_date: '2026-03-21' },
      },
    ]
    mock.state.sourceOverrideRows = [
      { date: '2026-02-11', override_type: 'force_on', shift_type: 'both', note: null },
    ]
    mock.state.existingTargetRows = [{ date: '2026-03-25' }] // shifted date already there
    createClientMock.mockResolvedValue(mock)

    await expect(copyAvailabilityFromPreviousCycleAction(makeCopyFormData())).rejects.toThrow(
      'REDIRECT:/availability?cycle=cycle-new&therapist=therapist-1&error=copy_nothing_new'
    )
  })
})
```

- [ ] **Step 4: Run tests to confirm they fail**

```bash
npx vitest run src/app/availability/actions.test.ts
```

Expected: 5 new tests all FAIL — `copyAvailabilityFromPreviousCycleAction is not exported`

- [ ] **Step 5: Implement the server action**

Append to `src/app/availability/actions.ts` after the final closing brace (~line 517):

```typescript
export async function copyAvailabilityFromPreviousCycleAction(formData: FormData) {
  const { supabase, user, role } = await getAuthenticatedUserWithRole()

  if (!can(role, 'access_manager_ui')) {
    redirect('/availability')
  }

  const cycleId = String(formData.get('cycle_id') ?? '').trim()
  const therapistId = String(formData.get('therapist_id') ?? '').trim()

  if (!cycleId || !therapistId) {
    redirect('/availability')
  }

  const errorUrl = buildAvailabilityUrl({
    cycle: cycleId,
    therapist: therapistId,
    error: 'copy_no_source',
  })

  // 1. Load target cycle date range
  const { data: targetCycle } = await supabase
    .from('schedule_cycles')
    .select('start_date, end_date')
    .eq('id', cycleId)
    .maybeSingle()

  if (!targetCycle) redirect(errorUrl)

  // 2. Find the most recent other cycle with manager overrides for this therapist
  const { data: sourceCycleRows } = await supabase
    .from('availability_overrides')
    .select('cycle_id, schedule_cycles(start_date, end_date)')
    .eq('therapist_id', therapistId)
    .eq('source', 'manager')
    .neq('cycle_id', cycleId)
    .order('created_at', { ascending: false })
    .limit(1)

  const sourceRow = (sourceCycleRows ?? [])[0] as
    | { cycle_id: string; schedule_cycles: { start_date: string; end_date: string } | null }
    | undefined

  if (!sourceRow?.schedule_cycles) redirect(errorUrl)

  // 3. Load all manager overrides from the source cycle
  const { data: sourceOverrides } = await supabase
    .from('availability_overrides')
    .select('date, override_type, shift_type, note')
    .eq('cycle_id', sourceRow.cycle_id)
    .eq('therapist_id', therapistId)
    .eq('source', 'manager')

  if (!sourceOverrides || sourceOverrides.length === 0) redirect(errorUrl)

  // 4. Load dates already in target cycle to avoid overwriting
  const { data: existingRows } = await supabase
    .from('availability_overrides')
    .select('date')
    .eq('cycle_id', cycleId)
    .eq('therapist_id', therapistId)
    .eq('source', 'manager')

  const existingTargetDates = new Set((existingRows ?? []).map((r) => String(r.date)))

  // 5. Shift dates forward
  const { shiftOverridesToCycle } = await import('@/lib/copy-cycle-availability')

  const shifted = shiftOverridesToCycle({
    sourceOverrides: sourceOverrides.map((r) => ({
      date: String(r.date),
      override_type: r.override_type as 'force_on' | 'force_off',
      shift_type: (r.shift_type ?? 'both') as 'day' | 'night' | 'both',
      note: r.note ?? null,
    })),
    sourceCycleStart: sourceRow.schedule_cycles.start_date,
    targetCycleStart: targetCycle.start_date,
    targetCycleEnd: targetCycle.end_date,
    existingTargetDates,
  })

  if (shifted.length === 0) {
    redirect(
      buildAvailabilityUrl({
        cycle: cycleId,
        therapist: therapistId,
        error: 'copy_nothing_new',
      })
    )
  }

  // 6. Upsert shifted rows
  const payload = shifted.map((row) => ({
    therapist_id: therapistId,
    cycle_id: cycleId,
    date: row.date,
    shift_type: row.shift_type,
    override_type: row.override_type,
    note: row.note,
    created_by: user.id,
    source: 'manager' as const,
  }))

  const { error: upsertError } = await supabase
    .from('availability_overrides')
    .upsert(payload, { onConflict: 'cycle_id,therapist_id,date,shift_type' })

  if (upsertError) {
    console.error('Failed to copy availability overrides:', upsertError)
    redirect(buildAvailabilityUrl({ cycle: cycleId, therapist: therapistId, error: 'copy_failed' }))
  }

  revalidatePath('/availability')
  redirect(
    buildAvailabilityUrl({
      cycle: cycleId,
      therapist: therapistId,
      success: 'copy_success',
      copied: String(shifted.length),
    })
  )
}
```

- [ ] **Step 6: Run all availability action tests**

```bash
npx vitest run src/app/availability/actions.test.ts
```

Expected: all tests pass (new 5 + all existing)

- [ ] **Step 7: Commit**

```bash
git add src/app/availability/actions.ts src/app/availability/actions.test.ts
git commit -m "feat: add copyAvailabilityFromPreviousCycleAction server action"
```

---

## Task 3: UI button in ManagerSchedulingInputs

**Files:**

- Modify: `src/components/availability/ManagerSchedulingInputs.tsx`

The button goes between the therapist info card closing tag (line 284 `</div>`) and the planner-mode section opening tag (line 286 `<div className="space-y-2">`).

- [ ] **Step 1: Add the new prop to the `Props` type** (top of file, ~line 44)

```typescript
type Props = {
  cycles: Cycle[]
  therapists: TherapistOption[]
  overrides: PlannerOverrideRecord[]
  initialCycleId: string
  initialTherapistId: string
  submittedRows: AvailabilityStatusSummaryRow[]
  missingRows: AvailabilityStatusSummaryRow[]
  saveManagerPlannerDatesAction: (formData: FormData) => void | Promise<void>
  deleteManagerPlannerDateAction: (formData: FormData) => void | Promise<void>
  copyAvailabilityFromPreviousCycleAction: (formData: FormData) => void | Promise<void>
}
```

- [ ] **Step 2: Destructure the new prop**

```typescript
export function ManagerSchedulingInputs({
  cycles,
  therapists,
  overrides,
  initialCycleId,
  initialTherapistId,
  submittedRows,
  missingRows,
  saveManagerPlannerDatesAction,
  deleteManagerPlannerDateAction,
  copyAvailabilityFromPreviousCycleAction,
}: Props) {
```

- [ ] **Step 3: Insert the button between lines 284 and 286**

Find the exact anchor — the therapist info card closing `</div>` followed by `null}` followed by the planner-mode `<div>`:

```tsx
            ) : null}

            {/* ── Copy from last block ── */}
            {selectedCycleId && selectedTherapistId && (
              <form action={copyAvailabilityFromPreviousCycleAction}>
                <input type="hidden" name="cycle_id"     value={selectedCycleId} />
                <input type="hidden" name="therapist_id" value={selectedTherapistId} />
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3.5 w-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                  </svg>
                  Copy from last block
                </button>
              </form>
            )}

            <div className="space-y-2">
```

- [ ] **Step 4: Run tsc**

```bash
npx tsc --noEmit
```

Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add src/components/availability/ManagerSchedulingInputs.tsx
git commit -m "feat: add Copy from last block button to manager scheduling inputs"
```

---

## Task 4: Wire to the availability page

**Files:**

- Modify: `src/app/availability/page.tsx`

Two changes in order — the type extension must come before the `params?.copied` reference.

- [ ] **Step 1: Add `copied` to `AvailabilityPageSearchParams`** (~line 75)

```typescript
type AvailabilityPageSearchParams = {
  cycle?: string | string[]
  error?: string | string[]
  success?: string | string[]
  search?: string | string[]
  therapist?: string | string[]
  copied?: string | string[] // ← add this
}
```

- [ ] **Step 2: Import the new action**

Find the existing import from `'@/app/availability/actions'` and add `copyAvailabilityFromPreviousCycleAction` to the list.

- [ ] **Step 3: Add feedback cases to the page's toast handler**

Find the function that maps success/error params to toast messages — look for the string `'entry_submitted'` as an anchor. Add these cases:

```typescript
// --- copy availability cases ---
if (success === 'copy_success') {
  const count = getSearchParam(params?.copied)
  return {
    message: count
      ? `${count} date${Number(count) === 1 ? '' : 's'} copied from the previous block.`
      : 'Availability copied from the previous block.',
    variant: 'success' as const,
  }
}
if (error === 'copy_no_source') {
  return {
    message: 'No previous block found with saved dates for this therapist.',
    variant: 'error' as const,
  }
}
if (error === 'copy_nothing_new') {
  return {
    message: 'All dates from the previous block are already planned for this cycle.',
    variant: 'error' as const,
  }
}
if (error === 'copy_failed') {
  return { message: 'Could not copy dates. Please try again.', variant: 'error' as const }
}
```

- [ ] **Step 4: Pass the new action to `<ManagerSchedulingInputs>`**

Find the `<ManagerSchedulingInputs` JSX block and add:

```tsx
<ManagerSchedulingInputs
  {/* ... existing props unchanged ... */}
  copyAvailabilityFromPreviousCycleAction={copyAvailabilityFromPreviousCycleAction}
/>
```

- [ ] **Step 5: Run tsc and full test suite**

```bash
npx tsc --noEmit
npx vitest run
```

Expected: tsc exit 0, all tests pass

- [ ] **Step 6: Final commit**

```bash
git add src/app/availability/page.tsx
git commit -m "feat: wire copy-cycle availability to availability page and add feedback toasts"
```

---

## Verification Checklist

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npx vitest run` — all tests pass (6 new in `copy-cycle-availability.test.ts`, 5 new in `actions.test.ts`)
- [ ] "Copy from last block" button appears between therapist info card and mode toggle in `/availability`
- [ ] Clicking it for a therapist with no previous manager-entered data shows "No previous block found" toast
- [ ] Clicking it for a therapist with previous data copies dates and shows "N dates copied" toast
- [ ] Clicking it again when all dates already exist shows "All dates already planned" toast
- [ ] Existing save/delete flows in the planner are unaffected

---

## Key Design Notes

**Why the pure function lives in its own file:** The date-shifting logic has edge cases (date exactly on cycle end, zero-gap copy, existing conflicts). Isolating it as a pure function lets all 6 edge cases be tested without any database mocking.

**Why "append only" (skip existing dates):** Overwriting existing manager overrides would silently destroy current-cycle planning work. Skipping conflicts is safer — the manager can manually adjust after copying.

**Why the most recent cycle with data (not the immediately preceding cycle):** A therapist might have been on FMLA for an entire cycle, leaving it empty. "Most recent with data" ensures the copy always finds something useful.

**Why Tannie's rotation works correctly:** Her 4+1+2+7 = 14-day rotation and 6-week (42-day) cycles are both multiples of 14, so shifting by exactly 42 days always lands on the same rotation-phase day. No special rotation logic needed.
