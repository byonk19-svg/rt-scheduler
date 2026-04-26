# Therapist Recurring Pattern and Availability Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign therapist recurring work patterns and future availability so recurring schedule templates are distinct from cycle-specific overrides, including repeating-cycle support and generated baseline availability.

**Architecture:** Extend `work_patterns` with an explicit pattern type plus cycle-specific fields while preserving legacy weekly columns for existing manager scheduling flows. Build a therapist-only recurring-pattern editor route and update the therapist availability workspace to render a generated baseline with override-specific controls and bulk actions.

**Tech Stack:** Next.js App Router, React, TypeScript, Supabase, Vitest, existing UI primitives in `src/components/ui`

---

### Task 1: Model and schema foundation

**Files:**

- Create: `supabase/migrations/20260426120000_expand_work_patterns_for_therapist_recurring_templates.sql`
- Modify: `src/lib/coverage/work-patterns.ts`
- Test: `src/lib/coverage/work-patterns.test.ts`

- [ ] Add failing tests for pattern-type normalization, every-weekend/every-other-weekend summaries, and repeating-cycle anchors.
- [ ] Run the focused work-pattern test file and verify the new cases fail for the expected missing-model behavior.
- [ ] Add new schema fields and TypeScript model support for `pattern_type`, `weekend_rule`, `cycle_anchor_date`, and `cycle_segments`.
- [ ] Preserve legacy weekly compatibility by mirroring weekly selections into existing `works_dow`, `offs_dow`, `weekend_rotation`, and `weekend_anchor_date` fields.
- [ ] Re-run `src/lib/coverage/work-patterns.test.ts` and keep the legacy cases green.

### Task 2: Recurring-pattern presentation and therapist editor route

**Files:**

- Create: `src/app/(app)/therapist/recurring-pattern/page.tsx`
- Create: `src/components/availability/RecurringPatternEditor.tsx`
- Create: `src/components/availability/RecurringPatternPreview.tsx`
- Modify: `src/components/team/WorkPatternCard.tsx`
- Modify: `src/components/team/team-directory-model.ts`
- Modify: `src/app/(app)/therapist/settings/page.tsx`
- Test: `src/components/team/WorkPatternCard.test.ts`
- Test: `src/app/(app)/therapist/settings/page.test.ts`

- [ ] Add failing presentation tests for recurring-pattern summaries and the therapist settings entry point copy.
- [ ] Replace the modal-first therapist settings pattern editor with a summary card and CTA into the dedicated recurring-pattern page.
- [ ] Implement the dedicated recurring-pattern page with pattern cards, progressive-disclosure form sections, and a live preview rail.
- [ ] Keep the saved payload compatible with the schema/model work from Task 1.
- [ ] Re-run the targeted recurring-pattern and therapist-settings tests.

### Task 3: Generated availability baseline and override workspace

**Files:**

- Create: `src/lib/availability-pattern-generator.ts`
- Modify: `src/app/(app)/therapist/availability/page.tsx`
- Modify: `src/components/availability/TherapistAvailabilityWorkspace.tsx`
- Modify: `src/components/availability/availability-calendar-panel.tsx`
- Test: `src/components/availability/TherapistAvailabilityWorkspace.test.ts`
- Test: `src/app/(app)/availability/actions.test.ts`

- [ ] Add failing tests for generated baseline availability, override-only persistence, and bulk actions that restore generated state.
- [ ] Build a generator utility that expands a recurring pattern into per-day baseline status for a selected cycle.
- [ ] Load work-pattern data into the therapist availability page and pass generated baseline plus existing overrides into the workspace.
- [ ] Refactor the workspace UI to distinguish generated baseline vs therapist overrides, add recurring-pattern summary copy, and add bulk actions like reapply pattern and clear overrides.
- [ ] Re-run the targeted workspace and action tests.

### Task 4: Verification and cleanup

**Files:**

- Modify: any touched files above as needed from verification fallout

- [ ] Run focused Vitest coverage for work patterns, recurring-pattern UI, therapist availability workspace, and availability actions.
- [ ] Run `npx tsc --noEmit`.
- [ ] Run `npm run lint`.
- [ ] Fix follow-on regressions without broadening scope into unrelated dirty files.
