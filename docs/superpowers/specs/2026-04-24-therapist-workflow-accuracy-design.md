# Therapist Workflow Accuracy And Navigation Alignment

**Date:** 2026-04-24  
**Status:** Implemented

## Scope

This pass focused on therapist workflow accuracy using the existing route and data model surfaces already present in the repo:

- official availability submissions in `therapist_availability_submissions`
- future-cycle availability overrides in `availability_overrides`
- therapist-visible preliminary state from `preliminary_snapshots`
- published schedule data from `shifts`
- therapist-relevant swap and pickup activity from `shift_posts`

The goal was to make therapist navigation and status reporting trustworthy without attempting a full rewrite of the preliminary or post-publish scheduling engines.

## Decisions

### Shared therapist workflow selector

Therapist workflow state is now derived centrally in `src/lib/therapist-workflow.ts` instead of being recomputed differently across pages.

This selector resolves:

- `availability_not_started`
- `availability_draft`
- `availability_submitted`
- `preliminary_review_available`
- `published_schedule_available`
- `cycle_closed`

It also determines:

- which cycle needs therapist attention
- the therapist-safe primary CTA
- supporting schedule CTA
- published-shift summary
- relevant swap and pickup counts

### Therapist-owned routing

Therapists now use canonical therapist-facing destinations:

- `/therapist/availability`
- `/therapist/schedule`
- `/therapist/swaps`
- `/staff/history`

`/therapist/schedule` no longer redirects to `/coverage`.

### Vocabulary alignment

Therapist-facing wording was aligned around:

- `Future Availability`
- `My Published Schedule`
- `Shift Swaps & Pickups`
- `Draft saved`
- `Submitted`

## Intentional Limits Of This Pass

This change does **not** implement the full later-stage PRD expansion for:

- full-team therapist preliminary editing on the roster grid
- reopened-final workflow semantics
- notifications and deep links for all state changes
- manager-side hard-issues and PTO reporting

Those behaviors need a larger follow-up beyond the route/state accuracy pass.

## Verification

Verified in this pass:

- shared therapist workflow selector tests
- dashboard contract tests
- shell navigation contract tests
- therapist schedule route contract tests
- therapist availability tests
- `npx tsc --noEmit`
- `npm run lint`

Repository-wide unit status after this work:

- therapist workflow changes pass
- existing unrelated failures remain in `src/components/availability/ManagerSchedulingInputs.test.ts`
