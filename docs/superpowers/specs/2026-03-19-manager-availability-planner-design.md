# Manager Availability Planner Design

Date: 2026-03-19
Routes: `/availability`, auto-draft behavior in `/coverage`

## Goal

Give managers a fast, calendar-based way to enter hard scheduling dates for each therapist directly inside the app.

Managers need to be able to mark dates a therapist:

- `Will work`
- `Cannot work`

These inputs must be easy to apply in bulk, easy to review by cycle, and must be treated as hard constraints by auto-draft.

## Approved Direction

- Put the manager workflow on `/availability`, not `/team`.
- Reuse the existing cycle-scoped availability override model instead of inventing a second scheduling-input table.
- Make `Will work` and `Cannot work` the manager-facing language.
- Treat both as hard auto-draft rules.
- Keep therapist-submitted availability and manager-entered planning inputs in the same general domain, but make the manager planner a dedicated, much easier workspace.
- For PRN, require explicit `Will work` dates in order to be auto-scheduled.

## Non-Goals

- No new separate manager scheduling page outside `/availability`
- No replacement of therapist self-service availability
- No attempt to solve long-term recurring PRN habits in the first pass
- No change to manual manager override after draft generation

## Current Problem

The app already has two relevant inputs, but neither is ideal for the manager workflow:

- therapists can submit cycle availability on `/availability`
- managers can enter date overrides from the old employee directory flow

That makes manager scheduling input harder than it needs to be:

- the manager-friendly interface is not prominent
- the workflow is split across surfaces
- it is not obvious which dates should be treated as hard must-work or hard cannot-work days
- PRN scheduling rules are hard to manage in practice

The manager needs one obvious place to prepare staffing inputs before auto-draft.

## Target Experience

### Manager Workflow

1. Manager opens `/availability`.
2. Manager switches into a `Staff Scheduling Inputs` workspace.
3. Manager selects a cycle.
4. Manager selects a therapist.
5. Manager chooses an input mode:
   - `Will work`
   - `Cannot work`
6. Manager clicks or drags across dates on a cycle calendar.
7. Saved dates immediately appear with clear visual distinction between required-work and blocked-work days.
8. Auto-draft uses those dates as hard rules.

### Therapist Workflow

Therapists continue using the normal availability workflow.

They do not need to see manager-only scheduling controls. Their current cycle requests remain separate in intent, but the resulting hard constraints still feed the same scheduling engine.

## Recommended Product Model

Use cycle-scoped hard date inputs as the first-class manager planning tool.

### Meaning of Each Manager Input

`Will work`

- therapist should be forced onto the draft on that date if a legal slot exists
- manager is signaling a hard positive assignment intent
- for PRN, this is the primary path into auto-draft

`Cannot work`

- therapist must never be auto-assigned on that date
- applies to full-time, lead therapist, and PRN equally

## Data Model

Do not introduce a new table for the first pass.

Use the existing `availability_overrides` records and keep them cycle-scoped.

### Stored Mapping

- manager `Will work` maps to `override_type = force_on`
- manager `Cannot work` maps to `override_type = force_off`
- preserve `cycle_id`, `therapist_id`, `date`, and `shift_type`
- set source metadata so manager-entered inputs are distinguishable from therapist-entered availability

This keeps one source of truth for hard date inputs while allowing different UI surfaces for different roles.

## UI Surface

### Placement

Add a manager-only section near the top of `/availability`.

Suggested label:

- `Staff Scheduling Inputs`

### Controls

- cycle picker
- therapist picker
- mode toggle:
  - `Will work`
  - `Cannot work`
- month calendar scoped to the selected cycle
- multi-select support by click and drag
- clear selected dates action

### Display

Show the selected therapist's saved inputs for the active cycle directly on the calendar:

- `Will work` dates in one strong positive style
- `Cannot work` dates in one blocked style

Also show a compact list or chips beneath the calendar for quick review and removal.

### Copy

Manager-facing language should be operational and explicit:

- `Will work` means auto-draft should place them if possible
- `Cannot work` means auto-draft must not place them

Avoid forcing managers to think in the therapist wording of `Available to work` versus `Need off`.

## Auto-Draft Rules

Auto-draft must honor manager scheduling inputs as hard constraints.

### Hard Rules

- `Cannot work` always blocks assignment
- `Will work` should be placed into the draft if a legal slot exists
- PRN must not be auto-scheduled unless they have explicit `Will work` dates
- full-time therapists remain hard-capped at 3 shifts per week unless the manager manually edits after draft

### Coverage Rules

- ideal target remains 4 per shift
- 3 is acceptable minimum coverage
- 5 is acceptable but not ideal
- prioritize getting every day covered
- require at least one lead-eligible therapist on each day if possible
- if two lead therapists work the same day, only one should be marked as designated lead

### Conflict Handling

Manager `Will work` does not mean the system may break every other hard rule.

It must still respect:

- one shift per person per day
- weekly hard cap
- inactive / FMLA blocks
- cycle date boundaries

If a `Will work` date cannot be honored because of conflicting hard constraints, auto-draft should:

- still save the best draft
- report that the forced assignment could not be satisfied
- leave the issue visible to the manager for manual follow-up

## PRN Handling

For the first pass, PRN behavior should be explicit and cycle-based:

- no PRN scheduling from general recurring patterns alone
- no PRN scheduling just because they often work weekends
- PRN enters auto-draft only through explicit `Will work` dates
- PRN can still have explicit `Cannot work` dates too

This keeps PRN behavior predictable and easy to reason about.

If needed later, recurring PRN tendencies such as “usually works weekends” can be added as a separate second-phase improvement.

## Interaction With Existing Availability

The manager planner should coexist with therapist-submitted availability.

Recommended precedence:

1. inactive / FMLA always blocks
2. manager `Cannot work` blocks
3. manager `Will work` allows and strongly prioritizes assignment
4. therapist-submitted cycle requests continue to inform eligibility when no manager hard date exists

This makes the manager planner the strongest operational signal without discarding therapist inputs entirely.

## Error Handling

If the manager tries to save dates without selecting a cycle or therapist:

- block save inline

If a selected date is outside the cycle:

- block save inline

If auto-draft cannot honor all hard `Will work` inputs:

- do not fail the entire draft
- save what can be safely generated
- show a manager-facing error or warning summary indicating which required dates were not honored

## Testing Strategy

- Unit tests for manager hard-date precedence in availability resolution
- Unit tests for PRN explicit-date-only eligibility
- Unit tests for auto-draft policy behavior around `Will work` and `Cannot work`
- Integration tests for manager calendar input persistence on `/availability`
- E2E coverage for:
  - manager selects cycle and therapist
  - manager marks `Will work` and `Cannot work` dates
  - saved dates re-render correctly
  - auto-draft respects those dates
  - PRN is scheduled only when explicit `Will work` dates exist

## Acceptance Criteria

- Managers can enter cycle-scoped `Will work` and `Cannot work` dates from `/availability`.
- The manager workflow is calendar-based and supports quick multi-date entry.
- Saved manager inputs are easy to review for the selected therapist and cycle.
- Auto-draft always respects manager `Cannot work` dates.
- Auto-draft attempts to force `Will work` dates into the draft whenever legal.
- PRN therapists are not auto-scheduled unless they have explicit `Will work` dates.
- Full-time therapists remain capped at 3 shifts per week during auto-draft.
- Coverage still targets 4 per shift, with 3 acceptable and 5 allowed when needed.
- The generator still tries to place at least one lead therapist per day.
