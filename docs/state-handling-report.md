# State Handling Report

Date: 2026-05-16

## Goal

Make loading, empty, restricted, missing-data, and failed-data states feel clear without exposing backend details or implying unsupported actions.

## Reviewed Surfaces

- Dashboard: manager dashboard and staff dashboard.
- Team Schedule and My Shifts: unified `/schedule` route plus legacy redirects from staff schedule routes.
- Availability: manager review/planner and therapist Future Availability.
- Availability Review: manager availability queue and submitted/missing roster states.
- Shift Board: request loading, empty filters, request errors, and claimant updates.
- Approvals: preliminary approval queue, empty queue, and request-load failure.
- Lottery: no published shift dates, loading, request list, history, and action errors.
- Coverage: legacy `/coverage` redirect into unified Schedule grid.
- Roster/settings: Team directory, employee roster, and Profile/settings page.

## Implemented Improvements

- Schedule now has a full no-Schedule-Block state that explains what happened and what managers or staff should expect next.
- Schedule grid now explains when the selected Schedule Block has no therapists for the selected shift instead of rendering an empty table shell.
- Schedule grid mutation alerts no longer show backend error messages to normal users.
- Staff dashboard now explains the no-published-shifts state and points staff back to Schedule after publish.
- Manager Availability now distinguishes no Schedule Block from no active therapists and gives the next step for each.
- Therapist Future Availability now explains that no upcoming Schedule Block is open and tells the therapist to check back after the manager opens one.
- Shift Board now maps unknown save and claimant errors to plain, non-technical retry guidance while preserving specific known lifecycle errors.
- Lottery now avoids rendering the decision workspace when there are no published shift dates, and it no longer displays raw API error payloads for load, refresh, save, or history failures.
- Team directory filter-empty state now tells managers to clear filters or search differently.
- Employee roster empty state now tells managers to add employees manually or use bulk import.

## Existing States Left In Place

- Approvals already has a clear empty state and a safe request-load error message.
- Manager dashboard already has loading placeholders and hides low-value empty sections.
- Profile/settings has safe save-failure feedback and does not expose raw errors.
- Coverage remains a redirect to Schedule, so Schedule state handling is the user-facing coverage state handling.

## Remaining Risks

- Browser validation still depends on local auth and seed data. Source and unit coverage verify the changed state branches.
- Some route-level permission denied states still redirect to the appropriate dashboard instead of showing a dedicated denied page. That preserves existing behavior and avoids inventing a new access-request path.
- Loading states are strongest in client-managed surfaces. Server-rendered pages still rely on route-level loading files where they exist.
