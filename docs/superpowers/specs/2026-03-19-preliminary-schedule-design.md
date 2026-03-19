# Preliminary Schedule Design

Date: 2026-03-19
Routes: `/coverage`, `/approvals`, therapist schedule experience

## Goal

Add an easy-to-use preliminary schedule workflow that lets managers share a staff-visible working version of a cycle before final publish.

Therapists should be able to:

- view tentative assignments
- request changes to their own tentative shifts
- claim open help-needed / PRN slots

Managers should retain final approval for all requests and claims.

## Approved Direction

- Add a separate preliminary snapshot layer instead of overloading the final publish state.
- Make the preliminary schedule visible to all therapists in the app.
- Keep the preliminary view live while the manager continues reviewing and approving requests.
- Let therapists both request changes and claim open slots.
- Lock open slots immediately when someone claims them so no second therapist can take the same slot.
- Keep notifications in-app only.
- Keep final publish as a separate manager action after preliminary review is complete.

## Non-Goals

- No email notification workflow
- No replacement of the final publish flow
- No therapist-side direct editing of staffing assignments
- No separate exported paper workflow as the main solution

## Current Problem

The current workflow depends on a paper preliminary schedule where therapists manually review tentative assignments and PRN openings. That creates friction:

- therapists cannot see changes update live
- more than one person can try to claim the same need
- managers have to reconcile requests manually
- the paper preview is disconnected from the actual schedule state in the app

The product needs a preliminary stage that feels simple for therapists while preserving manager control.

## Target Experience

### Manager Workflow

1. Manager builds or updates a draft schedule cycle.
2. Manager clicks `Send preliminary`.
3. The app creates or refreshes one active preliminary snapshot for that cycle.
4. Therapists can immediately view the preliminary version in the app.
5. Managers review incoming pending claims and change requests in one approvals queue.
6. Manager approvals update the live preliminary view immediately.
7. When ready, manager performs the normal final publish.

### Therapist Workflow

Therapists get a clearly labeled `Preliminary Schedule` experience that is visually distinct from the final published schedule.

They can:

- view their tentative assigned shifts
- see open help-needed / PRN slots
- request changes on their own tentative assignments
- claim open slots
- see statuses for their own pending, approved, or denied actions

The preliminary view should be simpler than the full manager staffing editor. Therapists should not edit raw staffing directly.

## Interaction Model

### Preliminary Schedule States

Each relevant shift in the preliminary view should surface one of these states:

- `Tentative`
- `Open`
- `Pending claim`
- `Pending change`
- `Approved`

`Denied` should appear in the requesting therapist's request history, not as persistent clutter on the main schedule surface.

### Change Request on Assigned Shift

For a therapist's own tentative assignment:

- show `Request change`
- require a short optional or lightly encouraged note
- create a pending request record
- do not change the underlying assignment until the manager approves

### Claim on Open Slot

For an open help-needed / PRN slot:

- show `Claim shift`
- on submit, immediately reserve that opening as `Pending claim`
- hide or disable that opening for everyone else
- release it again if the manager denies or the request is cancelled

### Manager Approval

Managers review a single queue containing:

- pending open-slot claims
- pending change requests

Each item should show:

- therapist
- date
- shift
- request type
- optional note
- approve
- deny

Approving a claim fills the slot in the preliminary schedule.

Approving a change request updates the preliminary schedule according to the request outcome, such as freeing the shift or reopening it for coverage.

## Data Model

Use a separate preliminary layer on top of the existing cycle and shift records rather than copying the entire schedule into a second authoritative table.

### Core Tables

`preliminary_snapshots`

- `id`
- `cycle_id`
- `created_by`
- `sent_at`
- `status`
- one active snapshot per cycle

`preliminary_shift_states`

- references a shift in the cycle
- stores the current preliminary presentation state for that shift
- supports:
  - `tentative_assignment`
  - `open`
  - `pending_claim`
  - `pending_change`

`preliminary_requests`

- `id`
- `snapshot_id`
- `shift_id`
- `requester_id`
- `type`
  - `claim_open_shift`
  - `request_change`
- `status`
  - `pending`
  - `approved`
  - `denied`
  - `cancelled`
- `note`
- approval metadata

## Conflict Rules

- Only one active preliminary snapshot may exist per cycle.
- An open slot can have only one active pending claim at a time.
- Therapists can request changes only on their own tentative assignments.
- Manager approval is the only action that mutates the accepted preliminary state.
- Final publish must continue to read from the real schedule state, not directly from unapproved preliminary requests.

## Live Update Behavior

The preliminary schedule should stay live during manager review.

- When a claim is submitted, the slot immediately flips to `Pending claim`.
- When a change request is submitted, the shift gets a pending marker but remains assigned until review.
- When a manager approves or denies a request, the preliminary view updates immediately for everyone.
- The system should maintain one live preliminary schedule, not multiple staff-visible forks of the same cycle.

If the manager edits the draft schedule after preliminary has been sent, the preliminary layer should refresh in place rather than creating a second disconnected version.

## Notifications

Notifications for this workflow should stay in-app only.

- No email send
- Use existing in-app notification patterns where possible
- Keep the notification volume low and directly tied to meaningful changes, such as:
  - preliminary sent
  - request approved
  - request denied

## UI Surface Recommendations

### Manager

- `Send preliminary` action from the cycle workflow
- manager approvals surface for preliminary actions
- clear visual distinction between:
  - internal draft editing
  - staff-visible preliminary
  - final published schedule

### Therapist

- dedicated `Preliminary Schedule` page or mode
- simple cards or schedule rows with strong status chips
- one-click primary actions:
  - `Request change`
  - `Claim shift`

## Testing Strategy

- Unit tests for reservation and conflict rules
- Unit tests for manager approval state transitions
- Integration tests for snapshot refresh behavior
- E2E coverage for:
  - manager sends preliminary
  - therapist sees preliminary schedule
  - therapist claims an open slot
  - second therapist cannot claim the same slot
  - therapist requests a change on their own shift
  - manager approves and denies requests
  - preliminary view updates live after approval changes

## Acceptance Criteria

- Managers can send a preliminary schedule without publishing the final schedule.
- All therapists can see the preliminary schedule in the app.
- Therapists can request changes to their own tentative shifts.
- Therapists can claim open help-needed / PRN slots.
- Open-slot claims prevent duplicate pickup attempts immediately.
- Managers can approve or deny all preliminary requests from one queue.
- Preliminary state updates live as approvals happen.
- Final publish remains a separate explicit manager step.
- Notifications remain in-app only.
