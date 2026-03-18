# Coverage Dialog Density Design

Date: 2026-03-18
Route: `/coverage`
Component: `src/components/coverage/ShiftEditorDialog.tsx`

## Goal

Make the coverage day editor dialog smaller and more compact for managers while preserving the current information model and assignment behavior.

## Approved Direction

- Use an even compact density pass rather than a dense rewrite.
- Reduce the dialog width another step on desktop.
- Tighten the header block and row sizing evenly so the whole dialog scales down together.
- Reduce therapist row height with smaller avatar, action circle, and internal spacing.
- Keep the two-line row structure and existing status text.
- Keep behavior, interaction order, accessibility semantics, and data flow unchanged.

## Non-Goals

- No assignment logic changes
- No status wording changes
- No new controls or sections
- No changes to calendar behavior outside the dialog

## Target Experience

The dialog should feel lighter and less oversized. Managers should be able to see more therapist rows without scrolling as quickly, but the UI should still read comfortably on desktop and mobile. No single element should look aggressively shrunken; the compaction should feel uniform.

## UI Changes

### Dialog Shell

- Reduce `DialogContent` max width from the current wide desktop size to a narrower layout.
- Keep the same scroll behavior and modal interaction model.

### Header

- Reduce top and bottom padding again.
- Scale the date title down further from the current treatment.
- Tighten the spacing between date, shift label, and active-count summary.

### Therapist Rows

- Reduce row vertical padding and outer radius again.
- Reduce avatar size.
- Reduce action toggle size.
- Reduce metadata font size slightly and tighten wrap spacing.
- Keep the `Lead` badge but make it visually lighter and smaller.

### Section Rhythm

- Tighten vertical spacing between sections and between individual rows.
- Preserve current warning and error surfaces, only with matching compact spacing.

## Testing Strategy

- Add a focused unit test for the compact layout tokens or class map.
- Verify the new compact values fail before implementation and pass after.
- Run the targeted unit test and a production build check if feasible.

## Acceptance Criteria

- The dialog is visually smaller and more compact than the current version.
- More therapist rows are visible in the viewport at once.
- The dialog still exposes the same content and controls.
- No assignment or status behavior changes.
