# Teamwise Scheduler - Codex Handoff Context

Updated: 2026-03-01 (PageHeader + staff roster + weekly breakdown + directory e2e filters)

## Latest Completed Work (2026-03-01, session 4)

### PageHeader shared component

- **`src/components/ui/page-header.tsx`** (new): shared surface card for page-level headers — props: `title`, `subtitle`, `badge?: ReactNode`, `actions?: ReactNode`, `className?`; uses `teamwise-surface`, `app-page-title`, `border-border` tokens; always-present sticky appearance without extra wrapper divs.
- **`src/app/dashboard/manager/page.tsx`**: replaced inline header block with `<PageHeader>` — `actions` slot carries the `<Calendar>` Lucide icon; `className="fade-up mb-7"` preserves existing stagger timing.
- **`src/app/dashboard/staff/page.tsx`**: replaced header div with `<PageHeader>` — `badge` slot holds Role + Team `<Badge>` chips.

### Staff dashboard — upcoming shift roster

- **`src/app/dashboard/staff/page.tsx`**: after the metrics banner, a new "Upcoming shifts" section shows the user's next 3 shifts with colleagues:
  - Fetches `shifts` for the same dates (excluding self) using 2 extra SSR queries (roster shifts + roster profile names); zero client-side JS
  - Each row: date label, shift type, **Lead** amber badge if user is lead that day
  - Colleague chips: amber `★ First` for lead colleagues; muted `First` for staff colleagues; sorted leads-first
  - Falls back to "No colleagues assigned yet." when the slot is otherwise empty

### Manager dashboard — weekly progress breakdown

- **`src/app/dashboard/manager/page.tsx`**: inside the existing Cycle Progress card, a new "Week by week" subsection shows a mini bar chart for fill rate per week:
  - `WeekRow = { label: string; scheduled: number; total: number }` type
  - Derived from existing coverage loop via `dateIndex` counter + `Map<number, bucket>` — **zero extra network requests**
  - Bar color: green (`var(--success)`) ≥80 %, amber (`var(--warning)`) ≥50 %, red (`var(--error)`) <50 %
  - Added to `DashboardData`, `DashboardDisplayData`, `INITIAL_DATA`, `setData` call

### Directory e2e — filter bar + drawer tabs (4 new tests)

- **`e2e/directory-date-override.spec.ts`** — grew from 3 tests to 7:
  - **Test 4**: search filter hides non-matching rows, restores on clear, keeps exact match visible
  - **Test 5**: PRN employment-type filter pill hides full-time employee; FT pill restores them
  - **Test 6**: Lead-only checkbox hides non-lead-eligible employees; unchecking restores them
  - **Test 7**: drawer tab navigation — Profile → Scheduling → Overrides → Profile; each tab shows correct panel, hides others via CSS `hidden`

- Quality: 195 unit tests pass; tsc, lint, format:check all green

---

## Latest Completed Work (2026-03-01, session 3 — Design System)

### Design token system + brand alignment

- **`src/app/globals.css`**: Added `--attention: #d97706` token (amber — attention signals only, not primary actions). Fixed global `tr:hover td` from amber `#fffbeb` → `var(--secondary)` blue tint.

- **`src/components/AppShell.tsx`**: Nav active pill and publish CTA button now use `--primary` (blue). Logo wordmark accent and user avatar keep amber via `NAV_AMBER` / `var(--attention)` as brand personality touches.

- **`src/app/dashboard/manager/page.tsx`** — full design pass:
  - `AmberButton` background → `var(--primary)`, font → `var(--font-sans)`
  - `GhostButton` border/bg/color → CSS vars
  - `WorkloadBar` day/night bar colors → `var(--primary)` / `var(--tw-deep-blue)` (was amber/indigo)
  - `FillRateBar` fill colors → `var(--success)` / `var(--warning)` / `var(--error)`
  - Attention bar border: conditional green (`var(--success-border)` + `var(--success)` left border) when all clear, amber when issues — driven by `hasAnyIssues` derived flag
  - Cycle badge SVG strokes → `var(--muted-foreground)` (was amber)
  - Deleted redundant **Quick Actions** section (~40 lines)
  - All `IssueRow` / `CheckRow` / `Stat` colors → CSS semantic vars
  - `CardHeader` icon container bg → `var(--muted)` / `var(--border)` (was amber `#fffbeb`)
  - All `#e5e7eb` / `#f1f5f9` borders → `var(--border)`; `#f8fafc` / `#f9fafb` tile backgrounds → `var(--muted)`
  - Page title: inline `fontSize:26 fontFamily:Plus Jakarta Sans` → `className="app-page-title"`
  - Section headers: inline `fontWeight:800` → `text-sm font-semibold text-foreground`
  - All `fontFamily: 'Plus Jakarta Sans'` / `'DM Sans'` removed; `fontWeight 800` → `700`
  - Emoji icons replaced with Lucide: `CardHeader` (ClipboardList / Rocket / SquareCheckBig), `SmallTile` (Calendar / Users), `CheckRow` (CheckCircle2 / XCircle), team stat tiles (Users / Sun / Moon / FileText)
  - `SmallTile` `icon` prop: `string` → `ReactNode`; `CardHeader` `icon` prop: `string` → `ReactNode`
  - All label text hardcodes (`#374151`, `#64748b`) → `var(--foreground)` / `var(--muted-foreground)`

- **`src/app/shift-board/page.tsx`**: `STATUS_META` hardcoded hex → CSS var token families (`--warning-*`, `--success-*`, `--error-*`, `--muted`)

- **`src/app/dashboard/staff/page.tsx`**: Role badge `variant="secondary"` (blue tint, was default)

- **`src/components/coverage/CalendarGrid.tsx`**:
  - Avatar bg: `#ef4444` → `var(--error)`, `#ea580c` → `bg-orange-600`, `#d97706` → `var(--attention)`
  - Day/Night tab active: `#d97706` bg → `bg-primary text-primary-foreground`
  - Tab inactive: `#e5e7eb` → `border-border bg-card text-muted-foreground`
  - Selected day card: `border-[#d97706]` → `border-primary`; shadow RGB → primary blue; `hover:border-amber-600` → `hover:border-primary`
  - Lead count badge: `#fee2e2/#dc2626` → `var(--error-subtle)/var(--error-text)`; `#ecfdf5/#047857` → `var(--success-subtle)/var(--success-text)`

- **`src/components/coverage/ShiftDrawer.tsx`**:
  - `SHIFT_STATUSES` mapping entirely → CSS vars: active → `text-foreground/border-border/bg-muted`; oncall → `warning-*`; leave_early → `info-*`; cancelled → `error-*`
  - Avatar bg: same treatment as CalendarGrid avatar
  - Inactive status button: `#e5e7eb/#9ca3af` → `border-border bg-card text-muted-foreground`

### Design system rules (enforced going forward)

- `--primary` (`#0667a9`) = all primary actions: buttons, nav pills, links, focus rings
- `--attention` (`#d97706`) = attention-only semantic: avatar accent, logo wordmark, amber chip for truly attention-needed states
- `--warning-*` / `--success-*` / `--error-*` / `--info-*` = all status badge families
- No hardcoded hex colors in UI — use CSS vars or Tailwind semantic classes
- No `fontFamily` string literals in JSX — use `font-sans` or `var(--font-sans)`
- `fontWeight 800` reserved for display-level only; section headers use `600`/`700`

## Latest Completed Work (2026-03-01, session 2)

- **Manager dashboard — workload distribution section** (`src/app/dashboard/manager/page.tsx`):
  - Added `full_name` to team profiles query (zero extra network requests)
  - Derives per-therapist shift count from already-loaded shifts data after coverage loop
  - New `WorkloadRow` type + `WorkloadBar` component: amber bars for day-shift, indigo for night-shift, sorted highest-to-lowest
  - Section animates in as part of the existing `fade-up` sequence (delays bumped +0.05s to accommodate)

- **Staff dashboard — live metrics** (`src/app/dashboard/staff/page.tsx`):
  - Converted from plain 3-nav-card hub to SSR page with real Supabase data
  - Fetches: active/next cycle, user's upcoming shifts, availability override count, pending shift post count
  - New metrics banner above nav cards: upcoming shifts count, next shift date, availability submitted status (green ✓ / amber warning)
  - Card descriptions now show live context (e.g. "5 upcoming shifts this cycle", "Submitted for Mar cycle")

- **Shift board — remove `window.alert()`** (`src/app/shift-board/page.tsx`):
  - Added `requestErrors: Record<string, string>` state
  - Replaced 3 `window.alert()` calls in `handleAction` with `setRequestErrors`
  - Specific messages for Lead coverage gap and Double booking errors
  - Error clears on retry + on board reload; renders inline below action buttons via `role="alert"` paragraph

- **Directory drawer — inline server-side error banners** (`src/app/directory/page.tsx` + `src/components/EmployeeDirectory.tsx`):
  - Changed `saveEmployeeDateOverrideAction` signature to `(prevState, formData)` for `useActionState` compatibility
  - Replaced all `redirect(error)` calls with `return { error: '<specific message>' }` on failures; keeps `redirect` on success
  - `EmployeeDirectory.tsx` uses `useActionState` to capture action state; inline red error banner inside Overrides tab form
  - Form keyed to `editEmployee.id + overrideCycleIdDraft` to auto-reset state between drawer opens

- Quality: 195 unit tests pass (20 files); tsc, lint, format:check all green

## Latest Completed Work (2026-03-01)

- Employee directory UX overhaul — `src/components/EmployeeDirectory.tsx` only, no behavior changes to data layer:
  - **Tabbed drawer** — Profile / Scheduling / Overrides tabs with sticky amber-underline tab bar
    - Profile + Scheduling panels use CSS `hidden` (not unmounted) so all FormData fields are always present on submit regardless of active tab
    - Overrides panel rendered outside the `saveEmployeeAction` form with its own `saveEmployeeDateOverrideAction` / `copyEmployeeShiftsAction` nested forms
    - Drawer tab resets to `'profile'` on close; "Enter availability" quick-action opens directly to `'overrides'` tab
  - **Sticky Save footer** — `sticky bottom-0` footer with Save + "Save + realign shifts" buttons always visible while scrolling long panels
  - **`EmployeeRowBadges` component** — Day/Night (amber/slate), FT/PT/PRN (blue/violet/orange), Lead, and Inactive chips rendered below each employee name in both desktop table rows and mobile cards
  - **Unified filter bar** — single compact row replacing the old dual TABS + checkbox row layout:
    - Shift toggle (All / Day / Night)
    - Status toggle (Active / All)
    - Employment type toggle (All / FT / PT / PRN) — added `employmentFilter` state + post-filter step in `filteredEmployees` useMemo
    - Lead and FMLA checkboxes inline in the same bar
  - **Override calendar pre-population** — calendar dates pre-loaded from existing `dateOverrides` whenever the drawer opens or cycle selector changes; no stale empty calendar
  - **`openEditForEmployee` updated** — added `dateOverrides` to deps; computes and sets `overrideDatesDraft` from existing overrides for the resolved cycle on open

- Quality: 195 unit tests pass (20 files); tsc, lint, format:check all green

## Latest Completed Work (2026-02-28, session 2)

- CI/tooling hardening:
  - `package.json` — `format` and `format:check` scripts now run `prettier . / prettier --check .` (whole repo, not a hardcoded path subset)
  - `.github/workflows/ci.yml` — added `npx tsc --noEmit` step between lint and build; TypeScript is now a CI gate
  - `eslint.config.mjs` — added `.claude/**` to global ESLint ignores so worktree build artifacts are never scanned

- Cycle workload counts in assign dropdown:
  - `src/app/coverage/page.tsx` — added `cycleTherapistCounts` useMemo (total shifts per therapist across full cycle, derived from already-loaded `dayDays`/`nightDays`, zero extra network requests)
  - `src/components/coverage/ShiftDrawer.tsx` — dropdown now shows `· N this wk, M this cyc` when both counts are available, `· M this cyc` when only cycle data exists; gives managers a complete scheduling load picture at a glance

- Extracted `buildDayItems` + `toUiStatus` from `page.tsx` into `selectors.ts`:
  - `src/lib/coverage/selectors.ts` — new exports: `buildDayItems`, `toUiStatus`, `BuildDayRowInput`
  - `mapByShiftType` closure in `page.tsx` replaced by `buildDayItems` call; callers pre-resolve names from DB profile join
  - `src/lib/coverage/selectors.test.ts` — 21 new tests covering `toUiStatus` (9 cases) and `buildDayItems` (12 cases): lead/staff sorting, constraint blocking, dayStatus derivation, assignment_status mapping; total unit tests: 171

- Removed final `window.alert` call:
  - `src/app/coverage/page.tsx` `handleUnassign` — removed redundant `window.alert` (error was already shown inline via `setError`; now consistent with assign/status error patterns)

- Inline assign error + 4 new e2e tests (session 1 recap):
  - `src/components/coverage/ShiftDrawer.tsx` — `assignError: string` prop renders inline `<p role="alert">` error banner
  - `src/app/coverage/page.tsx` — `window.alert` in `handleAssign` replaced with `setAssignError`; clears on role/user/tab/day/close
  - `e2e/coverage-overlay.spec.ts` — 4 new tests: assign therapist, duplicate-assign inline error (via `page.route` mock), lead-toggle filtering, status change label update; total: 10 tests

## Latest Completed Work (2026-02-28, session 1)

- Extracted shared calendar utilities — no behavior changes, net -87 lines:
  - `src/lib/calendar-utils.ts` extended with 4 new exports:
    - `dateFromKey`, `startOfWeek`, `endOfWeek`, `buildCalendarWeeks`
  - `src/lib/schedule-helpers.ts` — replaced 3 duplicate function bodies with re-exports from `calendar-utils`:
    - `dateKeyFromDate` → re-export of `toIsoDate`
    - `buildDateRange` → re-export of `dateRange`
    - `formatDate` → re-export of `formatDateLabel`
  - `src/components/manager-week-calendar.tsx` — removed 5 private calendar fns, imported from `calendar-utils`
  - `src/components/manager-month-calendar.tsx` — removed 6 private calendar fns, imported from `calendar-utils`
  - `src/lib/therapist-picker-metrics.ts` — removed private `keyFromDate`, uses `toIsoDate`
- Extracted shared domain primitive types:
  - new `src/lib/shift-types.ts` with 6 core types:
    `ShiftStatus`, `ShiftRole`, `AssignmentStatus`, `EmploymentType`, `WeekendRotation`, `WorksDowMode`
  - `src/app/schedule/types.ts` re-exports all 6 for backward compat (17 importers untouched)
  - `src/app/coverage/page.tsx` imports domain types from `@/lib/shift-types` directly

- Coverage assign panel: lead role toggle + weekly workload counts:
  - `src/lib/coverage/mutations.ts` — `assignCoverageShift` accepts optional `role?: 'lead' | 'staff'` (default `'staff'`)
  - `src/app/coverage/page.tsx`:
    - `TherapistOption` now includes `isLeadEligible: boolean` (fetched via `is_lead_eligible`)
    - `assignRole` state (`'staff'` default), resets on day change / tab switch / close
    - `weeklyTherapistCounts` useMemo — derives per-therapist shift count for the selected day's week from already-loaded `dayDays`/`nightDays` (zero extra network requests)
    - `handleAssign` passes `role: assignRole`; optimistic update routes to `leadShift` vs `staffShifts` based on role
  - `src/components/coverage/ShiftDrawer.tsx`:
    - Staff / Lead pill toggle above the dropdown
    - Lead disabled (with tooltip) when slot already has a lead or no lead-eligible therapists exist
    - Dropdown filters to lead-eligible therapists when Lead is active
    - Each option shows `· N this wk` for therapists with ≥1 shift scheduled that week

## Latest Completed Work (2026-02-27, follow-up)

- Centralized RBAC model and permission checks:
  - added shared auth helpers:
    - `src/lib/auth/roles.ts`
    - `src/lib/auth/can.ts`
  - replaced scattered role string checks in UI gating with `can(...)`
  - enforced matching checks in server actions and APIs (schedule/drag-drop/publish/directory/availability export/assignment status paths)
  - middleware/proxy route gating aligned to centralized permission helpers
- Added security documentation:
  - `docs/SECURITY.md` now includes a concise role-permission matrix
- Refactored coverage page into smaller units without behavior changes:
  - `src/components/coverage/CalendarGrid.tsx`
  - `src/components/coverage/ShiftDrawer.tsx`
  - `src/lib/coverage/selectors.ts`
  - `src/lib/coverage/mutations.ts`
  - `src/app/coverage/page.tsx` now composes these modules
- Hardened assignment status optimistic-update flow against stale closures:
  - extracted helper:
    - `src/lib/coverage/updateAssignmentStatus.ts`
  - added unit test coverage:
    - `src/lib/coverage/updateAssignmentStatus.test.ts`
    - success path asserts no rollback
    - failure path asserts rollback is executed
- Added and enforced formatting tooling:
  - `.prettierrc`, `.prettierignore`
  - npm scripts: `format`, `format:check`
  - Husky + lint-staged pre-commit formatting
  - CI updated to run `npm run format:check`

## Latest Completed Work (2026-02-27)

- Enforced PRN strict eligibility end-to-end:
  - Added shared eligibility resolver used by auto-generate + picker/API paths:
    - `resolveEligibility(...)` in `src/lib/coverage/resolve-availability.ts`
    - PRN can be scheduled only when:
      - cycle override has `force_on`, OR
      - recurring work pattern explicitly offers that weekday (`works_dow`) and other hard constraints pass.
    - new blocked reason surfaced: `PRN not offered for this date`
  - Auto-generate candidate selection now honors PRN strict policy through shared resolver:
    - `src/lib/schedule-helpers.ts`
  - Assignment/move/set-lead drag-drop API now hard-blocks PRN-not-offered (not override-confirmable):
    - `src/app/api/schedule/drag-drop/route.ts`
- Picker and availability UX aligned to strict policy:
  - Manager month smart picker:
    - PRN-not-offered rows are disabled with tooltip `PRN not offered for this date`
    - override-enabled PRN rows show badge `Offered`
    - file: `src/components/manager-month-calendar.tsx`
  - Therapist availability page:
    - PRN therapists can submit only `Available to work (PRN)` (`force_on`)
    - non-PRN therapists submit `Need off` (`force_off`)
    - server-side validation enforces employment-type override policy
    - files:
      - `src/app/availability/page.tsx`
      - `src/app/availability/availability-requests-table.tsx`
  - Manager directory wording clarified for override type labels:
    - `src/components/EmployeeDirectory.tsx`
- Introduced recurring work-pattern model:
  - New `work_patterns` table (manager-managed):
    - `works_dow`, `offs_dow`
    - `weekend_rotation` + `weekend_anchor_date`
    - `works_dow_mode` (`hard`/`soft`)
  - New typed helpers and unit tests:
    - `src/lib/coverage/work-patterns.ts`
    - `src/lib/coverage/resolve-availability.ts`
    - `src/lib/coverage/generator-slot.ts`
- Replaced legacy availability entry flow with one cycle-scoped source of truth:
  - `availability_overrides` now used for therapist + manager overrides.
  - Supports `force_off` and `force_on` by cycle/date/shift.
  - Added `source` metadata (`therapist`/`manager`) with source-aware RLS.
- Auto-generate now enforces hard constraints and records constraint-based unfilled slots:
  - Never violates `offs_dow`
  - Never violates off-weekend parity
  - Honors `works_dow_mode='hard'` as strict
  - Applies penalty when `works_dow_mode='soft'`
  - Writes `shifts.unfilled_reason='no_eligible_candidates_due_to_constraints'`
- Coverage and schedule feedback updated:
  - `constraints_unfilled` summary surfaced post-generation
  - slot-level badge: `No eligible therapists (constraints)`
- Team Directory manager workflow expanded:
  - Employee drawer includes cycle-scoped Date Overrides editor:
    - add/update/delete `Need off` / `Available to work`
    - manager saves with `source='manager'`
    - rows show badge: `Entered by manager`
  - Added cycle-scoped `Missing availability` table with quick action:
    - shows overrides count, last updated, submitted/not submitted
    - `Enter availability` opens drawer focused on override section
- Coverage assignment status update logic extracted + tested:
  - `src/lib/coverage/updateAssignmentStatus.ts`
  - includes proper rollback + user-facing error + real error logging

## Previous Milestone (2026-02-24)

- Availability workflow moved to `availability_entries` with role-based input:
  - full-time/part-time submit `unavailable`
  - PRN submit `available`
- Availability override metadata and confirmation flow added to `shifts`.
- Approvals flow narrowed to post-publish shift posts.
- Manager dashboard redesign shipped with live Supabase metrics.
- e2e coverage added for availability override + PRN soft-warning paths.

## What This App Is

Teamwise is a respiratory therapy scheduling app replacing paper workflows.
Core domains: coverage planning, cycles, availability requests, shift board, approvals, publish flow, directory.

## Current Stack

- Next.js 16.1.6 (App Router) + TypeScript
- Supabase (Auth + Postgres + RLS + RPC)
- Tailwind + shadcn/ui patterns
- Vitest (unit) + Playwright (e2e)

## Current Product Shape

Primary routes:

- `/` public marketing
- `/login`, `/signup`
- `/auth/signout`
- `/pending-setup` post-signup onboarding gate
- `/dashboard` role redirect
- `/dashboard/manager`, `/dashboard/staff`
- `/coverage` dedicated coverage UI (client page, full-width calendar + slide-over panel)
- `/schedule` schedule workspace (Week/Month views)
- `/approvals`
- `/availability`
- `/shift-board`
- `/directory` (manager team directory)
- `/profile`
- `/requests`, `/requests/new` shift request workflow
- `/publish`, `/publish/[id]` publish history + async email queue (implemented; requires env vars)
- `/staff/` staff-scoped layout with staff-specific schedule and requests sub-routes

## Role Model

Role source: `profiles.role`.

- `manager`: full scheduling + publish + directory controls
- `therapist`: staff experience

Lead capability is represented by `profiles.is_lead_eligible`.

## Scheduling Rules (Active)

- Coverage target: 3-5 per shift slot
- Weekly therapist limits from profile/defaults
- Exactly one designated lead (`shifts.role='lead'`) and lead must be eligible
- Recurring pattern constraints:
  - `offs_dow` is hard block
  - every-other-weekend off parity is hard block
  - `works_dow` is hard when `works_dow_mode='hard'`
  - `works_dow` is soft preference when `works_dow_mode='soft'`
- Cycle-scoped date overrides precedence:
  - inactive/FMLA blocks first
  - `force_off` blocks date in that cycle
  - `force_on` allows date in that cycle (except inactive/FMLA)
  - fallback to recurring pattern if no override
- PRN strict policy:
  - PRN is eligible only when:
    - cycle override matches with `force_on`, OR
    - recurring pattern offers that date (`works_dow`) and hard constraints pass.
  - PRN without `force_on` and without an offered recurring day is not eligible.

Auto-generate:

- Targets 4 therapists first when feasible
- Treats slot as unfilled only when below 3
- Excludes inactive + FMLA by default
- Leaves remaining slots unfilled when constraints eliminate candidates
- Marks constraint-caused unfilled slots for UI messaging and auditability

Assignment status remains informational only:

- Does not change coverage counts, attention metrics, or publish blockers

## Coverage UX (Current)

`/coverage` now uses:

- Full-width 7-column day calendar (no side panel shrinking layout)
- Fixed right slide-over detail panel (`z-50`)
- Click backdrop (`z-40`) or close button to dismiss
- Click same day again toggles panel closed
- Accordion therapist rows in panel (single expanded row)
- Day/Night shift tabs in coverage view
- Optimistic status updates with rollback on save failure
- Unassign therapist action from expanded row in the right panel
- Calendar chips now visibly reflect assignment status updates immediately:
  - `OC` (on call), `LE` (leave early), `X` (cancelled), with distinct chip colors
- Constraint visibility:
  - slot badge and detail note for `No eligible therapists (constraints)`
- Assignment picker behavior:
  - PRN not offered for date is disabled in smart picker with tooltip
  - PRN enabled via cycle override is labeled `Offered`
- Lead role assign:
  - Staff / Lead pill toggle in assign panel
  - Lead button disabled when slot already has a lead or no lead-eligible therapists available
  - Dropdown filtered to lead-eligible therapists when Lead mode is active
  - Assigns `shifts.role='lead'`; optimistic update sets `leadShift` on the day
- Workload visibility in assign dropdown:
  - Each therapist option shows `· N this wk` when they have ≥1 shift scheduled that week
  - Derived from already-loaded calendar state — no extra network requests

## Schedule UX (Current)

`/schedule` navigation now exposes only:

- `Week`
- `Month`

Grid/List tabs were removed from header navigation.
Legacy URLs with `view=grid` and `view=list` normalize to `view=week`.

Manager information hierarchy is now schedule-first:

- Coverage and publish are primary
- Approvals are intentionally secondary

## Navbar / Branding (Current)

- Navbar logo: inline amber icon (`var(--attention)`) + Teamwise wordmark in `AppShell`
- Plus Jakarta Sans (800) added at root layout via `next/font/google`
- Active nav pill: `var(--primary)` blue (was amber)
- User avatar circle: `var(--attention)` amber (brand personality)
- Manager badge: `bg-amber-50 text-amber-700 border-amber-200`
- App shell header z-index: `z-30` (coverage slide-over sits above at `z-50`)
- App shell includes `/coverage` route so top nav is present on coverage page
- Manager nav order is schedule-first:
  - `Dashboard`, `Coverage`, `Team`, `Requests` (approvals moved later and renamed in nav)

## Assignment Status Feature

Backend status values:

- `scheduled`, `call_in`, `cancelled`, `on_call`, `left_early`

Stored fields on shifts:

- `assignment_status`
- `status_note`
- `left_early_time`
- `status_updated_at`
- `status_updated_by`

Write path:

- `POST /api/schedule/assignment-status`
- Optimistic local update with rollback on failure in client views

## Notifications and Audit

Notifications:

- Bell in top nav
- unread badge + list + mark-read behavior
- APIs: `/api/notifications`, `/api/notifications/mark-read`

Audit:

- `public.audit_log`
- recent activity panel available in schedule coverage flows

## Data Model Snapshot

Core tables:

- `profiles`
- `schedule_cycles`
- `shifts`
- `availability_requests` (legacy)
- `availability_entries` (legacy transitional model)
- `work_patterns` (active recurring rules model)
- `availability_overrides` (active cycle-scoped override model)
- `shift_posts`
- `notifications`
- `audit_log`

Common profile fields used:

- `full_name`, `email`, `phone_number`
- `role`, `shift_type`, `employment_type`
- `max_work_days_per_week`
- `is_lead_eligible`, `on_fmla`, `fmla_return_date`, `is_active`
- `default_calendar_view`, `default_landing_page`
- `site_id`

Common shift fields used:

- `cycle_id`, `user_id`, `date`, `shift_type`
- `status` (`scheduled|on_call|sick|called_off`)
- `role` (`lead|staff`)
- `unfilled_reason`
- availability override fields:
  - `availability_override`
  - `availability_override_reason`
  - `availability_override_by`
  - `availability_override_at`
- assignment-status fields listed above
- `site_id`

## Recent Migrations (Relevant)

- `20260223091500_add_profile_view_and_landing_preferences.sql`
- `20260223104500_add_notifications_and_audit_log.sql`
- `20260223121500_add_assignment_status_rpc.sql`
- `20260223191000_harden_role_and_lead_permissions.sql`
- `20260224103000_add_shift_status_changes_audit.sql`
- `20260224121500_add_availability_entries_and_override_metadata.sql`
- `20260227143000_add_work_patterns_and_cycle_overrides.sql`
- `20260227184500_add_source_to_availability_overrides.sql`

## Quality Status

Latest local checks:

- `npx tsc --noEmit` pass
- `npm run lint` pass
- `npm run format:check` pass (whole-repo Prettier; `.claude/**` excluded from ESLint)
- `npm run test:unit` pass (**195 tests** across 20 files)
- CI now gates on: format check → lint → **tsc --noEmit** → build
- e2e specs:
  - `e2e/coverage-overlay.spec.ts` (10 tests)
  - `e2e/directory-date-override.spec.ts` (7 tests: seeding, save override, delete override, search filter, employment filter, lead checkbox, drawer tabs)

## Resume Checklist

1. `git status -sb`
2. `supabase db push`
3. `npm install`
4. `npx tsc --noEmit`
5. `npm run lint`
6. `npm run test:unit`
7. `npm run dev`

## Paused Work

### Publish flow with async email + publish history

Status: **Code fully implemented** — pending env var configuration and final validation before rollout.

Key files:

- `src/app/publish/page.tsx`, `src/app/publish/[id]/page.tsx`
- `src/app/publish/actions.ts`, `src/app/publish/process-queued-button.tsx`
- `src/lib/publish-events.ts`

To activate:

- Run migration: `supabase/migrations/20260225190000_add_publish_events_and_notification_outbox.sql`
- Set env vars:
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `RESEND_API_KEY`
  - `PUBLISH_EMAIL_FROM`
  - `NEXT_PUBLIC_APP_URL`
  - optional `PUBLISH_WORKER_KEY`
- Validate manager publish UX:
  - Publish shows "Published - visible to employees"
  - Publish shows queued/sent/failed counts
- Validate async queue processing:
  - `POST /api/publish/process` processes queued rows
  - counts update on `/publish` and `/publish/[id]`
- Validate retry path:
  - Use "Re-send failed" on `/publish/[id]`
  - Reprocess queue and confirm failures can move to sent
- Optional: add scheduled worker/cron to call `/api/publish/process`

## Next High-Value Priorities

1. Publish flow validation — activate env vars and validate queued email send + retry path
2. **Coverage e2e suite expansion** — add tests for: lead assignment end-to-end, workload warning when at weekly limit, unassign removes shift chip, status change persists across panel close/reopen
3. Server-side validation messages for cycle/date conflicts directly in the directory drawer (inline error banners vs. redirect-based toasts)
