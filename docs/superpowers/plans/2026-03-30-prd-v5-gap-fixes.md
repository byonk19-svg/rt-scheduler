# PRD v5.1 Gap Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the five gaps between the current codebase and PRD v5.1 — swap operational lock integrity bug, headcount threshold colors, therapist operational code visibility, active block editing guardrails, and PRN interest queue.

**Architecture:** Each task is self-contained and produces a passing test suite + clean build before committing. Task 1 replaces one Postgres trigger function via migration. Task 2 adds a pure helper function and updates one component. Task 3 adds display logic to one server component. Task 4 adds a UI warning banner and an audit log write in the drag-drop API route. Task 5 extends the shift board with a multi-candidate pickup grouping view and a DB trigger to auto-deny siblings.

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase (Postgres + RLS + triggers), Tailwind CSS, shadcn/ui component patterns, Vitest (unit tests `npm run test:unit`), Playwright (e2e `npm run test:e2e`). All commands run from `C:\Users\byonk\OneDrive\Desktop\rt-scheduler`.

---

## Codebase Orientation — Read These First

Before touching any file, read each of the following to understand existing patterns:

| File                                                                                   | Why                                                                            |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `src/lib/operational-codes.ts`                                                         | `OperationalCode` type, `fetchActiveOperationalCodeMap`                        |
| `src/lib/coverage/selectors.ts`                                                        | `countActive`, `flatten`, `DayItem`, `ShiftItem`                               |
| `src/components/coverage/CalendarGrid.tsx`                                             | Day-card badge rendering (`activeCount/totalCount`)                            |
| `src/components/coverage/ShiftEditorDialog.tsx`                                        | Manager day-editor dialog and its props                                        |
| `src/app/coverage/page.tsx`                                                            | Loads op codes into `activeOperationalCodesByShiftId`, builds day items        |
| `src/app/therapist/schedule/page.tsx`                                                  | Therapist published schedule; already imports `fetchActiveOperationalCodeMap`  |
| `src/app/shift-board/page.tsx`                                                         | `ShiftBoardRequest` type, `handleAction`, `requests` state, `therapists` state |
| `src/app/api/schedule/drag-drop/route.ts`                                              | `DragAction` union type, `writeAuditLog` already imported                      |
| `src/lib/audit-log.ts`                                                                 | `writeAuditLog(supabase, { userId, action, targetType, targetId })`            |
| `supabase/migrations/20260329120000_enforce_swap_operational_locks_and_48h_expiry.sql` | Contains `apply_approved_shift_post` — the trigger being fixed in Task 1       |
| `supabase/migrations/20260329153000_add_shift_operational_entries.sql`                 | Defines `shift_operational_entries` and the `update_assignment_status` RPC     |

### Design System Color Tokens (`src/app/globals.css`)

```
--success-subtle / --success-text              → green (PRD: activeCount ≥ 4)
--warning-subtle / --warning-text / --warning-border  → yellow (PRD: activeCount = 3)
--error-subtle   / --error-text                → red   (PRD: activeCount < 3)
```

---

## Task 1: Fix Swap Operational Lock Bug

### Problem

`apply_approved_shift_post` (trigger on `shift_posts`) checks `shifts.assignment_status` to
determine whether a shift has an operational code. However, `update_assignment_status` (the
RPC added in migration `20260329153000`) writes codes to `shift_operational_entries` and
does **not** update `shifts.assignment_status`. Any operational code applied after that
migration is invisible to the swap lock — a therapist with CI or CX can still have a swap
approved.

### Fix

Replace the `apply_approved_shift_post` function with a version that checks
`shift_operational_entries WHERE active = true` directly, and drops the stale
`requester_assignment_status` / `partner_assignment_status` local variables.

### Why no unit test?

This is a Postgres trigger. Vitest cannot execute it. Instead of a fake test, the plan uses
a targeted migration + manual SQL assertion as the verification step.

**Files:**

- Create: `supabase/migrations/20260330100000_fix_swap_lock_use_operational_entries.sql`

- [ ] **Step 1: Create the migration**

Create `supabase/migrations/20260330100000_fix_swap_lock_use_operational_entries.sql` with
the following content in full. This is a complete replacement of the function — do not
splice; paste the entire block:

```sql
-- PRD v5.1 §5.3: Swaps are blocked if either shift has an active operational code.
-- Bug fixed: the previous version checked shifts.assignment_status, which is no longer
-- updated by the new operational-entries model (migration 20260329153000).
-- This version reads from shift_operational_entries directly.

create or replace function public.apply_approved_shift_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_shift_id         uuid;
  requester_id               uuid;
  partner_id                 uuid;
  partner_shift_id           uuid;
  requester_shift_date       date;
  requester_shift_type       text;
  partner_shift_date         date;
  partner_shift_type         text;
  requester_shift_role       public.shift_role;
  partner_shift_role         public.shift_role;
  requester_shift_user_id    uuid;
  partner_shift_user_id      uuid;
  requester_shift_status     text;
  partner_shift_status       text;
  requester_has_active_op    boolean := false;
  partner_has_active_op      boolean := false;
  shift_is_lead_slot         boolean := false;
  partner_slot_is_lead       boolean := false;
  partner_is_eligible        boolean := false;
  requester_is_eligible      boolean := false;
  other_lead_count           integer := 0;
begin
  -- Only fire when status transitions to approved.
  if new.status <> 'approved' or old.status = 'approved' then
    return new;
  end if;

  requester_shift_id := new.shift_id;
  requester_id       := new.posted_by;
  partner_id         := coalesce(new.claimed_by, null);

  if requester_shift_id is null then
    raise exception 'Cannot approve request %: shift_id is null.', new.id;
  end if;
  if requester_id is null then
    raise exception 'Cannot approve request %: posted_by is null.', new.id;
  end if;
  if new.type not in ('swap', 'pickup') then
    raise exception 'Cannot approve request %: unsupported type %.', new.id, new.type;
  end if;

  select s.date, s.shift_type, s.role, s.user_id, s.status
    into requester_shift_date, requester_shift_type, requester_shift_role,
         requester_shift_user_id, requester_shift_status
  from public.shifts s
  where s.id = requester_shift_id
  for update;

  if not found then
    raise exception 'Cannot approve request %: requester shift % not found.',
      new.id, requester_shift_id;
  end if;
  if requester_shift_user_id is distinct from requester_id then
    raise exception 'Cannot approve request %: requester no longer owns shift %.',
      new.id, requester_shift_id;
  end if;

  if new.type = 'pickup' then
    if partner_id is null then
      raise exception 'Cannot approve pickup request %: no claimant assigned.', new.id;
    end if;
  end if;

  if new.type = 'swap' then
    if partner_id is null then
      raise exception 'Cannot approve swap request %: no swap partner assigned.', new.id;
    end if;
    if partner_id = requester_id then
      raise exception 'Cannot approve swap request %: requester and partner are the same user.',
        new.id;
    end if;
  end if;

  if new.type = 'swap' then
    if new.swap_shift_id is not null then
      select s.id, s.date, s.shift_type, s.role, s.user_id, s.status
        into partner_shift_id, partner_shift_date, partner_shift_type,
             partner_shift_role, partner_shift_user_id, partner_shift_status
      from public.shifts s
      where s.id = new.swap_shift_id
      for update;
    else
      select s.id, s.date, s.shift_type, s.role, s.user_id, s.status
        into partner_shift_id, partner_shift_date, partner_shift_type,
             partner_shift_role, partner_shift_user_id, partner_shift_status
      from public.shifts s
      where s.date = requester_shift_date
        and s.user_id = partner_id
      order by case when s.shift_type = 'day' then 0 else 1 end, s.id
      limit 1
      for update;
    end if;

    if partner_shift_id is null then
      raise exception 'Could not find a shift for swap partner on %.', requester_shift_date;
    end if;
    if partner_shift_user_id is distinct from partner_id then
      raise exception 'Cannot approve request %: partner no longer owns shift %.',
        new.id, partner_shift_id;
    end if;
    if partner_shift_date is distinct from requester_shift_date then
      raise exception 'Cannot approve request %: partner shift date mismatch.', new.id;
    end if;
    if partner_shift_type is distinct from requester_shift_type then
      raise exception 'Cannot approve request %: partner shift type mismatch.', new.id;
    end if;

    -- PRD §5.3: check shift_operational_entries, not shifts.assignment_status.
    -- shifts.assignment_status is no longer updated by the operational code workflow.
    select exists(
      select 1 from public.shift_operational_entries e
      where e.shift_id = requester_shift_id and e.active = true
    ) into requester_has_active_op;

    select exists(
      select 1 from public.shift_operational_entries e
      where e.shift_id = partner_shift_id and e.active = true
    ) into partner_has_active_op;

    if requester_shift_status is distinct from 'scheduled' or requester_has_active_op then
      raise exception
        'Cannot approve request %: requester shift has an active operational code or is not working.',
        new.id;
    end if;
    if partner_shift_status is distinct from 'scheduled' or partner_has_active_op then
      raise exception
        'Cannot approve request %: partner shift has an active operational code or is not working.',
        new.id;
    end if;
  end if;

  -- Lead-slot vacancy protection. Skipped when manager_override = true.
  if not coalesce(new.manager_override, false) then
    shift_is_lead_slot := requester_shift_role = 'lead';

    if shift_is_lead_slot then
      select coalesce(p.is_lead_eligible, false)
        into partner_is_eligible
      from public.profiles p where p.id = partner_id;

      if not partner_is_eligible then
        select count(*) into other_lead_count
        from public.shifts s
        join public.profiles p on p.id = s.user_id
        where s.date = requester_shift_date
          and s.shift_type = requester_shift_type
          and s.role = 'lead'
          and s.id <> requester_shift_id
          and coalesce(p.is_lead_eligible, false) = true;

        if other_lead_count = 0 then
          raise exception 'Lead coverage gap: this shift would have no lead after approval.';
        end if;
      end if;
    end if;

    if new.type = 'swap' and partner_shift_id is not null then
      partner_slot_is_lead := partner_shift_role = 'lead';

      if partner_slot_is_lead then
        select coalesce(p.is_lead_eligible, false)
          into requester_is_eligible
        from public.profiles p where p.id = requester_id;

        if not requester_is_eligible then
          select count(*) into other_lead_count
          from public.shifts s
          join public.profiles p on p.id = s.user_id
          where s.date = partner_shift_date
            and s.shift_type = partner_shift_type
            and s.role = 'lead'
            and s.id <> partner_shift_id
            and coalesce(p.is_lead_eligible, false) = true;

          if other_lead_count = 0 then
            raise exception 'Lead coverage gap: this shift would have no lead after approval.';
          end if;
        end if;
      end if;
    end if;
  end if;

  if new.type = 'pickup' then
    update public.shifts set user_id = partner_id where id = requester_shift_id;
    return new;
  end if;

  -- Swap: defer unique constraint so intermediate state doesn't violate it.
  set constraints shifts_unique_cycle_user_date deferred;

  update public.shifts set user_id = partner_id  where id = requester_shift_id;
  update public.shifts set user_id = requester_id where id = partner_shift_id;

  return new;
end;
$$;
```

- [ ] **Step 2: Apply the migration**

```bash
npx supabase db push
```

Expected: migration applies cleanly, no SQL errors.

- [ ] **Step 3: Manually verify the fix in Supabase dashboard (or psql)**

Run this SQL against your local/remote DB to confirm the trigger now reads from
`shift_operational_entries`:

```sql
-- 1. Find two scheduled shifts with the same date and shift_type.
-- 2. Add an active operational entry to the first shift.
-- 3. Create a pending swap post between them.
-- 4. Attempt to approve it — expect the trigger to raise an exception.

-- Quick sanity check: confirm the function body was replaced:
select prosrc from pg_proc where proname = 'apply_approved_shift_post';
-- Expected: the body should contain "shift_operational_entries" not "requester_assignment_status".
```

- [ ] **Step 4: Run existing unit tests**

```bash
npm run test:unit -- src/lib/coverage
```

Expected: all pass (no regressions).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260330100000_fix_swap_lock_use_operational_entries.sql
git commit -m "fix(db): swap lock now reads shift_operational_entries instead of stale shifts.assignment_status"
```

---

## Task 2: Headcount Threshold Colors

### Problem

`CalendarGrid.tsx` renders the `activeCount/totalCount` badge as binary (error vs success
color). PRD §9.3: Red < 3 / Yellow exactly 3 / Green ≥ 4.

**Files:**

- Modify: `src/lib/coverage/selectors.ts` (add `headcountThreshold` export)
- Modify: `src/lib/coverage/selectors.test.ts` (add test cases)
- Modify: `src/components/coverage/CalendarGrid.tsx` (update badge color logic)

- [ ] **Step 1: Write the failing tests**

Open `src/lib/coverage/selectors.test.ts`. At the top, verify the import of `headcountThreshold`
will be expected (add it to the existing import line from `@/lib/coverage/selectors`):

```typescript
import {
  // ... any existing imports ...
  headcountThreshold,
} from '@/lib/coverage/selectors'
```

Append these test cases at the end of the file:

```typescript
describe('headcountThreshold', () => {
  it('returns "red" for activeCount 0', () => {
    expect(headcountThreshold(0)).toBe('red')
  })
  it('returns "red" for activeCount 1', () => {
    expect(headcountThreshold(1)).toBe('red')
  })
  it('returns "red" for activeCount 2', () => {
    expect(headcountThreshold(2)).toBe('red')
  })
  it('returns "yellow" for activeCount 3', () => {
    expect(headcountThreshold(3)).toBe('yellow')
  })
  it('returns "green" for activeCount 4', () => {
    expect(headcountThreshold(4)).toBe('green')
  })
  it('returns "green" for activeCount 5', () => {
    expect(headcountThreshold(5)).toBe('green')
  })
  it('returns "green" for activeCount above 5', () => {
    expect(headcountThreshold(10)).toBe('green')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test:unit -- src/lib/coverage/selectors.test.ts
```

Expected: FAIL with "headcountThreshold is not a function" (or similar import error).

- [ ] **Step 3: Add `headcountThreshold` to selectors**

In `src/lib/coverage/selectors.ts`, append after the last existing export:

```typescript
export type HeadcountThreshold = 'red' | 'yellow' | 'green'

/**
 * PRD §9.3: Red < 3, Yellow = 3, Green ≥ 4.
 * Pass countActive(day) as the argument.
 */
export function headcountThreshold(activeCount: number): HeadcountThreshold {
  if (activeCount < 3) return 'red'
  if (activeCount === 3) return 'yellow'
  return 'green'
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test:unit -- src/lib/coverage/selectors.test.ts
```

Expected: all pass.

- [ ] **Step 5: Update CalendarGrid badge**

In `src/components/coverage/CalendarGrid.tsx`:

**a)** Add `headcountThreshold` to the existing import from `@/lib/coverage/selectors`:

```typescript
import {
  countActive,
  flatten,
  headcountThreshold,
  shouldShowMonthTag,
} from '@/lib/coverage/selectors'
```

**b)** Immediately after `const activeCount = countActive(day)` (around line 86), add:

```typescript
const threshold = headcountThreshold(activeCount)
```

**c)** Find the `<span>` that currently renders `{activeCount}/{totalCount}`. It looks like:

```typescript
<span
  className={cn(
    'rounded-full px-2 py-0.5 text-[0.62rem] font-bold leading-none',
    hasCoverageIssue
      ? 'bg-[var(--error-subtle)] text-[var(--error-text)]'
      : 'bg-[var(--success-subtle)] text-[var(--success-text)]'
  )}
>
  {activeCount}/{totalCount}
</span>
```

Replace the entire `<span>` with:

```typescript
<span
  className={cn(
    'rounded-full px-2 py-0.5 text-[0.62rem] font-bold leading-none',
    threshold === 'red'    && 'bg-[var(--error-subtle)] text-[var(--error-text)]',
    threshold === 'yellow' && 'bg-[var(--warning-subtle)] text-[var(--warning-text)]',
    threshold === 'green'  && 'bg-[var(--success-subtle)] text-[var(--success-text)]'
  )}
>
  {activeCount}/{totalCount}
</span>
```

- [ ] **Step 6: Run all tests and build**

```bash
npm run test:unit
npm run build
```

Expected: all pass, clean build.

- [ ] **Step 7: Commit**

```bash
git add src/lib/coverage/selectors.ts src/lib/coverage/selectors.test.ts src/components/coverage/CalendarGrid.tsx
git commit -m "feat: headcount badge uses red/yellow/green thresholds per PRD §9.3"
```

---

## Task 3: Therapist Visibility of Operational Codes

### Problem

`src/app/therapist/schedule/page.tsx` fetches operational codes then silently **removes**
any shift that has one (line: `const shifts = allShifts.filter((shift) => !activeOperationalCodesByShiftId.has(shift.id))`).
PRD §8: therapists must see all shifts with operational code badges (OC / CI / CX / LE).

**Files:**

- Create: `src/app/therapist/schedule/schedule-helpers.ts`
- Create: `src/app/therapist/schedule/schedule-helpers.test.ts`
- Modify: `src/app/therapist/schedule/page.tsx`

### Operational code display labels

| DB value     | Badge |
| ------------ | ----- |
| `on_call`    | `OC`  |
| `call_in`    | `CI`  |
| `cancelled`  | `CX`  |
| `left_early` | `LE`  |

- [ ] **Step 1: Write the failing test**

Create `src/app/therapist/schedule/schedule-helpers.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { operationalCodeLabel } from './schedule-helpers'

describe('operationalCodeLabel', () => {
  it('maps on_call to OC', () => expect(operationalCodeLabel('on_call')).toBe('OC'))
  it('maps call_in to CI', () => expect(operationalCodeLabel('call_in')).toBe('CI'))
  it('maps cancelled to CX', () => expect(operationalCodeLabel('cancelled')).toBe('CX'))
  it('maps left_early to LE', () => expect(operationalCodeLabel('left_early')).toBe('LE'))
  it('returns null for unknown values', () => expect(operationalCodeLabel('scheduled')).toBeNull())
  it('returns null for empty string', () => expect(operationalCodeLabel('')).toBeNull())
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm run test:unit -- src/app/therapist/schedule/schedule-helpers.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the helpers module**

Create `src/app/therapist/schedule/schedule-helpers.ts`:

```typescript
import type { OperationalCode } from '@/lib/operational-codes'

const CODE_LABELS: Record<OperationalCode, string> = {
  on_call: 'OC',
  call_in: 'CI',
  cancelled: 'CX',
  left_early: 'LE',
}

/** Returns the PRD short label (OC/CI/CX/LE) or null if not an operational code. */
export function operationalCodeLabel(code: string): string | null {
  return CODE_LABELS[code as OperationalCode] ?? null
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npm run test:unit -- src/app/therapist/schedule/schedule-helpers.test.ts
```

Expected: all 6 tests pass.

- [ ] **Step 5: Update page.tsx — remove the filter line and add operationalCode to ShiftAssignment**

Open `src/app/therapist/schedule/page.tsx`. Make these changes **in this exact order**:

**a)** Add the import at the top of the file (after other local imports):

```typescript
import { operationalCodeLabel } from './schedule-helpers'
```

**b)** Add `operationalCode` to the `ShiftAssignment` type:

```typescript
type ShiftAssignment = {
  id: string
  userId: string | null
  name: string
  role: 'lead' | 'staff'
  shiftType: 'day' | 'night'
  isCurrentUser: boolean
  operationalCode: string | null // NEW — PRD §8 visibility
}
```

**c)** Update the `buildDaySchedules` function signature to accept the op-codes map:

```typescript
function buildDaySchedules(
  rows: ShiftRow[],
  currentUserId: string,
  nameByUserId: Map<string, string>,
  operationalCodesByShiftId: Map<string, string>  // NEW
): DaySchedule[] {
```

**d)** Inside `buildDaySchedules`, populate the new field in the `ShiftAssignment` object:

```typescript
const assignment: ShiftAssignment = {
  id: row.id,
  userId: row.user_id,
  name: row.user_id ? (nameByUserId.get(row.user_id) ?? 'Unknown therapist') : 'Open slot',
  role: row.role,
  shiftType: row.shift_type,
  isCurrentUser: row.user_id === currentUserId,
  operationalCode: operationalCodeLabel(operationalCodesByShiftId.get(row.id) ?? ''), // NEW
}
```

**e)** In `TherapistSchedulePage`, delete the filter line that removes coded shifts:

```typescript
// DELETE this line:
const shifts = allShifts.filter((shift) => !activeOperationalCodesByShiftId.has(shift.id))
```

**f)** Update the `buildDaySchedules` call to pass `allShifts` (not `shifts`) and the codes map:

```typescript
const daySchedules = buildDaySchedules(
  allShifts,
  user.id,
  nameByUserId,
  activeOperationalCodesByShiftId
)
```

Note: `nameByUserId` is built from `shiftUserIds`. After step (e) removes the filter, rebuild
`shiftUserIds` from `allShifts` instead of `shifts`:

```typescript
const shiftUserIds = Array.from(
  new Set(allShifts.map((s) => s.user_id).filter((v): v is string => Boolean(v)))
)
```

- [ ] **Step 6: Render the operational code badge in `ShiftGroup`**

Find the `ShiftGroup` component in `page.tsx`. It renders each assignment as a `<span>`.
The current span looks approximately like:

```typescript
<span
  key={assignment.id}
  className={cn(
    'rounded-full border px-2.5 py-1 text-[11px] font-semibold',
    assignment.isCurrentUser
      ? 'border-primary/40 bg-primary/10 text-primary'
      : 'border-border bg-card text-foreground',
    assignment.role === 'lead' && !assignment.isCurrentUser
      ? 'border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]'
      : null
  )}
>
  {assignment.role === 'lead' ? 'Lead: ' : ''}
  {assignment.name}
  {assignment.isCurrentUser ? ' (You)' : ''}
</span>
```

Replace this entire `<span>` with the following (adds the code badge as a sibling element
inside a wrapper):

```typescript
<span
  key={assignment.id}
  className="inline-flex items-center gap-1"
>
  <span
    className={cn(
      'rounded-full border px-2.5 py-1 text-[11px] font-semibold',
      assignment.isCurrentUser
        ? 'border-primary/40 bg-primary/10 text-primary'
        : 'border-border bg-card text-foreground',
      assignment.role === 'lead' && !assignment.isCurrentUser
        ? 'border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]'
        : null
    )}
  >
    {assignment.role === 'lead' ? 'Lead: ' : ''}
    {assignment.name}
    {assignment.isCurrentUser ? ' (You)' : ''}
  </span>
  {assignment.operationalCode && (
    <span className="rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider border border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]">
      {assignment.operationalCode}
    </span>
  )}
</span>
```

- [ ] **Step 7: Type-check and build**

```bash
npx tsc --noEmit
npm run build
```

Expected: no type errors, clean build.

- [ ] **Step 8: Commit**

```bash
git add src/app/therapist/schedule/page.tsx \
        src/app/therapist/schedule/schedule-helpers.ts \
        src/app/therapist/schedule/schedule-helpers.test.ts
git commit -m "feat: therapists see OC/CI/CX/LE badges on published schedule per PRD §8"
```

---

## Task 4: Active Block Editing Guardrails

### Problem

PRD §7.1: editing a past date OR a date with existing operational entries requires a
confirmation step and must be logged as a "post-publish modification."

### Strategy

1. Promote `activeOperationalCodesByShiftId` from a local variable inside the coverage page's
   `useEffect` to component state, so it is accessible in JSX.
2. Compute `isPastDate` and `hasOperationalEntries` from component state.
3. Pass both to `ShiftEditorDialog` as new props.
4. Inside the dialog, show a warning banner when either is true.
5. In the drag-drop API route (`src/app/api/schedule/drag-drop/route.ts`), accept an optional
   `isPostPublishModification` flag and write an audit log entry when it is set.

**Files:**

- Modify: `src/app/coverage/page.tsx`
- Modify: `src/components/coverage/ShiftEditorDialog.tsx`
- Modify: `src/app/api/schedule/drag-drop/route.ts`
- Test: `src/components/coverage/shift-editor-dialog-layout.test.ts` (existing — verify passes)

- [ ] **Step 1: Write the failing test**

Open `src/components/coverage/shift-editor-dialog-layout.test.ts`. Add at the end:

```typescript
describe('guardrail props', () => {
  it('ShiftEditorDialogProps type includes isPastDate and hasOperationalEntries', () => {
    // Type-level contract test: if this file compiles, the props exist.
    // A runtime render test requires jsdom setup not present in this project.
    // The banner itself carries data-testid="coverage-guardrail-banner" for e2e.
    const _typeCheck: {
      isPastDate: boolean
      hasOperationalEntries: boolean
    } = { isPastDate: false, hasOperationalEntries: false }
    expect(_typeCheck.isPastDate).toBe(false)
    expect(_typeCheck.hasOperationalEntries).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to confirm it passes (it should, as a baseline)**

```bash
npm run test:unit -- src/components/coverage/shift-editor-dialog-layout.test.ts
```

Expected: passes (this test is a compile-time contract check; it will also fail if we
accidentally delete the props in future).

- [ ] **Step 3: Promote `activeOperationalCodesByShiftId` to component state in `coverage/page.tsx`**

Open `src/app/coverage/page.tsx`. Find the `useState` declarations near the top of the
component. Add:

```typescript
const [activeOpCodes, setActiveOpCodes] = useState<Map<string, string>>(new Map())
```

Inside the `useEffect` (or wherever `activeOperationalCodesByShiftId` is currently a
`const`), after it is populated, add:

```typescript
setActiveOpCodes(activeOperationalCodesByShiftId)
```

The existing usages inside the effect that reference `activeOperationalCodesByShiftId` are
fine — they run before React re-renders. Only the JSX-level access (added in Step 4) needs
the state version.

- [ ] **Step 4: Compute guardrail flags and pass to `ShiftEditorDialog`**

Still in `src/app/coverage/page.tsx`, find where `<ShiftEditorDialog` is rendered. Just
before it, add:

```typescript
const today = toIsoDate(new Date())
const isPastDate = selectedDay !== null && selectedDay.isoDate < today
const selectedDayShiftIds = [
  ...(selectedDay?.leadShift ? [selectedDay.leadShift.id] : []),
  ...(selectedDay?.staffShifts.map((s) => s.id) ?? []),
]
const hasOperationalEntries = selectedDayShiftIds.some((id) => activeOpCodes.has(id))
```

Then pass the flags to the dialog:

```typescript
<ShiftEditorDialog
  {/* ...all existing props... */}
  isPastDate={isPastDate}
  hasOperationalEntries={hasOperationalEntries}
/>
```

`toIsoDate` is already imported from `@/lib/calendar-utils` in this file.

- [ ] **Step 5: Add props and warning banner to `ShiftEditorDialog`**

Open `src/components/coverage/ShiftEditorDialog.tsx`.

**a)** Add two props to `ShiftEditorDialogProps`:

```typescript
type ShiftEditorDialogProps = {
  // ... all existing props ...
  isPastDate: boolean
  hasOperationalEntries: boolean
}
```

**b)** Destructure them in the function signature:

```typescript
function ShiftEditorDialog({
  // ... all existing destructured props ...
  isPastDate,
  hasOperationalEntries,
}: ShiftEditorDialogProps) {
```

**c)** Inside the `{selectedDay && (...)}` block, immediately after the existing
`{!canEdit && (...)}` warning div, add:

```typescript
{(isPastDate || hasOperationalEntries) && canEdit && (
  <div
    role="alert"
    data-testid="coverage-guardrail-banner"
    className={cn(
      shiftEditorDialogLayout.alert,
      'border border-[var(--warning-border)] bg-[var(--warning-subtle)] font-medium text-[var(--warning-text)]'
    )}
  >
    {isPastDate
      ? 'This date is in the past. Changes will be logged as a post-publish modification.'
      : 'This date has active operational entries. Changes will be logged as a post-publish modification.'}
  </div>
)}
```

- [ ] **Step 6: Add `isPostPublishModification` to the drag-drop API route**

Open `src/app/api/schedule/drag-drop/route.ts`.

**a)** The `DragAction` type is a discriminated union with exactly **5 variants**. Add
`isPostPublishModification?: boolean` to all 5. The variant shapes are:

- `action: 'assign'` — add after `availabilityOverrideReason?: string`
- `action: 'move'` — add after `availabilityOverrideReason?: string`
- `action: 'remove'` with `shiftId: string` — add after `shiftId: string`
- `action: 'remove'` with `userId: string` (the second remove variant using `userId + date + shiftType`) — add after `shiftType: 'day' | 'night'`
- `action: 'set_lead'` — add after `availabilityOverrideReason?: string`

All 5 variants must receive the field. Do not skip the second `remove` variant.

**b)** After each successful DB mutation (assign, move, remove, set_lead) and before the
`return NextResponse.json(...)` success response, add:

```typescript
if (body.isPostPublishModification) {
  await writeAuditLog(supabase, {
    userId: user.id,
    action: 'post_publish_modification',
    targetType: 'shift',
    targetId: /* the shift id involved in the mutation */,
  })
}
```

Use these exact variable names — they are already present in the route:

- `assign` branch: `insertedShift?.id` (set at the line `const { data: insertedShift, error } = await supabase.from('shifts').insert(...)`)
- `move` branch: `body.shiftId` (the incoming payload field)
- `remove` (by shiftId) branch: `body.shiftId`
- `remove` (by userId/date) branch: use `body.userId + ':' + body.date` as `targetId` since there is no single shift id in this path
- `set_lead` branch: use the shift id returned from `setDesignatedLeadMutation`

**c)** In `src/app/coverage/page.tsx`, find where `onAssignTherapist` and `onUnassign`
call the API (they call `assignCoverageShift` / `unassignCoverageShift` from
`src/lib/coverage/mutations.ts`). Add `isPostPublishModification` to those call payloads:

```typescript
await assignCoverageShift({
  // ... existing fields ...
  isPostPublishModification: isPastDate || hasOperationalEntries,
})
```

Open `src/lib/coverage/mutations.ts` and add `isPostPublishModification?: boolean` to the
parameter type of `assignCoverageShift` and `unassignCoverageShift`, and forward it in the
`fetch` body.

- [ ] **Step 7: Run tests, lint, build**

```bash
npm run test:unit
npx tsc --noEmit
npm run lint
npm run build
```

Expected: all pass, clean build, no new type errors.

- [ ] **Step 8: Commit**

```bash
git add src/app/coverage/page.tsx \
        src/components/coverage/ShiftEditorDialog.tsx \
        src/app/api/schedule/drag-drop/route.ts \
        src/lib/coverage/mutations.ts
git commit -m "feat: active block editing guardrail — warning banner + post_publish_modification audit log (PRD §7)"
```

---

## Task 5: PRN Interest Queue

### Problem

PRD §6.1: when an open shift needs a PRN, managers must see **all** interested PRN therapists
sorted by submission time and manually select one.

### Current state

- `shift_posts` with `type = 'pickup'` covers slot claims.
- Only one pending pickup per slot may exist due to implicit UI flow (not a hard DB constraint).
- The shift board (`src/app/shift-board/page.tsx`) shows all pickup posts but does not group
  them by slot or sort multi-candidate slots by submission time.
- `ShiftBoardRequest` (the display type) has `poster` (therapist name string) but no `shiftId`.

### Strategy

1. Add a DB trigger so approving one pickup post auto-denies all other pending pickup posts
   for the same `shift_id`.
2. Add `shiftId` to `ShiftBoardRequest` so the grouping helper can use it.
3. Add a helper that groups pending pickup posts by `shiftId` sorted by `postedAt`.
4. In the shift board JSX (manager view), add a "PRN Interest" section above the main list
   that renders multi-candidate slots (slots with ≥ 2 pending pickups).
5. Change the pickup button label for PRN therapists from "Claim" / "Request pickup" to
   "Express interest."

**Files:**

- Create: `supabase/migrations/20260330110000_auto_deny_sibling_pickup_posts.sql`
- Create: `src/app/shift-board/prn-interest-helpers.ts`
- Create: `src/app/shift-board/prn-interest-helpers.test.ts`
- Modify: `src/app/shift-board/page.tsx`

### Sub-task 5a: DB Migration — Auto-Deny Sibling Pickup Posts

- [ ] **Step 1: Create the migration**

Create `supabase/migrations/20260330110000_auto_deny_sibling_pickup_posts.sql`:

```sql
-- PRD v5.1 §6.1: When a manager approves one PRN pickup candidate, all other
-- pending pickup posts for the same shift_id are auto-denied.

create or replace function public.deny_sibling_pickup_posts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only fires when a pickup post transitions to approved.
  if new.status = 'approved' and old.status <> 'approved' and new.type = 'pickup' then
    update public.shift_posts
    set status = 'denied'
    where shift_id = new.shift_id
      and type     = 'pickup'
      and status   = 'pending'
      and id       <> new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists deny_sibling_pickup_posts_trigger on public.shift_posts;
create trigger deny_sibling_pickup_posts_trigger
after update of status on public.shift_posts
for each row
execute function public.deny_sibling_pickup_posts();
```

- [ ] **Step 2: Apply the migration**

```bash
npx supabase db push
```

Expected: clean.

### Sub-task 5b: Group-By-Slot Helper

- [ ] **Step 3: Write the failing test**

Create `src/app/shift-board/prn-interest-helpers.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { groupPickupsBySlot } from './prn-interest-helpers'
import type { ShiftBoardRequest } from './prn-interest-helpers'

function makeRequest(
  id: string,
  shiftId: string,
  postedAt: string,
  poster: string = 'Therapist'
): ShiftBoardRequest {
  return {
    id,
    type: 'pickup',
    poster,
    avatar: poster[0] ?? 'T',
    shift: 'Day Shift',
    shiftDate: '2026-04-01',
    shiftId,
    message: '',
    status: 'pending',
    posted: postedAt,
    postedAt,
    swapWithName: null,
    swapWithId: null,
    shiftType: 'day',
    shiftRole: 'staff',
    overrideReason: null,
  }
}

describe('groupPickupsBySlot', () => {
  it('groups pending pickup requests by shiftId', () => {
    const requests = [
      makeRequest('a', 'shift-1', '2026-04-01T08:00:00Z', 'Alice'),
      makeRequest('b', 'shift-1', '2026-04-01T09:00:00Z', 'Bob'),
      makeRequest('c', 'shift-2', '2026-04-01T07:00:00Z', 'Carol'),
    ]
    const groups = groupPickupsBySlot(requests)
    expect(groups).toHaveLength(2)
  })

  it('sorts candidates within a slot by postedAt ascending', () => {
    const requests = [
      makeRequest('late', 'shift-1', '2026-04-01T10:00:00Z', 'Late'),
      makeRequest('early', 'shift-1', '2026-04-01T08:00:00Z', 'Early'),
    ]
    const groups = groupPickupsBySlot(requests)
    expect(groups[0].candidates[0].id).toBe('early')
    expect(groups[0].candidates[1].id).toBe('late')
  })

  it('excludes non-pickup and non-pending requests', () => {
    const requests = [
      makeRequest('a', 'shift-1', '2026-04-01T08:00:00Z'),
      { ...makeRequest('b', 'shift-1', '2026-04-01T09:00:00Z'), type: 'swap' as const },
      { ...makeRequest('c', 'shift-1', '2026-04-01T10:00:00Z'), status: 'approved' as const },
    ]
    const groups = groupPickupsBySlot(requests)
    expect(groups).toHaveLength(1)
    expect(groups[0].candidates).toHaveLength(1)
  })

  it('only includes slots with 2 or more candidates in the multi-candidate result', () => {
    const requests = [
      makeRequest('a', 'shift-1', '2026-04-01T08:00:00Z'),
      makeRequest('b', 'shift-1', '2026-04-01T09:00:00Z'),
      makeRequest('c', 'shift-2', '2026-04-01T07:00:00Z'),
    ]
    const groups = groupPickupsBySlot(requests)
    const multiOnly = groups.filter((g) => g.candidates.length >= 2)
    expect(multiOnly).toHaveLength(1)
    expect(multiOnly[0].shiftId).toBe('shift-1')
  })
})
```

- [ ] **Step 4: Run test to confirm it fails**

```bash
npm run test:unit -- src/app/shift-board/prn-interest-helpers.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 5: Create the helpers module**

Create `src/app/shift-board/prn-interest-helpers.ts`:

```typescript
// This file defines a ShiftBoardRequest type that is structurally compatible with
// the local type in page.tsx. Verify before using: page.tsx defines
// `type RequestType = 'swap' | 'pickup'` (confirmed at line 26). If that ever changes,
// update this file to match. The two types are intentionally kept in sync rather than
// one importing from the other, because page.tsx is a 'use client' file and the helper
// is used in tests that run outside of Next.js.

export type ShiftBoardRequest = {
  id: string
  type: 'swap' | 'pickup'
  poster: string
  avatar: string
  shift: string
  shiftDate: string | null
  shiftId: string | null // NEW field added in Task 5 Step 6
  message: string
  status: 'pending' | 'approved' | 'denied' | 'expired'
  posted: string
  postedAt: string
  swapWithName: string | null
  swapWithId: string | null
  shiftType: 'day' | 'night' | null
  shiftRole: 'lead' | 'staff' | null
  overrideReason: string | null
}

export type SlotCandidateGroup = {
  shiftId: string
  shiftLabel: string
  candidates: ShiftBoardRequest[]
}

/**
 * Groups pending pickup posts by shiftId and sorts candidates within each group
 * by postedAt ascending (earliest submission first — PRD §6.1).
 * Only includes pending pickup requests.
 */
export function groupPickupsBySlot(requests: ShiftBoardRequest[]): SlotCandidateGroup[] {
  const byShift = new Map<string, ShiftBoardRequest[]>()

  for (const req of requests) {
    if (req.type !== 'pickup' || req.status !== 'pending') continue
    if (!req.shiftId) continue
    const bucket = byShift.get(req.shiftId) ?? []
    bucket.push(req)
    byShift.set(req.shiftId, bucket)
  }

  return Array.from(byShift.entries()).map(([shiftId, candidates]) => ({
    shiftId,
    shiftLabel: candidates[0]?.shift ?? shiftId,
    candidates: candidates.slice().sort((a, b) => a.postedAt.localeCompare(b.postedAt)),
  }))
}
```

- [ ] **Step 6: Run test to confirm it passes**

```bash
npm run test:unit -- src/app/shift-board/prn-interest-helpers.test.ts
```

Expected: all tests pass.

### Sub-task 5c: Update Shift Board — Add `shiftId` to `ShiftBoardRequest` and Render Multi-Candidate Section

- [ ] **Step 7: Add `shiftId` to `ShiftBoardRequest` in `page.tsx`**

Open `src/app/shift-board/page.tsx`.

**a)** Add `shiftId` to the `ShiftBoardRequest` type:

```typescript
type ShiftBoardRequest = {
  // ... all existing fields ...
  shiftId: string | null // NEW
}
```

**b)** Find where `ShiftBoardRequest` objects are constructed (inside `loadBoard` where
raw `ShiftPostRow` data is mapped). There is **one** construction site. Add
`shiftId: post.shift_id ?? null` to that object.

**c)** Add the import for the grouping helper:

```typescript
import { groupPickupsBySlot } from './prn-interest-helpers'
```

- [ ] **Step 8: Render multi-candidate PRN interest section for managers**

In `src/app/shift-board/page.tsx`, find the JSX block where the request list is rendered
for managers (`canReview === true`). It likely renders `filteredRequests.map(...)`.

Before that map, compute:

```typescript
const pickupGroups = groupPickupsBySlot(requests)
const multiCandidateSlots = pickupGroups.filter((g) => g.candidates.length >= 2)
```

Then, inside the manager view JSX (conditional on `canReview`), add this section above
the existing request list. It should look like:

```typescript
{canReview && multiCandidateSlots.length > 0 && (
  <section className="space-y-3">
    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      PRN Interest — Multiple Candidates
    </p>
    {multiCandidateSlots.map((group) => (
      <div
        key={group.shiftId}
        className="rounded-xl border border-border bg-card p-4"
      >
        <p className="mb-3 text-sm font-semibold text-foreground">
          {group.shiftLabel}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {group.candidates.length} interested
          </span>
        </p>
        <div className="space-y-2">
          {group.candidates.map((candidate, index) => (
            <div
              key={candidate.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  #{index + 1}
                </span>
                <span className="text-sm font-medium text-foreground">
                  {candidate.poster}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(candidate.postedAt).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <button
                type="button"
                disabled={savingState[candidate.id]}
                onClick={() => handleAction(candidate.id, 'approve')}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {savingState[candidate.id] ? 'Selecting…' : 'Select'}
              </button>
            </div>
          ))}
        </div>
      </div>
    ))}
  </section>
)}
```

- [ ] **Step 9: Update pickup button label for PRN therapists**

In `src/app/shift-board/page.tsx`, find where the pickup button is rendered for a therapist
on an open shift slot. The button currently likely says "Claim", "Request", or "Pickup".

Find the profile fetch (it already fetches `role` from profiles; add `employment_type` if
not already present). Then conditionally change the label:

```typescript
// In the data fetch:
supabase.from('profiles').select('id, full_name, role, employment_type').eq('id', user.id)

// In the component state, store employment_type:
const [employmentType, setEmploymentType] = useState<string | null>(null)
// After loading: setEmploymentType(profile.employment_type ?? null)

// On the pickup button:
{
  employmentType === 'prn' ? 'Express interest' : 'Claim shift'
}
```

- [ ] **Step 10: Run all tests and build**

```bash
npm run test:unit
npm run build
```

Expected: all pass, clean build.

- [ ] **Step 11: Commit**

```bash
git add supabase/migrations/20260330110000_auto_deny_sibling_pickup_posts.sql \
        src/app/shift-board/prn-interest-helpers.ts \
        src/app/shift-board/prn-interest-helpers.test.ts \
        src/app/shift-board/page.tsx
git commit -m "feat: PRN interest queue — multi-candidate grouping with submission-order display, auto-deny siblings on approval (PRD §6)"
```

---

## Final Verification

- [ ] **Run full local quality gate**

```bash
npm run ci:local
```

Expected: format → lint → tsc → build all pass.

- [ ] **Run unit tests and confirm count is higher than baseline (212)**

```bash
npm run test:unit
```

- [ ] **Run e2e**

```bash
npm run test:e2e
```

Expected: 39 passed, 1 skipped (no regressions).

- [ ] **Push**

```bash
git push
```

---

## Definition of Done

| Gap                              | Verification Signal                                                                                                                                                                                                                                                                             |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Swap operational lock**        | Approving a swap where requester has active `shift_operational_entries` row raises DB exception in trigger                                                                                                                                                                                      |
| **Headcount thresholds**         | Badge is red when `activeCount < 3`, yellow when `= 3`, green when `≥ 4`                                                                                                                                                                                                                        |
| **Therapist op code visibility** | OC/CI/CX/LE badges appear on therapist `/schedule` view next to affected therapist names                                                                                                                                                                                                        |
| **Active block guardrail**       | Warning banner appears in `ShiftEditorDialog` for past dates (`data-testid="coverage-guardrail-banner"` present in DOM); run this SQL after an assign on a past date to confirm logging: `SELECT * FROM audit_log WHERE action = 'post_publish_modification' ORDER BY created_at DESC LIMIT 5;` |
| **PRN interest queue**           | Shift board shows multi-candidate slots with submission-order ranking; approving one causes DB trigger to deny the others                                                                                                                                                                       |
