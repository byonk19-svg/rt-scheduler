# RT Scheduler UI/UX Redesign Audit

Implementation tracker: `docs/UI_UX_REDESIGN_IMPLEMENTATION_PLAN.md`.

## Executive summary

The app already contains most of the workflows respiratory therapy scheduling needs: manager coverage editing, a read-only roster view, therapist availability, manager availability review, shift swaps and pickups, and a lottery workflow. The core UX problem is not missing capability. The problem is that schedule context, shift context, action ownership, and edit permissions are fragmented across pages.

Users need to know, within a few seconds:

- Which Schedule Block they are viewing.
- Whether they are viewing day shift or night shift.
- Whether the page is read-only or editable.
- What action is needed next, and who owns it.
- Whether an item belongs to them, their shift, or another team member.
- Who is working with them on a selected day.

The safest redesign direction is a phased context-first redesign, not a route rewrite. Keep current business logic, Supabase schema, RLS, server actions, and route ownership intact. Add reusable UI structure around the existing workflows: a shared schedule context bar, a consistent day/night shift toggle, 6-week overview grids, selected-day detail panels, and action cards that name the responsible user.

## Canonical product model

The redesign should make the app feel like one coherent scheduling system, not a collection of unrelated pages. These are the canonical concepts to preserve across navigation, headings, empty states, action cards, and detail panels.

### Primary workflows

- Dashboard: role-specific triage and next action.
- My Shifts: the therapist's personal Schedule Block, with all days visible and the therapist's scheduled days highlighted.
- Team Schedule: the live published schedule and shared source of truth for all roles.
- Coverage: the manager staffing workbench for building, reviewing, publishing, and maintaining coverage.
- Availability: exception-based input before schedule building, using Need Off and Need to Work.
- Shift Board: post-publish swaps, pickups, give-up requests, and direct requests.
- Lottery: live-schedule-driven staff reduction decision center.

### Supporting views

- Schedule Blocks: manager utility inside Coverage for published block history, take-offline, safe delete, republish, and start-over actions.
- Roster View: table/print/export view mode inside Team Schedule.
- History: workflow-specific history inside Shift Board, Lottery, Team Schedule details, and My Shifts past blocks.
- Print/export: secondary actions inside the relevant workflow.
- Profile/settings: secondary utilities, not scheduling workflows.

### Role navigation target

- Therapist: Dashboard, My Shifts, Team Schedule, Availability, Shift Board.
- Lead: Dashboard, Team Schedule, Shift Board, Lottery, and limited Availability visibility if needed.
- Manager: Dashboard, Coverage, Team Schedule, Availability, Shift Board, Lottery.

### Shift visibility

- Team Schedule opens on Day and offers Day, Night, Both in that order.
- Both view is summary/read-only for operational status changes. Managers and leads must choose Day or Night before toggling live statuses.
- Therapists default to their own shift in personal views and may view both shifts read-only on Team Schedule.
- Leads have permanent lead tools and may toggle operational statuses across shifts when permitted.
- Managers can view and manage across shifts.

### Availability model

- Availability is exception-based.
- Unmarked days mean no therapist-entered exception, while inherited recurring pattern context may still display as the Availability Baseline.
- Need Off is a hard no for the therapist's regular shift.
- Need to Work is a hard yes for the therapist's regular shift.
- PTO is an optional reason under Need Off, not a separate state.
- Therapists can submit with no exceptions to confirm they reviewed the Schedule Block.
- Submitted availability can be edited only while the Availability Edit Window is open.
- After availability locks, changes are manager-managed.

### Live schedule statuses

- Scheduled means active working coverage.
- On Call means backup, visible but not active bedside coverage, and does not automatically create a gap when intentionally assigned.
- Cancelled means not needed, usually due to overstaffing, and does not create a coverage gap.
- Call In means the scheduled therapist cannot work and is the only operational status that automatically creates possible coverage impact.
- Left Early is informational for the day and does not affect the staffing ratio.
- Use full labels by default. Abbreviations such as OC, CX, CI, and LE are only acceptable in dense manager table views with a legend or tooltip.

### Lifecycle truth

- Team Schedule is the live truth after publish.
- Shift Board owns request lifecycle, but approved swaps and pickups update Team Schedule and My Shifts.
- Lottery is driven by Team Schedule and applies Cancelled or On Call back to Team Schedule/My Shifts.
- Coverage owns build/publish lifecycle and the Before Publish checklist.
- Published operational warnings are manager/lead visible by default; staff see only warnings that directly affect them.

High-impact findings:

- My Shifts first slice is now implemented: it uses a 42-day Sunday-start Schedule Block, shows shared schedule context, keeps non-working days visible, highlights the therapist's scheduled days, and includes selected-day details with coworkers.
- The Coverage page has strong 6-week manager tooling, but its schedule context is local to that page instead of a shared pattern.
- The read-only roster view defaults to day shift instead of the actor's own shift, and should be reframed as a Roster View of Team Schedule rather than a separate primary workflow.
- Therapist availability is functionally strong, but labels such as "Future Availability", "Can work", and "Can't work" do not match the exception-based therapist vocabulary: Need Off and Need to Work.
- Manager availability has the right queue/detail shape, but manager planning states and therapist request states need clearer separation.
- Shift swaps and pickups contain robust lifecycle data, including direct requests and primary/backup pickup claimants, but the UI should make action ownership more explicit.
- Lottery exists and has recommendation logic, history, PRN awareness, and apply/override behavior. It should evolve into a decision center rather than a three-column utility page.
- Mobile support exists in several places, but each scheduling surface handles it differently. A shared mobile schedule navigator would reduce confusion.

## Design principles

1. Always show the schedule block.
   Every scheduling page should show the Schedule Block, the Sunday-start date range, status, and whether the user can edit that block.

2. Treat day shift and night shift as modes, not casual filters.
   Team Schedule opens on Day and offers a Day, Night, Both toggle in that order. Leads default to their regular Day or Night shift in lead-scoped views. Therapists default to their own shift in personal views. Therapists may view both shifts on Team Schedule as read-only visibility, while My Shifts remains personally scoped. Leads and managers may toggle Day/Night wherever their role has schedule access.

3. Separate overview from details.
   Use the 6-week view to answer "what is happening across the block?" Use a selected-day panel, drawer, or modal to answer "who works this day and what can I do?"

4. Make action ownership explicit.
   Every actionable card should say one of: Needs your action, Waiting on manager, Waiting on therapist, Open to team, Already handled, or Read-only.

5. Use respiratory scheduling language, not database language.
   Prefer "block", "shift", "availability", "request", "response", "schedule status", and "manager note". Avoid exposing terms such as cycle, override, force_on, force_off, row, table, mutation, RLS, or RPC.

6. Keep read-only and editable surfaces visibly different.
   Manager edit tools, roster review, therapist self-service, and lead review should share context but not blur permissions.

7. Preserve lifecycle integrity.
   The redesign must not change how drafts, submissions, manager edits, direct request responses, pickup queues, publish state, or lottery history are stored or reconciled.

8. Use structure before color.
   Group related information, use clear labels, then small icons, and use restrained semantic color last. Avoid giving every workflow or status a loud competing color.

## Page-by-page recommendations

### 1. Navigation and app shell

Current implementation evidence:

- Primary shell lives in `src/components/AppShell.tsx`.
- Navigation configuration lives in `src/components/shell/app-shell-config.ts`.
- Manager navigation separates Dashboard, Schedule, People, and Admin.
- Staff navigation exposes Dashboard, My Shifts, Availability, Team Schedule, Shift Swaps, and History, but the redesign should converge the swaps/pickups label to Shift Board and move History into workflow-specific views.
- Mobile shell has a top bar, bottom navigation, and drawer.

What the page is trying to help the user do:

- Move between role-specific workflows.
- Understand whether they are in manager, lead, or staff mode.
- Keep local schedule workflow links available for managers.
- Find the right workflow without learning duplicate schedule concepts.

Why the current UX may be confusing:

- Schedule context is not part of the app shell. Users can move between schedule pages without a persistent reminder of block, shift, or edit mode.
- Staff "Team Schedule" routes to `/coverage`, while manager "Roster" routes to `/schedule`; the relationship between Coverage, Team Schedule, Roster View, and My Shifts is not obvious.
- Local schedule navigation is hidden on some schedule-adjacent pages, so users lose orientation between related surfaces.
- The mobile bottom navigation is generic and does not always emphasize the current user's most common scheduling tasks.

What should be visible immediately:

- Current role: Therapist, Lead, or Manager.
- Current scheduling context when on schedule-related routes: Schedule Block range, Sunday start, Day/Night mode, and read-only/editable state.
- The current workflow group: My schedule, Team schedule, Availability, Swaps, Coverage, Lottery, or Publish.

What should move into a detail panel, drawer, or modal:

- Rare admin links and secondary manager utilities should stay in drawer/local nav rather than crowding the top shell.
- Profile, sign-out, and notification preferences should remain in menus.

Recommended layout:

- Add a reusable `ScheduleContextBar` below the shell header on scheduling routes.
- Keep primary role navigation stable.
- For staff, keep Dashboard, My Shifts, Availability, Team Schedule, and Shift Swaps as the main bottom/mobile items.
- For managers, keep Dashboard, Coverage, Availability, Shift Board, and Lottery visible through grouped navigation, while treating Publish, Roster, History, Print, and Export as modes or supporting views.
- Use route labels consistently: "Team Schedule" for the canonical live published schedule, "Coverage" for manager planning/editing, and "Roster View" only for printable/table display.
- Keep primary navigation conceptually small: My Shifts, Team Schedule, Coverage, Availability, Shift Board, and Lottery.
- Use Shift Board as the shared workflow name for therapists, leads, and managers; Requests, Pickups, and Swaps should be sections or card types, not separate primary nav concepts.
- History should not remain a standalone primary nav item; use Shift Board History, Lottery History, Team Schedule post-publish details, and My Shifts past blocks.

Reusable components needed:

- `ScheduleContextBar`
- `ShiftModeToggle`
- `RoleModeBadge`
- `PermissionStateBadge`
- `MobileWorkflowNav`

Risks or behavior that must not be broken:

- Existing route access rules for staff, lead, manager, and admin.
- Staff redirects away from manager-only schedule surfaces.
- Manager local navigation for Coverage, Roster, Analytics, Availability, Lottery, Publish, and Approvals.

Suggested implementation phase:

- Phase 1: Shared context and vocabulary.

### 2. Dashboard

Current implementation evidence:

- Manager dashboard is loaded by `src/app/(app)/dashboard/manager/page.tsx`.
- Manager UI is rendered by `src/components/manager/ManagerTriageDashboard.tsx`.
- Staff dashboard is loaded by `src/app/(app)/dashboard/staff/page.tsx`.
- Staff action card is rendered by `src/components/dashboard/StaffAttentionCard.tsx`.

What the page is trying to help the user do:

- Managers need a triage view of the active block, urgent approvals, coverage issues, recent activity, open shifts, and upcoming schedule work.
- Therapists need to see what they need to do now, their upcoming shifts, and shift swap or pickup status.

Why the current UX may be confusing:

- Manager dashboard contains many useful cards, but the primary "what should I do first?" path competes with metrics, workflow cards, recent activity, open shifts, and staffed shifts.
- Site and cycle controls visually look interactive even when they are static.
- Day and night shift are represented in counts, but not consistently as two distinct work modes.
- Staff dashboard does a better job with next action, but it still depends on downstream pages to clarify block and shift context.

What should be visible immediately:

- Current Schedule Block and status.
- Current Day/Night mode or a combined "Both shifts" manager summary.
- One next action, with owner and destination.
- For managers: pending approvals, missing availability submissions, open coverage issues, and publish readiness.
- For therapists: next scheduled shift, due availability, pending requests, and open items that need their response.

What should move into a detail panel, drawer, or modal:

- Recent activity can move below the fold or into an activity drawer.
- Open shifts snapshot can link into Shift Board or Coverage instead of competing with the primary action queue.
- Workflow explanation should be minimized once a user has schedule history.

Recommended layout:

- Top: `ScheduleContextBar` plus role-specific next action banner.
- Middle: action queue with 3 to 5 prioritized cards.
- Lower: supporting summaries grouped by Schedule, Availability, Requests, and Activity.
- Manager dashboard should separate Day/Night summary tiles, then link each tile to the relevant shift mode.
- Manager dashboard should summarize both shifts by default because it is a triage surface.
- Managers should land on Dashboard for active Schedule Block status, availability readiness, publish readiness, urgent Coverage gaps, Shift Board approvals, and Lottery/day-of actions.
- Lead dashboard should default to the lead's regular shift with optional cross-shift summary.
- Therapist dashboard should remain personal and not expose both-shift controls.
- Keep dashboards role-specific: therapist personal next action, lead day-of regular-shift operations, manager both-shift triage.
- Lead dashboard should show today's Team Schedule for the lead's regular shift, operational status attention, Call In coverage impact, Lottery decision context, and Shift Board visibility without manager final approval.
- Leads should land on Dashboard, with Team Schedule one click away for live schedule work.
- Lead-facing UI should depend on permanent lead permission, even when the lead is not assigned as lead that day.
- Show a small Lead tools indicator for permanent lead permissions, and reserve "Assigned lead today" for day-specific schedule assignment.
- Staff dashboard should keep My Shifts and Shift Swaps previews, but each preview should include block and shift context.
- Dashboard should summarize top attention items, while My Shifts, Availability, and Shift Board show inline context where the user acts.
- Therapists should land on Dashboard for next shift, availability state, Shift Board actions, and recent schedule changes, with My Shifts one click away.

Reusable components needed:

- `RoleDashboardHeader`
- `ActionQueue`
- `ActionCard`
- `ShiftSummaryPair`
- `DashboardPreviewSection`

Risks or behavior that must not be broken:

- Existing data loading for pending approvals, unread notifications, recent activity, shifts today, upcoming shifts, and operational codes.
- Links that route managers to Coverage, Schedule, Availability, Publish, Approvals, and Shift Board.
- Staff next-action logic that distinguishes due availability from past-due and completed states.

Suggested implementation phase:

- Phase 2 for staff clarity.
- Phase 3 for manager dashboard schedule context.

### 3. My Shifts

Current implementation evidence:

- Route: `src/app/(app)/therapist/schedule/page.tsx`.
- Main component: `src/components/schedule/PublishedSchedulePage.tsx`.
- Calendar UI: `src/components/schedule/TherapistShiftCalendar.tsx`.
- Shared context component: `src/components/schedule/ScheduleContextBar.tsx`.
- Schedule Block helpers and tests: `src/lib/my-shifts-schedule-block.ts` and `src/lib/my-shifts-schedule-block.test.ts`.
- Current published schedule window uses `SCHEDULE_BLOCK_DAYS = 42`, which is 6 weeks.
- Focused component coverage: `src/components/schedule/TherapistShiftCalendar.test.ts`.

Implementation status:

- Done in first slice: My Shifts page title remains "My Shifts"; the page shows the Schedule Block date range, Sunday-start 6-week context, therapist default shift, Published schedule state, and Read-only personal schedule state.
- Done in first slice: My Shifts now loads and displays a full 42-day Schedule Block from existing published schedule rows, with no backend, schema, RLS, server action, route, manager Coverage, publish/preflight, Shift Board, or Lottery changes.
- Done in first slice: non-working days remain visible for orientation, therapist working days are clearly highlighted, and selected-day detail shows date, shift, whether the therapist works, coworkers on that shift, lead when listed, and schedule status labels.
- Still remaining: next shift card, upcoming personal shifts list, historical block selector, mobile-specific week strip polish, and calendar-started Give up this shift / Trade this shift entry points.

What the page is trying to help the user do:

- Therapists need to see their own scheduled shifts and who they are working with.
- They need quick confidence about the block, their shift mode, and any open swap or pickup actions.

Why the current UX may be confusing:

- The first slice fixed the 35-day period; the page now shows the full 6-week block.
- View labels are clearer after the first slice: "6 Weeks", "2 Weeks", and "4 Weeks" now describe the visible block window.
- Day/Night mode is inferred from the therapist profile and current rows, but the UI should be clearer about "your shift" and when another shift can be viewed.
- Team-wide shift visibility must not imply edit permission; therapists can view both shifts on Team Schedule but should not see manager controls.
- Teammate filters and highlight controls remain useful, but can still be made more compact once the shared selected-day pattern is reused elsewhere.

What should be visible immediately:

- Implemented: "My Shifts" title with the Schedule Block Sunday-start range.
- Implemented: the user's default shift mode: Day shift or Night shift.
- Implemented: a clear working-day marker when showing the therapist's own assigned shift.
- Next shift card with date, time, lead, and coworkers.
- Implemented: 6-week overview with the user's working days clearly marked.
- Implemented: selected day detail showing whether the current user works that day and who else is scheduled.
- Implemented: non-working days visible for orientation, not hidden from the Schedule Block calendar.
- For non-working selected days, show coworkers on the therapist's own shift by default and route both-shift exploration to Team Schedule.
- Implemented: Scheduled, On Call, Cancelled, Call In, and Left Early labels remain available in My Shifts rather than disappearing from the block.
- Scheduled selected days should offer contextual actions such as Give up this shift and Trade this shift.

What should move into a detail panel, drawer, or modal:

- Coworker list, lead, notes, and swap/pickup entry points should appear in selected-day detail.
- Give-up and trade request creation should start from selected-day detail when the therapist is viewing one of their scheduled shifts.
- Both-shift coworker exploration should move to Team Schedule rather than expanding My Shifts into a full roster.
- Teammate filtering can stay in a collapsible filter drawer.
- Historical block selection can sit behind a block selector.

Recommended layout:

- Top context: 6-week block, own shift, read-only status.
- Left or main: all 6 weeks as a compact calendar, including non-working days.
- Right or drawer: selected day detail.
- Below: upcoming personal shifts list and request links.
- Mobile: week strip plus selected-day card, with a sticky block/shift header.
- Use restrained status design: text labels, grouping, icons, and subtle tones before strong color.

Reusable components needed:

- `ScheduleContextBar` - implemented and applied to My Shifts first.
- `SixWeekBlockGrid`
- `SelectedDayPanel` - first My Shifts version implemented inline in `TherapistShiftCalendar`; extract when a second page needs it.
- `CoworkerList` - first My Shifts version implemented inline in `TherapistShiftCalendar`; extract when reused.
- `MyShiftHighlight` - first My Shifts version implemented through calendar day styling; extract only if reuse becomes real.
- `BlockSelector`

Risks or behavior that must not be broken:

- Published-only schedule visibility.
- Current user's shift identification and teammate grouping.
- Live operational status visibility without overwhelming color use.
- My Shifts remains personally scoped even though Team Schedule can expose both shifts read-only.
- Selected-day coworker details stay scoped to the therapist's own shift by default.
- Redirect behavior for unauthenticated or non-staff access.
- Links to swap or pickup workflows.
- Calendar-started request creation must prefill the selected shift and preserve Shift Board lifecycle rules.

Suggested implementation phase:

- Phase 2: Therapist schedule clarity. First slice complete; remaining work should stay scoped to next shift/upcoming list, mobile polish, and safe Shift Board entry points.

### 4. Team Schedule

Current implementation evidence:

- Staff navigation points Team Schedule to `/coverage`.
- Manager Coverage route uses `src/app/(app)/coverage/CoverageClientPage.tsx`.
- Calendar grid lives in `src/components/coverage/CalendarGrid.tsx`.
- Day detail/edit drawer lives in `src/components/coverage/ShiftEditorDialog.tsx`.
- Read-only manager roster route uses `src/app/(app)/schedule/page.tsx` and `src/components/schedule-roster/ScheduleRosterScreen.tsx`.

What the page is trying to help the user do:

- Therapists need to see the full 6-week team schedule and select a day to understand who works that day.
- Managers need to edit or review coverage for a specific day and shift.
- Leads may need a read-only or limited-action view depending on permissions.
- All roles need one obvious place to see the live published schedule.

Why the current UX may be confusing:

- "Team Schedule", "Coverage", and "Roster" are separate labels for related schedule views; Team Schedule should become the canonical live published schedule, while Roster is only a view mode.
- `/coverage` has strong manager tooling, but the title and actions can feel manager-first even when staff need a read-only team view.
- `/schedule` is a read-only roster but defaults to day shift rather than actor shift.
- The 6-week overview exists, but the selected-day detail pattern should be made the standard mental model across staff and manager schedule pages.

What should be visible immediately:

- Full 6-week block.
- Day/Night mode, with therapist visibility clearly marked read-only.
- Read-only vs editable state.
- Selected day summary: date, shift, lead, scheduled staff, current user's presence, open coverage state.
- Current operational statuses such as Scheduled, On Call, Cancelled, Call In, and Left Early.
- For managers and leads: permitted operational status toggles on the live Team Schedule.
- Subtle post-publish change markers for swaps, pickups, Lottery decisions, and operational status changes.

What should move into a detail panel, drawer, or modal:

- Manager assignment editing, candidate lists, status edits, publish warnings, and coverage diagnostics should stay in a drawer or dialog.
- Candidate and assignment views should show compact availability signals: Need Off, Need to Work, No submission, or No exceptions.
- Coverage should include a Before Publish checklist with linked issues for availability hard-rule conflicts, lead coverage, staffing below target, and missing submissions.
- Before Publish checklist should distinguish Publish Blockers from Publish Warnings.
- Need Off should be treated as a hard scheduling no unless a manager explicitly overrides it with a reason.
- Need to Work should be treated as a hard scheduling intent in Coverage, not as a soft preference.
- Staff should see a simplified selected-day panel without manager-only controls.
- Staff may toggle between Day shift and Night shift on Team Schedule, but the surface remains read-only.
- Managers and leads should be able to toggle live operational statuses from Team Schedule when permitted.
- Post-publish change details should move into selected-day detail rather than crowding each calendar cell.
- Both view should stay summary/read-only for operational status changes; managers and leads must select Day or Night before toggling live statuses.
- Print and export controls should stay in secondary actions.

Recommended layout:

- Use one shared team schedule frame:
  - Context bar.
  - 6-week block grid.
  - Selected day panel.
  - Optional manager edit drawer.
- Keep `/coverage` as the manager planning/editing surface.
- Move publish actions and published block lifecycle into Coverage as a Schedule Blocks utility rather than a standalone primary workflow.
- Schedule Blocks utility should distinguish Take offline, Delete, and Start over with explicit impact previews.
- Leads should primarily use Team Schedule, with scoped coverage visibility for their regular shift where needed, rather than the full Coverage workbench by default.
- Reframe `/schedule` as a Roster View of Team Schedule rather than a separate primary workflow.
- Staff Team Schedule should present a read-only version of the 6-week grid and selected day panel, even if it continues to use the `/coverage` route internally.
- Do not add a separate Live Schedule route or nav concept; make Team Schedule carry the live published schedule meaning.
- Add manager/lead operational status controls to selected-day detail on Team Schedule, using the same underlying status lifecycle as Coverage.
- Link to Lottery from Team Schedule selected-day detail when the selected shift has extra staff or an active lottery decision.
- Hide or disable operational status controls in Both view and prompt managers/leads to choose Day or Night before editing.
- Keep the same operational status control available in Coverage when managers are actively resolving staffing, but do not create a second status lifecycle.
- Show current schedule truth first, then expose post-publish change history from selected-day detail.
- If an operational status change creates a coverage gap, save the live status, show the coverage impact, and route the manager to Coverage or Shift Board instead of auto-filling another therapist.
- Cancelled means the scheduled staff member was not needed and should not create a coverage gap.
- Left Early is informational for the day and should not affect the staffing ratio for that day.
- On Call should remain visible on Team Schedule but be grouped separately from actively working staff, should not count as active bedside coverage, and should not automatically create a coverage gap when intentionally assigned.
- Call In is the only operational status that automatically creates possible coverage impact and should route managers or leads to Coverage or Shift Board when staffing falls below target.

Reusable components needed:

- `SixWeekBlockGrid`
- `SelectedDayPanel`
- `ShiftRosterGroup`
- `CoverageHealthBadge`
- `ManagerEditDrawer`
- `ReadOnlyScheduleFrame`

Risks or behavior that must not be broken:

- Coverage assignment, draft, auto-draft, publish, preflight, and assignment status mutations.
- Existing `canEdit` and `canUpdateAssignmentStatus` permission boundaries.
- Coverage remains manager-first while lead operational work stays centered in Team Schedule.
- Leads operate live schedule workflows through Team Schedule, Lottery, and Shift Board visibility; full build/publish Coverage remains manager-first.
- Compact availability signals must not replace the full manager availability review flow.
- Need Off overrides must require a visible manager reason and must not imply therapist agreement.
- Publish/preflight should block or require resolution for Need Off overrides without a manager reason.
- Need Off overrides should notify the therapist and show the conflict in My Shifts with manager reason when present.
- Need to Work conflicts with other scheduling rules must surface a manager conflict warning.
- Publish/preflight should require either scheduling the therapist or adding a manager reason when Need to Work is not honored.
- Need to Work not honored should be visible at publish in My Shifts/notification, not as noisy draft-time alerts.
- Publish, take-offline, safe delete, and start-over actions must preserve existing schedule lifecycle safeguards.
- Published blocks should be taken offline rather than hard-deleted; hard delete should be limited to drafts or unpublished blocks with no live dependencies.
- Taking a block offline does not need staff notification by default, but manager UI should preserve who took it offline and when.
- Offline blocks should be hidden from active staff My Shifts and Team Schedule, and from normal staff history by default, while remaining available to managers in Schedule Blocks utility.
- Republishing an offline block should be allowed only when no replacement block is already published for the same date range, and must require impact confirmation.
- The distinction between editable Coverage and read-only Roster.
- Team Schedule as the canonical live published schedule and Roster as a display mode.
- Manager/lead operational status changes from Team Schedule must preserve existing status persistence, notifications, and permission checks.
- Lead operational status toggles may apply across Day and Night shifts when permitted and must not grant Shift Board final approval.
- Team Schedule and Coverage operational status controls must share the same permissions, persistence, notifications, and audit behavior.
- Operational status changes that reduce coverage must surface manager action without silently changing another therapist's schedule.
- Cancelled and Left Early must not trigger coverage-gap behavior.
- On Call visibility must stay separate from active coverage counts and must not automatically imply an unresolved coverage gap.
- Call In must be the only automatic possible-gap operational status.
- The distinction between shift visibility and edit permission.
- 42-day Sunday-start block semantics.

Suggested implementation phase:

- Phase 3: Team schedule and manager coverage frame.

### 5. Availability therapist flow

Current implementation evidence:

- Route: `src/app/(app)/therapist/availability/page.tsx`.
- Main workspace: `src/components/availability/TherapistAvailabilityWorkspace.tsx`.
- Saved rows are also shown by `src/components/availability/AvailabilityEntriesTable.tsx`.
- The page uses future unpublished cycles, recurring work patterns, cycle overrides, submissions, and scheduled conflict data.

What the page is trying to help the user do:

- Therapists need to tell the scheduler which days are exceptions to their normal scheduling baseline during a Schedule Block.
- They need to distinguish their recurring baseline from one-block changes.
- They need to save progress and submit final availability.
- They may need to submit a Schedule Block even when they have no exceptions, so managers know the block was reviewed.

Why the current UX may be confusing:

- Page metadata and copy still use "Future Availability" in places, while navigation says "Availability".
- Therapist-facing labels use "Can work" and "Can't work" instead of the requested exception language: Need Off and Need to Work.
- The page carries complex state: recurring pattern, selected days, one-block changes, scheduled conflicts, saved progress, and submitted state.
- Manager-facing concepts such as cycle overrides should not leak into therapist language.

What should be visible immediately:

- Schedule Block range and submission status.
- The therapist's regular shift for the submitted exceptions.
- Plain exception legend: Need Off and Need to Work.
- Due date or "submitted" state.
- Whether the availability edit window is open or locked.
- A short summary: need-off days, need-to-work days, inherited baseline days, no-exception days, PTO reasons when known, and conflicts with already scheduled shifts.
- A clear "No exceptions submitted" summary when the therapist reviewed the block without day-level exceptions.
- Clear primary action: Save progress or Submit availability.
- A short review-before-submit step with Schedule Block, regular shift, Need Off dates, Need to Work dates, PTO reasons when known, and edit-window messaging.
- Submitted availability can be edited while the window is open; locked availability should route to manager contact or later workflows.
- Late Need Off or Need to Work changes after lock should be manager-managed rather than silently editing submitted availability.
- Availability locks when a manager closes collection or starts a draft schedule for the Schedule Block.
- Managers may reopen availability intentionally with confirmation; reopening should not delete draft schedule or manager planning data.

What should move into a detail panel, drawer, or modal:

- Recurring pattern setup and advanced baseline editing.
- Conflict explanations for scheduled shifts.
- Review-before-submit summary.
- Existing saved entries table can move below the main workflow or behind a "View saved details" panel.

Recommended layout:

- Top: block context, submission state, and primary action.
- Main: 6-week calendar with a persistent exception legend, optional PTO reason badges under Need Off, and a subdued recurring baseline display when inherited pattern data exists. Need Off and Need to Work both override that baseline for the selected Schedule Block.
- Side panel: selected date/range editor with Need Off, Need to Work, and Clear exception for returning a day to baseline.
- Exception controls should default to the therapist's regular shift so Need Off and Need to Work are not ambiguous across Day and Night.
- Need Off should be understood as regular-shift off by default because therapists rarely switch between days and nights.
- Therapist UI should show "Submitting for Day shift" or "Submitting for Night shift" once near the top, not repeat the shift on every exception chip.
- Secondary: compact recurring pattern summary with a separate edit recurring pattern flow, plus review details.
- Recurring pattern edits should apply to future Schedule Blocks by default, with an explicit option to update the current open Schedule Block baseline.
- Mobile: selected-day editor should be a bottom sheet, not a dense side panel.

Reusable components needed:

- `AvailabilityStateLegend`
- `AvailabilityDayGrid`
- `AvailabilitySelectionPanel`
- `SubmissionStatusCard`
- `RecurringPatternSummary`
- `ConflictNotice`

Risks or behavior that must not be broken:

- `workflow="draft"` versus `workflow="submit"` semantics.
- Official submission records in `therapist_availability_submissions`.
- Recurring pattern separation from one-block changes.
- Recurring pattern editing stays out of the main Schedule Block exception calendar.
- Therapist availability exceptions stay scoped to the therapist's regular shift unless a manager-managed or advanced cross-shift flow is explicitly introduced.
- Scheduled conflict warnings.
- Manager visibility into submitted and missing availability.

Suggested implementation phase:

- Phase 4: Availability vocabulary and flow clarity.

### 6. Availability manager flow

Current implementation evidence:

- Route: `src/app/(app)/availability/page.tsx`.
- Main manager UI: `src/components/availability/ManagerSchedulingInputs.tsx`.
- Queue summary: `src/components/availability/AvailabilityStatusSummary.tsx`.
- Therapist detail: `src/components/availability/therapist-context-panel.tsx`.
- Manager editor: `src/components/availability/manager-availability-editor-panel.tsx`.

What the page is trying to help the user do:

- Managers need to see who has submitted availability, who is missing, who has requests, and what edits are needed before drafting a schedule.
- Managers also need to edit a therapist's availability or planning state when needed.

Why the current UX may be confusing:

- The queue/detail structure is strong, but status vocabulary mixes submitted availability, therapist requests, and manager planning decisions.
- Short chips such as Plan, Work, Block, Off, and Req are efficient but not plain enough for managers under time pressure.
- Manager editor modes include Will work, Cannot work, Need off, and Need to work. These are valid operationally, but they need to be visually separated into manager planning states versus therapist exception states.
- Search, shift filter, work queue, summary, detail panel, and editor all compete for attention.

What should be visible immediately:

- Schedule Block and Day/Night mode.
- Submission counts: submitted, missing, has requests, needs manager review.
- Readiness summary for schedule building: submitted count, missing count, exception count, and lock state.
- Work queue with therapist name, shift, employment type, submission state, and request count.
- Selected therapist detail with latest submission, request days, manager edits, and next action.
- Clear separation between "Therapist submitted" and "Manager plan".

What should move into a detail panel, drawer, or modal:

- Manager day-by-day edit controls should stay in the selected therapist detail panel.
- Therapist-submitted exceptions and manager planning edits should appear as separate layers in the detail panel.
- Bulk reminder tools and CSV/intake utilities should stay in secondary actions.
- Full activity history can move into a drawer.

Recommended layout:

- Top: manager availability context bar.
- Left: queue grouped and ordered by Missing submissions, Submitted with exceptions, Submitted with no exceptions.
- Right: selected therapist detail with a 6-week grid and manager edit controls.
- Keep Day/Night mode prominent and default selection to the current manager/lead shift when known.
- Manager rows and cards should repeat shift because managers scan mixed staff.
- Show "Ready to build" only when the manager-defined threshold is met; otherwise warn without hard-blocking schedule building.
- Managers can proceed to Coverage even when availability is not ready, but starting schedule building should warn and confirm that availability will lock.
- Availability should use a simple Schedule Block selector for submission collection and review, not the full Schedule Blocks lifecycle utility.
- Use two visual layers in the editor:
  - Therapist exception layer: Need Off and Need to Work.
  - Manager planning layer: Scheduled/Do not schedule or manager note, when needed.
- If manager planning conflicts with therapist input, show the conflict explicitly instead of overwriting the therapist's visible submission.

Reusable components needed:

- `SubmissionQueue`
- `SubmissionStatusBadge`
- `TherapistAvailabilityDetail`
- `ManagerAvailabilityEditPanel`
- `AvailabilityStateLegend`
- `ManagerPlanningLegend`

Risks or behavior that must not be broken:

- Missing/submitted calculations.
- Manager ability to edit availability for a therapist.
- Therapist submission auditability when manager planning differs from submitted exceptions.
- Shift filter behavior and selected therapist behavior.
- Intake redirect from `?tab=intake` to `/availability/intake`.
- Existing authorization for manager-only access.

Suggested implementation phase:

- Phase 4: Availability vocabulary and manager queue clarity.

### 7. Shift Board / Shift Swaps

Current implementation evidence:

- Manager board route: `src/app/(app)/shift-board/page.tsx`.
- Board UI: `src/components/shift-board/ShiftBoardClientPage.tsx`.
- Therapist swaps route: `src/app/(app)/therapist/swaps/page.tsx`.
- Request creation route: `src/app/(app)/requests/new/page.tsx`.
- Composer: `src/components/requests/RequestComposer.tsx`.
- History and selected request view: `src/components/requests/RequestsHistoryView.tsx`.
- Lifecycle staging logic: `src/lib/request-page-data.ts`.
- Board snapshot data: `src/lib/shift-board-snapshot.ts`.

What the page is trying to help the user do:

- Therapists need to request a swap, give away a shift, respond to a direct request, show pickup interest, and track their own requests.
- Managers need to approve, deny, select pickup claimants, resolve missing lead issues, and review open board items.
- Managers may need to create or resolve Shift Board posts on behalf of therapists after verbal or operational requests.

Why the current UX may be confusing:

- The UI carries many lifecycle states on each card: direct recipient response, manager approval, open board visibility, pickup interest, primary claimant, backup claimants, swap partner, override, and history.
- Cards often show several badges, and the user must infer whether the action belongs to them or someone else.
- Therapist terms such as "Give away (pickup)", "Suggested on board", and "Open swap" can be simplified.
- Manager and therapist views share a lot of surface area, but they need different first questions.

What should be visible immediately:

- Needs your action.
- Open to team.
- My requests.
- Waiting on someone else.
- History.
- For each request: date, shift, request type, owner, current stage, next action owner, and current user's allowed action.
- Waiting state labels that distinguish Waiting on teammate from Waiting on manager.

What should move into a detail panel, drawer, or modal:

- Full request timeline.
- Pickup primary/backup claimant details.
- Manager override reason.
- Swap partner selector.
- Schedule Impact Preview showing affected days, people, shift modes, coverage counts, and resulting Team Schedule changes.
- Audit/history details.

Recommended layout:

- Shared sections for all roles:
  - Needs Action.
  - Open Shifts.
  - My Requests.
  - History.
- Default to Needs Action for all roles, with tab counts and an empty state when no action is needed.
- Open Shifts should combine pickup opportunities and open swap requests, using clear item type labels and optional filters instead of separate sections.
- Therapist:
  - Needs Action shows direct requests to answer, manager feedback, and pending confirmations.
  - Open Shifts shows opportunities on the board.
  - My Requests shows items they created or are involved in.
  - Composer should use plain choices for creating requests: Trade shift, Give up shift, Ask a specific teammate.
  - Picking up a shift should start from an existing Open Shifts card, not from New Request.
  - Give up shift can ask a specific teammate or post to Open Shifts.
- Manager:
  - Needs Action shows approvals, pickup selection, coverage-impacting items, and blocked requests.
  - Open Shifts shows unresolved board items.
  - My Requests can show manager-created or manager-owned items when applicable.
  - Cards should state "Manager decision needed", "Waiting on therapist", "Open for pickup", or "Already approved".
  - On-behalf posts should clearly show "Created by manager for [Therapist]" or equivalent attribution.
- Therapist cards should state "Waiting on teammate", "Waiting on manager", "Approved", "Declined", "Denied by manager", or "Withdrawn" where applicable.

Reusable components needed:

- `RequestLifecycleCard`
- `LifecycleStageBadge`
- `ActionOwnerLabel`
- `PickupQueuePanel`
- `RequestTimelineDrawer`
- `RequestComposerStepper`

Risks or behavior that must not be broken:

- Direct request send, accept, decline, withdraw, and manager approval flow.
- Pickup primary and backup claimant ordering.
- Manager approval and denial actions.
- Swap partner assignment.
- Request visibility and role permissions.
- On-behalf post attribution and auditability.
- Manager-only final approval before Shift Board requests change Team Schedule or My Shifts.
- Notification behavior tied to state changes.
- Approved pickup resolution updating Team Schedule while preserving the original Call In or other source status.
- Approved swaps updating Team Schedule and both therapists' My Shifts views while preserving Shift Board history.
- Shift Board as the shared workflow name across therapist, lead, and manager UI.
- Shared Shift Board sections: Needs Action, Open Shifts, My Requests, History.
- Needs Action as the default section with counts on all sections.

Suggested implementation phase:

- Phase 5: Shift board action architecture.

### 8. Lottery

Current implementation evidence:

- Route: `src/app/(app)/lottery/page.tsx`.
- Client UI: `src/components/lottery/LotteryClientPage.tsx`.
- Recommendation logic: `src/lib/lottery/recommendation.ts`.
- Snapshot/service logic: `src/lib/lottery/service.ts`.

What the page is trying to help the user do:

- Managers and leads need to decide who should remain scheduled, be cancelled, or be placed on call when staffing needs change.
- Therapists need transparent visibility into their shift's lottery order and their own position without decision controls.
- The page should explain the recommendation, show PRN status, account for volunteers, preserve history, and make decisions auditable.

Why the current UX may be confusing:

- The current page is a functional utility with controls, recommendation, request list, and lottery list. It is not yet a single decision center.
- Scheduled staff, PRN involvement, volunteers, lottery history, and recommendation reasons are spread across separate areas.
- The user may not immediately see which staff are scheduled for the selected day/shift and how the recommendation was reached.
- Request list and lottery list are useful, but the decision should be framed around "what happens next?".
- Current permissions and layout do not yet express the desired model: Team Schedule drives Lottery, leads make day-of decisions for their regular shift, and therapists get transparent list position.

What should be visible immediately:

- Selected date and Day/Night shift.
- Scheduled staff for that shift, grouped by role and PRN/core status.
- Volunteers or requests affecting the decision.
- Recommendation: keep working, cancel, or on call.
- Reason for recommendation in plain language.
- Latest applied decision and whether the recommendation is stale.
- Resulting Team Schedule status when a decision has been applied.
- Current user's lottery position when the viewer is a therapist.
- Full lottery order for the therapist's shift, using neutral wording.
- Permission state: manager/lead apply across shifts, therapist view only.

What should move into a detail panel, drawer, or modal:

- Full lottery history.
- Request entry and manager add-on-behalf controls.
- Override reason and final confirmation.
- Detailed ranking explanation.
- Therapist-facing list-position details.

Recommended layout:

- Top: decision context bar with date, shift, scheduled count, and required count.
- Main left: scheduled staff table grouped by Lead, Core, PRN, Volunteers.
- Main right: recommendation panel with reason, confidence, latest applied decision, and action buttons.
- Lower: request list, lottery order, and history tabs.
- Mobile: start with recommendation, then scheduled staff, then request/history tabs.

Reusable components needed:

- `LotteryDecisionCenter`
- `ScheduledStaffTable`
- `RecommendationPanel`
- `RecommendationReasonList`
- `LotteryHistoryTimeline`
- `DecisionOverrideDialog`

Risks or behavior that must not be broken:

- Current recommendation ranking rules, including volunteer priority and PRN involvement.
- Applied decision history and stale recommendation detection.
- Manager override reasons.
- Date/shift context signature.
- Existing manager-only access.

Suggested implementation phase:

- Phase 6: Lottery decision center.

### 9. Shared components and visual hierarchy

Current implementation evidence:

- Pages reuse some strong local patterns: segmented controls, badges, side drawers, queue/detail layouts, and calendar grids.
- Many schedule pages implement their own context, labels, and mobile behavior.
- Status colors are useful but not fully standardized across availability, coverage, requests, and lottery.

What the page is trying to help the user do:

- Shared components should reduce cognitive load by making the same concept look and behave the same everywhere.

Why the current UX may be confusing:

- "Cycle", "block", "schedule", "coverage", "roster", "availability", and "future availability" appear as separate concepts.
- Day/Night toggles vary by page.
- Status badges and action states are locally correct but not globally consistent.
- Permission state is often implied by hidden controls rather than explicitly labeled.

What should be visible immediately:

- Workflow title.
- Schedule block.
- Shift mode.
- Permission state.
- Primary action.
- Action owner.
- Selected day or selected therapist when applicable.

What should move into a detail panel, drawer, or modal:

- Candidate lists.
- Audit history.
- Advanced filters.
- Bulk operations.
- Override reasons.
- Full request timelines.

Recommended layout:

- Use a standard page spine:
  - Page title and role context.
  - Schedule context bar.
  - Primary action queue or overview.
  - Main working surface.
  - Detail panel/drawer.
- Keep page sections unframed where possible and use cards for repeated items, dialogs, and discrete records.
- Use semantic status groups rather than many one-off colors.
- Keep operational statuses understandable without assigning every status a loud competing color.
- Use full operational status labels by default; abbreviations such as OC, CX, CI, or LE should appear only in dense manager table views with a legend or tooltip.

Reusable components needed:

- `ScheduleContextBar`
- `ShiftModeToggle`
- `SixWeekBlockGrid`
- `SelectedDayPanel`
- `ActionQueue`
- `ActionCard`
- `StatusBadge`
- `PermissionStateBadge`
- `DetailDrawer`
- `EmptyState`
- `ResponsiveTwoPaneLayout`

Risks or behavior that must not be broken:

- Local server components and client components currently divide data loading and interactivity carefully.
- Avoid adding a global state layer unless existing patterns require it.
- Preserve current server action boundaries and permission checks.

Suggested implementation phase:

- Phase 1 first, then reused in Phases 2 through 7.

### 10. Mobile responsiveness

Current implementation evidence:

- `AppShell.tsx` includes mobile top bar, bottom navigation, and drawer.
- `CalendarGrid.tsx` has a mobile week-by-week schedule view.
- `RosterScheduleView.tsx` includes mobile day cards.
- `TherapistShiftCalendar.tsx` uses a horizontally scrollable 7-day grid.

What the page is trying to help the user do:

- Mobile users need to check their schedule, submit availability, respond to requests, and understand today's team quickly.
- Leads need day-of operational access to Team Schedule, operational status toggles for their regular shift, and Lottery for their regular shift.
- Managers may need quick triage on mobile, but dense manager editing and schedule building can remain desktop-optimized.

Why the current UX may be confusing:

- Mobile schedule behavior differs by page: coverage has week navigation, roster has day cards, and therapist schedule uses a wide horizontal grid.
- Critical context can scroll away.
- Dense cards and many badges make action ownership harder to scan.
- Manager editing drawers may be heavy on small screens.

What should be visible immediately:

- Sticky block and shift context.
- Current workflow.
- Selected day.
- Primary action or no-action state.
- Current user's own shifts and requests.

What should move into a detail panel, drawer, or modal:

- Filters.
- Full timelines.
- Candidate lists.
- Manager override controls.
- Bulk actions.

Recommended layout:

- Shared mobile schedule pattern:
  - Sticky context bar.
  - Week selector or day strip.
  - Selected-day card.
  - Primary action footer when relevant.
- Therapist-first mobile navigation should prioritize Dashboard, My Shifts, Availability, Team Schedule, and Shift Board.
- Lead mobile should prioritize Team Schedule, regular-shift operational statuses, Shift Board visibility, and Lottery for the lead's regular shift.
- Manager mobile should prioritize Dashboard, Coverage issues, Availability submissions, Shift Board decisions, and Lottery decision view, while dense build/edit work remains desktop-first.

Reusable components needed:

- `MobileScheduleNavigator`
- `MobileSelectedDayCard`
- `BottomActionBar`
- `MobileFilterSheet`
- `MobileActionQueue`

Risks or behavior that must not be broken:

- Existing desktop manager workflows.
- Dialog focus management.
- Touch target accessibility.
- Any route guards or auth redirects.

Suggested implementation phase:

- Phase 7: Mobile pass after shared desktop patterns stabilize.

Mobile priority:

- Priority 1: therapist quick use.
- Priority 2: lead day-of operations.
- Priority 3: manager triage.
- Desktop-first: dense manager schedule building and broad coverage editing.

## Proposed reusable component system

### ScheduleContextBar

Purpose:

- One consistent schedule identity strip across schedule-related pages.

Content:

- 6-week block date range.
- Sunday start label.
- Schedule status: Draft, Preliminary, Published, Review needed, Read-only.
- Day/Night mode.
- Permission state: You can edit, Read-only, Manager only, Waiting on publish.
- Optional block selector.
- Role-aware default: Team Schedule starts Day with Day, Night, Both order; lead-scoped views use the lead's regular shift; therapist personal views use the therapist's own shift.

Primary consumers:

- Dashboard previews, My Shifts, Team Schedule, Coverage, Roster, Availability, Shift Board, Lottery.

### ShiftModeToggle

Purpose:

- Make Day/Night a first-class mode.

Behavior:

- Default by surface: Team Schedule starts Day with Day, Night, Both order; lead-scoped views use the lead's regular shift; therapist personal views use the therapist's own shift.
- Show both modes for users with permission.
- Disable or annotate restricted modes.
- Persist locally within the workflow where safe.

### SixWeekBlockGrid

Purpose:

- Standard 42-day Sunday-start overview.

Behavior:

- Week rows always start Sunday.
- Selected day is visually obvious.
- Today is distinct from selected day.
- Current user's shifts can be highlighted.
- Day details are not overloaded into the cells.

### SelectedDayPanel

Purpose:

- Answer "who works this day?" and "what can I do?".

Content:

- Date and shift.
- Lead, staff, PRN/extra staff.
- Current user's assignment.
- Coverage state.
- Open actions.
- Link to edit drawer for managers.

### ActionQueue and ActionCard

Purpose:

- Standardize triage.

Each card should include:

- Actor: You, manager, therapist, team.
- Object: availability, shift request, coverage issue, lottery decision.
- State: needed, waiting, open, done.
- Destination.
- Due or age when relevant.

### AvailabilityStateLegend

Purpose:

- Keep therapist availability simple.

States:

- Need Off.
- Need to Work.
- Inherited baseline, shown as context from the recurring pattern when it exists.
- No exception, shown as the absence of therapist-entered availability input.
- PTO reason, shown only as optional supporting context under Need Off.

Manager-only extension:

- Manager scheduled.
- Manager will not schedule.
- Manager note.

### RequestLifecycleCard

Purpose:

- Make shift swap/pickup states deterministic and readable.

Content:

- Request type.
- Shift.
- Current owner.
- Current stage.
- Next action.
- Direct response or pickup queue status.
- Manager decision state.

### LotteryDecisionPanel

Purpose:

- Turn lottery from a utility into a decision center.

Content:

- Recommendation.
- Reason.
- Scheduled staff.
- PRN involvement.
- Volunteers.
- Latest applied decision.
- Override controls.

## Suggested implementation phases

### Phase 0: Audit and planning

Scope:

- This document.
- No production behavior changes.

Verification:

- Lint, typecheck, and build should remain unchanged by the documentation-only change.

### Phase 1: Shared vocabulary and schedule context

Scope:

- Status: partially complete. My Shifts now has the first shared schedule context implementation; broader reuse across Team Schedule, Coverage, Availability, Shift Board, and Lottery remains future work.
- Add shared schedule terminology and low-risk reusable components.
- Establish the canonical navigation model: My Shifts, Team Schedule, Coverage, Availability, Shift Board, Lottery.
- Fold Publish into Coverage and add a Schedule Blocks manager utility for published block history and lifecycle actions.
- Keep Availability on the same Schedule Block terminology but only expose selector/review states, not destructive lifecycle actions.
- Add destructive-action impact review for take-offline, delete, and start-over actions.
- Replace user-facing "cycle" language with "Schedule Block" where it does not alter code or data contracts.
- Introduce `ScheduleContextBar` and `ShiftModeToggle` in one or two low-risk pages first.
- Do not change routes in Phase 1; update safe labels and shared context while preserving existing URLs.

Do not change:

- Routes.
- Server actions.
- Supabase schema.
- RLS.
- Scheduling algorithms.

Suggested first surfaces:

- My Shifts - complete for the first slice.
- Team Schedule read-only frame.

### Phase 2: Therapist schedule clarity

Scope:

- Status: partially complete. My Shifts now covers the full Schedule Block and selected-day clarity without backend changes.
- Complete: make My Shifts show the full 6-week block.
- Complete: keep non-working days visible while highlighting the therapist's scheduled days.
- Complete: clarify own shift default.
- Complete: add selected-day detail for coworkers.
- Complete for first slice: simplify filters into highlights and clarify view labels.
- Remaining: add next shift/upcoming personal shifts below the block if still useful after selected-day detail.
- Remaining: add mobile-specific week strip polish.
- Remaining: add calendar-started Shift Board entry points only after request lifecycle wiring is scoped and tested separately.

Critical behavior to preserve:

- Published schedule only.
- Current user's assignment detection.
- Coworker grouping by shift.

### Phase 3: Team Schedule and manager Coverage frame

Scope:

- Standardize 6-week overview plus selected-day detail across Team Schedule, Coverage, and Roster View.
- Support manager/lead live operational status toggles in Team Schedule selected-day detail.
- Reuse the same operational status control in Coverage when needed for staffing work.
- Add regression coverage for operational status changes that create staffing gaps and confirm they route to manager resolution rather than auto-fill.
- Add regression coverage that Cancelled and Left Early do not create coverage gaps.
- Add regression coverage that On Call remains visible, does not count as active bedside coverage, and does not automatically create a gap when intentionally assigned.
- Add regression coverage that Call In creates possible coverage impact and routes manager/lead users to resolution when staffing falls below target.
- Keep manager edit controls in the existing drawer/dialog pattern.
- Clarify read-only versus editable modes.

Critical behavior to preserve:

- Coverage mutations.
- Draft, preliminary, publish, preflight, and assignment status flows.
- Compact availability signals in Coverage candidate and assignment views.
- `/coverage` editable manager workspace and `/schedule` Roster View distinction.

### Phase 4: Availability language and queue clarity

Scope:

- Rename therapist-facing states to Need Off and Need to Work, with unmarked days treated as baseline rather than an explicit Available choice.
- Preserve recurring pattern display as inherited baseline context, not as a third therapist-entered state.
- Show recurring pattern as a compact baseline summary with a separate edit flow.
- Default recurring pattern changes to future Schedule Blocks only; require explicit opt-in for the current open block.
- Show PTO as an optional reason under Need Off when known, not as a separate availability state.
- Treat Need Off and Need to Work as Schedule Block exceptions that override the inherited baseline for that block.
- Treat Need Off as hard no; manager override requires visible reason.
- Treat Need to Work as hard scheduling intent; if another rule prevents it, show a manager conflict warning.
- Default therapist-entered exceptions to the therapist's regular shift.
- Keep internal values unchanged.
- Separate therapist request states from manager planning states.
- Preserve therapist-submitted exceptions as their own visible layer when managers add or change planning data.
- Keep manager queue/detail layout but simplify status language.

Critical behavior to preserve:

- Save progress vs submit.
- Official submission truth.
- Valid no-exception submissions.
- Availability edit-window state.
- Plain lock labels: Availability open, Availability submitted, Availability locked, Schedule building started.
- Reopen availability impact review when schedule building has started.
- Recurring pattern separation.
- Manager editing authority.
- Missing submission calculations.
- Manager availability queue order: missing first, exceptions second, no-exception submissions third.
- Availability readiness summary before moving into Coverage.

### Phase 5: Shift Board action architecture

Scope:

- Reorganize board into Needs action, Open board, My items, and History.
- Use the same section names for each role, with role-specific content and actions.
- Default to Needs Action and provide empty-state routing to Open Shifts, My Requests, and History.
- Keep pickup opportunities and open swap requests together under Open Shifts with item type labels.
- Use Shift Board as the canonical workflow name; keep Direct Swap Request, Open Swap Request, and Pickup Request as item types inside the board.
- Keep New Request focused on trade/give-up request creation; pickup responses begin from Open Shifts posts.
- Let Give up shift target a specific teammate or post to Open Shifts, with manager approval before the live schedule changes.
- Posting a give-up request to Open Shifts must not change Team Schedule until manager approval finalizes a replacement or other resolution.
- Add calendar-started request creation from My Shifts selected-day detail for Give up this shift and Trade this shift.
- Add Schedule Impact Preview before therapist submission and manager approval so both sides understand the overall schedule effect.
- Keep therapist requests sendable when the preview shows a coverage concern; show a Manager-review warning instead of blocking unless the request is structurally invalid.
- Make action owner explicit on every card.
- Simplify therapist composer language.
- Move timelines, claimant details, and overrides into drawers.
- Ensure approved pickups update Team Schedule as the live truth after Shift Board resolution.
- Ensure manager-approved swaps update Team Schedule and My Shifts as the live truth after Shift Board resolution.

Critical behavior to preserve:

- Direct request response lifecycle.
- Manager approval lifecycle.
- Pickup primary/backup claimant ordering.
- Notifications tied to request state.
- Team Schedule visibility after pickup approval.
- Team Schedule and My Shifts visibility after approved swaps.
- Subtle post-publish change markers with details in selected-day panels.

### Phase 6: Lottery decision center

Scope:

- Reframe Lottery around scheduled staff, PRN status, volunteers, history, recommendation, and reason.
- Make Lottery driven by the live Team Schedule for the selected date and shift.
- Keep current recommendation service and applied decision lifecycle.
- Add clearer stale/applied recommendation states.
- Apply decisions as live Team Schedule operational statuses: Cancelled or On Call.
- Lottery decisions must be Day- or Night-specific; no Both apply mode.
- Support role permissions: managers and leads apply across shifts, therapists view their shift order and own position only.
- Show therapists the full lottery order for their shift with neutral labels and no manager-only rationale/actions.
- Keep Lottery as a primary workflow for managers/leads and add contextual links from Team Schedule; lead-applied decisions require attribution/history, and therapists can see lottery order context from schedule surfaces without needing primary Lottery navigation.

Critical behavior to preserve:

- Recommendation ranking rules.
- PRN involvement handling.
- Applied decision history.
- Manager override reasons.
- Team Schedule and My Shifts visibility of applied Cancelled or On Call statuses.
- Shift-specific application of Lottery decisions.
- Therapist transparency without apply controls.
- Full shift lottery order visibility for therapists using calm, factual language.

### Phase 7: Mobile responsiveness pass

Scope:

- Standardize sticky block/shift context.
- Add shared mobile schedule navigator.
- Make selected-day detail the primary mobile interaction.
- Improve action queues for therapist and manager mobile use.

Critical behavior to preserve:

- Existing desktop layouts.
- Route access and auth redirects.
- Dialog/drawer focus management.

Note:

- Because this phase spans many user-facing surfaces, it should remain explicitly scoped and approved before implementation.

## Testing checklist

### Source and unit checks

- `npm run lint`
- `npm run typecheck`
- Unit tests for schedule date helpers, especially 42-day Sunday-start blocks.
- Unit tests for Day/Night default selection from profile or actor role.
- Unit tests for therapist availability state mapping: Need Off, Need to Work, inherited baseline display, and cleared no-exception days to existing internal values.
- Unit tests for request lifecycle labels and action-owner derivation.
- Unit tests for lottery recommendation reasons and stale/applied state labels.

### Browser workflow checks

- Therapist Dashboard:
  - Shows one clear next action.
  - Links to My Shifts, Availability, Team Schedule, and Shift Swaps.

- My Shifts:
  - Shows full 6-week block.
  - Defaults to user's own shift.
  - Selecting a day shows coworkers.
  - Read-only status is clear.

- Team Schedule:
  - Shows all 6 weeks.
  - Day/Night modes are visually separated.
  - Selecting a day shows lead and staff for that day.
  - Staff users do not see manager edit controls.
  - Post-publish changes show subtle markers and selected-day details without obscuring current truth.

- Therapist Availability:
  - Shows Need Off and Need to Work as explicit exception choices.
  - Allows submitting with no exceptions and shows "No exceptions submitted".
  - Save progress and Submit remain distinct.
  - Submitted availability can be edited only while the edit window is open.
  - Review-before-submit summarizes Schedule Block, shift, exceptions, PTO reasons, and edit-window state.
  - Scheduled conflict warnings still appear.
  - Submitted state is clear.

- Manager Availability:
  - Submitted and missing therapists are visible.
  - Day/Night filter is obvious.
  - Selecting a therapist opens editable details.
  - Manager edits do not obscure therapist submissions.

- Shift Board:
- Direct request accept/decline lifecycle is clear.
- Pickup interest shows primary and backup claimant states.
  - Manager approvals show what needs manager action.
  - Current user's items are easy to identify.
  - Approved pickups update Team Schedule and resolve coverage only when staffing target is met.
  - Approved swaps update Team Schedule and both therapists' My Shifts views while preserving request history.

- Lottery:
  - Selected date and shift are clear.
  - Scheduled staff and PRN status are visible.
  - Recommendation includes reason.
  - Apply and override flows preserve history.
  - Applied decisions update Team Schedule and My Shifts status as Cancelled or On Call.
  - Decisions apply to one shift at a time, not Both.
  - Managers and leads can apply across shifts, and therapists can view their shift order and own position without apply controls.

### Regression risks to test specifically

- Staff cannot access manager-only routes.
- Managers can still edit coverage and availability where allowed.
- Publishing and preflight behavior remain unchanged.
- Request notifications still fire on send, accept, decline, withdraw, approve, deny, pickup interest, and selection events.
- Need Off override notifications fire when a manager schedules a therapist on a Need Off day.
- Publish/preflight catches Need Off overrides without manager reasons.
- Need to Work not honored notifications or My Shifts details appear at publish, with manager note when present.
- Publish/preflight catches Need to Work not honored without manager reasons.
- Before Publish checklist links each issue to the affected day and therapist.
- Unresolved blockers prevent publish; acknowledged warnings can publish with manager judgement.
- Missing availability submissions are warnings that require manager acknowledgement but do not block publish once acknowledged.
- Critical staffing below target blocks publish until manager acknowledgement and reason are recorded, then remains as a warning.
- Missing required lead coverage blocks publish until resolved or acknowledged with manager reason, then remains visible as a warning.
- Published operational warnings are manager/lead visible by default; staff see only warnings that directly affect them personally.
- Lottery decisions remain auditable after apply or override.

## Accessibility and responsive checklist

### Accessibility

- All interactive calendar days are keyboard reachable.
- Selected day, today, disabled day, and current user's shift are not color-only distinctions.
- Segmented controls expose selected state to assistive technology.
- Cards that act like buttons should use buttons or links, not only clickable divs.
- Drawers and modals trap focus, restore focus on close, and have clear labels.
- Action cards include text labels for state and owner.
- Attention items appear both as dashboard summaries and inline workflow context without duplicating noisy alerts.
- Status colors meet contrast requirements.
- Status abbreviations have visible legends and are not the only way to understand the state.
- Touch targets are at least 44 by 44 CSS pixels on mobile.
- Error, warning, and conflict states include plain text.

### Responsive

- Schedule context stays visible on mobile.
- Day/Night toggle does not wrap awkwardly or hide the selected state.
- 6-week views collapse to week/day navigation without losing the block range.
- Selected-day detail appears as a bottom sheet or stacked card on small screens.
- Manager dense tables remain usable with sticky labels or mobile cards.
- Primary actions stay reachable without covering critical schedule information.
- Horizontal scrolling is used only when the table format is essential and labels remain sticky.

## Non-goals for the first implementation phases

- Do not change Supabase schema or RLS.
- Do not rewrite scheduling, coverage, availability, request, or lottery business logic.
- Do not rename routes as part of initial UI work.
- Do not merge manager and staff workflows into one permission-heavy page.
- Do not redesign mobile across all surfaces until shared desktop patterns are stable.
- Do not hide lifecycle states to make the UI simpler. Instead, group them and name the action owner clearly.

## Recommended first implementation slice

Status: complete as of the My Shifts clarity slice.

The safest first code slice was Phase 1 plus a small part of Phase 2:

1. Complete: Introduce shared display vocabulary for "Schedule Block", "Day shift", "Night shift", and "Read-only" on My Shifts. "Editable" remains future work for manager-owned surfaces.
2. Complete: Add a `ScheduleContextBar` to My Shifts using existing data.
3. Complete: Expand My Shifts from 35 days to the full 42-day block using existing published schedule data without changing backend behavior.
4. Complete: Add selected-day detail for My Shifts so therapists can immediately see coworkers.
5. Complete: Add focused tests for 42-day display, Sunday-start behavior, own-shift default behavior, selected-day coworkers, and non-working day visibility.

This slice improves therapist comprehension without touching manager editing, Supabase schema, RLS, publishing, request lifecycle, or lottery decisions.

Verification from the completed slice:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test:unit -- src/lib/my-shifts-schedule-block.test.ts src/components/schedule/TherapistShiftCalendar.test.ts`
- `git diff --check`

Browser note: unauthenticated `/therapist/schedule` redirects to login locally, so authenticated browser verification remains a follow-up when a seeded therapist session is available.

## Recommended next implementation slice

Keep the next slice narrow and still therapist-safe:

1. Extract the selected-day detail and coworker list only if Team Schedule or another page is ready to reuse it.
2. Add the My Shifts next-shift or upcoming-shifts summary using the existing published schedule data already available to the page.
3. Do mobile-only polish for the My Shifts 6-week block and selected-day detail.
4. Do not add calendar-started Give up this shift or Trade this shift actions until Shift Board request lifecycle wiring is scoped as its own tested slice.
