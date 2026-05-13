# Schedule Grid Unification

**Date:** 2026-05-13  
**Status:** Approved

## Problem

The app has three overlapping ways to view the schedule:

1. `/coverage` with a "Block board" layout (weekly calendar, editable)
2. `/coverage` with a "Roster" layout (grid, editable) — toggled from the same page
3. `/schedule` "Roster View" nav tab (grid, read-only, published only)

Managers don't know which is the live truth. Therapists have both "My Shifts" and "Team Schedule" pointing to different surfaces. The layout toggle inside Coverage adds a third dimension of confusion.

## Solution

Collapse everything into a single `/schedule` route that is the one live truth. The grid (rows = therapists, columns = dates) is the only schedule view. Editing happens inline on the grid via cell clicks. The block board is removed.

---

## 1. Navigation Changes

### Manager — Schedule section tabs (before → after)

**Before:** Coverage · Roster View · Analytics · Availability · Lottery · Publish · Approvals  
**After:** Schedule · Analytics · Availability · Lottery · Publish · Approvals

- "Coverage" and "Roster View" collapse into a single **"Schedule"** tab
- The layout toggle (Block board / Roster) inside Coverage is removed entirely

### Therapist nav (before → after)

**Before:** My Shifts · Team Schedule · Availability  
**After:** Schedule · Availability

- "My Shifts" and "Team Schedule" collapse into a single **"Schedule"** tab
- Same grid component, read-only, with the therapist's own row pinned at top

### Route plan

| Route                                    | After                                                 |
| ---------------------------------------- | ----------------------------------------------------- |
| `/schedule`                              | Canonical unified grid (replaces both old pages)      |
| `/coverage`                              | Redirects to `/schedule` (no-op, preserves bookmarks) |
| `/staff/schedule`, `/therapist/schedule` | Redirect to `/schedule`                               |

---

## 2. The Schedule Grid Page

**Route:** `/schedule`  
**Component:** Unified `ScheduleGrid` (new, replaces `CoverageClientPage` + `ScheduleRosterScreen`)

### Toolbar

```
[May 3 – Jun 13, 2026]  [Draft ▾]  [Day] [Night]     [⚡ Auto-draft] [✓ Pre-flight] [🖨 Print] [Publish →]
```

- **Cycle selector** — current cycle date range, dropdown to switch cycles
- **State badge** — "Draft" (yellow) or "Published" (green)
- **Day / Night toggle** — switches shift type, updates URL (`?shift=day|night`)
- **Auto-draft** — visible in Draft state only; triggers existing pre-flight + draft generation flow
- **Pre-flight** — visible in Draft state only
- **Print** — always visible
- **Publish →** — visible in Draft state for managers only; triggers existing publish action

### Grid

Columns: therapist name (fixed left) + one column per cycle date + total (fixed right, shows count of `scheduled`/`call_in` shifts for that therapist in the cycle)  
Rows: one per therapist, grouped by shift type (day staff first, then night), FMLA rows muted

**Cell rendering:**

| State                 | Display                                                                 |
| --------------------- | ----------------------------------------------------------------------- |
| Lead-designated shift | Yellow `1` (`#fef08a`, dark amber text)                                 |
| Scheduled (staff)     | Blue `1` (`#dbeafe`, blue text)                                         |
| On call               | Amber `OC` (`#fef9c3`, amber text)                                      |
| Cancelled             | Red `CX` (`#fee2e2`, red text)                                          |
| Call-in               | Green `CI`                                                              |
| Left early            | Orange `LE`                                                             |
| Off (unscheduled)     | Muted `·`                                                               |
| Needs-off conflict    | Append bold black `*` superscript to any cell (`·*`, `1*`, `OC*`, etc.) |

**Daily totals row** (pinned bottom):

- `< 3` → red
- `3–5` → teal/green
- `> 5` → amber (overstaffed warning)
- Weekends / non-work days → grey

---

## 3. Cell Interaction Model

### Manager / Lead — Draft state

Each cell in the grid belongs to one therapist (the row) on one date (the column). A manager clicks **any therapist's cell** to assign or unassign that specific therapist on that specific date.

**Click `·` (off, no conflict):**  
→ Small popover: "Assign [Name] to [Date]?" with **Assign** / **Cancel**.  
Cells for therapists who are ineligible on that date (FMLA, inactive, `force_off` override, or at their weekly max) are not clickable and render without a hover state. Eligibility follows the same rules as `generateDraftForCycle` in `src/lib/coverage/generate-draft.ts`.

**Click `·*` (off, requested off):**  
→ Same popover with an amber warning banner: "⚠ Requested this day off." Actions: **Assign anyway** / **Cancel**. The `·*` cell is clickable — the `*` is informational only, never a hard block.

**Click `1` or `1*` (scheduled):**  
→ Popover showing current status with **Unassign** and **Designate as lead** actions (manager only). **Designate as lead** calls the existing `setCoverageDesignatedLeadViaApi` (`action: 'set_lead'`) mutation — this replaces the lead designation that previously lived in the shift editor dialog. If `1*`, includes the "Requested this day off" warning.

### Manager / Lead — Published state

**Click any assigned cell:**  
→ Status popover with current status checked:

- Scheduled ✓
- On call
- Cancelled
- Call-in
- Left early
- ──
- Unassign

Leads can update status but cannot assign new therapists (manager-only). Lead designation is also manager-only in published state.

### Therapist — all states

- Cells are **not clickable**
- Their own row is **pinned to the top** of the grid with a teal bottom border and `"You"` label prefix
- Rest of team shown below at normal size
- No editing actions rendered

### Conflict behaviour

The `*` asterisk is **informational only** — it surfaces the therapist's "Need Off" availability override but never blocks the manager from assigning. The warning appears in the popover; the manager confirms with **Assign anyway**.

---

## 4. What Is Removed

| Removed                                                    | Notes                                                                                   |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Block board (calendar/week view)                           | Full removal. Auto-draft and pre-flight remain; only the calendar editing UI goes away. |
| "Roster" layout toggle inside Coverage                     | Replaced by the grid being the only layout.                                             |
| `/schedule` read-only page (`ScheduleRosterScreen`)        | Replaced by the unified grid.                                                           |
| Therapist "My Shifts" route (`/therapist/schedule`)        | Redirects to `/schedule`.                                                               |
| "Team Schedule" therapist nav item pointing to `/coverage` | Replaced by single "Schedule" tab.                                                      |

---

## 5. Key Existing Code to Reuse

- `src/components/schedule-roster/ScheduleRosterScreen.tsx` — `PaperScheduleGrid` for the grid rendering foundation
- `src/lib/coverage/mutations.ts` — `assignCoverageShift`, `unassignCoverageShift`, `setCoverageDesignatedLeadViaApi`
- `src/app/api/schedule/assignment-status/` — POST route for status updates (OC/CX/CI/LE)
- `src/lib/coverage/selectors.ts` — `buildDayItems`, `toUiStatus`
- `src/lib/coverage/coverage-shift-tab.ts` — day/night tab helpers
- `src/app/(app)/coverage/coverage-page-data.ts` — snapshot loader (adapt for new route)
- `src/components/shell/app-shell-config.ts` — nav config to update

---

## 6. Out of Scope

- Auto-draft algorithm changes (`generate-draft.ts`) — untouched
- Publish flow — untouched
- Availability, Lottery, Approvals pages — untouched
- Mobile layout optimisation — future work
- Print layout — existing print styles carry over
