# Teamwise Scheduler

Updated: 2026-04-25 (session 87)

## Handoff Snapshot

### Current Truth

- Production is live on `https://www.teamwise.work`.
- The working inbound availability webhook URL is:
  - `https://www.teamwise.work/api/inbound/availability-email`
- `mail.teamwise.work` receiving is verified in Resend, and the webhook now acknowledges `email.received` events quickly enough for Resend delivery to succeed in production.
- Availability intake currently supports:
  - inbound email webhook
  - manager-created manual intake from pasted text
  - uploaded form image/PDF on `/availability`
- Uploaded images can OCR through the OpenAI Responses API when `OPENAI_API_KEY` is configured. PDFs now try direct PDF extraction first, then render pages to images and retry OCR when direct extraction returns no text using stronger preprocessing and fixed-form-like region prompts.
- Production now successfully OCRs and parses the photographed PTO form example (`IMG_0262.jpeg`): employee name is extracted, therapist matching succeeds, and PTO rows parse into structured requests. The item remains `needs_review` only when schedule-cycle matching is missing (for example OCR dates from 2024 against current cycles).
- The production pipeline is now instrumented enough to distinguish delivery failures, render failures, and OCR failures in `availability_email_intake_items.ocr_error`.
- The inbound webhook route now returns immediately and continues OCR/database work in `after()`, preventing Resend retries caused by long OCR work inside the request.
- The OpenAI Responses OCR parser now reads both `output_text` and nested `output[].content[].text`, matching the real production payload shape.
- Replaying the same Resend inbound event does **not** reliably create a fresh processed intake row every time. Use `created_at` on the newest intake item rows to confirm whether a replay actually exercised the latest production code.
- The real HCA multi-page handwritten scan used in session 60 proved that the end-to-end pipeline works, but generic OCR still fails to recover useful text from that specific document. Treat that as a document-readability ceiling, not a transport bug.
- The latest production pass adds rotated/grayscale/threshold OCR variants plus region-specific prompts for handwritten name/request areas, but the replayed HCA scan still remains unreadable. Assume future progress will require either a truly template-anchored field extractor or a manager rescue workflow.
- Managers can now fix therapist matches inline on the intake card and then apply parsed dates from the same surface.
- Managers must now match both the therapist and the schedule block before `Apply dates` appears on an intake card. This prevents the old dead-end `email_intake_apply_failed` redirect when a therapist was matched but no cycle was attached yet.
- Managers can now inspect the stored original email body plus attachment OCR text directly on the intake card, reparse a stored intake after OCR/parser changes, and delete troubleshooting/replay batches from `/availability`.
- Reduced PTO-form-style email bodies that repeat `Employee Name:` blocks are now split into per-employee intake items even without the full `PTO REQUEST/EDIT FORM` scaffold, and repeated blocks for the same employee merge back into a single item.
- PTO recurrence lines like `Off Tuesday + Wednesdays` now expand across the active cycle window when a single active block is available; malformed OCR fragments like `5 Sunday 5/ Back to work 25` stay in `needs_review` instead of generating fake work dates.
- **Coverage workspace compaction:** `/coverage` now uses a compact scheduling workspace instead of the old oversized setup/stat/day-card layout. The page is organized around a tighter header, unified planning toolbar, lighter health summary cards, slim setup/live-status banners, a denser weekly grid, and a tighter roster matrix. Grid day cells now prioritize date, staffing ratio, lead state, and compact gap/status chips; the shift editor uses a tighter header plus ranked candidate rows with clearer selected state.
- **Coverage responsive breakpoints:** `/coverage` now keeps its compact week-by-week/card treatment until `xl`, with explicit previous/next week controls and touch swipe navigation on narrower breakpoints. Larger screens keep the full multi-week grid; print forces the desktop/full-grid path.
- **Coverage designated lead vs extra lead-eligible staff:** only one `shifts.role='lead'` row designates the lead for that slot. The shift editor still lists every **lead-eligible** therapist; choosing another while a lead exists adds them as **staff** coverage (`assign` with `role: 'staff'`). Someone already on the day as staff can be **designated** via **`set_lead`** (`setCoverageDesignatedLeadViaApi` in `src/lib/coverage/mutations.ts`), which now uses `router.refresh()` against the server snapshot path instead of a client reload nonce. Lead-eligible rows are **not** disabled merely because a lead is already booked.
- **Email intake tab stability:** intake date chip toggles and **Apply dates** refresh in place (`router.refresh` / `router.replace` with `tab=intake`) so managers are not bounced back to the **Planner** tab after saves. Intake request chips cycle **`force_off` ↔ `force_on`** only; removing a date uses an explicit **Remove** path with confirmation instead of a silent third-click delete.
- **Schedule layout + role consistency:** `/coverage` supports both **Grid** and **Roster** layouts. Managers can edit staffing from either layout by clicking a day cell; leads can update staffed cells to **`OC`**, **`LE`**, **`CX`**, or **`CI`** through the shared assignment-status flow. Users can save a default schedule layout (`Grid` or `Roster`) in `/profile`, and the therapist compatibility route (`/therapist/schedule`) still defers default layout selection to `/coverage` so a saved preference wins unless an explicit `view` query is present.
- **Theme support:** the root layout now reads the `tw-theme` cookie on the server, applies the initial `dark` class without any inline script, and renders a plain `<body>` without importing `ThemeProvider`. `ThemeProvider` now lives in `src/components/AppShell.tsx` so the theme boundary stays client-to-client and avoids the webpack HMR lazy-element crash path; `/profile` still includes an **Appearance** section with **Light / System / Dark** controls. Client-side theme changes keep `localStorage` and the `tw-theme` cookie in sync through `src/lib/theme.ts`, `.dark` token overrides live in `src/app/globals.css`, and print explicitly forces light token values.
- **Audit cleanup + shared-surface polish:** the branch now removes the remaining accent-stripe/header chrome and most decorative halo treatment, tokenizes the brand mark plus lingering public/print visual values, and brings the last compact therapist/manager actions closer to the touch-target bar.
- **Responsive follow-up:** `/coverage` and the read-only `/schedule` roster now hold their compact week/card treatments until `xl`, while narrower admin tools like `/team/import` preview and `/settings/audit-log` filters stack instead of forcing immediate wide horizontal layouts.
- **Hot-path performance trim:** `/coverage` now carries both day and night therapist/roster datasets in the initial server snapshot so shift-tab changes stop re-querying Supabase after hydration, `/availability` skips hidden-tab intake/planner reads, and `shift-board` approve/deny actions no longer rerun the full board bootstrap after a successful save.
- **Shared header/navigation system:** authenticated routes now use one shared sticky `AppHeader` plus surface-level `LocalSectionNav` driven by `src/components/shell/app-shell-config.ts`; page titles/actions are being standardized through `PageIntro`, and public/auth routes now share `src/components/public/PublicHeader.tsx` from `src/app/(public)/layout.tsx`. Avoid reintroducing page-specific top bars or dark secondary sticky bars.
- **Schedule roster route:** `/schedule` no longer redirects to `/coverage`, but it is also no longer a public mock. It now loads live roster/availability data through `src/app/(app)/schedule/schedule-roster-live-data.ts`, stays auth-protected by `src/proxy.ts`, and renders a read-only roster matrix inside the shared app shell.
- **Schedule roster shift filtering:** `/schedule` now respects `profiles.shift_type` when splitting the read-only roster. Day shift shows only day therapists and PRN, night shift shows only night therapists and PRN, and the staff-count badges follow the selected shift instead of listing the full therapist pool on both tabs.
- **Lead role source of truth:** product behavior now treats `profiles.role = 'lead'` as the source of truth for lead-only UI/actions. The legacy `is_lead_eligible` column is kept in sync to `role`, but Coverage, print/export, profile badges, swap partner filtering, and designated-lead actions should all be reasoned about in terms of `role`, not the legacy flag.
- **Auth entry (`/login`, `/signup`):** `src/lib/auth/login-utils.ts` parses auth errors from top-level query params **or nested inside `redirectTo`** (e.g. `/availability?error=...`), maps friendly copy, and `router.replace` cleans error keys while preserving a sanitized `redirectTo`. Approval/allowlist copy shows as a **warning** banner with optional **Request access** link and dismiss; credential failures stay **destructive**. Successful access **request** redirects to **`/login?status=requested`** with an **info** banner (dismiss + URL strip); signup no longer auto-signs-in before that redirect, and the public signup page now always uses that same generic redirect instead of exposing roster-match state. **Name roster auto-match:** managers maintain **`employee_roster`** on **`/team`** (single row, **bulk paste**, or ops script). On signup, **`handle_new_user`** still matches **normalized full name** to an active roster row on the server; matched users can receive roster **role/settings** immediately (non-pending), and the roster row records **`matched_profile_id`**, but the public UX no longer discloses whether that match happened. Unmatched signups stay **`profiles.role = null`** pending approval. **Migration:** `20260413123000_add_employee_roster_and_name_match_signup.sql`. **Ops:** `npm run sync:roster` bulk-creates **auth + profiles** from an email list file (separate from **`employee_roster`** name pre-match). **Public homepage (`/`):** dark teal hero (`bg-[var(--primary)]`) with subtle grid texture and amber right stripe; headline "Scheduling that keeps care moving."; amber **Sign in** primary CTA + outline **Request access** secondary; warm `bg-background` feature strip below. `PublicHeader` uses `bg-[var(--primary)]` (not transparent) for the dark homepage variant — the header renders outside `<main>` in the public layout so transparent would land on the light wrapper background. Vitest contracts in `src/app/page.test.ts` and `src/app/globals.test.ts`. Shared **Input** focus ring uses **`--ring`**; **`:autofill`** + **`-webkit-autofill`** theming lives in `globals.css`.
- Mixed off/work sentences are parsed more accurately than before, but parser changes should continue to be driven by real inbound examples.
- **Layout split + authenticated shell performance pass:** the universal root layout is now lightweight (`src/app/layout.tsx`), public pages get the display font through `src/app/(public)/layout.tsx`, and authenticated shell work lives in `src/app/(app)/layout.tsx`. The authenticated layout is intentionally `force-dynamic` because it reads auth cookies and server-loads shell state. The shell no longer wraps the full authenticated tree in `MotionProvider`; `framer-motion` now stays local to the small surfaces that actually animate. The top-nav notification control now hydrates through `DeferredNotificationBell` so the unread badge can render immediately without loading the full dropdown/fetch logic on first paint. Prefer design tokens over raw **`text-white`** / **`bg-white`** / stray **`dark:`** on shared surfaces; destructive actions use **`text-destructive-foreground`**. **`globals.css`:** stronger **`--muted-foreground`**, **`--color-destructive-foreground`** in **`@theme`**, table row hover scoped to **`table:not(.no-row-hover)`**, marketing header + home preview shell reduce **`backdrop-filter`** under **`prefers-reduced-motion: reduce`**. **`/requests/new`** and **`/publish/[id]`** use **`ManagerWorkspaceHeader`**. **`LEAD_ELIGIBLE_BADGE_CLASS`** uses **`--info-*`** tokens (`src/lib/employee-tag-badges.ts`).
- **Bundle trim follow-up (session 77):** `/coverage` lazy-loads its closed dialogs (`ShiftEditorDialog`, auto-draft confirm, clear-draft confirm, cycle management) instead of bundling them into the initial route payload; `/team` now code-splits `TeamDirectory` and `EmployeeRosterPanel` so only the active tab ships initially. Current measured build results on `main`: `/coverage` client chunk is about **91.3 KB** (down from about **117.4 KB**), `/team` route entry is about **7.8 KB** (down from about **59.8 KB**), and the authenticated app layout chunk is about **27.8 KB** after removing global shell animation plumbing and deferring notification UI.
- **Manager `/availability` planner shell:** URL tabs **`?tab=planner|intake`** under **`AvailabilityOverviewHeader`**. **Planner** = **`ManagerSchedulingInputs`** inside **`AvailabilityWorkspaceShell`**. **Saved planner dates** and primary planner actions belong in the shell **`controls`** slot (left column, muted background). Use **`lower={null}`** for that surface — **`lower`** renders **outside** the primary card. Calendar month UI: **`AvailabilityCalendarPanel`** (`src/components/availability/availability-calendar-panel.tsx`).
- **Availability Planning polish:** `/availability` now keeps the current planner-first structure while tightening the lower half into a single **Secondary workflow** surface with **Response roster** and **Request inbox** tabs. The roster uses dense rows with initials, status, request signal, and last activity; the inbox collapses to a compact empty state instead of a large blank table shell; the disabled planner CTA now reads **`Select dates to save`**.
- **Team workspace refactor:** `/team` renders through workspace-style components (`TeamWorkspaceClient`, `TeamDirectoryFilters`, `TeamDirectorySummaryChips`, `TeamPersonRow`, `EmployeeRosterTable`) for denser directory and roster administration. **`?tab=roster`** is resolved on the server (`initialTab` from `TeamPage`) and synced in **`TeamWorkspaceClient`** via **`router.replace`** without **`useSearchParams`**, so that subtree does not depend on a search-params **`Suspense`** boundary. Only the active tab now mounts, and the page parallelizes the main directory/work-pattern/roster reads.
- **Team directory operational layout:** `/team` **Team directory** tab uses a compact non-sticky controls block (quick-view chips as filters, search + selects, **Clear filters**, **Expand all** / **Collapse all**). Grouped sections use lightweight structural headers (not accordion cards); **all groups default expanded** on first visit; manual open/closed state persists in **localStorage**; while search/filters are active, groups with matches auto-expand so results are never hidden; clearing filters restores saved section state. **`TeamPersonRow`** is a denser directory-style row with stronger focus/hover affordance. Runtime stability still uses **`TeamWorkspaceClient.tsx`** as the manager-team client boundary.
- **Cycle templates:** managers can now save a published cycle as a reusable staffing template and apply a template into a draft cycle from Coverage. Templates serialize shifts as `day_of_cycle` rows only; they intentionally do **not** include availability overrides.
- **Roster CSV import wizard:** managers now have a generic `/team/import` flow for legacy roster CSVs. The wizard maps CSV headers to Teamwise fields, validates rows, and lets managers import valid rows while skipping errors.
- **Therapist scheduled conflict warning:** `/therapist/availability` now warns when a therapist marks a date as **Need Off** (`force_off`) while they already have a `scheduled` shift on that same active-cycle date. This is a dismissible warning banner only; it does not block saving.
- **Therapist recurring pattern vs future availability:** `/therapist/recurring-pattern` is now the default-template editor, while `/therapist/availability` is the generated cycle workspace. Future Availability starts from the saved recurring pattern and stores only cycle-specific overrides; editing the cycle must not mutate the recurring template.
- **Advanced recurring work patterns:** `work_patterns` now supports `pattern_type`, `weekly_weekdays`, `weekend_rule`, `cycle_anchor_date`, and `cycle_segments` in addition to the legacy weekly columns. Any scheduling workflow that reasons about work patterns should prefer the normalized pattern object and not assume weekday-only constraints.
- **Coverage pre-flight check:** the auto-draft flow on `/coverage` now opens a pre-flight report before running draft generation. The report uses the same pure draft engine as generation, includes real existing shifts, and summarizes unfilled slots, missing leads, and forced must-work misses.
- **Shift reminders:** `vercel.json` now schedules `/api/cron/shift-reminders` at `0 6 * * *`. The cron route requires `CRON_SECRET`, queues rows in `shift_reminder_outbox`, sends 24h reminder emails for next-day `scheduled` shifts only, and writes matching in-app notifications.
- **Manager analytics:** `/analytics` now provides cycle fill rates, therapist submission compliance, and force-on miss reporting using server-side Supabase queries plus simple CSS-based summary components.
- **Dedicated work-pattern pages:** managers now have `/team/work-patterns` for grouped review and `/team/work-patterns/[therapistId]` for the full advanced editor. Legacy quick-edit surfaces are still weekly-only and should not be used to rewrite repeating-cycle patterns.
- **`resolveRosterCellIntent` intent split:** the function now returns `'quick_assign'` for manager + empty roster cell and `'manage'` for manager + filled cell. Both intents render the same editor-open button in `RosterMatrixTable`; the distinction exists for test assertions and future intent-specific styling. Do not collapse them back into a single `'manage'` return.
- **Dead `onUnassign` prop removed from roster matrix:** `onUnassign` no longer exists on `RosterScheduleViewProps`, `RosterSection`, or `RosterMatrixTable`. `handleUnassign` in `CoverageClientPage` is still wired exclusively to `ShiftEditorDialog` where it is actually called.
- **Availability intake utilities:** `src/lib/availability-email-intake.ts` and related tests now cover richer request-edit parsing and manager-edit workflows more explicitly.
- `RESEND_API_KEY` must support receiving APIs, not just sending. A send-only key fails on `/emails/receiving` with `401 restricted_api_key`.

### Local In-Progress Work

All features from merged PRs are now on `main` and live: dark mode, cycle templates, CSV import wizard, bulk therapist status actions, audit log UI, availability conflict warning, coverage pre-flight, shift reminders, manager analytics, work-patterns page, roster segmentation fix, dark teal homepage (PR `#42`), and therapist workflow accuracy pass (PR `#43`). Current working branch is `main`.

Key additions from PR `#43`: centralized therapist workflow state (`src/lib/therapist-workflow.ts`), trusted shift-post mutation route (`src/app/api/shift-posts/route.ts`), deterministic pickup queue via `shift_post_interests.status`, RLS hardening for direct posts, and shared cleanup path in `src/lib/shift-post-cleanup.ts`. Note: `supabase db reset` pending (Docker Desktop unavailable locally).

### Where We Want To Go

1. Run a full browser QA pass across shared headers, `/coverage`, `/schedule`, `/team/import`, and `/settings/audit-log` on desktop, tablet, and mobile before shipping.
2. **Add "Send reminders" bulk action** to the response roster on `/availability` - bulk email nudge for non-respondents is still the top operational gap.
3. **Swap history and My Schedule quick view** - `src/app/(app)/staff/history` and `src/app/(app)/staff/my-schedule` are still not implemented.
4. **Schedule/roster CSV export** - `/api/schedule/export` and `/api/team/roster/export` are still not implemented; `csv-utils.ts` still needs to be extracted from the availability export route.
5. **Print confidentiality footer** - `print-schedule.tsx` still lacks the "Internal Use Only" footer.
6. Keep hardening the intake parser with concrete real-message examples before changing heuristics.
7. Deploy production after significant public-surface changes (`vercel deploy --prod`) so `www.teamwise.work` matches `main`.
8. Keep manual intake first-class even if Resend inbound is healthy. It is the practical fallback path for operations.

### Verification Baseline

- As of 2026-04-25 on `main`, `npm run lint`, `npm run test:unit`, `npm run build`, and `npx tsc --noEmit` all pass (729+ unit tests).
- **Therapist browser validation path:** for `/therapist/settings`, `/therapist/recurring-pattern`, and `/therapist/availability`, prefer an automation-only auth setup over a human session. The validated local pattern is: read repo `.env.local`, create a temporary therapist user with the service-role client, authenticate Playwright/headless browser via Supabase SSR cookies on `127.0.0.1:3000`, capture the therapist routes, then delete the temporary user. Treat `SHOT_STAFF_EMAIL` / `SHOT_PASSWORD` as optional shortcuts only; if they fail, fall back to temp-user creation instead of giving up on the visual pass.
- `npm run lint`
- `npm run build`
- `npm run test:unit`
- `npm run test:e2e` when auth/env setup is available
- `vercel deploy --prod --yes` for production shipping
- Targeted availability lane: `npx vitest run src/app/availability/`
- Targeted coverage lane: `npm run test:unit -- src/app/coverage/page.test.ts src/components/coverage/CalendarGrid.test.ts src/components/coverage/RosterScheduleView.test.ts src/components/coverage/shift-editor-dialog-layout.test.ts`
- Targeted shell/header lane: `npx vitest run src/components/shell/app-shell-config.test.ts src/components/AppShell.test.ts src/components/manager/ManagerWorkspaceHeader.test.ts src/app/(public)/signup/page.test.ts`
- Targeted theme lane: `npm run test:unit -- src/lib/theme.test.ts src/app/layout.theme.test.ts src/app/profile/theme-controls.test.ts src/app/globals.test.ts`
- Targeted template lane: `npm run test:unit -- src/lib/cycle-template.test.ts src/app/api/schedule/templates/route.test.ts src/app/coverage/template-wiring.test.ts src/components/coverage/CycleManagementDialog.test.ts`
- Targeted team import lane: `npm run test:unit -- src/lib/csv-import-parser.test.ts src/app/team/import/page.test.ts src/app/team/import/actions.source.test.ts src/components/team/EmployeeRosterPanel.test.ts`
- Targeted therapist conflict lane: `npm run test:unit -- src/lib/availability-scheduled-conflict.test.ts src/components/availability/TherapistAvailabilityWorkspace.test.ts src/app/(app)/availability/page.test.ts src/app/(app)/therapist/availability/page.test.ts`
- Targeted pre-flight lane: `npm run test:unit -- src/lib/coverage/pre-flight.test.ts src/app/api/schedule/pre-flight/route.test.ts src/app/(app)/coverage/preflight-wiring.test.ts`
- Targeted shift reminder lane: `npm run test:unit -- src/lib/shift-reminders.test.ts src/app/api/cron/shift-reminders/route.test.ts`
- Targeted analytics lane: `npm run test:unit -- src/lib/analytics-queries.test.ts src/app/analytics/page.test.ts src/components/shell/app-shell-config.test.ts`
- Targeted work-pattern lane: `npm run test:unit -- src/components/team/WorkPatternCard.test.ts src/components/team/WorkPatternEditDialog.test.ts src/app/team/work-patterns/page.test.ts`
- Targeted schedule-roster lane: `npm run test:unit -- src/lib/schedule-roster-data.test.ts`

## Recent changelog

**Session 88 (2026-04-25)** — Design system font swap + auth panel polish:

- Swapped DM Sans → Plus Jakarta Sans (UI font) and Fraunces → Instrument Serif (display/hero); updated `--font-sans` CSS variable in `globals.css`.
- Auth left panels (`/login`, `/signup`): dark teal background (`var(--marketing-hero-bg)`), amber right stripe, grid texture, Instrument Serif headline at `font-normal text-[2.625rem]` matching the homepage hero.
- Updated `DESIGN.md` typography section. Trimmed `CLAUDE.md` from 655 → 503 lines.

**Session 87 (2026-04-25)** — Homepage redesign to dark teal "Teamwise Refined" style (PR `#42`):

- Replaced the luminous light-mode homepage with a dark teal hero: `bg-[var(--primary)]` background, subtle white grid texture, amber right stripe, amber eyebrow, serif headline "Scheduling that keeps care moving.", feature strip below.
- `PublicHeader` uses `bg-[var(--primary)]` for the dark homepage variant so white text stays readable above the layout wrapper.
- Updated `src/app/page.test.ts` Vitest contracts to assert the new design.

Per-session detail for earlier sessions lives in `docs/SESSION_HISTORY.md` or `git log --oneline`.

**Session 86 (2026-04-17)** - Audit-driven cleanup, responsive follow-up, and verification reset on `claude/audit-log-bulk-team-clean`:

- `npm run lint` now intentionally targets `src` so local quality checks stop drowning in `.next` / `.next-dev` artifact noise, and the stale route-group source tests now point at the real `(app)` / `(public)` files.
- Shared/public surfaces were cleaned up: removed the remaining accent-stripe/header chrome, reduced decorative halo treatment, tokenized the logo plus lingering public/print values, and tightened shared semantic details like grouped quick filters and safe button defaults.
- `/coverage`, `/schedule`, `/team/import`, and `/settings/audit-log` received the final responsive/touch-target pass: compact scheduling views now hold until `xl`, admin previews/filters stack better on narrow widths, and therapist/manager action controls were raised where they still lagged.
- Full verification is green again on this branch: lint, unit tests (`127` files / `729` tests), TypeScript, and production build all pass.

For sessions 47–86 see `docs/SESSION_HISTORY.md` or `git log --oneline`.

## Data model gotcha — publish history ≠ schedule cycles

- `publish_events` (shown at `/publish`) and `schedule_cycles` (shown as cycle pills on `/coverage`) are **separate tables**. Deleting a publish history record does NOT remove the cycle from the coverage selector.
- Preferred lifecycle action: **archive** old non-live cycles from `/publish`. That sets `schedule_cycles.archived_at` and removes the cycle from Coverage, Availability, therapist availability, and dashboard cycle pickers without deleting operational records.
- Unpublished draft cycles can still be hard-deleted through the delete-cycle flow when you explicitly want to remove the row and its dependents.
- `schedule_cycles` `ON DELETE CASCADE` covers: `shifts`, `availability_overrides`, `therapist_availability_submissions`, `availability_requests`, `publish_events`, `preliminary_snapshots`. One DB call cleans up everything when hard-delete is used.

## What This App Is

Teamwise is a respiratory therapy scheduling app replacing paper workflows.
Core domains: coverage planning, cycles, availability requests, shift board, approvals, publish flow, team management.

## Current Stack

- Next.js (App Router) + TypeScript — **`package.json`** uses a semver range; **lockfile / `npm ls next`** is the canonical installed version when debugging version skew.
- Supabase (Auth + Postgres + RLS + RPC)
- Tailwind + shadcn/ui patterns
- Vitest (unit) + Playwright (e2e)

## UX Fixes (session 34 — items #1–#3 shipped)

From audit: workflow/usability issues being addressed one at a time.

- [x] **#1** Rename staff nav "My Schedule" → "Schedule" (`AppShell.tsx`)
- [x] **#2** Manager Inbox: add "New 6-week block" CTA when no active cycle (`ManagerTriageDashboard`, `dashboard/manager/page.tsx`)
- [x] **#3** Publish History: info callout + "Open to publish" label for draft cycles (`publish/page.tsx`)
- [ ] **#4** After preliminary claim submit, add link to see pending request status
- [ ] **#5** Auto-draft result: surface summary (shifts assigned, unfilled, forced-date misses)
- [ ] **#6** Approvals: sort by age, add urgency signal
- [ ] **#7** Availability deadline: countdown chip on therapist dashboard
- [x] **#8** Coverage empty state: guided first-time manager flow (done session 48 — `noCycleSelected` redesigned with icon + numbered 3-step flow)

## Resume Checklist

```bash
git status -sb
supabase db push
npm install
npx tsc --noEmit
npm run lint
npm run test:unit
npm run dev
```

**Windows:** if `next dev` acts stale or `.next` errors with `EBUSY`, stop other Node processes on port **3000**, delete **`.next`**, then run **`npm run dev`** once.

## Deploy to Production

```bash
vercel --prod   # GitHub → Vercel auto-deploy is NOT wired; CLI is the only deploy method
```

Generate new HMAC/cron secrets: `openssl rand -hex 32`

## Quality Status

Run these fresh at the start of each session:

- `npx tsc --noEmit` pass
- `npm run build` pass
- `npm audit --omit=dev` pass
- full `npx vitest run` pass (**729+ tests** as of 2026-04-25)
- targeted `npx vitest run src/app/availability/actions.test.ts src/app/api/schedule/drag-drop/route.test.ts src/lib/coverage/mutations.test.ts` pass
- targeted `npx eslint` on touched files pass
- Playwright CLI smoke pass on `/` and `/coverage?shift=day` (redirect to login as expected, no console warnings)

Broader historical baseline:

- `npm run test:e2e` pass (**42 passed**) with default Playwright workers set to `2`
- Full `npx vitest run` is green without real Supabase admin env: **`assignment-status`** route tests mock **`@/lib/supabase/admin`** (`createAdminClient`).
- Auth E2E happy path requires `.env.local` (or shell env) entries for `E2E_USER_EMAIL` and `E2E_USER_PASSWORD`

CI gates: format check → lint → tsc → build → Playwright E2E

E2E specs:

- `e2e/coverage-overlay.spec.ts` (14 tests)
- `e2e/directory-date-override.spec.ts` (12 tests)
- `e2e/availability-override.spec.ts` (2 tests)
- `e2e/publish-process-api.spec.ts` (2 tests)
- `e2e/auth-redirect.spec.ts`, `e2e/authenticated-flow.spec.ts`, `e2e/public-pages.spec.ts`

## Primary Routes

- `/` public marketing (therapist-first luminous homepage; `globals.test` + `page.test` contracts)
- `/login`, `/signup`
- `/auth/signout`
- `/pending-setup` post-signup onboarding gate
- `/dashboard` role redirect
- `/dashboard/manager`, `/dashboard/staff`
  - `/dashboard/manager` is the manager **Inbox** — h1 and nav label both read "Inbox"
- `/coverage` dedicated coverage UI (client page, full-width calendar + dialog/popover editing model)
- `/schedule` manager/lead read-only roster matrix (live cycle, shifts, submitted availability; auth required)
- `/approvals`
- `/availability`
- `/shift-board`
- `/directory` compatibility redirect to `/team`
- `/profile`
- `/requests` manager requests hub
- `/requests/user-access` manager access-approval queue
- `/requests/new` shift request workflow
- `/publish`, `/publish/[id]` publish history + async email queue
- `/staff/*` legacy compatibility routes (redirects)

## Role Model

Role source: `profiles.role`.

- `manager`: full scheduling + publish + team management controls
- `lead`: therapist experience plus assignment-status updates
- `therapist`: standard staff experience
- `null` role: pending-access user; can sign in but is gated to `/pending-setup` until manager approval

Coverage lead eligibility remains separate at `profiles.is_lead_eligible`.
On the `/team` surface, lead eligibility is derived from the selected role when saving quick edit.
All permission checks go through `can(role, permission)` in `src/lib/auth/can.ts`, and inactive or archived users should be denied there.

## Key Shared Components

- `src/components/ui/page-header.tsx` — `<PageHeader>` is a compatibility wrapper around `PageIntro`; use the shell primitives directly for new work
- `src/components/motion-provider.tsx` — client root wrapper: Framer **`MotionConfig reducedMotion="user"`** (respects **`prefers-reduced-motion`**); used from `src/app/layout.tsx`
- `src/components/manager/ManagerWorkspaceHeader.tsx` — canonical manager-style route header for `/availability`, `/coverage`, `/team`, `/approvals`, `/publish/[id]`, and staff **`/requests/new`**
- `src/components/availability/AvailabilityOverviewHeader.tsx` — manager-specific availability wrapper around the shared manager workspace header
- `src/components/ui/skeleton.tsx` — `<Skeleton>`, `<SkeletonLine>`, `<SkeletonCard>`, `<SkeletonListItem>` loading states
- `src/components/NotificationBell.tsx` — on-demand bell panel; unread badge count is server-provided from the authenticated layout, and the dropdown fetch runs when the user opens it. Variants: `default` | `staff` | `shell`.
- `src/components/AppShell.tsx` — authenticated shell wrapper; compose shared nav behavior through `src/components/shell/app-shell-config.ts`, `AppHeader`, and `LocalSectionNav`. Keep one sticky top bar only; local section nav belongs on the page surface. `/schedule` remains part of the manager `Schedule` section.
- `src/components/public/PublicHeader.tsx` — shared public/auth top bar used from `src/app/(public)/layout.tsx`
- `src/components/feedback-toast.tsx` — `<FeedbackToast message variant>` for success/error toasts
- `src/lib/auth/can.ts` — `can(role, permission)` — all permission checks go through here
- `src/lib/coverage/selectors.ts` — `buildDayItems`, `toUiStatus`
- `src/lib/coverage/mutations.ts` — `assignCoverageShift`, `unassignCoverageShift`
- `src/lib/calendar-utils.ts` — `toIsoDate`, `dateRange`, `buildCalendarWeeks`, etc.

## Design System

CSS tokens (defined in `src/app/globals.css`):

- `--primary` (`#0667a9`) — all primary actions: buttons, nav pills, links, focus rings
- `--attention` (`#d97706`) — brand personality only: user avatar, logo accent; **not** for primary actions
- `--warning-*` / `--success-*` / `--error-*` / `--info-*` — all status badge families
- `--foreground`, `--muted-foreground`, `--border`, `--card`, `--muted`, `--secondary` — layout tokens

Rules (enforced):

- No hardcoded hex colors — use CSS vars or Tailwind semantic classes
- No `fontFamily` JSX literals — use `font-sans` or `var(--font-sans)`
- `bg-white` → `bg-card`
- Focus rings → `focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none`
- `fontWeight 800` reserved for display-level; section headers use `600`/`700`
- All Lucide icons — no emoji icons in UI

Typography classes:

- `app-page-title` — page-level h1
- `app-section-title` — card/section headers
- `font-display` — Instrument Serif 400 (display/hero headings on public routes; set via `--font-display` in `(public)/layout.tsx`)
- `font-sans` default — Plus Jakarta Sans (all authenticated + public UI text; set via `--font-plus-jakarta-sans` in root `layout.tsx`)

Always read `DESIGN.md` before making visual or UI decisions — it is the canonical reference for fonts, colors, spacing, and aesthetic direction.

## Tooling Gotchas

- **`npm run lint` is intentionally source-scoped:** it runs `eslint src --ext .ts,.tsx` to avoid `.next` / `.next-dev` artifact noise. If you need to lint scripts or docs, run `npx eslint <paths>` explicitly.
- **`formatCycleDate` produces no year:** Uses `{ month: 'short', day: 'numeric' }` → `'Apr 13'` not `'Apr 13, 2026'`. Test fixtures asserting on date range strings must omit the year (e.g. `'Mar 17 – Apr 13'`).
- **Browser verification on auth routes:** All app routes require login. Chrome DevTools MCP always redirects to `/login` — browser verification via screenshot is not possible without credentials. Confirm changes via `tsc`, `vitest`, and code review only.
- **framer-motion `ease`:** `ease: 'easeOut'` fails `tsc` — the `Easing` type requires specific literals. Omit `ease` entirely to use framer-motion's safe default.
- **Auto-draft algorithm lives in `src/lib/coverage/generate-draft.ts`:** `generateDraftForCycle(input: GenerateDraftInput): GenerateDraftResult` is a pure function. `generateDraftScheduleAction` in `src/app/schedule/actions/draft-actions.ts` is a thin wrapper that loads DB data, calls it, then saves results. Dry-run and preview features can call `generateDraftForCycle` directly without a server action.
- **`src/app/schedule/actions.ts` is a barrel:** Real logic is in `src/app/schedule/actions/` sub-modules (`helpers.ts`, `cycle-actions.ts`, `publish-actions.ts`, `shift-actions.ts`, `draft-actions.ts`, `preliminary-actions.ts`). Each action file has `'use server'`; `helpers.ts` and `index.ts` do not.
- **FK column names in schedule tables:** `work_patterns` and `availability_overrides` use `therapist_id` (not `user_id`) as the FK column — match what `generateDraftScheduleAction` uses when writing new queries against those tables.
- **CalendarGrid has no React import:** `src/components/coverage/CalendarGrid.tsx` uses `'use client'` but has no `import ... from 'react'`. Add hooks as a fresh single import statement — don't look for an existing one to amend.
- **`CoverageClientPage.tsx` lucide imports are minimal:** Default set is `ChevronRight, Printer, Send, Sparkles`. Adding any new icon (e.g. `CalendarDays`) requires updating that import line explicitly.
- **`days` array in CalendarGrid is always populated:** Entries exist for every day in the cycle date range even before any shifts are drafted. `days[0]` reliably selects the first day and opens the shift editor — safe to use as a "Assign manually" CTA target on the `showEmptyDraftState` panel.
- **Roster `+` cells should open the editor, not mutate:** In `src/components/coverage/RosterScheduleView.tsx`, empty roster cells should prefer `onOpenEditor(date)` when present. Sending those clicks through the quick-assign mutation path makes the UI feel slow because the click waits on assignment work instead of opening the modal immediately.
- **`@/components/ui/progress` not installed by default:** Run `npx shadcn@latest add progress` before importing the Progress primitive. Not in the original shadcn set for this repo (added session 21).
- **Preview MCP on Windows:** `preview_start` server tracking doesn't persist between tool calls. Chrome MCP also returns "Permission denied" on localhost. For local visual verification, use saved screenshots in `artifacts/screen-capture/latest/`. To confirm server health use `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000`.
- **Zombie dev server on Windows:** Stale `next dev` processes can hold port 3000 silently (visible as ~994MB node.exe in tasklist). Find the PID with `netstat -ano | grep ":3000" | grep LISTENING` then kill with `taskkill //PID <pid> //F`. Follow with `rm -rf .next` before rebuilding.
- **Clean Windows dev restart:** if localhost returns `ERR_FAILED`, first confirm whether anything is actually listening on `3000` (`netstat -ano | Select-String ':3000'`). For a clean restart, stop repo-local `next dev` processes, delete `.next`, then launch exactly one fresh `npm run dev`. Old Chrome tabs can keep stale HMR/runtime overlays alive even after the code is fixed, so prefer a brand-new `localhost:3000` tab before treating an old overlay as current truth.
- **Stale Next build lock on Windows:** if `npm run build` says another build is already running but no real build process exists, delete `.next/lock` and retry before assuming the source tree is broken.
- **Do not re-mount `ThemeProvider` in `src/app/layout.tsx`:** the root layout must stay server-only. Putting `ThemeProvider` back there reintroduces a server-to-client import boundary that can surface as a webpack HMR `lazy element type must resolve to a class or function` crash. Keep the provider mounted in `src/components/AppShell.tsx` unless the boundary design changes deliberately.
- **"Supabase lookup failed" in build output is not an error:** During `npm run build`, Next.js tries to statically pre-render all routes; auth routes that call `cookies()` bail out and log this message. All routes correctly render as `ƒ` (dynamic). Safe to ignore.
- **Responsive stat grids:** Always `grid-cols-2 lg:grid-cols-4` — never bare `grid-cols-4` which clips on narrower viewports.
- **Repo-local Next build lock on Windows:** if `npm run build` throws `EPERM` under `.next`, check for a running `next dev` process from this repo and stop it before rebuilding.
- **Bare `npx tsc --noEmit` can flap on `.next/types` includes:** This repo includes `.next/types/**/*.ts` in `tsconfig.json`, so standalone `tsc` may complain about missing generated route type files unless a fresh Next build has already recreated them. If `tsc` fails with missing `.next/types/app/...`, rerun it after `npm run build` or rely on the build’s TypeScript pass.
- **Session end workflow:** update CLAUDE.md with learnings → `git add CLAUDE.md && git commit && git push`
- **`availability_overrides` are cycle-scoped:** Manager-entered overrides (`force_on`/`force_off`) do NOT carry forward between cycles. Use `copyAvailabilityFromPreviousCycleAction` (or the "Copy from last block" UI) to shift them into the next cycle. Rotating-schedule workers should submit availability each block or use the copy feature.
- **Supabase mock builder must include all chained methods used by the action under test:** `neq`, `order`, `limit` are no-ops on most mocks — add them as chainable builders that return `this`. Forgetting them causes `TypeError: builder.neq is not a function` even when the test assertions look correct. Also extend `then()` to handle every select column shape the action calls (keyed by the column string).
- **Publish email flow no longer depends on a Vercel cron deployment hook:** production publish now processes queued emails immediately in `toggleCyclePublishedAction`. Keep `/api/publish/process` as the shared retry/manual path, but do not reintroduce `vercel.json` cron config unless the deployment plan changes.
- **AI agents and binary file copies:** When an agent (Cursor, Claude, etc.) is instructed to `cp` a binary file (PNG, PDF, etc.), always verify with `ls -lh` — agents frequently write a small placeholder instead of the real file.
- **`next/image` static asset caching in dev:** Adding a new file to `public/` while `next dev` is running requires a server restart to pick it up. Add `unoptimized` prop to `<Image>` to bypass the optimization cache for local static assets during development.

Additional intake gotchas:

- Resend inbound email requires the webhook route to stay public through proxy middleware (`/api/inbound/availability-email` in `PUBLIC_API_ROUTES`) or provider POSTs will be redirected to `/login`.
- `RESEND_API_KEY` must support receiving APIs, not just sending. A send-only key fails on `/emails/receiving` with `401 restricted_api_key`.
- If Resend inbound is still empty after domain verification, managers can still test the workflow immediately from the `Email Intake` card on `/availability` by pasting request text or uploading a request-form image/PDF.
- PTO recurrence expansion is intentionally conservative: clear phrases like `Tuesday + Wednesdays` expand only when there is a single active block window, while broken OCR fragments remain unresolved for manager review.

## Scheduling Rules

- Coverage target: 3–5 per shift slot
- Weekly therapist limits from profile/defaults
- Exactly one designated lead (`shifts.role='lead'`) per slot; lead must be eligible
- Recurring pattern constraints (from `work_patterns` table):
  - `offs_dow` is hard block
  - every-other-weekend off parity is hard block
  - `works_dow` is hard when `works_dow_mode='hard'`
  - `works_dow` is soft preference when `works_dow_mode='soft'`
- Cycle-scoped date overrides (`availability_overrides` table):
  - inactive/FMLA blocks first
  - manager `force_off` blocks date in that cycle
  - manager `force_on` forces eligibility and is prioritized by auto-draft when legal
  - therapist **Available** (default): no override row — neutral day (no forced on/off); autodraft may or may not assign that day based on pattern and constraints
  - therapist **Need Off** → `force_off` (block); therapist **Request to Work** → `force_on` (hard autodraft constraint: prioritization same class as manager `force_on` for slot picking and forced-miss reporting)
  - manager planner is still the strongest operational signal for roster planning
  - fallback to recurring pattern if no override
- PRN strict policy:
  - eligible only when cycle override `force_on` exists
  - recurring weekday patterns alone are not enough for PRN auto-draft eligibility
  - PRN without explicit `force_on` = not eligible

Auto-generate (`src/lib/coverage/generate-draft.ts` → `generateDraftForCycle`):

- Targets 4 therapists first; slot is "unfilled" only below 3
- Excludes inactive + FMLA by default
- Prioritizes manager `force_on` dates when legal
- Marks constraint-caused unfilled slots: `unfilled_reason='no_eligible_candidates_due_to_constraints'`
- Reports forced-date misses back to manager feedback instead of failing the whole draft

Assignment status is informational only (does not affect coverage counts or publish blockers).

## Coverage UX

`/coverage` (`src/app/(app)/coverage/page.tsx` server entry + `src/app/(app)/coverage/coverage-page-data.ts` snapshot loader + `src/app/(app)/coverage/CoverageClientPage.tsx` client logic + `src/components/coverage/`):

- Full-width 7-column day calendar; centered shift editor dialog + inline status popovers
- Uses the shared manager workspace header pattern at the top of the page
- Clicking a day opens the editor dialog
- Clicking an assigned therapist opens the status popover without opening the editor
- Day/Night shift tabs; therapist assignment rows live in the dialog
- **Default shift tab:** without `?shift=`, the selected tab follows signed-in `profiles.shift_type` (night → Night, else Day). **`?shift=day|night`** overrides; toggling updates the URL (`shift` query) while preserving other params. Helpers: `src/lib/coverage/coverage-shift-tab.ts`
- Optimistic status updates with rollback on save failure
- Lead/staff assignment actions still use current Teamwise mutations and rules; designated-lead changes go through **`setCoverageDesignatedLeadViaApi`** (`action: 'set_lead'` on drag-drop) when promoting from staff or swapping designation, while additional lead-eligible coverage without a role change uses a normal **staff** assign.
- Coverage E2E now validates dialog/popover workflow instead of the removed drawer
- Dialog density is controlled centrally in `src/components/coverage/shift-editor-dialog-layout.ts`
- Shift editor header includes compact coverage progress (`X / 5 covered`) with threshold colors (`<3` error, `3-5` success, `>5` warning); therapist rows show non-FT employment badges (`[PRN]`, `[PT]`); and editable shifts with no lead show an amber lead-required banner.
- **Constraint warning gotcha:** `constraintBlockedSlotKeys` in `CoverageClientPage.tsx` is built from unfilled shift rows (`user_id IS NULL`). After the loop, any slot key that also has an assigned therapist is deleted from the set — so "No eligible therapists (constraints)" only appears for truly empty slots; manually assigned therapists suppress it.
- **Day-card warning treatment:** `hasCoverageIssue` in `CalendarGrid.tsx` is `day.constraintBlocked` only — **not** `missingLead || constraintBlocked`. Missing-lead-only days show their warning exclusively through the lead sub-section widget inside the card (which uses `day.leadShift` directly). Do not restore `missingLead` to `hasCoverageIssue` — it caused the entire 6-week calendar to look permanently alarmed in the demo data.
- **Coverage empty states:** Two distinct flags in `CoverageClientPage.tsx` (around line 703): `noCycleSelected` (no cycle row active) and `showEmptyDraftState` (`activeCycleId` set but `selectedCycleHasShiftRows` is false). They render separate `<section>` panels before `<CalendarGrid>`. Edit those blocks to change empty state copy or layout.

## Team UX

`/team` is now the canonical manager roster-management surface.

- **Tabs:** default is the people directory; **`?tab=roster`** opens **Employee roster** signup pre-match admin. Tab selection is server-informed (`initialTab`) and URL updates use **`router.replace`** (no **`useSearchParams`** on this surface).
- **Team directory tab:** quick-view chips (**Total**, role/shift slices, **FMLA** when relevant) act as **filters** (counts match server summary). Search + role/shift/employment/status selects unchanged; **Clear filters** resets chip + form state. Groups (managers, day/night leads and therapists, inactive) are **expanded by default**; collapse is optional; state persists locally; active filters force-open groups that have rows.
- Clicking a team member row opens a quick-edit modal on the same page
- Sections are grouped by: managers, day shift (Lead Therapists, Therapists), night shift (Lead Therapists, Therapists), inactive
- Quick edit is meant for roster/access fields: name, app role, shift type, employment type, FMLA, FMLA return date, active/inactive, recurring **work pattern** (works/offs DOW, hard/soft works mode, weekend rotation + anchor) for therapist/lead rows
- **Employee roster (signup pre-match):** below the directory, **`EmployeeRosterPanel`** (`src/components/team/EmployeeRosterPanel.tsx`) edits **`employee_roster`** — preload **full names** (and optional role/shift/employment via bulk paste) so first-time signup can auto-link by **name** (see **Auth entry** above). Do not confuse this with **`npm run sync:roster`**, which is an email-list **auth/profile** sync for ops.
- `Lead Therapist` is the visible manager-facing role label; the separate `Coverage lead` control was removed from `/team`
- The page now shares the quieter manager workspace header pattern and lighter card framing used on `/availability` and `/approvals`
- `/directory` should be treated as a compatibility redirect only, not a feature surface

## Schedule UX

`/coverage` is the shared schedule workspace for all roles; actions and edits are permission-gated.
`/schedule` is a **read-only roster matrix** for managers and leads (assignments + submitted availability for the selected cycle); edits happen in `/coverage`.
The manager shell must still show the `Schedule` primary section as active on `/schedule`, with the `Coverage` secondary tab highlighted as the adjacent workflow entry.

- `/coverage` supports both `Grid` and `Roster` layouts. Explicit `view` params must survive compatibility redirects, and default layout selection belongs in `/coverage` where profile context is available.

## Navbar / Branding

- Logo: amber icon (`var(--attention)`) + Teamwise wordmark
- Active nav pill: `var(--primary)` blue
- User avatar: `var(--attention)` amber
- Manager badge: `bg-[var(--warning-subtle)] text-[var(--warning-text)] border-[var(--warning-border)]`
- App shell header `z-30`; coverage slide-over `z-50`
- Manager nav (top bar): Today → Schedule → People (user avatar dropdown → Settings / Therapist view / Log out)
  - Schedule sub-nav: Coverage → Availability → Publish → Approvals
  - People sub-nav: Team → Requests (merged; includes access requests with badge)
- **Old sidebar is gone** — do not restore it. Nav is now a fixed horizontal top bar.
- Manager shell IA uses primary sections `Today`, `Schedule`, and `People`
- `Schedule` secondary nav items are `Coverage`, `Availability`, `Publish`, and `Approvals`
- `People` secondary nav items are `Team` and `Requests`
- The fixed secondary nav must preserve `overflow-x-auto` with non-shrinking items so narrow mobile widths scroll instead of clipping tabs

## Assignment Status

Backend values: `scheduled`, `call_in`, `cancelled`, `on_call`, `left_early`

Shift fields: `assignment_status`, `status_note`, `left_early_time`, `status_updated_at`, `status_updated_by`

Write path: `POST /api/schedule/assignment-status` with optimistic local update + rollback.

- Allowed actors: manager or lead.

## Notifications

- `NotificationBell` in top nav: unread badge, divider-based list, "mark all read" CTA
- Unread badge count is loaded in the authenticated layout; full list fetch is deferred until the panel is opened
- APIs: `GET /api/notifications`, `POST /api/notifications/mark-read`

## Publish Flow

- Manager publishes from `/coverage` -> triggers email queue via `notification_outbox` and immediately processes the queued emails in the publish action
- `POST /api/publish/process` is still available for retries/manual processing (batch_size param)
- History at `/publish`; detail + retry at `/publish/[id]`
- Key files: `src/app/publish/`, `src/lib/publish-events.ts`, `src/app/publish/actions.ts`

Required env vars:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL              # must be https://www.teamwise.work in production (not localhost)
RESEND_API_KEY
PUBLISH_EMAIL_FROM               # must match verified Resend domain: Teamwise <noreply@mail.teamwise.work>
```

Optional/manual processing only:

```
PUBLISH_WORKER_KEY
PUBLISH_WORKER_SIGNING_KEY
CRON_SECRET
```

Supabase Auth (production):

- Site URL: `https://www.teamwise.work`
- Redirect URL: `https://www.teamwise.work/auth/callback`

Resend: `mail.teamwise.work` is **Verified**. No test-mode restriction — emails go to all recipients.

Inbound intake notes:

- `POST /api/inbound/availability-email` verifies the Resend webhook signature itself and must remain publicly reachable through middleware.
- If inbound email still does not appear in Resend after receiving is verified, use the manual intake form on `/availability` to keep validating the scheduling workflow.

## Data Model Snapshot

Core tables:

- `profiles` — `full_name`, `email`, `phone_number`, `role` (nullable for pending users), `shift_type`, `employment_type`, `max_work_days_per_week`, `is_lead_eligible` (legacy synced field), `on_fmla`, `is_active`, `default_calendar_view`, `default_schedule_view`, `default_landing_page`, `site_id`
- `schedule_cycles`
- `shifts` — `cycle_id`, `user_id`, `date`, `shift_type`, `status`, `role`, `unfilled_reason`, assignment-status fields, `site_id`
- `work_patterns` — `works_dow`, `offs_dow`, `weekend_rotation`, `weekend_anchor_date`, `works_dow_mode`
- `availability_overrides` — active cycle-scoped override model (`force_off` / `force_on`, `source`)
- `therapist_availability_submissions` — official per-therapist per-cycle submit state (`submitted_at`, `last_edited_at`)
- `shift_posts`, `notifications`, `audit_log`
- `publish_events`, `notification_outbox`
- `availability_requests` (legacy), `availability_entries` (legacy transitional)

## Recent Migrations

- `20260223091500_add_profile_view_and_landing_preferences.sql`
- `20260223104500_add_notifications_and_audit_log.sql`
- `20260223121500_add_assignment_status_rpc.sql`
- `20260223191000_harden_role_and_lead_permissions.sql`
- `20260224103000_add_shift_status_changes_audit.sql`
- `20260224121500_add_availability_entries_and_override_metadata.sql`
- `20260225190000_add_publish_events_and_notification_outbox.sql`
- `20260227143000_add_work_patterns_and_cycle_overrides.sql`
- `20260227184500_add_source_to_availability_overrides.sql`
- `20260407140000_therapist_availability_submissions.sql` (`therapist_availability_submissions`, `schedule_cycles.availability_due_at`)
- `20260409124000_pending_signup_access_requests.sql` (nullable `profiles.role`, pending-aware `handle_new_user`)
- `20260409145500_fix_custom_access_token_hook_for_pending_users.sql` (omit null `user_role` claim)
- `20260412164000_sync_lead_eligibility_to_role.sql` (sync legacy `is_lead_eligible` to `role`)
- `20260413083000_add_default_schedule_view_to_profiles.sql` (`profiles.default_schedule_view`)
- `20260413123000_add_employee_roster_and_name_match_signup.sql` (`employee_roster`, name-match **`handle_new_user`**)

## Next High-Value Priorities

1. **Verify end-to-end publish email flow in production** — publish a schedule from `/coverage`, check `/publish` for queue status, confirm recipient receives email from `noreply@mail.teamwise.work`.
2. **Wire GitHub → Vercel auto-deploy** (optional) — connect `byonk19-svg/rt-scheduler` repo in Vercel dashboard under Git Integration so pushes trigger builds automatically.
3. **Production UAT for the newer manager workflows** — verify `/availability`, `/coverage`, `/team`, `/approvals`, `/preliminary`, and `/publish` together against a real cycle before broader visual/branding work.
