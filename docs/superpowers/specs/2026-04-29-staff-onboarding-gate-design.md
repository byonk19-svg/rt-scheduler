# Staff Onboarding Gate Design

Date: 2026-04-29
Status: Approved
Decision: Required onboarding hub for therapist and lead users; managers skip the flow

## Goal

Make sure new non-manager users set the schedule inputs and defaults the app depends on before they enter the normal workflow.

The onboarding must:

- stop new therapist and lead users from wandering the app before setup is complete
- collect the user's normal schedule and their schedule-related defaults in plain language
- allow flexible answers such as "No preference" where the therapist is not picky
- recommend future-availability setup when relevant without blocking completion on it

## Problem

The current app spreads first-run therapist inputs across separate pages:

- `src/app/(app)/therapist/recurring-pattern/page.tsx`
- `src/app/(app)/therapist/settings/page.tsx`
- `src/app/(app)/therapist/availability/page.tsx`

That makes the intended first-run path implicit. A new user can sign in, reach `/dashboard`, and still not know that the app expects a normal recurring schedule, schedule defaults, notification settings, and appearance confirmation.

The current `/pending-setup` page is only an approval gate. It does not become a post-approval onboarding flow.

## Scope

This design covers:

- a required onboarding route for `therapist` and `lead` users
- route gating from `/dashboard` and therapist/staff routes until onboarding is complete
- a setup hub that tracks completion of required steps
- reuse of the existing recurring-pattern, settings, notifications, and theme controls
- a non-blocking "next recommended step" for future availability when an actionable cycle exists

This design does not cover:

- manager onboarding
- changing manager workflow routes
- making future availability a required onboarding step
- redesigning the underlying recurring-pattern or availability data model
- invitation-email or approval mechanics

## Existing Constraints

- The real role model in this repo is `manager`, `therapist`, and `lead`.
- Managers already route through `/dashboard` to manager-only destinations.
- Therapists and leads already route away from manager pages and into therapist-safe surfaces.
- The recurring pattern is the durable "normal schedule" source of truth.
- Future availability is intentionally separate from the recurring pattern and should stay cycle-specific.
- Theme preference currently lives in browser storage and cookie state through `src/components/ThemeProvider.tsx` and `src/lib/theme.ts`; there is no existing server-backed "theme confirmed during onboarding" field.

## Recommended Design

### 1. Add a required onboarding hub at `/onboarding`

Create a dedicated authenticated route for first-run setup.

Behavior:

- unauthenticated users still go to `/login`
- users still waiting for approval still go to `/pending-setup`
- `manager` users never enter onboarding
- `therapist` and `lead` users with incomplete onboarding redirect to `/onboarding`
- `therapist` and `lead` users with complete onboarding continue into the normal app

The onboarding route should render inside the authenticated app shell so the experience feels like part of the product, not a separate public funnel.

### 2. Use a setup hub with required steps instead of one giant form

The onboarding route should be a hub that clearly lists what is required and what is still missing.

Required steps:

1. **Set your normal schedule**
   - backed by the existing recurring-pattern editor
   - this is where the user tells the app their usual repeating schedule
   - valid "no repeating schedule" or "starts blank" states must count as completion if explicitly chosen

2. **Choose schedule preferences**
   - backed by the existing therapist settings inputs
   - includes preferred work days, max consecutive days, default calendar view, default schedule view, and default landing page
   - "No preference" must be a first-class answer for preferred work days and must count as complete

3. **Choose notifications and appearance**
   - backed by existing notification toggles and theme control
   - requires explicit choices, but permissive choices such as "email off" or "system theme" remain valid

Recommended but not required:

- **Review Future Availability**
  - shown only when there is an open or upcoming actionable cycle
  - should be framed as the next helpful step after setup
  - must never block onboarding completion

### 3. Drive completion from one shared onboarding-status helper

Do not treat onboarding as "user visited three pages."

Instead, add a shared derived-status helper that inspects the signed-in user's setup state and returns:

- `isComplete`
- which required steps are complete
- which required steps are missing
- whether a recommended future-availability action exists

Suggested shape:

- `getOnboardingStatus(profile, workPattern, themeState)`

This helper should become the source of truth for:

- `/dashboard` redirects
- onboarding hub step states
- protection on therapist/staff routes so URL typing cannot bypass the gate

### 4. Redirect from `/dashboard` first, then guard therapist/staff routes

The current post-login seam is `src/app/(app)/dashboard/page.tsx`. That is the right place for the first onboarding redirect.

Expected redirect order:

1. no auth -> `/login`
2. pending approval -> `/pending-setup`
3. manager -> current manager routing
4. incomplete therapist/lead -> `/onboarding`
5. complete therapist/lead -> current therapist/lead routing

In addition, therapist/staff routes such as `/dashboard/staff`, `/therapist/*`, and other non-manager destinations should guard against incomplete onboarding and redirect back to `/onboarding`.

The onboarding route itself must never bounce incomplete users away, and complete users should be redirected from `/onboarding` back to `/dashboard`.

### 5. Treat flexible answers as valid completion, not missing data

The product requirement is strict completion, not forced pickiness.

That means:

- preferred work days need an explicit state that can be either selected days or `No preference`
- recurring-pattern setup can be explicitly "no repeating schedule"
- notification settings can be explicitly enabled or disabled
- appearance can be explicitly "System"

The onboarding copy should say things like:

- `Normal schedule set`
- `Preferences saved`
- `Notifications and appearance saved`

and when incomplete:

- `Tell us whether you have preferred work days`

not vague profile-completeness language.

## Completion Rules

Onboarding completion for therapist and lead users should mean:

- recurring-pattern decision exists and is valid
- preferred work day state is explicit
- max consecutive days is set
- default calendar view is set
- default schedule view is set
- default landing page is set
- in-app notification choice is explicit
- email notification choice is explicit
- theme choice is explicitly confirmed

Important implementation note:

- because theme currently defaults from local storage without a separate persisted "confirmed during onboarding" signal, implementation will likely need either:
  - a small onboarding-completion flag that records theme confirmation, or
  - a stored onboarding payload/flag that marks the notification-and-appearance step complete after explicit user submission

Do not assume an untouched default theme means the user made a conscious onboarding choice.

## Route And UX Details

### Onboarding page behavior

The `/onboarding` page should:

- explain why setup is required in plain language
- show the three required steps with complete/incomplete state
- show exactly what is missing
- send the user into the focused editor for the missing step
- return them to `/onboarding` after saving so progress is obvious
- show a clear finish state with a primary button into the app

### Existing page reuse

Reuse the current editors rather than rewriting them into a giant new wizard:

- recurring pattern editor remains the place for normal schedule input
- therapist settings remains the place for defaults and notification controls
- theme control remains the existing control

The hub owns the sequence and completion messaging; the existing pages own the detailed forms.

### Future availability recommendation

After required setup is complete, if an actionable cycle exists:

- show a recommended next-step card for future availability
- allow the user to skip it and continue into the app
- optionally keep a quick action on the staff dashboard afterward

## Error Handling

- If a user is incomplete, protected therapist/lead routes must redirect to `/onboarding` instead of partially rendering.
- If onboarding status cannot be resolved because required profile data fails to load, fail safely and show a recoverable onboarding error state rather than looping redirects.
- If the user saves a step but the data is still incomplete, the hub should show the exact remaining gap.
- If an existing user has partial legacy data, the hub should list only the missing requirements instead of forcing full re-entry.

## Existing-User Migration Expectation

Do not blindly gate every current therapist or lead user the moment this ships.

The implementation plan should explicitly define how to distinguish:

- clearly complete existing users who should pass through untouched
- partially configured users who should finish missing setup
- newly approved users who should always enter onboarding

The safe product stance is: gate users only when the new completion rules truly identify missing required setup.

## Testing Strategy

### Unit tests

- onboarding-status helper returns complete/incomplete correctly for therapist, lead, and manager
- explicit flexible answers such as `No preference` count as complete
- recurring-pattern states distinguish valid `none` from missing data
- recommended future-availability state appears only when an actionable cycle exists

### Route tests

- `/dashboard` sends managers to current manager destinations
- `/dashboard` sends incomplete therapist/lead users to `/onboarding`
- `/dashboard` sends complete therapist/lead users to current destinations
- protected therapist/staff routes redirect incomplete users to `/onboarding`
- `/onboarding` redirects complete users back to `/dashboard`

### Page and source-contract tests

- onboarding page renders required-step copy and missing-state messaging
- therapist settings flow includes an explicit `No preference` path
- recurring-pattern flow preserves explicit "no repeating schedule" completion semantics

### Browser verification

- sign in as a newly approved therapist or lead and confirm onboarding gate appears
- complete normal schedule, preferences, notifications, and appearance
- confirm completion returns the user to the normal app
- confirm future availability appears as recommended, not blocking
- confirm managers never see onboarding

## Tradeoffs

### Benefits

- makes the required first-run path obvious
- prevents users from missing critical setup inputs
- reuses existing focused editors instead of creating a large replacement form
- keeps recurring pattern and future availability cleanly separated
- supports flexible users with explicit `No preference` answers

### Costs

- adds route-gating complexity
- requires a precise shared completion helper to avoid redirect bugs
- likely needs one additional persisted or explicit-confirmation mechanism for theme/onboarding completion

## Implementation Notes For Planning

- Favor a small, shared onboarding-status helper over route-by-route ad hoc checks.
- Reuse current therapist settings and recurring-pattern actions where possible.
- Add explicit `No preference` semantics before treating preferences as required.
- Keep onboarding state-based and deterministic; avoid "visited this page once" heuristics.
- Protect against redirect loops first in the implementation plan.
