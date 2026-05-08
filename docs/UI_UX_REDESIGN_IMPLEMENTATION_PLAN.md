# UI/UX Redesign Implementation Plan

Source of truth: `docs/UI_UX_REDESIGN_AUDIT.md`.

Current status: the first My Shifts clarity slice is complete. My Shifts now has the first `ScheduleContextBar`, a 42-day Sunday-start Schedule Block, visible non-working days, highlighted therapist work days, selected-day details, and focused tests.

## Operating rules

- Keep each slice small enough to review independently.
- Do not change Supabase schema, RLS, server actions, route names, scheduling algorithms, publish/preflight behavior, Shift Board lifecycle logic, or Lottery logic unless a later phase explicitly scopes that work.
- Prefer shared display components only after a second real consumer exists.
- Keep therapist personal views personally scoped. Team-wide exploration belongs in Team Schedule.
- Use user-facing language from the audit: Schedule Block, Day shift, Night shift, Read-only, Published schedule, Need Off, Need to Work, Shift Board.
- Avoid backend language in UI: cycle, row, override, mutation, RLS, RPC, force_on, force_off.

## Implementation sequence

### Phase 0 - Plan and Track

Status: in progress.

Goal:

- Keep the audit evaluative and this plan executable.
- Track implementation status, cut lines, verification, and remaining risks.

Files:

- `docs/UI_UX_REDESIGN_AUDIT.md`
- `docs/UI_UX_REDESIGN_IMPLEMENTATION_PLAN.md`

Acceptance criteria:

- The audit reflects completed work without becoming a task board.
- This plan names concrete implementation slices, files, tests, and stop conditions.

Verification:

- `git diff --check -- docs/UI_UX_REDESIGN_AUDIT.md docs/UI_UX_REDESIGN_IMPLEMENTATION_PLAN.md`

### Phase 1 - Shared Schedule Context Foundation

Status: partially complete.

Completed:

- `src/components/schedule/ScheduleContextBar.tsx`
- My Shifts applies the context bar.
- My Shifts uses shared Schedule Block helpers in `src/lib/my-shifts-schedule-block.ts`.

Remaining scope:

- Keep `ScheduleContextBar` stable until Team Schedule or Availability becomes the second consumer.
- Add a small source-level/component test for `ScheduleContextBar` only when props or role-specific states become more complex.
- Do not introduce global state for block/shift context.

Likely files:

- `src/components/schedule/ScheduleContextBar.tsx`
- `src/components/schedule/ScheduleContextBar.test.ts` if needed
- Future consumers in Coverage, Team Schedule, Availability, Shift Board, or Lottery

Acceptance criteria:

- The shared context bar supports Schedule Block range, block shape, shift mode, published/read-only/editable state, and permission state.
- Consumers pass display-ready labels; the component does not fetch data or own workflow state.

Verification:

- `npm run lint`
- `npm run typecheck`
- Focused component/source tests when new behavior is added

### Phase 2 - My Shifts Completion

Status: partially complete. First slice complete.

Completed:

- Full 42-day Schedule Block.
- Sunday-start behavior.
- Own/default shift display.
- Read-only Published schedule state.
- Non-working days visible.
- Current therapist's scheduled days highlighted.
- Selected-day detail with date, shift, work status, coworkers, lead, and schedule status.
- Focused tests in `src/lib/my-shifts-schedule-block.test.ts` and `src/components/schedule/TherapistShiftCalendar.test.ts`.

Next safe slice:

1. Add a compact next-shift or upcoming-personal-shifts summary using the already-loaded published schedule data.
2. Tighten My Shifts mobile behavior: week strip or stacked selected-day card, without changing desktop workflow.
3. Extract selected-day detail and coworker list only if Team Schedule work starts and needs the same shape.

Explicitly defer:

- Calendar-started Give up this shift and Trade this shift actions. That belongs with a separate Shift Board lifecycle slice.
- Both-shift coworker browsing. That belongs in Team Schedule.

Likely files:

- `src/components/schedule/PublishedSchedulePage.tsx`
- `src/components/schedule/TherapistShiftCalendar.tsx`
- `src/components/schedule/TherapistShiftCalendar.test.ts`
- `src/lib/my-shifts-schedule-block.ts`
- `src/lib/my-shifts-schedule-block.test.ts`

Acceptance criteria:

- My Shifts remains personally scoped and read-only.
- The page still shows all 42 days even when highlight filters are active.
- The next-shift summary, if added, uses the same published schedule data already available to the page.
- Mobile does not hide Schedule Block range, selected day, or work status.

Verification:

- `npm run test:unit -- src/lib/my-shifts-schedule-block.test.ts src/components/schedule/TherapistShiftCalendar.test.ts`
- `npm run lint`
- `npm run typecheck`
- Browser smoke with a seeded therapist session when available

### Phase 3 - Team Schedule and Coverage Frame

Goal:

- Make Team Schedule the live published schedule view while preserving Coverage as the manager editing workspace and Roster as a display mode.

Cut lines:

- Do not change Coverage mutations.
- Do not change publish/preflight.
- Do not change manager assignment logic.
- Do not rename routes.
- Do not grant staff manager controls.

Implementation slices:

1. Read-only Team Schedule frame:
   - Add shared Schedule Block context to the staff Team Schedule surface.
   - Clarify read-only state and Day/Night mode.
   - Keep staff controls non-mutating.

2. Shared selected-day pattern:
   - Reuse or extract the My Shifts selected-day panel shape.
   - Show date, shift, lead, scheduled staff, current user's presence, and operational statuses.
   - Keep manager edit controls out of the staff panel.

3. Roster framing:
   - Reframe `/schedule` as Roster View of Team Schedule in labels and empty states.
   - Default shift behavior should match actor context where safe.

4. Manager/lead operational controls:
   - Only after read-only framing is stable.
   - Controls must use existing permission checks and persistence paths.
   - Both view remains summary/read-only for operational edits.

Likely files:

- `src/app/(app)/coverage/CoverageClientPage.tsx`
- `src/components/coverage/CalendarGrid.tsx`
- `src/components/coverage/ShiftEditorDialog.tsx`
- `src/app/(app)/schedule/page.tsx`
- `src/components/schedule-roster/ScheduleRosterScreen.tsx`
- Shared schedule components under `src/components/schedule/`

Acceptance criteria:

- Staff Team Schedule shows a 6-week block, selected-day details, and read-only state.
- Staff users cannot see or trigger manager edit controls.
- Coverage remains the manager planning/editing workspace.
- Roster View is clearly a display/print view, not a separate scheduling workflow.
- Operational statuses remain visible and use full labels.

Verification:

- Focused unit/source tests for read-only labels and route framing.
- Existing Coverage tests.
- Browser checks for staff, lead, and manager roles.
- `npm run lint`
- `npm run typecheck`
- `npm run build`

### Phase 4 - Availability Vocabulary and Queue Clarity

Goal:

- Make therapist availability exception-based: Need Off and Need to Work, with unmarked days treated as no therapist-entered exception.
- Separate therapist submissions from manager planning state.

Cut lines:

- Do not change internal data values unless separately approved.
- Do not merge recurring pattern edits into the Schedule Block exception calendar.
- Do not change official submission truth.
- Do not change manager authorization.

Implementation slices:

1. Therapist vocabulary pass:
   - Replace safe user-facing "Can work" / "Can't work" labels with Need to Work / Need Off.
   - Keep no-exception submissions valid and clear.
   - Keep recurring pattern as baseline context.

2. Therapist review-before-submit:
   - Summarize Schedule Block, regular shift, Need Off dates, Need to Work dates, PTO reasons when present, and edit-window state.

3. Manager queue clarity:
   - Group Missing submissions, Submitted with exceptions, Submitted with no exceptions.
   - Separate therapist exception layer from manager planning layer.
   - Keep manager editing in the selected therapist detail panel.

Likely files:

- `src/app/(app)/therapist/availability/page.tsx`
- `src/components/availability/TherapistAvailabilityWorkspace.tsx`
- `src/components/availability/AvailabilityEntriesTable.tsx`
- `src/app/(app)/availability/page.tsx`
- `src/components/availability/ManagerSchedulingInputs.tsx`
- `src/components/availability/AvailabilityStatusSummary.tsx`
- `src/components/availability/therapist-context-panel.tsx`
- `src/components/availability/manager-availability-editor-panel.tsx`

Acceptance criteria:

- Therapists see Need Off and Need to Work as the primary exception choices.
- Save progress and Submit remain distinct.
- Submitted-with-no-exceptions is understandable and not treated as missing work.
- Managers can still see missing/submitted counts and edit therapist details.
- Manager planning changes do not obscure therapist submissions.

Verification:

- Existing availability unit tests.
- Add focused tests for label mapping and no-exception submissions.
- Browser checks for therapist availability and manager availability.
- `npm run lint`
- `npm run typecheck`
- `npm run build`

### Phase 5 - Shift Board Action Ownership

Goal:

- Make request lifecycle states readable without changing lifecycle behavior.

Cut lines:

- Do not change direct request send/accept/decline/withdraw/approve semantics.
- Do not change pickup primary/backup ordering.
- Do not change notification behavior without dedicated tests.
- Do not make My Shifts request actions until this phase owns the lifecycle path.

Implementation slices:

1. Board section architecture:
   - Needs Action, Open Shifts, My Requests, History.
   - Keep sections role-aware but consistently named.

2. Request card language:
   - Add action owner labels: Needs your action, Waiting on manager, Waiting on teammate, Open to team, Already handled.
   - Move long timelines and claimant details into drawers.

3. Composer language:
   - Trade shift, Give up shift, Ask a specific teammate.
   - Pickup starts from Open Shifts, not New Request.

4. My Shifts entry points:
   - Add Give up this shift / Trade this shift from selected-day detail only after the board path and tests are stable.

Likely files:

- `src/app/(app)/shift-board/page.tsx`
- `src/components/shift-board/ShiftBoardClientPage.tsx`
- `src/app/(app)/therapist/swaps/page.tsx`
- `src/app/(app)/requests/new/page.tsx`
- `src/components/requests/RequestComposer.tsx`
- `src/components/requests/RequestsHistoryView.tsx`
- `src/lib/request-page-data.ts`
- `src/lib/shift-board-snapshot.ts`

Acceptance criteria:

- Every card names the request type, owner, current state, and next action owner.
- Therapist and manager views use the same section model.
- Approved requests still update Team Schedule and My Shifts through existing lifecycle paths.
- Notifications still fire for the same state transitions.

Verification:

- Existing Shift Board/request lifecycle tests.
- Add tests for action-owner derivation and section grouping.
- Browser checks for therapist and manager request flows.
- `npm run lint`
- `npm run typecheck`
- `npm run build`

### Phase 6 - Lottery Decision Center

Goal:

- Reframe Lottery as a decision center driven by live Team Schedule while preserving recommendation and apply logic.

Cut lines:

- Do not change ranking rules.
- Do not change applied decision history semantics.
- Do not add Both-shift apply mode.
- Do not give therapists apply controls.

Implementation slices:

1. Decision context:
   - Show selected date, Day/Night shift, scheduled staff, PRN/core grouping, volunteers, and latest applied decision.

2. Recommendation clarity:
   - Show recommendation and reason in plain language.
   - Show stale/applied state.

3. Therapist transparency:
   - Therapists see their shift order and own position with neutral wording.
   - No manager-only rationale or actions.

4. Team Schedule link-in:
   - Add contextual links from Team Schedule selected-day detail when extra staff or active lottery decisions exist.

Likely files:

- `src/app/(app)/lottery/page.tsx`
- `src/components/lottery/LotteryClientPage.tsx`
- `src/lib/lottery/recommendation.ts`
- `src/lib/lottery/service.ts`

Acceptance criteria:

- Lottery displays the selected shift's scheduled staff before asking for a decision.
- Apply/override flows preserve history.
- Applied Cancelled or On Call statuses remain visible in Team Schedule and My Shifts.
- Therapists can view order context without action controls.

Verification:

- Existing Lottery unit tests.
- Add label/state tests for stale/applied recommendation display.
- Browser checks for manager/lead and therapist visibility.
- `npm run lint`
- `npm run typecheck`
- `npm run build`

### Phase 7 - Mobile Schedule Pass

Goal:

- Standardize mobile schedule navigation after desktop shared patterns stabilize.

Entry criteria:

- My Shifts selected-day pattern is stable.
- Team Schedule selected-day pattern is stable.
- Availability vocabulary pass is complete.
- Shift Board action ownership is complete enough that mobile queues have stable labels.

Implementation slices:

1. Mobile context:
   - Sticky Schedule Block and shift context.

2. Mobile schedule navigation:
   - Week selector or day strip.
   - Selected-day card or bottom sheet.

3. Mobile action queues:
   - Therapist Dashboard, My Shifts, Availability, Team Schedule, Shift Board.
   - Lead day-of Team Schedule and Lottery.
   - Manager triage only; dense schedule building stays desktop-first.

Likely files:

- `src/components/AppShell.tsx`
- Schedule components under `src/components/schedule/`
- Coverage, availability, shift board, and lottery client components touched in earlier phases

Acceptance criteria:

- Schedule context remains visible on mobile.
- Selected-day detail is the primary mobile interaction.
- Touch targets are at least 44 by 44 CSS pixels.
- Dense manager edit flows remain usable or explicitly desktop-first.

Verification:

- Browser screenshots/checks at representative mobile and desktop widths.
- Focus and keyboard checks for drawers/dialogs.
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Cross-phase testing gates

Run for every code slice:

- `npm run lint`
- `npm run typecheck`
- Focused unit tests for touched modules
- `git diff --check`

Run for standard or cross-surface slices:

- `npm run build`
- Role-specific browser smoke for affected routes when seeded auth is available

Run before merging a phase:

- Relevant existing route/component tests for the touched workflow
- Browser checks for staff, lead, and manager visibility where the workflow is role-sensitive
- A quick source scan for forbidden user-facing terms introduced by the slice

## Suggested branch and commit strategy

- Keep each implementation slice on its own branch or commit.
- Do not bundle docs-only updates with risky workflow changes unless the doc update directly describes that slice.
- Use Lore commit trailers for implementation commits.
- Commit verification truth exactly: list commands run, and list browser/auth gaps honestly.

## Current next action

The next safest implementation task is Phase 2, My Shifts completion:

1. Add a compact next-shift or upcoming-shifts summary from existing published schedule data.
2. Improve My Shifts mobile layout around the 6-week block and selected-day detail.
3. Keep Shift Board actions out of scope until the request lifecycle slice begins.
