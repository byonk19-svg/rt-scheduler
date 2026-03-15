# Manager Scheduler Lovable Alignment Design

Date: 2026-03-14
Route: `/coverage`
Reference: `.reference/teamwise-ops-hub`

## Goal

Replace the current manager scheduler interaction model on `/coverage` with the Lovable manager scheduler pattern from the reference repo while preserving the existing Teamwise scheduling rules, mutations, and publish workflow.

This is a UI and interaction redesign, not a scheduling engine rewrite.

## Approved Direction

- Match the Lovable manager scheduler shell, including header actions, shift tabs, issue chip, and published-state presentation.
- Replace the current right-side slide-over editor with the Lovable interaction model:
  - clicking a calendar day opens a centered edit dialog
  - clicking an assigned therapist inside a calendar cell opens a small status popover
- Simplify the calendar cells and editor UI to match Lovable more closely, even if that removes some richer current-app surface detail.
- Keep all existing Teamwise scheduling rules intact and continue using the current Teamwise data layer.

## Non-Goals

- Changing staffing rules, publish gating, or assignment persistence rules
- Reworking non-manager scheduling routes
- Refactoring unrelated shared app shell patterns
- Replacing Teamwise backend logic with the reference repo's demo data model

## Current Problem

The current `/coverage` route already moved toward the Lovable visual style, but the main interaction model still diverges from the intended design:

- it uses a fixed right-side slide-over editor instead of a modal day editor
- assignment status editing is handled inside expanded drawer rows instead of anchored inline popovers
- the top bar and published-state controls do not fully match the Lovable scheduler shell
- calendar cells expose more scheduling detail than the target interface

The result is a manager scheduler that looks adjacent to the reference but behaves differently enough to feel like the wrong product.

## Target Experience

### Page Shell

The `/coverage` page should present the same broad manager workflow as the Lovable scheduler:

- page title `Coverage`
- cycle date range, total weeks, and `Click a day to edit`
- top-right actions for `Print`, `Auto-draft`, and `Publish` or `Published`
- `Day Shift` and `Night Shift` segmented control
- compact issue chip when the selected shift view contains schedule issues
- published banner and published actions when the active cycle is published

The Teamwise published banner remains because it reflects a real product state already wired to backend behavior.

### Calendar Grid

The calendar becomes the primary interaction surface. Each cell should follow the Lovable pattern:

- date number
- optional month tag on month boundary
- coverage count pill
- lead card
- simplified staff list
- compact warnings and issue states

The grid must support two distinct click behaviors:

- clicking the day cell background opens the day edit dialog
- clicking an assigned therapist or lead opens the assignment status popover without opening the day dialog

The cells should preserve only the most decision-relevant information. They should not surface the current drawer-level detail such as grouped therapist sections, weekly workload summaries, or large state panels.

## Interaction Model

### Day Edit Dialog

Clicking a calendar day opens a centered modal dialog similar to the Lovable `EditShiftDialog`:

- header with formatted date and shift type
- summary status row showing staffing count and lead requirement state
- `Lead Therapists` section
- `Staff Therapists` section
- rows with initials avatar, therapist name, weekly shift count, same-day conflict hint, lead badge, and assign/unassign circle

The dialog is a simplified editing surface. It is not a persistent workspace and should close cleanly back to the grid.

### Assignment Status Popover

Clicking a therapist name or lead inside the cell opens a small anchored popover similar to the Lovable `AssignmentStatusPopover`.

Supported status changes remain the Teamwise set mapped to UI labels:

- `active`
- `oncall`
- `leave_early`
- `cancelled`
- `call_in`

The popover should:

- show the therapist name and lead badge when applicable
- allow changing status inline
- show a selected state for the active status
- preserve current optimistic updates and rollback behavior

Lead replacement logic stays intact. If a lead status requires replacement under current Teamwise behavior, the popover UI should still support that flow, but in the Lovable popover style instead of the current expanded drawer row pattern.

## Data and Logic Boundaries

The page continues to use Teamwise data and rules. The design does not permit the UI simplification to weaken correctness.

The following logic remains unchanged and must stay sourced from the current app:

- cycle loading and active cycle selection
- shift assignment persistence
- assignment status persistence
- lead eligibility and one-lead enforcement
- PRN/date eligibility rules
- weekly limits and same-day opposite-shift conflict detection
- auto-draft, reset draft, publish, and print actions
- publish blocking and published-state messaging
- constraint-driven empty or unfilled states

The reference repo is a visual and interaction reference only.

## Component Architecture

### Existing Components To Rework

- `src/app/coverage/page.tsx`
- `src/components/coverage/CalendarGrid.tsx`
- `src/components/coverage/ShiftDrawer.tsx`

### Intended Component Shape

`src/app/coverage/page.tsx`

- remains the page-level state owner
- loads cycle, therapists, and calendar day data
- manages selected day and selected assignment anchor state
- owns optimistic assignment and status mutations
- renders the top shell, published banner, grid, edit dialog, and status popover

`src/components/coverage/CalendarGrid.tsx`

- becomes the Lovable-style week grid
- renders cell-level interactive targets
- distinguishes day clicks from assignment clicks
- displays simplified status pills and warnings

`src/components/coverage/ShiftEditorDialog.tsx`

- new modal editor replacing the current drawer
- receives selected day and therapist metadata
- emits assign/unassign actions

`src/components/coverage/AssignmentStatusPopover.tsx`

- new anchored popover for inline assignment status edits
- emits status-change actions
- optionally supports lead replacement affordances

`src/components/coverage/ShiftDrawer.tsx`

- removed from active use after migration

## Visual Fidelity Rules

The rebuilt manager scheduler should match the Lovable reference in the areas that matter most to user perception:

- compact top bar spacing and action hierarchy
- simplified day cards with light borders and subtle status treatment
- modal editing rather than slide-over editing
- anchored status popovers rather than row-expansion controls
- lighter information density across the calendar

Where current Teamwise product behavior introduces states the reference does not model directly, keep the Teamwise behavior but render it in the same calm visual language.

Examples:

- `No eligible therapists (constraints)` remains visible in a compact error card inside the day cell
- missing lead remains visible but compact
- published-state banner remains visible

## Error Handling

Assignment and status changes should continue to use optimistic UI with rollback:

- if assignment persistence fails, restore the previous day state and show the existing inline error message
- if status persistence fails, restore the previous assignment status and show the current error path
- if cycle or therapist loading fails, preserve the existing lightweight empty/error state behavior

The redesign should reduce visible complexity, not hide failures.

## Testing Strategy

### Behavioral Checks

- clicking a calendar cell opens the day edit dialog
- clicking an assigned therapist opens the status popover and does not open the day dialog
- assigning and unassigning therapists still persists correctly
- assignment status changes still persist correctly
- published-state shell controls still render and disable correctly
- missing lead and constraint-blocked slots still render visible states

### Regression Coverage

- remove expectations tied to the right-side drawer from E2E coverage
- add E2E checks for modal editor and inline popover behavior
- verify typecheck and targeted tests for coverage selectors and mutations still pass

## Risks

### Event Target Conflicts

The grid now needs nested click targets inside a clickable cell. Event propagation must be handled carefully so clicking a therapist name does not also open the day dialog.

### State Coordination

The page will manage both a selected day dialog and an assignment-status popover. State boundaries must stay explicit so modal and popover interactions do not interfere with each other.

### Fidelity Drift

If the implementation preserves too much current drawer behavior, the result will remain visually and behaviorally off-target. The simplified Lovable model should win whenever there is a presentation tradeoff, provided Teamwise rules remain intact.

## Implementation Notes For Planning

- reuse current selectors and mutation helpers rather than porting reference data logic
- model therapist click targets at the cell level so popovers can anchor correctly
- map current Teamwise status names to Lovable-style labels and pill rendering in one place
- remove the drawer from the active render path rather than trying to support both editor models
- preserve accessibility for dialog, popover, keyboard focus, and button semantics

## Acceptance Criteria

- `/coverage` no longer uses the right-side slide-over editor
- clicking a day opens a centered Lovable-style edit dialog
- clicking an assigned therapist opens a Lovable-style status popover
- the top shell matches the Lovable manager scheduler pattern, including action layout and issue chip
- Teamwise scheduling rules and publish behavior remain intact
- the resulting page feels like the Lovable scheduler using Teamwise backend logic
