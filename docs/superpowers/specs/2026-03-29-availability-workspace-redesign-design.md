# Availability Workspace Redesign Design

Date: 2026-03-29
Routes: `/availability`, `/therapist/availability`
Reference: user-provided manager availability mockup

## Goal

Redesign the manager availability screen to match the approved reference direction, then create a therapist availability screen that uses the same visual system without exposing any manager controls.

This is a workspace redesign and route split, not a rewrite of the existing availability actions or scheduling rules.

## Approved Direction

- Rebuild the manager availability screen around a single structured workspace row that mirrors the reference:
  - left: planning controls
  - center: calendar workspace
  - right: response roster
- Keep the lower request review area, but restyle it to match the new workspace hierarchy.
- Create a therapist-only availability screen with the same overall layout language and rhythm.
- Do not expose therapist pickers, response rosters, or team review controls on the therapist route.
- Stop re-exporting the manager page from `/therapist/availability`.
- Reuse the current availability actions, query patterns, and data model wherever possible.

## Non-Goals

- Changing the meaning of `force_on` or `force_off`
- Rewriting availability persistence or introducing a new table
- Changing manager scheduling policy, cycle rules, or publish behavior
- Adding new approval workflows
- Refactoring unrelated app shell or dashboard routes

## Current Problem

The current availability experience has the right pieces, but the overall product structure is off:

- the manager page is a vertical stack instead of a clear workspace
- the manager planning area, response summary, and request review feel disconnected
- the therapist route simply re-exports the manager page
- permission safety depends too much on conditional rendering inside one page
- the therapist experience does not have its own focused control surface

The result is a manager screen that lacks the intended visual hierarchy and a therapist screen that feels like an accidental alias of the manager workflow.

## Target Experience

### Manager Workspace

When a manager opens `/availability`, the page should read as one availability operations hub:

- header with cycle context and actions
- main workspace row with three coordinated panels
- lower review section for submitted requests

The middle workspace row should map closely to the reference:

- planning controls on the left
- a month calendar in the center
- response roster on the right

The manager should be able to scan the page in one pass and understand:

- which cycle they are working in
- which therapist is selected
- which dates are saved
- who still has not submitted
- what requests need review

### Therapist Workspace

When a therapist opens `/therapist/availability`, the page should feel like the personal counterpart to the manager workspace.

It should preserve the same overall composition and visual language, but all content must be personal and self-service:

- left: request controls for the therapist's own availability
- center: personal calendar workspace
- right: saved selections and cycle submission status
- lower section: that therapist's saved request history

The therapist page must not contain:

- therapist picker
- team response roster
- all-staff review controls
- manager planning language

## UX Structure

### Shared Visual Thesis

Use a calm clinical operations style with:

- one strong workspace row
- fewer isolated cards
- lighter framing
- dense but readable information
- no decorative dashboard clutter

The page should feel operational, not promotional.

### Shared Layout

Both routes should use the same broad sequence:

1. workspace header
2. primary three-column workspace
3. lower history or review area

This keeps the two routes obviously related while still separating responsibility by role.

### Manager Panel Jobs

Left panel:

- cycle picker
- therapist picker
- planner mode controls
- quick context about selected therapist
- save / clear controls

Center panel:

- month navigation
- cycle-bounded calendar selection
- visual distinction between `Will work` and `Cannot work`

Right panel:

- missing response roster
- submitted count or compact submitted list
- fast scan of who still needs follow-up

Lower section:

- request review table
- filters
- row expansion for details

### Therapist Panel Jobs

Left panel:

- cycle picker
- request type
- shift type
- optional note
- save action

Center panel:

- personal calendar workspace
- saved-date visual state
- cycle-bounded date interaction

Right panel:

- submission status for the selected cycle
- saved dates grouped by request meaning
- short explanatory guidance

Lower section:

- personal saved requests only
- same table language, but personal scope only

## Component Architecture

### Existing Files To Rework

- `src/app/availability/page.tsx`
- `src/app/therapist/availability/page.tsx`
- `src/components/availability/ManagerSchedulingInputs.tsx`
- `src/components/availability/AvailabilityStatusSummary.tsx`
- `src/app/availability/availability-requests-table.tsx`

### Intended Component Shape

`src/app/availability/page.tsx`

- remains the manager route
- loads cycle, therapist, override, and response data
- maps data into the shared workspace composition
- renders manager-specific panels plus the shared lower table

`src/app/therapist/availability/page.tsx`

- becomes a real therapist page instead of a re-export
- loads only the signed-in therapist's cycles and overrides
- renders the same workspace composition with therapist-specific panels

Shared availability workspace components under `src/components/availability`:

- workspace shell component for the three-column layout
- shared calendar surface for month navigation and date selection
- optional shared header/section framing helpers

Manager-only components:

- planner controls panel
- response roster panel

Therapist-only components:

- personal request controls panel
- personal submission status panel

`AvailabilityEntriesTable`

- remains the lower history/review surface
- keeps role-based scoping
- is visually aligned to the new workspace system rather than left as a generic card stack

## Data Flow

Keep the current server-side queries and actions as the source of truth.

Manager route data:

- upcoming cycles
- active therapists
- current cycle availability overrides
- manager planner overrides
- response status rows derived from therapist availability

Therapist route data:

- upcoming cycles
- the signed-in therapist's own overrides only
- enough cycle context to show status and saved selections

Shared behavior:

- both routes map fetched data into a common workspace shape
- both routes continue using the existing create and delete availability actions
- manager planner saves continue using the existing manager planner actions

This keeps the redesign UI-focused and lowers regression risk.

## Permissions

Permissions should be enforced in route structure and component ownership, not only in hidden controls.

Manager route can:

- select therapists
- save manager planner dates
- view submission rosters
- review all staff requests

Therapist route can:

- create personal availability requests
- view personal saved requests
- delete personal requests

Therapist route cannot render manager-only controls at all.

## Error Handling and Empty States

Retain the existing toast-based success and error messaging.

The redesigned pages need explicit empty states for:

- no upcoming cycle
- no active therapists for manager planning
- no personal saved requests yet
- no requests matching filters

Calendar interactions must continue to reject dates outside the selected cycle.

## Testing Strategy

Follow test-first implementation.

Priority test coverage:

- `/therapist/availability` no longer re-exports the manager page
- therapist page does not render manager-only controls
- manager page still renders planner controls and response roster
- therapist page renders personal request controls and personal status panel
- lower request table remains correctly scoped by role

Focused component tests:

- shared calendar surface behavior
- manager workspace panel visibility
- therapist workspace panel visibility
- role-safe actions in the lower table

Action tests should remain mostly unchanged unless the UI split requires small payload-shape adjustments.

## Risks

### Drift Between Manager and Therapist Layouts

If the two routes copy markup instead of sharing composition, the screens will diverge quickly.

### Permission Leakage

If the therapist route continues to depend on the manager page tree, manager-only affordances may remain reachable or accidentally reappear.

### Over-Abstraction

If the redesign introduces a fully generic builder pattern too early, implementation complexity will rise without real product benefit.

## Implementation Notes For Planning

- prioritize one shared workspace composition with role-specific panels
- keep calendar behavior in a shared component so visual alignment stays tight
- move therapist route off the manager page entirely
- preserve current action wiring unless tests prove a change is needed
- treat the lower table as a shared surface with role-based content, not two separate tables

## Acceptance Criteria

- `/availability` presents a single manager availability workspace aligned to the approved reference direction
- the manager workspace uses a three-panel main row with controls, calendar, and response roster
- the lower request review section remains available and visually integrated
- `/therapist/availability` is its own page and no longer re-exports the manager route
- the therapist page uses the same overall layout language as the manager page
- the therapist page includes only personal controls and personal status content
- the therapist page exposes no manager controls
- existing availability actions and persistence remain intact
