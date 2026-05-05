# Teamwise Frontend UX/UI Implementation Plan

Source audit: `docs/FRONTEND_UX_UI_REDESIGN_GUIDE.md`

This plan breaks the frontend UX/UI audit into small, reviewable phases. Each phase must preserve scheduling business logic, Supabase contracts, auth behavior, auto-draft, publish logic, routes, and existing tests unless that phase explicitly says otherwise.

## Current Completed Items

These items are already implemented or present in the current checkout and should not be redone unless a regression is found:

- Manager primary nav uses `Dashboard` instead of `Today`.
- Manager dashboard h1 uses `Dashboard` instead of `Inbox`.
- Manager dashboard actionable content renders before metric cards.
- `/team` defaults to `Directory` when no tab search param is present.
- `?tab=roster` still opens Employee roster.
- Shift Board is directly visible under manager `People` navigation.
- `/shift-board` activates the Shift Board nav subitem instead of Requests.
- Manager Schedule local nav uses `Coverage` and `Roster` in the current worktree.
- `/coverage` uses a Coverage h1/title and shows cycle status plus Day/Night context more prominently in the current worktree.
- Staff nav uses `Availability` instead of `Future Availability`.
- Staff nav uses `Shift Swaps` instead of `Shift Swaps & Pickups`.
- Manager `People > Requests` links directly to `/requests/user-access` while the `/requests` route remains available.
- Homepage feature strip no longer uses decorative side-stripe card borders in the current worktree.
- Homepage tests guard against decorative side-stripe feature-card regressions.
- Signup phone label already marks the field optional.
- Login already includes a "Forgot password?" link.

## Risk Buckets

### Low Risk: Copy, Nav, And Route Clarity

- Staff nav `Future Availability` was renamed to `Availability` while preserving `/therapist/availability`.
- Rename staff nav `Shift Swaps & Pickups` to `Shift Swaps` while preserving `/therapist/swaps`.
- Clarify read-only roster copy and CTAs so `/schedule` stays clearly read-only and `/coverage` stays the edit destination.
- Keep route metadata and h1 text aligned with route purpose.
- Manager `Requests` now links directly to `/requests/user-access` while preserving the hub route and pending badge.

### Medium Risk: Component Hierarchy And Page Priorities

- Dashboard and Shift Board content hierarchy changes that reorder existing data without changing loaders or permissions.
- Homepage/auth copy polish and shared auth panel extraction if it stays presentation-only.
- Coverage header/component extraction for action hierarchy without moving assignment, draft, publish, or calendar logic.
- Therapist availability action hierarchy such as stronger Save progress vs Submit availability treatment.

### High Risk: Scheduling Surfaces And Mobile Layouts

- Coverage calendar, roster, drag/drop, assignment, or auto-draft behavior.
- Availability route split or intake route changes.
- Mobile schedule pass across therapist schedule, availability, Coverage, and roster surfaces.
- Any change requiring Supabase schema, migrations, RLS, seed data, auth rules, or data-loading contracts.

## Phased Plan

### Phase A: Documentation And Planning

Deliverable: this implementation plan.

Acceptance criteria:

- The plan names completed audit items.
- Remaining work is grouped by risk.
- Later implementation phases are small enough to review independently.
- No app behavior changes are required for this phase.

Verification:

- `git diff --check`

### Phase B: Low-Risk Copy And Route Clarity

Completed Phase B slices:

- Rename staff nav `Future Availability` to `Availability`.
- Update shell tests only.
- Preserve route, page h1, metadata, dashboard copy, data loading, and therapist availability behavior.
- Rename staff nav `Shift Swaps & Pickups` to `Shift Swaps`.
- Preserve route, page h1, metadata, dashboard cards, workflow labels, and request behavior.
- Point manager `People > Requests` directly to `/requests/user-access`.
- Preserve `/requests`, People active states, and pending access-request badge behavior.

Deferred Phase B candidates:

- Continue harmonizing `Open Coverage` and read-only roster copy if more stale copy appears.

Verification:

- Targeted shell tests.
- `npm run lint`
- `npm run typecheck`
- `git diff --check`

### Phase C: Homepage/Auth Polish

Scope:

- Remove banned homepage side-stripe feature-card pattern if still present.
- Add signup "What happens next?" microcopy if absent.
- Extract shared auth brand panel only if the diff stays presentation-only.

Do not change auth behavior, redirects, Supabase calls, or onboarding gates.

Current Phase C slice:

- Add signup "What happens next?" approval-queue microcopy below the submit button.
- Preserve signup redirect to `/login?status=requested`, Supabase auth call, field requirements, and public layout.
- Add a homepage source-contract test that preserves the feature strip while blocking decorative `border-l` side-stripe cards.

### Phase D: Dashboard And Shift Board Content Hierarchy

Scope:

- Make actual Shift Board request rows more prominent than metric cards.
- Preserve server snapshots, role behavior, request lifecycle, and approval actions.

Current Phase D slice:

- Move the Shift Board KPI cards below the operational request-card list as a lower-priority `Board summary`.
- Preserve header status pills, summary banner, tabs, filters, request loading, approval actions, and pickup/swap lifecycle behavior.

### Phase E: Coverage Header Hierarchy Only

Scope:

- Continue refining Coverage header hierarchy only after the current Coverage naming work is reviewed.
- Consider extracting a context/action bar only if it reduces file complexity without moving scheduling logic.

Do not change calendar cells, assignment mutations, pre-flight, auto-draft, publish, or template behavior.

Current Phase E slice:

- Make the Coverage cycle context bar a labeled section with the active cycle range and explicit cycle status.
- Put Day/Night before Layout in the context controls so shift context is the first visible mode decision.
- Preserve cycle switching, view switching, shift switching, auto-draft, preliminary, publish, print, and calendar behavior.

### Phase F: Availability Workflow Polish

Scope:

- Make Save progress vs Submit availability visually distinct.
- Consider sticky action footer if it is low-risk and accessible.
- Keep recurring pattern and cycle-specific availability semantics separate.

Do not split routes or change availability writes without explicit approval.

Current Phase F slice:

- Make therapist Save progress read as a lower-weight draft action.
- Keep Submit availability as the primary action with manager-notification copy.
- Preserve `workflow="draft"` and `workflow="submit"` form values, action routing, selected-cycle state, availability writes, and submission lifecycle behavior.

### Phase G: Mobile Schedule Pass

Plan only until explicitly approved.

Scope:

- Therapist mobile navigation and week-by-week schedule/availability patterns.
- Mobile touch target and layout improvements for therapist workflows.

Do not implement this phase without approval because it spans multiple schedule surfaces.

Current Phase G planning slice:

- No app code changes in this phase.
- Keep manager schedule planning desktop-first; mobile work should optimize therapist check-in, schedule reading, availability submission, and shift swaps.
- Do not alter scheduling data contracts, assignment mutations, availability writes, publish, auto-draft, or route ownership.

Proposed Phase G implementation sequence, approval required before starting:

1. Phase G1 - Staff mobile bottom navigation shell
   - Files: `src/components/AppShell.tsx`, `src/components/shell/app-shell-config.ts`, new `src/components/shell/MobileTabBar.tsx`, shell tests.
   - Scope: staff-only bottom tab bar for Dashboard, My Shifts, Availability, Shift Swaps, and More if needed.
   - Preserve: desktop top nav, manager shell, route list, auth/role checks, notification behavior.
   - Verification: shell unit tests plus browser smoke at mobile width for staff routes.

2. Phase G2 - Therapist schedule mobile week reader
   - Files: `src/app/(app)/therapist/schedule/page.tsx`, existing therapist schedule helpers/tests, any shared schedule display component found during implementation.
   - Scope: one-week-at-a-time mobile reading pattern for therapist shifts, with previous/next week controls.
   - Preserve: schedule data loading, published-schedule visibility, staff route ownership.
   - Verification: route tests plus mobile browser smoke proving the week reader renders real shift data.

3. Phase G3 - Therapist availability mobile action footer and touch targets
   - Files: `src/components/availability/TherapistAvailabilityWorkspace.tsx`, related availability tests.
   - Scope: make availability day chips and Save/Submit footer meet mobile touch sizing; use a sticky bottom action bar only if it does not obscure calendar content.
   - Preserve: `workflow="draft"`, `workflow="submit"`, selected cycle, baseline-vs-override semantics, notes, conflicts, and submission lifecycle.
   - Verification: workspace tests plus mobile browser smoke for selection, Save progress, and Submit availability visibility.

4. Phase G4 - Coverage read-only mobile week navigator
   - Files: `src/components/coverage/CalendarGrid.tsx`, optional new `src/components/coverage/WeekNavigator.tsx`, `src/app/(app)/coverage/CoverageClientPage.tsx`, coverage tests.
   - Scope: hide the 42-day grid below 768px and show a 7-day week strip for read-only schedule inspection.
   - Preserve: desktop 42-day grid, roster view on desktop, day click behavior, assignment/editing behavior, pre-flight, auto-draft, publish, and Day/Night state.
   - Verification: CalendarGrid tests plus mobile and desktop browser screenshots confirming the 42-day grid remains desktop-only.

Phase G acceptance criteria before any implementation PR:

- Each implemented slice is independently reviewable and has its own tests.
- Mobile therapist surfaces have touch targets at least 44px high where they act like buttons/chips.
- The 42-day Coverage grid is not shown below 768px after G4, while desktop Coverage remains unchanged.
- Day/Night context remains visible before schedule content.
- Browser validation covers at least one mobile viewport and one desktop viewport for every slice that changes layout.

## Next Recommended Phase

Stop here until Phase G implementation is explicitly approved. The next approved implementation slice should start with Phase G1, the staff mobile bottom navigation shell, because it is isolated from scheduling mutations and establishes the therapist mobile route framework before changing schedule surfaces.
