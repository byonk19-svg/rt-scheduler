# Teamwise Frontend UX/UI Redesign Guide

**Prepared:** 2026-05-04  
**Audience:** (1) Design tools (Claude Design, Stitch) generating higher-fidelity mockups; (2) Coding agents (Claude Code, Codex, Cursor) implementing changes in the Next.js/Tailwind codebase.  
**Codebase:** `src/` in this repo — Next.js App Router, Tailwind, shadcn/ui, Supabase.  
**Design system baseline:** `DESIGN.md` (canonical token reference), `src/app/globals.css` (shipped tokens).

---

## Executive Summary

Teamwise is operationally sound — the data model, routing, and role separation are correct. The UX debt is structural, not cosmetic:

1. **The Coverage page is too large.** At 1,600 lines, `CoverageClientPage.tsx` handles cycle selection, grid/roster view switching, auto-draft, pre-flight, template management, print, and preliminary actions simultaneously. Nothing is clearly primary when a manager opens it cold.
2. **Navigation is correct in structure but weak in labels.** "Today" as a nav section for the dashboard, "Requests" for a mixed shift-swap/access-approval hub, and 6 sub-items under "Schedule" all create orienting friction.
3. **The manager dashboard ("Inbox") tells you what happened, not what to do.** Recent activity is secondary information. The page should lead with the next-action queue.
4. **Availability workflows are architecturally right but surface-level confusing.** The manager sees `/availability`; the therapist sees `/therapist/availability`. The URL asymmetry leaks into UI labels and creates ambiguity on shared surfaces.
5. **Mobile is not designed — it is tolerated.** The horizontal top nav degrades gracefully but is not a real mobile pattern. Schedule surfaces (6-week calendar, roster matrix) have no mobile-first alternative.

### Top 5 Highest-Impact Redesign Changes

| Priority | Change                                                                                                                                                                                                                                                               | Impact                                                                         |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1        | **Give the Coverage page a clear primary action hierarchy** — cycle state drives what the page shows first: empty → start draft CTA; draft in progress → review/edit tools; published → read-only with re-draft option                                               | Eliminates the "what do I do here?" confusion for every manager session        |
| 2        | **Rename and restructure the manager nav** — rename "Today" → "Dashboard", clarify "Schedule" sub-items, move Shift Board out of People into its own context                                                                                                         | Every manager visit becomes faster to orient                                   |
| 3        | **Rebuild the manager dashboard as a true action queue** — lead with a ranked list of outstanding tasks (approvals, intake review, unfilled slots, upcoming deadline) rather than metric cards that summarize already-visible state                                  | Reduces the time from login to first productive action                         |
| 4 \*\*   | Design an explicit mobile layout for therapists\*\* — bottom tab bar with 4 items (Dashboard, My Shifts, Availability, More), week-by-week schedule view, and mobile-first chip interactions for availability submission                                             | Therapists are the most likely mobile users; current UI has no mobile story    |
| 5        | **Separate the Availability Intake tab into its own route** (`/availability/intake`) and give it a dedicated header, action buttons, and empty state — the combined Planner + Intake tab on one page creates two different user goals competing for the same surface | Managers stop losing context when switching between planning and intake review |

---

## 1. Product Design Principles

These 8 principles govern every design decision in this app. When two design choices conflict, apply the higher-numbered principle as the tiebreaker.

### 1. Make the next action obvious

Every page must answer: "What should I do right now?" Status summaries that don't lead to an action are secondary. Dashboard pages must surface the action queue first, not the metric grid.

### 2. The cycle is the unit of time — keep it visible

The 6-week schedule cycle is the core navigational concept. Every schedule-adjacent surface must show which cycle is active (label + date range), its current state (draft, preliminary, published), and how to switch cycles. This context must never require the user to go looking.

### 3. Day/Night shift context must never be ambiguous

Any page that mixes or differentiates Day and Night shift data must show that context prominently — ideally in the page header or a persistent toggle that is never hidden in a dropdown. A manager viewing night shift data while thinking they're looking at day shift is a patient-safety risk.

### 4. Semantic color communicates state, not decoration

Green = complete/healthy. Amber = needs attention or in progress. Red = blocker or failed. Blue = informational. These are used only for their meanings. Do not use teal or amber decoratively where it might be confused with a status.

### 5. Density is earned, not imposed globally

Coverage and roster surfaces can be compact because users are navigating spatially. Forms, dashboards, and analytics should breathe. Never globally tighten padding to make a page feel faster — only tighten when the spatial structure earns it.

### 6. Show first names legibly at all times on schedule surfaces

A schedule grid that requires horizontal scrolling or squinting to read a therapist's name has failed. First names should always be visible at the current breakpoint. Full names are secondary.

### 7. Distinguish planning from reading

Coverage planning (editing shifts, auto-drafting, assigning staff) is a different mode from reading the schedule (who is working when). The UI should visually separate these modes. Editing controls must not clutter read-only views.

### 8. Mobile serves therapists, not managers

Manager workflows (cycle planning, availability review, publishing) are desktop-first — they require spatial awareness of a 6-week grid. Therapist workflows (checking my schedule, submitting availability, claiming a pickup) are mobile-first. Design decisions for mobile should optimize the therapist path, not try to cram the manager workspace.

---

## 2. Global App Shell Recommendation

### Current state

The app has a fixed horizontal top bar (height 44px) with two levels:

- **Primary bar:** section labels (Today / Schedule / People for manager; 6 items for staff)
- **Secondary bar:** sub-items for the active primary section (up to 6 items for Schedule)

The secondary bar requires `overflow-x-auto` on mobile, which is functional but not designed.

### Recommended app shell

#### Manager shell

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Logo]  Dashboard  |  Schedule ▾  |  People ▾            [Bell] [Avatar ▾] │  ← Top bar, 44px
├─────────────────────────────────────────────────────────────────────────────┤
│  Coverage · Availability · Publish · Approvals · Analytics                  │  ← Sub-nav (visible when Schedule active)
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [Cycle pill: Apr 28 – Jun 8 · Draft ▾]          [Day | Night toggle]      │  ← Cycle context bar (schedule pages only)
│                                                                             │
│  Page content                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

**What stays persistent across all pages:**

- Top bar (logo, primary nav, bell, avatar)
- Cycle context bar appears only on pages where a cycle is relevant (Coverage, Availability, Schedule, Approvals); it is hidden on Dashboard, Team, Profile, Analytics

**What changes per page:**

- Sub-nav: only visible when Schedule or People is active
- Cycle context bar: only on schedule-adjacent pages
- Page-level actions: right-aligned in the page header, not in the shell

#### Staff shell

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Logo]  Dashboard  My Shifts  Availability  Team Schedule  Swaps           [Bell] [Avatar ▾] │
└─────────────────────────────────────────────────────────────────────────────┘

Mobile (therapist):
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Logo]                                                          [Bell] [≡]  │
├─────────────────────────────────────────────────────────────────────────────┤
│  Page content                                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  [Dashboard]   [My Shifts]   [Availability]   [Swaps]   [More]             │  ← Bottom tab bar
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Key shell rules

- **One sticky top bar only.** The current implementation is correct; do not add a sidebar.
- **Cycle selector belongs in a sub-header bar on schedule pages,** not in the primary top bar. It is a page-level control, not a global control.
- **Day/Night toggle belongs adjacent to the cycle selector,** always visible on schedule pages. Never inside a dropdown.
- **Notification bell badge:** shows unread count; clicking opens the panel. Do not expand to a full page.
- **User menu (avatar dropdown):** Settings, Therapist view (if manager), Log out.

---

## 3. Information Architecture

### Manager navigation (recommended)

| Section   | Label         | Sub-items                                  | Notes                                                                                                                                      |
| --------- | ------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Dashboard | **Dashboard** | _(none)_                                   | Rename from "Today" — "Today" is time-specific and confusing as a section name                                                             |
| Schedule  | **Schedule**  | Coverage, Availability, Publish, Approvals | Remove "Roster view" and "Analytics" from top-level sub-nav; Roster view is accessible from Coverage page directly; Analytics moves to end |
| People    | **People**    | Team, Requests, Shift Board                | Move Shift Board under People (not under Requests hub)                                                                                     |
| Analytics | **Analytics** | _(none)_                                   | Promote to top-level primary item; currently buried 6th in Schedule sub-nav                                                                |

**Changes from current:**

- Rename "Today" → "Dashboard"
- Remove the thin `/requests` hub page; route `/requests` directly to `/requests/user-access` for manager and add a Shift Board link in the nav
- Move Shift Board from `People > Requests` to `People > Shift Board` as a direct sub-item
- Promote Analytics to primary nav (or give it a dedicated spot in the Schedule sub-nav, not after Publish)
- Rename "Schedule workspace" sub-item → "Coverage"
- Rename "Roster view" sub-item → "Roster" and de-emphasize (it is a secondary view of Coverage)

### Staff navigation (recommended)

| Item | Label         | Route                     | Notes                                                       |
| ---- | ------------- | ------------------------- | ----------------------------------------------------------- |
| 1    | Dashboard     | `/dashboard/staff`        | Current                                                     |
| 2    | My Shifts     | `/therapist/schedule`     | Implemented (`src/app/(app)/therapist/schedule/page.tsx`)   |
| 3    | Availability  | `/therapist/availability` | Rename from "Future Availability" — shorter, clearer        |
| 4    | Team Schedule | `/coverage`               | Current                                                     |
| 5    | Shift Swaps   | `/therapist/swaps`        | Rename from "Shift Swaps & Pickups" — too long for nav chip |

**History** (`/staff/history`) is implemented (`src/app/(app)/staff/history/page.tsx`) — keep it in the nav. The dashboard card linking to it is a useful shortcut but does not replace the nav item.

### Routes that feel redundant or confusing

| Route                 | Issue                                                                        | Recommendation                                                                                     |
| --------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `/requests` (manager) | Hub page with 2 nav cards — thin wrapper that adds a navigation step         | Eliminate; update nav to link Shift Board and User Access Requests directly                        |
| `/schedule`           | "Read-only roster matrix" that duplicates part of `/coverage` in Roster view | Keep but clarify: rename nav item to "Roster" and add a visual note "View only — edit in Coverage" |
| `/directory`          | Compatibility redirect to `/team`                                            | Retire and redirect; remove from any visible nav                                                   |
| `/staff/*`            | Legacy compat routes                                                         | Redirect; do not surface in nav                                                                    |

---

## 4. Route-by-Route UX Audit

---

### 4.1 Public Homepage `/`

**Purpose:** Marketing/entry point for an internal RT-department tool. Explains what Teamwise is and gives employees a way to sign in or request access.

**Primary user:** A new employee or returning user who isn't yet logged in.

**Primary action:** Sign in.

**Secondary action:** Request access (for new employees who don't have an account).

#### Current issues

- The 3-up feature strip below the hero uses amber vertical left borders on cards — this is the "side-stripe border" anti-pattern (see DESIGN.md). Those borders are purely decorative and should be replaced with a top icon or headline treatment.
- The hero headline "Scheduling that keeps care moving." is good; the subtext below it is adequate but could be tighter.
- `PublicHeader` uses `bg-[var(--marketing-hero-bg)]` — correct per the regression guard; do not change.
- The "Request access" secondary CTA is currently an outline button on the dark hero. The visual hierarchy between Sign in (filled amber) and Request access (outline) is correct.

#### Recommended layout

- Keep the dark teal hero with amber CTA — this is working and locked by tests.
- Fix the 3-up feature strip: replace side-stripe card borders with icon-led cards or frameless text blocks. Use a subtle `bg-muted` background strip, not card borders.
- On mobile: stack hero headline + single CTA, hide feature strip or show one item.

#### Desktop guidance

- Hero: full-width, max 1120px content area, centered copy, two CTAs side by side.
- Feature strip: 3 columns below the fold, each with an icon (Lucide), a short label, and 1-sentence description.

#### Mobile guidance

- Single-column hero, "Sign in" CTA full-width, "Request access" as a text link below.
- Feature strip: hide or convert to a single scrollable row of chips.

#### Components needed

- `PublicHeader` (exists)
- `HeroSection` (exists as part of page.tsx)
- `FeatureStrip` — refactor to remove side-stripe borders

---

### 4.2 Login `/login`

**Purpose:** Sign existing users in; surface friendly messages for pending/rejected users.

**Primary user:** Any employee who already has an account.

**Primary action:** Submit email + password.

**Secondary actions:** Go to sign up; dismiss status banners.

#### Current issues

- Left brand panel is correct visually (dark teal + amber stripe + serif headline). No changes needed there.
- The error/warning/info banner system is sound but the dismissal UX is brittle — `dismissedMessageKey` is local state and resets on page reload.
- No "Forgot password?" link is visible. This is a gap for users who have forgotten credentials.
- The approval warning banner copy ("Your account is pending manager approval") correctly avoids disclosing whether a name match occurred, but doesn't tell the user what to do next beyond waiting.

#### Recommended layout

- Right panel: email, password, forgot password link (as a small text link below the password field), primary Sign in button.
- Status banners: above the form fields, not below. Info/warning banners for pending/requested status; error banner for credential failure. Keep existing logic.
- Add "Forgot password?" as `<button type="button">` linked to Supabase password reset flow.

#### Desktop guidance

- Left panel: 40% width, dark teal, brand content. Right panel: 60%, white/form background, the form.
- Both panels should be equal height, with the form centered vertically in the right panel.

#### Mobile guidance

- Hide left brand panel entirely. Show only the form panel, centered on the page, with the logo at the top.

#### Components needed

- `AuthBrandPanel` — left column (exists inline in page.tsx; extract to a reusable component shared with signup)
- `AuthFormPanel` — right column wrapper
- `AuthStatusBanner` — exists as inline alert blocks; extract

---

### 4.3 Signup `/signup`

**Purpose:** Let a new employee create an account and enter the pending-approval queue.

**Primary user:** A new employee who received the Teamwise URL from their manager.

**Primary action:** Submit name, email, password to create an account.

**Key UX constraint:** Signup success does not log the user in — it redirects to `/login?status=requested`. This is correct but the user may not understand why they're back at login.

#### Current issues

- The "pending approval" mental model is not explained before the user fills out the form. A user might expect to land directly in the app.
- The success redirect to `/login?status=requested` shows an info banner — this is good but the banner copy should explicitly say "A manager will approve your request. You'll be able to sign in once approved."
- No phone number field is required but it is present — clarify in the UI whether it is optional.

#### Recommended layout

- Same split-panel layout as login.
- Add a small "What happens next?" explanation below the form (2 lines of muted text): "Your account will be reviewed by a manager. You'll receive access once approved."
- Mark phone as "(Optional)" explicitly in the label.

#### Mobile guidance

- Same as login: hide left brand panel, single-column form.

---

### 4.4 Onboarding `/onboarding`

**Purpose:** First-run configuration for newly approved therapists and leads before they can use the app.

**Primary user:** A therapist or lead who just received approval and has logged in for the first time.

**Required steps:** Set normal schedule, Choose schedule preferences, Choose notifications and appearance.

**Recommended (non-blocking):** Review future availability.

#### Current issues

- The onboarding page structure is not documented at the component level in the codebase (loads `OnboardingScheduleSetup`) — the UX is a single form flow.
- No visible step indicator — users don't know they're in step 1 of 3.
- Managers skip onboarding entirely, but there's no clear explanation of why a manager account behaves differently.

#### Recommended layout

- Step indicator at the top: numbered pills (1, 2, 3) with labels showing current step.
- One step per screen, not all three stacked.
- At the end: a "You're all set" completion screen with links to the dashboard and therapist availability.
- Progress must survive a browser refresh (store step completion in the database, which it already does via `staff_onboarding_required` / `staff_onboarding_completed_at`).

#### Desktop guidance

- Centered form container (max 560px wide), comfortable padding, one step per view.
- Step indicator at top-left of form card.

#### Mobile guidance

- Full-width form, same step indicator pattern.

---

### 4.5 Manager Dashboard `/dashboard/manager`

**Purpose:** Give the manager a quick read on operational status and surface the next required action.

**Primary user:** Manager, accessed multiple times per day, especially at the start of a shift.

**Primary action:** Act on the highest-priority outstanding item (approvals, intake review, unfilled slots).

**Secondary actions:** Navigate to Coverage, Availability, or other tools.

#### Current issues

- The page is called "Inbox" in the h1 but the nav section is labeled "Today." These two labels create dissonance. Neither label accurately describes the page — it's a dashboard/triage surface.
- The metric card row (Coverage Issues, Pending Approvals, Upcoming Shifts) repeats information the manager can see more precisely in the actual pages. Cards that show "3 issues" without immediately resolving them don't serve the manager.
- "Recent Activity" (notification-based event log) is the least actionable section but currently gets the same visual weight as action-oriented content.
- The `nextAction` banner (when approvals are pending) is the most valuable element on the page but is positioned after the metric cards.
- The ScheduleProgress component (day/night fill rates) is genuinely useful but visually competes with everything else.

#### Recommended layout

**Lead with the action queue, not metrics.**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Dashboard                                               [Monday, May 4]     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  NEEDS ATTENTION                                                      │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │  │
│  │  │  [!]  2 access requests waiting      → Review approvals         │ │  │
│  │  │  [!]  1 intake item needs review     → Open intake              │ │  │
│  │  │  [~]  Apr 28 – Jun 8 draft incomplete  → Open Coverage          │ │  │
│  │  └─────────────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Today's coverage  ─────────────────────────────────────────────────────── │
│  Day: 4/5 filled · Night: 3/5 filled                                       │
│  [Shift list: name + role for today's scheduled staff]                     │
│                                                                             │
│  Upcoming ───────────────────────────────────────────────────────────────── │
│  May 5 · 6 shifts · May 6 · 5 shifts · ...                                │
│                                                                             │
│  Recent activity ────────────────────────────────────────────────────────── │
│  (de-emphasized, collapsed by default on load)                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Visual hierarchy:**

1. Action queue (amber/red tones for urgency) — always at top
2. Today's coverage summary (compact, green/amber status)
3. Upcoming 3-day outlook (compact)
4. Recent activity (muted, collapsed by default)

#### Component changes

- Replace metric card grid with a ranked action queue list (`ActionQueueItem` component)
- Keep ScheduleProgress but move it below the action queue
- Rename page h1 from "Inbox" to "Dashboard"
- Add today's date to the page header

#### Desktop guidance

- Two-column layout: action queue + today's shifts on the left (2/3), schedule progress on the right (1/3).

#### Mobile guidance

- Single column; action queue first; today's shifts as a collapsed section; schedule progress hidden or shown on scroll.

---

### 4.6 Coverage Workspace `/coverage`

**Purpose:** The manager's primary scheduling workspace — view, edit, and manage the 6-week cycle schedule. Auto-draft, assign staff, designate leads, publish.

**Primary user:** Manager (daily use during active cycle planning), Lead (read with some status updates).

**This is the most complex surface in the app and needs the most careful UX attention.**

#### Current state

The `CoverageClientPage` (1,600 lines) handles:

- Cycle selection (from a list of draft/published/archived cycles)
- Grid view (42-day calendar) vs Roster view (6-week × staff matrix)
- Day shift / Night shift tab
- Shift editor dialog (click a day → open dialog → assign/unassign staff)
- Auto-draft generation + pre-flight report
- Save as template / Start from template
- Cycle management (create, delete, archive)
- Print
- Preliminary snapshot send
- Cycle publish

#### Current issues

1. **No clear primary action on load.** A manager lands on Coverage and sees: a cycle selector pill, a toolbar with Sparkles (auto-draft), Send (preliminary), a More actions menu, and a Print button — all at the same visual weight. What does the manager do first?
2. **Cycle state is not prominent enough.** Whether a cycle is Draft, Preliminary, or Published determines what actions are available — but this status is shown only as a small badge on the cycle selector pill. It should be the most visible element on the page.
3. **The auto-draft CTA ("Generate draft") and the cycle creation CTA ("New cycle") look similar.** They are categorically different operations — creating a new cycle vs. populating an existing empty one.
4. **Two views (Grid, Roster) compete.** The Grid is the primary navigation tool; the Roster is a read-optimized comparison view. But they are presented as equal toggle options.
5. **The pre-flight dialog is the right pattern** — run a check before drafting. This UX decision is correct.
6. **Empty draft state panel** is correct but the copy could be stronger.

#### Recommended layout

**State-driven page structure:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [Cycle: Apr 28 – Jun 8 · DRAFT ▾]    [Day | Night]     [Grid | Roster]   │  ← Persistent sub-header
├─────────────────────────────────────────────────────────────────────────────┤
│  STATE: Draft incomplete                                                     │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  [Coverage Health: 12 of 42 days have ≥3 staff · 6 days unfilled]    │  │
│  │  [Primary CTA: Run auto-draft ✦] [Secondary: Assign manually]        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  [42-day calendar grid — compact density]                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  STATE: Draft complete / Published — actions change:                        │
│  [Primary CTA: Send preliminary] or [Published: Re-draft | Print]          │
└─────────────────────────────────────────────────────────────────────────────┘
```

**State machine for page header actions:**

| Cycle state             | Primary CTA      | Secondary CTA    |
| ----------------------- | ---------------- | ---------------- |
| No cycle selected       | Create new cycle | —                |
| Cycle exists, no shifts | Run auto-draft ✦ | Assign manually  |
| Draft in progress       | Continue editing | Run auto-draft ✦ |
| Draft complete          | Send preliminary | Preview / Print  |
| Preliminary sent        | Publish schedule | Edit draft       |
| Published               | Re-draft         | Print            |

**Key UX rules for Coverage:**

- Cycle status (Draft / Preliminary / Published) must be visible in the sub-header at all times, larger than the cycle date range.
- The Day/Night toggle must be in the sub-header, not a tab that could be missed.
- Auto-draft ✦ is a primary action — give it the teal primary button style when applicable.
- Print, More actions, template operations are secondary — put them in a `...` overflow menu.

#### Desktop guidance

- Full-width calendar grid (compact density) at `xl` breakpoints.
- Shift editor: centered dialog (current pattern is correct).
- Cycle sub-header: sticky at the top of the content area, below the main nav bar.

#### Mobile guidance

- Switch to week-by-week view automatically: show one 7-day week strip at a time.
- Week navigator: `← prev` / `Week of May 4` / `next →`.
- No roster view on mobile — it is unreadable.
- Shift editor: full-screen bottom sheet on mobile.

#### Implementation notes

- File: `src/app/(app)/coverage/CoverageClientPage.tsx`
- Extract the page-level action bar (cycle selector + state CTA) into `CoverageActionBar.tsx`
- Extract cycle status + day/night toggle into `CoverageContextBar.tsx`
- The dialog/modal structure is already well-organized with dynamic imports — keep that pattern

---

### 4.7 Schedule / Roster View `/schedule`

**Purpose:** Read-only roster matrix for managers and leads — who is working on which days in the active cycle.

**Primary user:** Manager or lead checking staffing at a glance, without editing intent.

**Primary action:** Read. No mutation.

#### Current issues

- The page is labeled "Roster view" in the sub-nav, but the h1 and page behavior are not clearly distinguished from `/coverage`. Users may not understand why they can't edit here.
- No clear "To edit, go to Coverage" CTA or link.
- Analytics is grouped in the same Schedule sub-nav, sandwiched between Roster view and Availability — it doesn't naturally belong between these two pages.

#### Recommended layout

- Add a persistent muted banner at the top: "Read-only view — to edit shifts, go to Coverage workspace." with a link.
- Page h1: "Schedule Roster" (or "Roster") not "Schedule" (too generic).
- Otherwise, keep the existing roster matrix component — it works well for its purpose.

#### Desktop guidance

- Full-width table with sticky left column (therapist names) and sticky header row (dates).
- Day/Night tab visible at top of the table.

#### Mobile guidance

- Collapse to a single week view; allow swipe navigation between weeks.
- Show only current week by default.

---

### 4.8 Manager Availability Review `/availability`

**Purpose:** Manager planning surface for the upcoming cycle — view submitted therapist availability, set overrides (force_on / force_off), and review parsed email intake items.

**Primary user:** Manager, before and during cycle planning.

**This route has two distinct sub-workflows that compete for the same surface:**

1. **Planner:** Set override dates for therapists across the 6-week grid.
2. **Intake:** Review parsed email/OCR intake submissions, match therapists, apply dates.

#### Current issues

- The Planner and Intake tabs are on the same page, but they represent different mental modes. A manager reviewing OCR email results is in a triage/review mode, not a planning mode. Mixing them adds context-switching overhead.
- The Planner's "Select dates to save" CTA is only shown when no dates are selected — the disabled state copy is good but the enabled state CTA appears only after interaction.
- "Response Roster" and "Request Inbox" tabs inside the Planner tab create a three-level tab nesting that is confusing to navigate.

#### Recommended layout

**Split Planner and Intake into distinct routes:**

- `/availability` → Planner only
- `/availability/intake` → Intake review only (already exists as a redirect, but should be a first-class page)

**Planner page (`/availability`):**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Availability Planning                [Cycle: Apr 28 – Jun 8]              │
│  Planner  |  Intake →                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  Left col (controls):          │  Right col (calendar / roster grid):       │
│  [Therapist selector]          │  [6-week availability calendar]            │
│  [Date range filter]           │                                            │
│  [Force-on / Force-off toggle] │  [Each day: availability status chips]     │
│  [Save dates button]           │                                            │
│                                │                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Intake page (`/availability/intake`):**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Availability Intake             [Cycle: Apr 28 – Jun 8]    [+ Manual add] │
├─────────────────────────────────────────────────────────────────────────────┤
│  [Intake items list — each card:]                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  [Therapist: unmatched | matched name]  [Status chip: needs_review] │   │
│  │  [Parsed dates as chips]               [Source: email / upload / manual] │ │
│  │  [Actions: Match therapist | Apply dates | Delete]                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Desktop guidance

- Planner: 2-column split (left: controls, right: calendar) — currently correct pattern.
- Intake: single-column card list with inline edit controls.

#### Mobile guidance

- Planner: hide the left control column by default; show as a bottom sheet triggered by a floating "Filter" button.
- Intake: same card list works on mobile.

---

### 4.9 Therapist Availability Submission `/therapist/availability`

**Purpose:** Therapist submits availability for the upcoming cycle — marking dates as "Need off" or "Request to work" against their recurring pattern.

**Primary user:** Therapist, 1–2 times per cycle per their deadline.

**Primary action:** Review the cycle calendar, toggle date statuses, submit.

**Key UX constraint:** "Save progress" and "Submit availability" are different operations. Saving is intermediate; submitting is final and notifies the manager.

#### Current issues

- The distinction between "Save" (draft/intermediate) and "Submit" (final) is not visually prominent enough. Both actions are present but similar in weight.
- The conflict warning (when a therapist marks a date as Need Off when they already have a scheduled shift on that date) is a dismissible banner — this is correct, but the warning should appear adjacent to the specific date chip, not only as a page-level banner.
- Recurring pattern vs. availability override: the baseline (recurring pattern) and the override (cycle-specific change) need to be visually distinguished so the therapist understands they're editing deviations, not redefining their schedule.
- The "Future Availability" label in the nav is accurate but long; "Availability" is clearer.

#### Recommended layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Your Availability              [Cycle: Apr 28 – Jun 8 · Due: May 10]     │
│  Based on your recurring schedule: Tue–Sat · Day shift                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  [6-week calendar grid]                                                     │
│  Each day cell:                                                             │
│    [Date] [chip: Available | Need Off | Request to Work]                   │
│    [if scheduled conflict: amber ⚠ inline]                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  [Save progress — secondary/ghost]       [Submit availability — primary]   │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Visual separation rules:**

- Days that match the recurring pattern with no override: muted "Available" chip.
- Days with active overrides: colored chip (error for Need Off, success for Request to Work).
- Days outside the therapist's normal work pattern: show a subtle hatching or gray background — not a fully interactive chip.

#### Desktop guidance

- Calendar grid with compact chips; Submit button pinned to the bottom-right (sticky footer on scroll).

#### Mobile guidance

- Week-by-week view (one week at a time, swipe to navigate).
- Chips are touch-target sized (min 44px height).
- Submit button: full-width in a sticky bottom bar.

---

### 4.10 Staff Dashboard `/dashboard/staff`

**Purpose:** Give a therapist their operational status at a glance: what's next for them, their upcoming shifts, and any swap/pickup activity.

**Primary user:** Therapist or lead, daily check-in.

**Primary action:** Navigate to the next required task (submit availability, check schedule, claim a pickup).

#### Current issues

- The `StaffAttentionCard` (next-step action) and `MyScheduleCard` (upcoming shifts) are the most valuable elements — they should lead the page.
- "Shift Swaps & Pickups" card links to the shift board but doesn't show current open opportunities inline.
- "History" links to an unimplemented page. A dead link on the dashboard is a trust issue.

#### Recommended layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Dashboard                                         [Monday, May 4]         │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────┐  ┌─────────────────────────────┐ │
│  │  NEXT STEP                           │  │  YOUR UPCOMING SHIFTS       │ │
│  │  [StaffAttentionCard]                │  │  [next 3 shifts: date, role]│ │
│  │  Amber banner if action needed       │  │  [View full schedule →]     │ │
│  └──────────────────────────────────────┘  └─────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  OPEN PICKUPS · 2 available                                          │  │
│  │  [Compact pickup opportunity rows with Claim button]                 │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Remove** "History" card until the route is implemented. Don't link to dead pages.

#### Mobile guidance

- Single column, same order.
- StaffAttentionCard should be a highlighted action banner at the very top of the mobile view.

---

### 4.11 Shift Board `/shift-board`

**Purpose:** Manage shift swaps and pickups — therapists express interest in open shifts; leads/managers approve.

**Primary user:** Therapist (viewing and claiming open pickups), Lead/Manager (approving swap requests).

**Primary action:** Claim an open shift (therapist) or approve/deny a swap (lead/manager).

#### Current issues

- Shift Board is nested under `People > Requests` in the manager nav, but operationally it belongs closer to Coverage (it is a live coverage management tool).
- The `ShiftBoardClientPage` is loaded as a server snapshot; real-time updates would benefit this surface but are not present.
- No clear empty state for "no open swaps" — the page likely shows an empty table.

#### Recommended layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Shift Board                         [Day | Night]  [Open | My requests]   │
│  Active swaps and pickups                                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  [Shift: May 6 · Day · 3 interested]                               │   │
│  │  Who's interested: [Name 1] · [Name 2] · [Name 3]                  │   │
│  │  [Approve: select one] [Deny all]                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  [Empty state: "No open shifts right now — check back later"]              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Navigation fix:** Move Shift Board to a direct link in the manager nav under "People," not buried under a hub page.

#### Desktop guidance

- Card list; each card shows the shift, interested therapists, and approve/deny controls inline.

#### Mobile guidance

- Same card list; approve/deny as a bottom sheet action.

---

### 4.12 User Access Requests `/requests/user-access`

**Purpose:** Manager reviews and approves/denies pending staff account requests.

**Primary user:** Manager, reviewed when they receive a notification.

**Primary action:** Approve or deny each pending request.

#### Current issues

- This is a simple list with approve/deny actions — the pattern is correct.
- Currently nested under a hub page (`/requests`) that serves no purpose other than routing. The hub page should be eliminated.
- No indication of what information the approved user will receive (e.g., does approving send an email?).

#### Recommended layout

- Link directly from nav: `People > Requests` goes straight to `/requests/user-access` (not the hub).
- Show a count badge on the nav item when pending requests > 0 (currently partially done).
- Each row: name, email, requested date, "Approve" (primary, teal) and "Deny" (destructive, outlined) inline.
- Success state: rows disappear after action with a brief success toast.

---

### 4.13 Team Management `/team`

**Purpose:** Manager manages the full team roster: view directory, set roles/shifts/employment, manage employee pre-match roster for signup.

**Primary user:** Manager.

**Primary action:** Find a team member and update their settings.

#### Current issues

- Two tabs: Directory (main) and Employee Roster (signup pre-match admin). These serve very different audiences and purposes — only a manager setting up the system touches the Employee Roster tab.
- Quick-edit modal opens in-place on row click — this is correct. But the modal's form fields for work patterns (DOW checkboxes, hard/soft mode, weekend rotation) are dense without explanatory labels.
- Team directory filter chips (Total, role/shift slices, FMLA) are toggle-filters — this is a good pattern that should be documented in the component spec.

#### Recommended layout

- Keep the tabs but move Employee Roster under Settings or as a secondary panel, reducing its visibility. Most team management is in the Directory tab.
- In the quick-edit modal: add section dividers between "Account" (name, role, shift, employment), "Status" (FMLA, active/inactive), and "Work pattern" (DOW, mode, weekend). These three areas have different edit frequency.
- The CSV import wizard (`/team/import`) should be accessible from a button on the Team page, not a separate nav item.

#### Desktop guidance

- Full-width directory table with filter row at top.
- Quick-edit as a centered dialog (current pattern is correct).

#### Mobile guidance

- Card list instead of table; each card shows name, role badge, shift badge.
- Tap card → full-screen edit sheet.

---

### 4.14 Publish History `/publish`

**Purpose:** View the publish history for schedule cycles; manage published/archived cycles; retry failed email deliveries.

**Primary user:** Manager.

**Primary action:** Archive old cycles; retry failed emails.

#### Current issues

- Two tables on the page (Schedule blocks + Publish email log) are conceptually correct but visually heavy when shown simultaneously.
- "Unpublish" / "Restart" / "Archive" actions on cycle rows are destructive — they need confirmation dialogs. Some may already have them; enforce consistently.
- The publish email log table is a support/debugging tool, not a daily-use surface. It should be collapsed by default or moved to a "Details" sub-view.

#### Recommended layout

- Lead with Schedule Blocks table (cycles, their status, archive/delete actions).
- Email log: collapsed by default, expandable per cycle (not a separate full table).
- All destructive actions (archive, delete, unpublish) require a confirmation dialog.

---

### 4.15 Analytics `/analytics`

**Purpose:** Manager reviews cycle health metrics: fill rates, therapist submission compliance, forced-date miss reporting.

**Primary user:** Manager, periodically (not daily).

**Primary action:** Read. Identify coverage gaps or compliance issues.

#### Current issues

- Analytics is the 5th sub-item under "Schedule" in the nav, making it hard to discover.
- Three data tables (CycleFillRateChart, SubmissionComplianceTable, ForcedDateMissTable) are displayed without clear hierarchy or a summary that interprets the data.

#### Recommended layout

- Move to a top-level primary nav item or a more prominent position in the Schedule sub-nav.
- Add a summary row at the top: "Current cycle: 87% filled · 14 of 18 therapists submitted · 2 forced misses."
- Each chart/table: give it a descriptive title and a 1-sentence interpretation below the title.

---

### 4.16 Profile & Settings `/profile`

**Purpose:** User manages their account preferences and appearance.

**Primary user:** Any authenticated user.

**Primary action:** Update preferences (calendar default view, schedule layout, dark mode).

#### Current issues

- Managers and therapists see different sections (therapists see Preferred Work Days; managers don't). This distinction is correct but should be clearly labeled.
- "Appearance" section with Light / System / Dark controls works. No issues.
- No "Change password" option is visible. This is a gap.

#### Recommended layout

- Sections: Account details (read-only badges) · Schedule preferences · Appearance · Preferred work days (therapists only).
- Add Change password link (triggers Supabase password reset email) in the Account section.

---

## 5. Screen-Specific Mockup Instructions for Claude Design / Stitch

Each prompt below is formatted for pasting directly into a design generation tool.

---

### 5.1 Manager Dashboard

**Prompt:**

Design a dashboard page for a healthcare operations scheduling SaaS called Teamwise, used by hospital department managers who manage respiratory therapy shift schedules. The dashboard should feel like a command center: dense enough to be efficient, but calm enough to reduce anxiety.

**Style:** Industrial/utilitarian with calm warmth. White page background. Off-white card surfaces (`hsl(38 14% 99%)`). Teal primary (`#276e66`) for actions. Amber (`#f0a030`) for attention/urgency. Slate text (`hsl(220 25% 12%)`). Typography: Plus Jakarta Sans. No decorative gradients. No glassmorphism.

**Layout:** Two-column layout at desktop (1280px+). Left column (2/3 width): action queue + today's shifts. Right column (1/3 width): schedule progress card.

**Action queue section (top of left column):**

- Section label: "Needs attention" in amber text, small caps
- List of 2-4 items, each with: a colored icon (red for error, amber for warning), a short description, a right-arrow chevron link
- Example items: "2 access requests waiting", "Draft for Apr 28–Jun 8 is incomplete", "1 intake item needs review"
- Card background: slightly amber-tinted (`hsl(38 14% 99%)`), 1px border

**Today's shifts section (below action queue on left):**

- Section label: "Today · Day shift" with a Day/Night toggle
- Compact list of 4-6 staff rows: first name, role badge (Lead / RN / PRN), assignment status chip
- If fewer than 3 scheduled: show a red "Under-staffed" indicator

**Schedule progress card (right column):**

- Current cycle label + date range
- Progress bar: Day shift filled (X/5) and Night shift filled (X/5)
- Color: green when ≥3, amber when 2, red when <2
- CTA button: "Open Coverage" (teal primary)

**What NOT to do:** Do not use a big number + small label hero-metric template. Do not use gradient text. Do not use identical card grids with icon + heading + paragraph copy. Do not use purple anywhere.

---

### 5.2 Coverage Workspace

**Prompt:**

Design the Coverage Workspace page for Teamwise — a respiratory therapy scheduling app. This is the most-used page in the app. Managers use it daily to build and edit 6-week shift schedules.

**Style:** Same as dashboard — Plus Jakarta Sans, white background, teal + amber tokens. This page is dense; use compact density (8–12px padding in cells, text-xs to text-sm).

**Header bar (below main nav):**

- Left: Cycle selector pill showing "Apr 28 – Jun 8 · DRAFT" with a down chevron
- Center: "Day shift | Night shift" toggle (currently Day selected)
- Right: "Grid | Roster" view toggle
- Below the pill: cycle status badge ("DRAFT" in amber, "PUBLISHED" in green, "PRELIMINARY" in blue)

**Primary action banner (below header, above calendar):**

- Shown when cycle is incomplete draft
- Background: very light amber tint
- Copy: "12 of 42 days have ≥3 staff · 6 days unfilled"
- Primary button: "Run auto-draft ✦" (teal)
- Secondary button: "Assign manually" (ghost)

**42-day calendar grid (main content):**

- 7 columns (Sun–Sat), 6 rows of weeks
- Compact day cells: date (top-left), staffing ratio chip (top-right, green/amber/red), Lead indicator (middle), shift count or "Unfilled" badge (bottom)
- Click a day cell → opens centered dialog
- Constraint-blocked days: amber warning ring on the cell
- Under-staffed days (<3 staff): red ring on the cell

**Shift editor dialog (triggered by clicking a day):**

- Centered modal, 560px wide
- Header: date, Day/Night badge, staffing ratio (e.g., "4 / 5 covered")
- Lead section: "Lead: [Name]" or "Lead: Unassigned" (amber)
- Therapist list: compact rows, each with name, employment type badge (PRN, PT), assign/unassign toggle
- Footer: Save / Close buttons

**What NOT to do:** Do not show all controls (draft, send, print, template, manage cycle) at the same visual level. Do not put the Day/Night toggle inside a dropdown. Do not use a sidebar for this page.

---

### 5.3 Therapist Schedule View (read-only)

**Prompt:**

Design a read-only schedule roster page for Teamwise, used by managers and leads to see who is working on which days in the current 6-week cycle. No editing is possible here.

**Style:** Same token system. This is a reading surface — use comfortable density (16px cell padding), clear name column, and a muted header banner indicating read-only state.

**Page header:**

- Title: "Roster"
- Muted info banner: "Read-only view. To edit shifts, open Coverage →" (link to /coverage)
- Day/Night tab toggle
- Cycle selector (same pill pattern as Coverage)

**Roster table:**

- Sticky left column: therapist full name + role badge
- Sticky header row: dates (compact, Mon 5, Tue 6, etc.)
- Cell states: empty (light gray), scheduled (teal chip with initials), off (no content), lead-designated (teal chip with a small star)
- Every 7 columns: a subtle vertical line separating weeks

**Mobile:**

- Show one week at a time (7 columns visible)
- Left/right arrows to navigate weeks

---

### 5.4 Therapist Availability Submission

**Prompt:**

Design the availability submission page for a respiratory therapist using Teamwise. The therapist marks which dates in the upcoming 6-week cycle they need off or want to work, then submits to their manager.

**Style:** Same tokens. Comfortable density for the form; compact density for the calendar chips.

**Page header:**

- Title: "Your Availability"
- Cycle label: "Apr 28 – Jun 8 · Due May 10"
- Recurring pattern summary: "Your schedule: Tue–Sat, Day shift" (muted text, non-editable here)
- Submission status badge: "Not submitted" (amber) or "Submitted [date]" (green)

**Calendar chip grid (main content):**

- 6 rows × 7 days — compact grid
- Each day cell: date label + status chip below
- Chip states: "Available" (muted gray), "Need Off" (red), "Request to Work" (green)
- Clicking chip cycles: Available → Need Off → Request to Work → Available
- Days outside the therapist's recurring pattern: slightly grayed cell background, chip still interactive
- Conflict warning: if the date already has a scheduled shift and the chip is "Need Off" — show a small amber ⚠ inline next to the chip

**Sticky footer:**

- Left: "Save progress" (ghost/secondary button)
- Right: "Submit availability" (teal primary button)
- Between: "Last saved: May 3 at 2:14 PM" (muted text)

**What NOT to do:** Do not make Save and Submit look the same weight. Do not use a modal for the conflict warning. Do not hide the submission status badge.

---

### 5.5 Manager Availability Review

**Prompt:**

Design the manager availability planner for Teamwise — a split-view page where managers see submitted therapist availability and can set override dates (force_on, force_off) for the upcoming cycle.

**Layout:** Two-column split at desktop. Left column (300px): therapist list + filter controls. Right column: 6-week availability calendar for the selected therapist or full-team view.

**Left column:**

- Cycle selector (same pill pattern)
- Therapist list: compact rows with name, submission status chip (Submitted / Not submitted / Overdue), last-activity date
- Clicking a therapist row highlights their availability in the right column

**Right column (calendar):**

- 6-week grid matching the availability chip grid (same design as therapist submission page)
- But in manager view: shows the therapist's submitted overrides + manager overrides in distinct visual layers:
  - Therapist submission: semi-transparent chip
  - Manager override: solid chip with a small "M" badge
- Manager can click any chip to toggle override: Available → Force Off → Force On → Available

**Intake link:**

- Muted link near the top: "Review email intake →" that navigates to /availability/intake

**What NOT to do:** Do not combine the Planner and Intake into nested tabs on the same page. Do not use modals for override toggles — inline chip interaction only.

---

### 5.6 Shift Board

**Prompt:**

Design the Shift Board page for Teamwise — where therapists see and claim open pickup shifts, and managers/leads approve swap requests.

**Style:** Same tokens. Comfortable density for the card list.

**Page header:**

- Title: "Shift Board"
- Tabs: "Open pickups | My requests"
- Day/Night toggle

**Open pickups tab (therapist view):**

- Card list; each card:
  - Date + shift type (e.g., "Tuesday, May 6 · Day shift")
  - Location or department note
  - "Claim pickup" button (teal)
  - If already claimed: "Claimed · Pending approval" chip
- Empty state: "No open shifts right now. Check back when the next cycle is published."

**Manager approval view (same page, different role):**

- Each card shows the shift + who expressed interest
- Compact name chips for each interested therapist
- "Approve [name]" select and "Deny all" inline

---

### 5.7 Team Roster Management

**Prompt:**

Design the Team management page for Teamwise — manager views and edits the full staff roster.

**Layout:** Full-width table with a filter/search bar at top.

**Filter bar:**

- Search input (by name or email)
- Filter chips: All · Managers · Day Leads · Night Leads · Day Therapists · Night Therapists · Inactive · On FMLA
- Active filters: show a small badge count on active chips

**Directory table:**

- Columns: Name, Role, Shift, Employment type, Status (Active / FMLA / Inactive)
- Click a row → opens quick-edit dialog (centered modal)
- Rows grouped by role (managers first, then day/night leads, then therapists, then inactive)
- Group headers: muted section dividers with group name and count

**Quick-edit dialog:**

- Sections with dividers: Account (name, role, shift, employment type) · Status (FMLA, active/inactive) · Work pattern (DOW checkboxes, hard/soft mode)
- Save / Cancel in footer

---

### 5.8 Requests / Access Management

**Prompt:**

Design the User Access Requests page for Teamwise — manager approves or denies pending staff account requests.

**Layout:** Single-column list, comfortable density.

**Page header:**

- Title: "Access Requests"
- Count badge: "3 pending"

**Request list:**

- Each row: name, email, requested date (relative: "3 days ago"), shift type if provided
- Inline actions: "Approve" (teal, outlined) and "Deny" (red/destructive, outlined)
- After approval: row gets a green "Approved" chip and fades/removes with animation
- Empty state: "No pending requests. New staff accounts appear here when someone signs up."

---

## 6. Component System Recommendations

### Shell components

| Component                  | Purpose                                                                              | Files                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `AppShell`                 | Authenticated layout wrapper; provides top bar, sub-nav, and page content slot       | `src/components/AppShell.tsx`                                                                |
| `AppHeader`                | Top bar: logo, primary nav, bell, avatar                                             | `src/components/shell/AppHeader.tsx`                                                         |
| `LocalSectionNav`          | Second-level nav bar (sub-items for active primary section)                          | `src/components/shell/`                                                                      |
| `CycleContextBar`          | Sticky sub-header on schedule pages: cycle selector + state badge + Day/Night toggle | Extract from `CoverageClientPage.tsx` → new `src/components/coverage/CoverageContextBar.tsx` |
| `DeferredNotificationBell` | Bell with unread badge; defers dropdown fetch                                        | `src/components/NotificationBell.tsx`                                                        |

### Page-level components

| Component                | Purpose                                                 | Files                                                                                 |
| ------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `PageHeader`             | Canonical page h1 + helper text + primary action slot   | `src/components/ui/page-header.tsx` (compatibility wrapper; use `PageIntro` directly) |
| `ManagerWorkspaceHeader` | Manager-style route header with breadcrumb and actions  | `src/components/manager/ManagerWorkspaceHeader.tsx`                                   |
| `ActionQueueItem`        | Ranked action row in the Dashboard action queue         | New: `src/components/dashboard/ActionQueueItem.tsx`                                   |
| `CoverageActionBar`      | State-driven primary action banner on the Coverage page | Extract from `CoverageClientPage.tsx`                                                 |

### Data display components

| Component                           | Purpose                                                                    | Files                                                                   |
| ----------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `CycleStatusBadge`                  | Renders Draft / Preliminary / Published in the correct semantic color      | New: `src/components/coverage/CycleStatusBadge.tsx`                     |
| `StaffingRatioChip`                 | Coverage count chip: `X / 5` in green/amber/red                            | Inline in `CalendarGrid.tsx`; extract for reuse                         |
| `AvailabilityStatusChip`            | Cycles Force Off / Available / Force On; correct DESIGN.md semantic colors | `src/components/availability/`                                          |
| `AssignmentStatusBadge`             | Scheduled / Call-in / On-call / Cancelled / Left early                     | `src/components/ui/status-badge.tsx`                                    |
| `SkeletonCard` / `SkeletonListItem` | Loading states                                                             | `src/components/ui/skeleton.tsx`                                        |
| `EmptyState`                        | Zero-state display with icon + message + optional CTA                      | Inline in multiple pages; extract to `src/components/ui/EmptyState.tsx` |
| `WarningBanner`                     | Dismissible inline warning (amber, not modal)                              | `src/components/ui/alert.tsx` extensions                                |

### Schedule-specific components

| Component                   | Purpose                                      | Files                                                         |
| --------------------------- | -------------------------------------------- | ------------------------------------------------------------- |
| `CalendarGrid`              | 42-day coverage calendar, compact density    | `src/components/coverage/CalendarGrid.tsx`                    |
| `RosterScheduleView`        | 6-week × staff roster matrix                 | `src/components/coverage/RosterScheduleView.tsx`              |
| `ShiftEditorDialog`         | Day-click → edit dialog for assigning staff  | `src/components/coverage/ShiftEditorDialog.tsx`               |
| `WeekNavigator`             | Mobile-only week strip with prev/next arrows | New: `src/components/coverage/WeekNavigator.tsx`              |
| `DayCellCompact`            | Individual day cell in the coverage calendar | Inline in `CalendarGrid.tsx`; potential extract               |
| `AvailabilityCalendarPanel` | Therapist availability chip grid             | `src/components/availability/availability-calendar-panel.tsx` |

### Form components

| Component                 | Purpose                                     | Files                                                                                                   |
| ------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `AuthBrandPanel`          | Left dark-teal brand column on login/signup | Inline in `login/page.tsx` and `signup/page.tsx`; extract to `src/components/public/AuthBrandPanel.tsx` |
| `OnboardingStepIndicator` | Step 1/2/3 indicator for onboarding flow    | New: `src/components/onboarding/StepIndicator.tsx`                                                      |
| `FeedbackToast`           | Success/error toast                         | `src/components/feedback-toast.tsx`                                                                     |

---

## 7. Status and Color System

### Semantic color roles

| Color                     | Token family                                                             | When to use                                                                                                | When NOT to use                                                   |
| ------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **Green**                 | `--success-*`                                                            | Published cycle, submitted availability, approved request, ≥3 staff covered                                | Marketing CTAs, logo accent, decorative                           |
| **Amber**                 | `--warning-*`                                                            | Draft cycle state, upcoming deadline, "needs attention" action items, 1–2 staff covered, preliminary state | Brand accent (use `--attention` for that), form labels            |
| **Red**                   | `--error-*`                                                              | Blocker (0 staff covered, validation failure, failed OCR, denied request, Need Off chip)                   | Warning (amber is correct for warnings)                           |
| **Blue**                  | `--info-*`                                                               | Neutral system notice, informational callouts, Preliminary sent state                                      | Success (use green), errors (use red)                             |
| **Teal (`--primary`)**    | Primary buttons, nav active pill, focus rings, primary CTA               | Brand color in the 174° hue family                                                                         | Status meaning (teal communicates "primary action," not a status) |
| **Amber (`--attention`)** | Logo mark, user avatar, decorative brand accent                          | Status colors (use `--warning-*` for status)                                                               |
| **Gray (`--muted*`)**     | Inactive/empty cells, "Available" default chip, non-actionable meta text | Status that has meaning — gray must mean "not applicable" or "neutral/no data"                             |

### Color-only prohibition

Never communicate critical status through color alone. Every status chip must include a text label in addition to color. This applies especially to:

- Availability chips (Need Off, Request to Work, Available must always show text, not just color)
- Assignment status badges
- Coverage health indicators (show the number, not just the color)

### Specific anti-patterns in the current codebase

| Pattern                                                    | Problem                                                           | Fix                                                  |
| ---------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------- |
| Inline `text-[var(--error-text)]` on icon-only elements    | Color-only status communication                                   | Add `aria-label` and visible text label              |
| Side-stripe `border-left` on feature cards (homepage 3-up) | Decorative border, the banned pattern                             | Replace with icon + heading treatment or full border |
| `dark:text-white` in JSX                                   | Hard-coded dark mode override — `--foreground` should handle this | Remove; let the token system work                    |

---

## 8. Dense Schedule UX Rules

These rules apply to every surface that renders schedule data (CalendarGrid, RosterScheduleView, AvailabilityCalendarPanel, therapist availability grid).

### Calendar layout rules

1. **6-week cycles always start on Sunday.** The grid must always have 7 columns labeled Sun–Sat, with partial first/last weeks showing grayed cells before/after the cycle boundary.
2. **Desktop (xl+) shows the full 42-day grid.** No horizontal scrolling on desktop — the grid must fit in the viewport width within the 7xl content container.
3. **Mobile defaults to week-by-week view.** A `WeekNavigator` component shows one 7-day strip at a time with prev/next arrows. The 42-day grid should never be shown on screens < 768px.
4. **Day/Night context is visible before the grid renders.** The toggle is in the page sub-header, not discoverable only inside the calendar area.

### Name display rules

5. **First names must always be visible at the current density level.** If a cell is too narrow to show "Maria T." then the cell is too small. Either increase the cell or switch to initials with a tooltip.
6. **Initials are acceptable in ultra-dense cells but require a tooltip on hover and `aria-label` with the full name.**
7. **Lead indicator must be distinguishable without color alone.** Use a small text label ("Lead") or a distinct badge, not just a teal border ring. The ring is helpful but not sufficient on its own.

### Status communication rules

8. **Every schedule cell state must be identifiable without color.** Use text labels (chip text, initials, "Unfilled" label) as the primary communication. Color is reinforcement.
9. **Never use hover-only to reveal critical schedule information.** Fill counts, lead assignments, and constraint warnings must be visible in the resting state. Hover can add detail but not primary information.
10. **Constraint-blocked slots ("No eligible candidates") must show a text chip** — `shadow-tw-ring-error-soft` ring alone is not enough. Show a "Constrained" label on the day cell.

### Interaction rules

11. **Clicking a day cell opens the edit dialog.** Never route a calendar click through a mutation directly (this causes lag while the assignment waits). Open the dialog first; mutations happen after user confirmation inside the dialog.
12. **Empty roster cells must open the editor, not the quick-assign mutation path.** (Already documented in CLAUDE.md but worth repeating here as a hard rule.)
13. **Sticky column headers.** Date headers in the roster matrix (`RosterScheduleView`) must remain sticky when the user scrolls down through a long therapist list. Sticky left column (therapist name) is equally important on wide grids.

### Legend requirements

14. **Every schedule surface must include a visible legend** on first use (or accessible via a "?" help button) explaining what each chip color/state means. The legend should be collapsible, not always expanded.

### Data ranges

| Surface                           | Typical rows       | Typical columns | Target density |
| --------------------------------- | ------------------ | --------------- | -------------- |
| Coverage calendar grid            | 6 weeks (42 cells) | 7 days          | Compact        |
| Coverage roster matrix            | 15–25 staff rows   | 42 days         | Ultra-dense    |
| Availability calendar (therapist) | 42 cells           | 7 days          | Compact        |
| Availability planner (manager)    | 15–25 staff rows   | 42 days         | Ultra-dense    |
| Schedule page roster              | 15–25 staff rows   | 42 days         | Ultra-dense    |

---

## 9. Implementation Plan for Coding Agent

**Important:** These phases are ordered by risk. Do Phase 1 before anything else — a broken shell breaks every page. Verify with `npm run lint && npx tsc --noEmit && npm run test:unit` after each phase.

### Phase 1 — Navigation and App Shell (2–3 days)

**Files:** `src/components/shell/app-shell-config.ts`, `src/components/AppShell.tsx`, `src/components/shell/AppHeader.tsx`

Tasks:

- Rename "Today" section label → "Dashboard" in `buildManagerSections()`
- Add Analytics as a more prominent nav item (either top-level or first sub-item of Schedule)
- Remove `/requests` hub from nav; point "Requests" sub-item directly to `/requests/user-access`
- Add Shift Board as a direct sub-item under People (alongside Team and Requests)
- Rename "Schedule workspace" sub-item → "Coverage"
- Rename "Roster view" sub-item → "Roster"
- Update `src/app/shell/app-shell-config.test.ts` to match new labels

---

### Phase 2 — Manager Dashboard Redesign (2–3 days)

**Files:** `src/components/manager/ManagerTriageDashboard.tsx`, `src/app/(app)/dashboard/manager/page.tsx`

Tasks:

- Replace metric card grid with ranked action queue list (new `ActionQueueItem` component)
- Move `nextAction` banner logic to the top of the component, above all other content
- Rename h1 from "Inbox" to "Dashboard"
- Add today's date display to the page header
- Remove "Recent Activity" section from primary view (collapse or move to end)
- Refactor `ManagerTriageDashboard` props to accept an `actionItems: ActionQueueItem[]` array (pre-sorted by priority)
- Update `src/app/(app)/dashboard/manager/page.tsx` to compute the action item list server-side

---

### Phase 3 — Coverage Page Hierarchy (3–4 days)

**Files:** `src/app/(app)/coverage/CoverageClientPage.tsx`, new `src/components/coverage/CoverageContextBar.tsx`, new `src/components/coverage/CoverageActionBar.tsx`, new `src/components/coverage/CycleStatusBadge.tsx`

Tasks:

- Extract cycle selector + Day/Night toggle + cycle status badge into `CoverageContextBar` (sticky sub-header)
- Extract state-driven action banner (the "run auto-draft" / "send preliminary" / "publish" decision tree) into `CoverageActionBar`
- Implement the state machine table from Section 4.6 — determine `primaryCta` and `secondaryCta` based on cycle state
- Move Print, More actions, template management into a `...` overflow `MoreActionsMenu`
- Test: cycle state transitions must show correct CTAs without regression in the existing dialog/mutation logic
- Run targeted coverage lane: `npm run test:unit -- "src/app/(app)/coverage/page.test.ts" src/components/coverage/CalendarGrid.test.ts src/components/coverage/RosterScheduleView.test.ts`

---

### Phase 4 — Availability Workflow Cleanup (2–3 days)

**Files:** `src/app/(app)/availability/page.tsx`, new `src/app/(app)/availability/intake/page.tsx`

Tasks:

- Move the Intake tab into a dedicated route `/availability/intake`
- Update nav links to point directly to the new route
- Rename "Future Availability" in staff nav to "Availability"
- On `/therapist/availability`: visually separate Save (ghost button) from Submit (primary teal button) with a comment explaining their different semantics
- Add a sticky footer bar for the Save/Submit buttons on scroll

---

### Phase 5 — Mobile Layout Pass (3–4 days)

**Files:** `src/components/AppShell.tsx`, new `src/components/shell/MobileTabBar.tsx`, `src/components/coverage/CalendarGrid.tsx`, new `src/components/coverage/WeekNavigator.tsx`

Tasks:

- Add a bottom tab bar for staff users on mobile (4 items: Dashboard, My Shifts, Availability, Swaps)
- Detect mobile breakpoint and switch CalendarGrid to week-by-week `WeekNavigator` mode
- `WeekNavigator`: renders 7 cells for the current week, with prev/next arrow buttons and a "Week of [date]" label
- Add `@media (max-width: 767px)` CSS to hide the 42-day grid and show the week strip
- Ensure touch target sizes are ≥44px for all availability chips

---

### Phase 6 — Homepage and Auth Polish (1 day)

**Files:** `src/app/page.tsx`, `src/app/(public)/login/page.tsx`, `src/app/(public)/signup/page.tsx`

Tasks:

- Fix homepage feature strip: remove `border-l` side-stripe cards; replace with icon-led cards or frameless text blocks
- Extract `AuthBrandPanel` into `src/components/public/AuthBrandPanel.tsx` (shared between login and signup)
- Add "Forgot password?" text link below the password field on login
- Add explicit "(Optional)" label to the phone field on signup
- Add "What happens next?" microcopy below the signup form

---

### Phase 7 — Component Extraction and Documentation (2 days)

**Files:** Various

Tasks:

- Extract `EmptyState` to `src/components/ui/EmptyState.tsx` (used in multiple places inline)
- Extract `AuthBrandPanel` (Phase 6)
- Extract `CycleStatusBadge` (Phase 3)
- Extract `ActionQueueItem` (Phase 2)
- Add a `ScheduleLegend` help button to `CalendarGrid` (collapsed, explains chip states)
- Verify all new components have `aria-label` attributes where color-only state exists

---

### Phase 8 — QA, Screenshots, and Regression Tests (2 days)

**Files:** `e2e/` tests, targeted Vitest lanes

Tasks:

- Run full test suite: `npm run test:unit` (must pass 729+ tests)
- Run targeted coverage lane (Section 4.6)
- Run targeted shell/header lane
- Run `npm run build` and `npx tsc --noEmit` for final type-check
- Capture Playwright screenshots on `/`, `/login`, `/coverage`, `/dashboard/manager`, `/therapist/availability`
- Document before/after for each major route change

---

## 10. Acceptance Criteria

These are verifiable by a coding agent after implementation. Each criterion must pass before the phase is considered complete.

### Navigation and shell

- [ ] The manager nav section for the dashboard is labeled "Dashboard" (not "Today")
- [ ] Clicking "Dashboard" in manager nav goes to `/dashboard/manager` and the h1 reads "Dashboard"
- [ ] The Coverage sub-nav item is labeled "Coverage" (not "Schedule workspace")
- [ ] Analytics is accessible from the nav in ≤2 clicks from any page
- [ ] The `/requests` hub page redirects immediately to `/requests/user-access` for managers
- [ ] Shift Board appears as a direct nav item under People

### Dashboard

- [ ] The manager dashboard action queue appears above all metric cards
- [ ] When there are pending access approvals, an action item linking to `/requests/user-access` is visible in the queue
- [ ] Page h1 is "Dashboard"
- [ ] Day/Night coverage is visible for today without navigating away

### Coverage

- [ ] The cycle status badge (Draft / Preliminary / Published) is visible at all times on `/coverage`
- [ ] The Day/Night toggle is visible in the sub-header without scrolling
- [ ] When a cycle has no shifts, the primary CTA is "Run auto-draft" or "Assign manually"
- [ ] Print, template management, and More actions are in an overflow menu, not in the primary toolbar
- [ ] Clicking a day cell opens the shift editor dialog (no direct mutation on click)

### Availability

- [ ] `/availability` shows only the Planner (no Intake tab)
- [ ] `/availability/intake` exists as a standalone page
- [ ] On `/therapist/availability`, the Submit button is visually distinct from the Save button (primary vs ghost)
- [ ] Staff nav label for availability route is "Availability" (not "Future Availability")

### Schedule surfaces

- [ ] The 42-day calendar grid does not appear on screens < 768px
- [ ] On mobile, a week-by-week view with prev/next navigation is shown instead
- [ ] Every availability status chip shows a text label (not just a color)
- [ ] Every coverage day cell shows a staffing count (not just a color ring)
- [ ] The roster matrix has sticky column headers and a sticky left name column

### Accessibility and correctness

- [ ] All status chips include an `aria-label` with the full status name
- [ ] No `dark:text-white` overrides exist in any modified file (use `--foreground` token)
- [ ] No `border-left` accent borders on cards (the banned side-stripe pattern)
- [ ] `npm run lint` passes on all modified files
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run test:unit` passes (729+ tests)
- [ ] `npm run build` succeeds

---

## 11. Screenshot Appendix

Screenshots were captured during a live audit session (2026-05-04) using the Chrome MCP tool against the local dev server (`http://localhost:3000`) with seeded demo data. All screenshots are stored in the Claude session artifact store and referenced by ID.

**Auth credentials used:**

- Manager: `julie.d@teamwise.test` / `Teamwise123!`
- Therapist: `layne@teamwise.test` / `Teamwise123!`

---

### Public routes

#### Homepage `/` — above fold

**Screenshot ID:** `ss_8026nixpn`

Dark teal hero (`var(--marketing-hero-bg)`, `#1b3836`) with amber eyebrow "SCHEDULING FOR RT TEAMS", Instrument Serif headline "Scheduling that keeps care moving.", amber "Sign in" CTA + outlined "Request access" secondary. Grid texture visible. `PublicHeader` uses the matching dark teal background.

**Observations:**

- Hero design matches the `Refined.html` spec — correct teal, correct font, correct amber stripe.
- No issues at this viewport.

---

#### Homepage `/` — feature strip

**Screenshot ID:** `ss_6936i8igh`

Three-column card grid below the hero with amber left-border stripe on each card.

**Observations:**

- **ANTI-PATTERN CONFIRMED:** `border-left` accent stripe on all three feature cards. This is the globally banned "side-stripe border" pattern. Fix: remove `border-l` and replace with icon + heading treatment.
- Card content reads correctly (scheduling, availability, handoffs).

---

#### Login `/login`

**Screenshot ID:** `ss_4325dsol3`

Split panel: dark teal left brand column (grid texture, amber stripe, Instrument Serif headline) + white right form ("Sign in", email, password, "Forgot password?", "Sign in" button, "Request access" link).

**Observations:**

- Split panel design matches the redesign spec — no structural issues.
- "Forgot password?" text link is present — Phase 6 task already done.
- The left panel copy repeats the homepage headline verbatim. Not a blocker but worth varying.

---

#### Signup `/signup`

**Screenshot ID:** `ss_4454uwhkq`

Same split-panel layout as login. Right form: "Request access" h1, First name, Last name, Phone number (optional), Email address, Password, "Submit request" button.

**Observations:**

- Phone number field is labeled "(optional)" — Phase 6 task already done.
- "What happens next?" microcopy is absent below the submit button — Phase 6 task remains.
- The page title is "Request access," not "Sign up" — correct for the approval-gated model.

---

### Manager routes

#### Manager Dashboard `/dashboard/manager` — above fold

**Screenshot ID:** `ss_4257qz863`

Page h1: **"Inbox"** (not "Dashboard"). Top metric card row: "Coverage Issues (0)" in error tone, "Pending Approvals (7)" in warning tone, "Upcoming Shifts (5)" in info tone. Amber "NEEDS ATTENTION NOW" banner below cards reads "7 requests need your review."

**Observations:**

- **H1 mismatch confirmed:** h1 reads "Inbox" while the nav label is "Today." Phase 1 and Phase 2 both address this — rename to "Dashboard."
- **Metric card SaaS template confirmed:** three identical icon + number + label + tone cards in a row. This is the banned "hero-metric template." Phase 2 replaces with ranked action queue.
- The amber NEEDS ATTENTION banner is a good pattern but should lead the page, not follow the metric cards.

---

#### Manager Dashboard `/dashboard/manager` — scrolled

**Screenshot ID:** `ss_3900bktkp`

Below the metric cards: Day shift progress bar (teal, 5 filled) and Night shift progress bar (teal, 6 filled) each labeled with a count. Below that: "Today's Staffed Shifts" section.

**Observations:**

- Day/Night progress bars are a useful pattern — keep, but move into a side card (right column) rather than the main content flow.
- The progress bar + count pattern is well-suited to a "Schedule Progress" card in the proposed two-column layout.

---

#### Coverage Workspace `/coverage` — header

**Screenshot ID:** `ss_5954tih1x`

Page h1: **"Team Schedule"**. Sub-nav shows 6 items: Schedule workspace (active), Roster view, Analytics, Availability, Publish, Approvals. Cycle badge: **"PUBLISHED"** in green. Top-right: Bell icon, "DM" avatar.

**Observations:**

- **Three names for Coverage confirmed:** nav label "Schedule workspace," page h1 "Team Schedule," URL `/coverage`. Phase 1 renames the nav label to "Coverage"; Phase 3 can standardize the h1.
- Six sub-nav items is a lot; Analytics and Approvals could be higher-level or consolidated.
- "PUBLISHED" badge is correctly in green — semantic color is right.

---

#### Coverage Workspace `/coverage` — calendar grid

**Screenshot ID:** `ss_7435yrqe6`

42-day compact calendar. Day cells show: date (top-left), staffing count chip (top-right, green "Fully staffed"), lead names ("Miller" visible), coverage row. Cells are dense but readable at this viewport width.

**Observations:**

- Calendar grid density is appropriate for desktop — the compact density spec is correctly implemented.
- Lead name shown as last name only ("Miller") — Phase 8 note: first name should be visible per dense UX rule #5.
- "Fully staffed" chips are green — correct semantic color.
- No "Run auto-draft" banner visible (cycle is already Published) — correct state-machine behavior.

---

#### Availability Manager `/availability`

**Screenshot ID:** `ss_9397o23bw`

Split-panel planner view with filter tabs (Planner active, Intake inactive). Left panel shows scheduling inputs; right panel shows the availability calendar. Cycle selector visible.

**Observations:**

- Planner-first layout is correct per current spec.
- Two tabs (Planner / Intake) on one page is the pattern Phase 4 will split: Intake moves to `/availability/intake`.
- The tab labels are legible; the active tab uses the teal underline pattern.

---

#### Schedule Roster `/schedule`

**Screenshot ID:** `ss_1674j6epz`

Page h1: **"Respiratory Therapy – Day Shift"**. Cycle badge: **"DRAFT"** in amber. Roster matrix with staff names as row headers and dates as columns. Most cells show **"1"** (single digit in a pill).

**Observations:**

- The "1" cells likely represent single assignments per slot — but at this density, a single digit conveys no status. Full name or at minimum initials + role badge would be more informative.
- "Respiratory Therapy – Day Shift" is a very long h1 for the primary heading. Consider shortening to "Roster" with Day/Night as a secondary toggle.
- DRAFT badge correctly in amber.
- The roster matrix sticky column behavior cannot be confirmed from a static screenshot — verify via scroll test.

---

#### Shift Board `/shift-board`

**Screenshot ID:** `ss_5497oyghw`

Page h1: **"Shift Swaps & Pickups"**. Four metric cards in a row: "Total Requests (4)", "Pending (3)", "Approved (1)", "Denied (0)". Located under **People > Requests** in the manager nav.

**Observations:**

- **Nav placement confirmed as wrong:** Shift Board lives under People > Requests, but it is a live coverage management tool that belongs closer to the Schedule section.
- **Second metric card template on this page:** four identical icon + number + label cards — same SaaS cliché as the manager dashboard. Both should be replaced with operational content (the actual shift swap rows).
- Page h1 "Shift Swaps & Pickups" matches the staff nav label — consistent, but Phase 1 addresses nav placement.

---

#### Team `/team`

**Screenshot ID:** `ss_48810bhqd`

Tab bar shows **"Directory"** and **"Employee roster"** tabs. The page loads with **"Employee roster"** as the active tab, showing the signup pre-match roster admin table.

**Observations:**

- **Default tab UX bug confirmed:** The page should default to "Directory" (the primary manager use case), not "Employee roster" (a setup/admin-only surface). This is a navigation UX regression.
- The Employee Roster table has columns: Full name, Role, Shift, Employment, Matched — correct for the pre-match use case.
- Fix: set `initialTab` to `'directory'` on server load, not `'roster'`.

---

#### Approvals `/approvals`

**Screenshot ID:** `ss_8938xy5qc`

Page h1: **"Preliminary approvals"**. Clean empty state: no pending approvals in the queue. Minimal page — just the header and the empty state.

**Observations:**

- "Preliminary approvals" as the h1 is specific to one approval type. The page may handle multiple approval types eventually — consider "Approvals" as the h1 with a sub-label.
- Empty state is clean and correct — no issues with the empty state design.
- The page is correctly under Schedule > Approvals in the nav (visible in the sub-nav active state).

---

#### Analytics `/analytics`

**Screenshot ID:** `ss_1086lkoyd`

"CYCLE FILL RATES" section header with subtitle "Using ideal coverage target of 4 therapists per shift." Two rows visible: "Teamwise UAT Draft 2026-06-08" (125% filled, red progress bar full-width) and "Teamwise UAT Published 2026-04-27" (125% filled).

**Observations:**

- **125% fill rate with red progress bar is confusing:** the bar goes past 100% and is colored red, which signals "error." But 125% means overstaffed, not understaffed — red is semantically wrong here. Over-target should be amber (warning/caution), and the bar should max at 100% with an overflow indicator.
- The section uses a plain CSS progress bar — no chart library required, but the color logic needs to handle >100% cases.
- Analytics is the 3rd sub-nav item under Schedule (after Coverage and Roster view) — low discoverability for a useful tool.

---

#### Publish History `/publish`

**Screenshot ID:** `ss_9903fs68r`

Page h1: **"Publish History"**. Status chips at top: "0 successful", "0 failed", "0 queued" in green/red/amber. An info banner: "Ready to publish a draft? Open the cycle in Schedule..." Schedule Blocks table with columns: Block, Dates, Status, Actions. One draft row: "Teamwise UAT Draft 2026-06-08" with "Open to publish" and "Archive" buttons.

**Observations:**

- The info banner correctly redirects users to `/coverage` to publish — this is the right pattern (Publish page is history/status only, not the publish trigger).
- "0 successful / 0 failed / 0 queued" status chips at the top are useful but their placement (mid-header area) makes them feel disconnected from the table below.
- The "Archive" and "Delete draft" actions in the table are destructive — confirm dialogs should be enforced (per Phase 7 checklist).
- No email log visible in this view — it may be below the fold or collapsed.

---

### Therapist routes

#### Staff Dashboard `/dashboard/staff`

**Screenshot ID:** `ss_2354e8vch`

Therapist: Aleyce L. Page h1: **"Welcome, Aleyce"**. Status badges: "Not started" (amber) and "No deadline set" (muted). Three-column card grid: NEXT STEP (left, 2/3 width) showing "Tell us when you can work" with the next cycle draft block; MY SCHEDULE (right, 1/3) showing 5 upcoming published shifts with dates and DAY/LEAD badges; SHIFT SWAPS & PICKUPS (right, below) showing "2 pending."

**Observations:**

- The personalized "Welcome, Aleyce" h1 is warmer than the manager dashboard — appropriate for staff.
- **NEXT STEP card is the correct primary action** — this pattern is already implemented correctly. The action is "Tell us when you can work" which links to the availability submission flow.
- MY SCHEDULE shows published shifts with role badges (DAY, LEAD) — useful signal for the therapist to know their assigned role.
- "2 pending" on the Shift Swaps card communicates actionable state without requiring navigation.
- **HISTORY card** is referenced in CLAUDE.md as "unimplemented" — it was not visible in this viewport, possibly below the fold. Confirm it exists and links to a real page before shipping.
- Three-card layout at this density is comfortable — not the banned metric-card template because the cards contain actionable content, not just numbers.

---

#### Future Availability `/therapist/availability`

**Screenshot ID:** `ss_1934ds56b`

Page h1: **"Future Availability"**. Cycle range: "Cycle: Jun 8 – Jul 19, 2026". SUBMISSION STATUS sidebar card (top-right): "Not submitted" (amber chip) + "Due Jun 7, 2026." Starting-point callout: "Works no weekdays." — with "Edit recurring pattern" button. QUICK EDIT section: Cycle selector pill, "Select a day or several days, then choose a state." radio group. Can work / Can't work / Clear toggle buttons. Calendar grid begins below (Week 1 visible).

**Observations:**

- **"Future Availability" is a long nav label** — Phase 4 renames to "Availability" in the staff nav.
- The "SUBMISSION STATUS" sidebar card with the amber "Not submitted" chip is the correct pattern for deadline awareness.
- "Works no weekdays" starting point is correctly communicated with the "Edit recurring pattern" escape hatch.
- QUICK EDIT section is clear: select days, then choose state. The "Can work / Can't work / Clear" toggle button group is intuitive.
- The calendar appears below the fold in this screenshot — confirm chip states (Available, Need Off, Request to Work) render correctly on scroll.
- **Submit vs Save button distinction** is not visible in this viewport — scroll down to confirm whether they are visually differentiated (Phase 4 task).

---

### UX issues confirmed by screenshots

| Issue                                              | Route                     | Screenshot   | Priority | Phase     |
| -------------------------------------------------- | ------------------------- | ------------ | -------- | --------- |
| h1 "Inbox" ≠ nav "Today"                           | `/dashboard/manager`      | ss_4257qz863 | P1       | Phase 1+2 |
| Metric card SaaS template on dashboard             | `/dashboard/manager`      | ss_4257qz863 | P1       | Phase 2   |
| Three names for Coverage                           | `/coverage`               | ss_5954tih1x | P2       | Phase 1+3 |
| Side-stripe `border-l` on homepage cards           | `/`                       | ss_6936i8igh | P2       | Phase 6   |
| Team defaults to wrong tab (Roster, not Directory) | `/team`                   | ss_48810bhqd | P2       | Phase 1   |
| Shift Board under People>Requests (wrong section)  | `/shift-board`            | ss_5497oyghw | P2       | Phase 1   |
| Metric card template on Shift Board                | `/shift-board`            | ss_5497oyghw | P3       | Phase 2   |
| Analytics 125% fill shown in red (wrong semantic)  | `/analytics`              | ss_1086lkoyd | P3       | Phase 7   |
| "Future Availability" nav label too long           | `/therapist/availability` | ss_1934ds56b | P3       | Phase 4   |
| "Preliminary approvals" h1 too specific            | `/approvals`              | ss_8938xy5qc | P4       | Phase 7   |
| Roster matrix cell shows only "1" (no name/role)   | `/schedule`               | ss_1674j6epz | P4       | Phase 3   |
| Lead shown as last name only                       | `/coverage`               | ss_7435yrqe6 | P4       | Phase 3   |

---

## Final Notes for Implementation Agents

### File location conventions

- Server components: `src/app/(app)/[route]/page.tsx`
- Client components: `src/app/(app)/[route]/[FeatureName]ClientPage.tsx`
- Shared components: `src/components/[domain]/[ComponentName].tsx`
- UI primitives: `src/components/ui/[name].tsx`
- Design tokens: `src/app/globals.css` only (no inline hex colors)

### Test before touching

Run the targeted lane for any component area before making changes:

```bash
# Coverage
npm run test:unit -- "src/app/(app)/coverage/page.test.ts" src/components/coverage/CalendarGrid.test.ts

# Shell/nav
npx vitest run src/components/shell/app-shell-config.test.ts src/components/AppShell.test.ts

# Theme regression (must always pass)
npm run test:unit -- src/lib/theme.test.ts src/app/globals.test.ts src/app/page.test.ts
```

### Color token rules (enforced)

- `--primary: hsl(174 48% 29%)` — do not change, regression-guarded
- `--marketing-hero-bg` — must not alias `var(--primary)`, regression-guarded
- No hardcoded hex colors in JSX
- No `dark:text-white` overrides

### The one rule that overrides everything else

When in doubt about a design decision: **make the next action obvious.** If a manager has to look for what to do, the page has failed.
