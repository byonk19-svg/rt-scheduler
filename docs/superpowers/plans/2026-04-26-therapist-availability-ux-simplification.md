# Therapist Availability UX Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify therapist recurring-pattern and future-availability flows so non-technical users immediately understand "normal schedule" versus "this cycle only" changes.

**Architecture:** Keep the existing route split and data model, but tighten the therapist-facing presentation layer around three explicit concepts: saved normal schedule, generated cycle starting point, and cycle-only changes. Add a neutral no-pattern display state in the UI layer, reduce top-of-page control density, and keep secondary actions behind progressive disclosure.

**Tech Stack:** Next.js App Router, React, TypeScript, Vitest, existing UI primitives in `src/components/ui`

---

### Task 1: Lock the new therapist vocabulary and neutral no-pattern behavior with failing tests

**Files:**

- Modify: `src/lib/availability-pattern-generator.test.ts`
- Modify: `src/components/availability/TherapistAvailabilityWorkspace.test.ts`
- Test: `src/lib/availability-pattern-generator.test.ts`
- Test: `src/components/availability/TherapistAvailabilityWorkspace.test.ts`

- [ ] **Step 1: Add a failing baseline test for no-pattern neutrality**

```ts
it('marks no-pattern days as neutral instead of off', () => {
  expect(
    buildCycleAvailabilityBaseline({
      cycleStart: '2026-05-03',
      cycleEnd: '2026-05-05',
      pattern: null,
    })
  ).toEqual({
    '2026-05-03': { baselineStatus: 'neutral', baselineSource: 'none', reason: 'none' },
    '2026-05-04': { baselineStatus: 'neutral', baselineSource: 'none', reason: 'none' },
    '2026-05-05': { baselineStatus: 'neutral', baselineSource: 'none', reason: 'none' },
  })
})
```

- [ ] **Step 2: Run the focused generator test and verify it fails on the current `'off'` expectation**

Run: `npx vitest run src/lib/availability-pattern-generator.test.ts`
Expected: FAIL in the new no-pattern case because the generator still returns `baselineStatus: 'off'`.

- [ ] **Step 3: Add failing therapist workspace copy tests for the simpler mental model**

```ts
expect(html).toContain('Starting point for this cycle')
expect(html).toContain('We used your normal schedule to fill this cycle.')
expect(html).toContain('Changes here stay in this cycle only.')
expect(html).toContain('Click a day to make a change.')
expect(html).toContain('No normal schedule saved yet.')
expect(html).toContain('This cycle starts blank.')
expect(html).not.toContain('Availability summary:')
expect(html).not.toContain('Generated from your recurring pattern')
expect(html).not.toContain('Request to Work')
expect(html).not.toContain('Need Off')
```

- [ ] **Step 4: Run the focused workspace test and verify the new expectations fail**

Run: `npx vitest run src/components/availability/TherapistAvailabilityWorkspace.test.ts`
Expected: FAIL because the current header copy still uses the denser baseline/override wording.

### Task 2: Implement neutral baseline semantics and simpler Future Availability framing

**Files:**

- Modify: `src/lib/availability-pattern-generator.ts`
- Modify: `src/app/(app)/therapist/availability/page.tsx`
- Modify: `src/components/availability/TherapistAvailabilityWorkspace.tsx`
- Test: `src/lib/availability-pattern-generator.test.ts`
- Test: `src/components/availability/TherapistAvailabilityWorkspace.test.ts`

- [ ] **Step 1: Change the generator to expose a neutral UI state for missing patterns**

```ts
export type GeneratedAvailabilityBaselineDay = {
  baselineStatus: 'available' | 'off' | 'neutral'
  baselineSource: 'recurring_pattern' | 'none'
  reason: PatternDecisionReason | 'none'
}

if (!params.pattern || params.pattern.pattern_type === 'none') {
  baseline[date] = {
    baselineStatus: 'neutral',
    baselineSource: 'none',
    reason: 'none',
  }
  continue
}
```

- [ ] **Step 2: Re-run the generator tests and verify they pass**

Run: `npx vitest run src/lib/availability-pattern-generator.test.ts`
Expected: PASS

- [ ] **Step 3: Simplify therapist availability framing and selected-day language**

```tsx
<p className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
  Starting point for this cycle
</p>
<p className="text-sm font-semibold text-foreground">{recurringPatternSummary}</p>
<p className="text-sm text-muted-foreground">
  We used your normal schedule to fill this cycle. Changes here stay in this cycle only.
</p>
```

```tsx
{
  selectedBaselineStatus === 'neutral'
    ? 'Not set from a normal schedule'
    : selectedBaselineStatus === 'available'
      ? 'Work day in your normal schedule'
      : 'Off day in your normal schedule'
}
```

- [ ] **Step 4: Update therapist-facing action labels to plain English**

```tsx
{
  selectedBaselineStatus === 'available' ? 'I can’t work this day' : 'I can work this day'
}
```

```tsx
{
  overrideStatus === 'force_off'
    ? 'Can’t work'
    : overrideStatus === 'force_on'
      ? 'Can work'
      : baselineStatus === 'available'
        ? 'Work day'
        : baselineStatus === 'off'
          ? 'Off day'
          : 'Not set'
}
```

- [ ] **Step 5: Re-run the workspace test and keep the no-pattern and copy cases green**

Run: `npx vitest run src/components/availability/TherapistAvailabilityWorkspace.test.ts`
Expected: PASS

### Task 3: Simplify the Future Availability controls and progressive disclosure

**Files:**

- Modify: `src/components/availability/TherapistAvailabilityWorkspace.tsx`
- Test: `src/components/availability/TherapistAvailabilityWorkspace.test.ts`

- [ ] **Step 1: Add a failing test/source assertion for de-emphasized bulk controls**

```ts
expect(src).toContain('Edit several days')
expect(src).toContain('Reset this cycle to normal schedule')
expect(src).not.toContain('Clear overrides')
expect(src).not.toContain('Reapply pattern')
```

- [ ] **Step 2: Run the focused workspace test to verify the source assertion fails**

Run: `npx vitest run src/components/availability/TherapistAvailabilityWorkspace.test.ts`
Expected: FAIL because the current component still exposes all top-level bulk controls.

- [ ] **Step 3: Move range tools into a lower-emphasis disclosure and merge reset actions**

```tsx
<details className="rounded-2xl border border-border/70 bg-muted/[0.05] px-4 py-3">
  <summary className="cursor-pointer text-sm font-semibold text-foreground">
    Edit several days
  </summary>
  {/* existing range start/end + range actions */}
</details>
```

```tsx
<Button type="button" variant="outline" size="sm" onClick={clearOverrides}>
  Reset this cycle to normal schedule
</Button>
```

- [ ] **Step 4: Keep the main top row limited to cycle selector, status, and the normal-schedule connection card**

Run: `npx vitest run src/components/availability/TherapistAvailabilityWorkspace.test.ts`
Expected: PASS

### Task 4: Simplify the Recurring Work Pattern page

**Files:**

- Modify: `src/components/availability/RecurringPatternEditor.tsx`
- Modify: `src/app/(app)/therapist/recurring-pattern/page.tsx`
- Test: `src/app/(app)/therapist/recurring-pattern/page.test.ts`

- [ ] **Step 1: Add a failing route/source contract for the calmer page copy**

```ts
expect(source).toContain('Set your normal repeating schedule.')
expect(source).toContain('Use Future Availability when one cycle is different.')
```

- [ ] **Step 2: Run the recurring-pattern route test and verify the copy assertion fails**

Run: `npx vitest run src/app/(app)/therapist/recurring-pattern/page.test.ts`
Expected: FAIL because the current header still uses more abstract template language.

- [ ] **Step 3: Simplify the page shell and editor labels**

```tsx
<p className="mt-1 text-sm text-muted-foreground">Set your normal repeating schedule.</p>
<p className="mt-1 text-sm text-muted-foreground">
  Use Future Availability when one cycle is different.
</p>
```

```tsx
<CardTitle>What you’re saving</CardTitle>
<CardTitle>Quick preview</CardTitle>
<Label>Which days do you usually work?</Label>
```

- [ ] **Step 4: Hide the hard/soft choice until it is needed**

```tsx
<details>
  <summary>This can vary sometimes</summary>
  {/* existing hard/soft controls with renamed labels */}
</details>
```

- [ ] **Step 5: Re-run the recurring-pattern route test**

Run: `npx vitest run src/app/(app)/therapist/recurring-pattern/page.test.ts`
Expected: PASS

### Task 5: Final verification

**Files:**

- Modify: any touched files above as needed from verification fallout

- [ ] **Step 1: Run the focused test suite**

Run: `npx vitest run src/lib/availability-pattern-generator.test.ts src/components/availability/TherapistAvailabilityWorkspace.test.ts src/app/(app)/therapist/recurring-pattern/page.test.ts`
Expected: PASS

- [ ] **Step 2: Run TypeScript verification**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Run lint if the touched TSX files stay isolated enough**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 4: Fix any fallout without broadening scope into manager-only scheduling surfaces**

Run: re-run only the failing command(s) until green.
Expected: clean focused verification for therapist recurring-pattern and availability flows.
