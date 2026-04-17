# Intake Date Chip Editing Design

Date: 2026-04-14
Status: Proposed

## Goal

Let managers correct parsed availability intake dates directly on the intake card by clicking each date chip to cycle between `off`, `work`, and `removed`, with every change saved immediately and used by `Apply dates`.

## Problem

The current intake parser can recover most PTO request dates, but OCR and handwritten forms still produce mistakes. Managers can fix therapist and cycle matches today, but they cannot correct the parsed date list without reparsing or changing the source text.

That creates two workflow problems:

- parsed dates that are directionally correct still require manual workaround when one or two chips are wrong
- parser mistakes can block clean downstream use in the manager availability workspace and auto draft because `Apply dates` currently trusts the saved parsed date list as-is

## Scope

This change covers:

- clickable parsed date chips on intake review items
- immediate persistence of each chip edit
- a three-state cycle: `off -> work -> removed`
- using the edited chip state as the source of truth for `Apply dates`
- reflecting the corrected intake output in downstream availability overrides, the manager availability request surface, and auto draft inputs

This change does not cover:

- bulk multi-chip edit mode
- undo history
- freeform custom date entry on the intake card
- changing the OCR pipeline itself

## Approved Interaction Model

- Each parsed request chip on an intake item is clickable.
- Clicking a chip cycles through:
  - red chip = `off`
  - light/neutral chip = `work`
  - removed = chip disappears
- Every click saves immediately to the intake item row.
- `Apply dates` always uses the currently saved chip state, not the original parser output.
- Reparse replaces the editable chip set with fresh parser output from the original saved source text.
- If a manager has edited an intake item, the card should show a small edited marker.

## Data Flow

Canonical flow after this change:

`OCR/body text -> parser output -> saved intake item parsed_requests -> manager chip edits -> saved parsed_requests -> Apply dates -> availability_overrides -> manager availability dashboard + auto draft`

The key rule is that `parsed_requests` on the intake item becomes the source of truth for this stage of the workflow.

## Existing Constraints

- Intake items already persist `parsed_requests` in `availability_email_intake_items`.
- `Apply dates` already reads from the saved intake item row rather than reparsing on demand.
- Manager availability and auto draft operate from applied availability override data, so the integration point is the existing apply flow.
- The intake card already renders request chips and already exposes item-level actions for match correction and apply.

## Recommended Design

### 1. Make parsed request chips stateful controls

Each chip should represent one saved parsed request:

- `date`
- `override_type`
- `shift_type`
- `source_line`
- optional note

Click behavior:

- `force_off` becomes `force_on`
- `force_on` becomes removed
- removed means the request disappears from the saved intake item

The control should be optimistic in the UI only if the saved state is reconciled immediately after the server response. If the save fails, the chip should snap back to the last persisted state.

### 2. Persist chip edits immediately

Add a dedicated server action for intake request editing:

- input: `item_id`, `date`, current `override_type`
- output: updated `parsed_requests` saved back to the intake item row

This action should:

- load the item
- sanitize and transform the existing `parsed_requests`
- cycle the target chip state
- write the updated `parsed_requests` back to the row
- mark the item as manually edited
- revalidate `/availability`

### 3. Preserve parser output provenance

To support `Reparse` and edited-state awareness cleanly, the system should preserve the difference between:

- original parser output
- manager-edited output

Recommended implementation:

- store the initial parser output in a dedicated field such as `original_parsed_requests`, or
- add an explicit boolean/manual timestamp such as `manually_edited_at`

Either approach is acceptable. The simpler option for this codebase is likely a manual edit marker plus using reparse as the reset action.

### 4. Keep `Apply dates` behavior unchanged except for its source input

`Apply dates` should continue to apply the currently saved intake item requests into `availability_overrides`.

No separate auto-draft integration code should be necessary if:

- corrected chips apply to overrides
- auto draft already reads those overrides

This keeps the architecture narrow and avoids introducing a second parallel correction system.

### 5. Reflect corrections in manager surfaces through existing downstream data

After a manager edits chips and applies them:

- the manager availability dashboard should show the corrected dates because it reads the applied override rows
- auto draft should respect those dates because it also consumes the applied availability state

No direct special-case rendering in those downstream views should be necessary if the override path remains the source of truth.

## UI States

### Chip states

- `off`: red/destructive outline chip
- `work`: neutral or info-style chip
- `removed`: no chip rendered

### Card indicators

- show an edited badge when the saved parsed requests have been manually changed
- keep existing confidence and batch-status badges
- keep `Apply dates` visible when the item still has at least one saved request and valid therapist/cycle matches

### Failure handling

- if a chip save fails, show an error toast
- restore the previous chip state after failure
- do not silently drop a chip locally without persistence

## Testing Strategy

### Unit tests

- request chip cycling helper transforms `off -> work -> removed`
- edited request persistence updates the saved `parsed_requests`
- removed requests no longer appear in the rendered chip set

### Action tests

- editing one chip persists immediately
- repeated clicks cycle through all three states
- failed saves leave the prior saved state intact

### Component tests

- the intake panel renders clickable chips from saved `parsed_requests`
- edited items show an edited marker
- `Apply dates` uses the edited request set

### Integration tests

- manager edits a parsed chip, applies dates, and the corrected dates appear in the manager availability request view
- corrected intake dates feed the same downstream availability override path used by auto draft

## Risks

- Immediate persistence increases write frequency on intake items.
- Optimistic chip UI can feel broken if not reconciled carefully after server response.
- If edited state is not tracked explicitly, managers may not realize when the parser output was manually changed.

## Acceptance Criteria

- Managers can click a parsed intake date chip to cycle `off -> work -> removed`.
- Each chip edit saves immediately.
- Reparse restores parser-generated chip state from the original source text.
- `Apply dates` uses the edited saved chip state.
- Corrected intake dates flow into the same downstream override data used by the manager availability dashboard and auto draft.
