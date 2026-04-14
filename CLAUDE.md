# Teamwise Scheduler

Updated: 2026-04-14 (session 60)

## Handoff Snapshot

### Current Truth

- Production is live on `https://www.teamwise.work`.
- The working inbound availability webhook URL is:
  - `https://www.teamwise.work/api/inbound/availability-email`
- `mail.teamwise.work` receiving is verified in Resend, and the webhook has now delivered a real `email.received` event successfully.
- Availability intake currently supports:
  - inbound email webhook
  - manager-created manual intake from pasted text
  - uploaded form image/PDF on `/availability`
- Uploaded images can OCR through the OpenAI Responses API when `OPENAI_API_KEY` is configured. PDFs now try direct PDF extraction first, then render pages to images and retry OCR when direct extraction returns no text using stronger preprocessing and fixed-form-like region prompts.
- The production pipeline is now instrumented enough to distinguish delivery failures, render failures, and OCR failures in `availability_email_intake_items.ocr_error`.
- Replaying the same Resend inbound event does **not** reliably create a fresh processed intake row every time. Use `created_at` on the newest intake item rows to confirm whether a replay actually exercised the latest production code.
- The real HCA multi-page handwritten scan used in session 60 proved that the end-to-end pipeline works, but generic OCR still fails to recover useful text from that specific document. Treat that as a document-readability ceiling, not a transport bug.
- The latest production pass adds rotated/grayscale/threshold OCR variants plus region-specific prompts for handwritten name/request areas, but the replayed HCA scan still remains unreadable. Assume future progress will require either a truly template-anchored field extractor or a manager rescue workflow.
- Managers can now fix therapist matches inline on the intake card and then apply parsed dates from the same surface.
- Managers must now match both the therapist and the schedule block before `Apply dates` appears on an intake card. This prevents the old dead-end `email_intake_apply_failed` redirect when a therapist was matched but no cycle was attached yet.
- **Schedule layout + role consistency:** `/coverage` now supports both **Grid** and **Roster** layouts. Managers can edit staffing from either layout by clicking a day cell; leads can update staffed cells to **`OC`**, **`LE`**, **`CX`**, or **`CI`** through the shared assignment-status flow. Users can save a default schedule layout (`Grid` or `Roster`) in `/profile`, and compatibility routes (`/schedule`, `/therapist/schedule`) now defer default layout selection to `/coverage` so a saved preference wins unless an explicit `view` query is present.
- **Lead role source of truth:** product behavior now treats `profiles.role = 'lead'` as the source of truth for lead-only UI/actions. The legacy `is_lead_eligible` column is kept in sync to `role`, but Coverage, print/export, profile badges, swap partner filtering, and designated-lead actions should all be reasoned about in terms of `role`, not the legacy flag.
- **Auth entry (`/login`, `/signup`):** `src/lib/auth/login-utils.ts` parses auth errors from top-level query params **or nested inside `redirectTo`** (e.g. `/availability?error=...`), maps friendly copy, and `router.replace` cleans error keys while preserving a sanitized `redirectTo`. Approval/allowlist copy shows as a **warning** banner with optional **Request access** link and dismiss; credential failures stay **destructive**. Successful access **request** redirects to **`/login?status=requested`** with an **info** banner (dismiss + URL strip); signup no longer auto-signs-in before that redirect. **Name roster auto-match:** managers maintain **`employee_roster`** on **`/team`** (single row, **bulk paste**, or ops script). On signup, **`handle_new_user`** matches **normalized full name** to an active roster row; the new profile gets roster **role/settings** immediately (non-pending), the roster row records **`matched_profile_id`**, and signup sends users to **`/login?status=matched`** with a ready-to-sign-in banner. Unmatched signups stay **`profiles.role = null`** pending approval. **Migration:** `20260413123000_add_employee_roster_and_name_match_signup.sql`. **Ops:** `npm run sync:roster` bulk-creates **auth + profiles** from an email list file (separate from **`employee_roster`** name pre-match). **Public homepage (`/`):** therapist-first copy, luminous background utilities (`--home-*`, `.teamwise-home-*`), header **Get started** (`/signup`) + **Sign in**, hero **Sign in** + **Create account** (`/signup`); Vitest contracts in `src/app/page.test.ts` and `src/app/globals.test.ts`. Shared **Input** focus ring uses **`--ring`**; **`:autofill`** + **`-webkit-autofill`** theming lives in `globals.css`.
- Mixed off/work sentences are parsed more accurately than before, but parser changes should continue to be driven by real inbound examples.
- **Accessibility / theming pass (UI review branch):** root layout wraps the app in **`MotionProvider`** (`src/components/motion-provider.tsx`) with Framer **`MotionConfig reducedMotion="user"`** so motion respects **`prefers-reduced-motion`**. Prefer design tokens over raw **`text-white`** / **`bg-white`** / stray **`dark:`** on shared surfaces; destructive actions use **`text-destructive-foreground`**. **`globals.css`:** stronger **`--muted-foreground`**, **`--color-destructive-foreground`** in **`@theme`**, table row hover scoped to **`table:not(.no-row-hover)`**, marketing header + home preview shell reduce **`backdrop-filter`** under **`prefers-reduced-motion: reduce`**. **`/requests/new`** and **`/publish/[id]`** use **`ManagerWorkspaceHeader`**. **`LEAD_ELIGIBLE_BADGE_CLASS`** uses **`--info-*`** tokens (`src/lib/employee-tag-badges.ts`).
- `RESEND_API_KEY` must support receiving APIs, not just sending. A send-only key fails on `/emails/receiving` with `401 restricted_api_key`.

### Local In-Progress Work

- `main` includes the merged email-intake apply gating fix from PR `#27` and the **therapist-first luminous homepage** (replaces the older `codex/therapist-homepage-redesign` intent; that branch may be deleted when convenient).
- `claude/review-ui-flow-7Weav` has the **top nav redesign** (session 55) — sidebar replaced with a fixed horizontal top nav. Needs review and merge to `main` before deploying.

### Where We Want To Go

1. **Coverage grid redesign** — Stitch explorations in session 56 converged on a swimlane grid (therapist rows × date columns) that mirrors the physical paper schedule managers already use. Target aesthetic: mostly white grid, color only for exceptions (FMLA = soft red, missing lead = amber flag, scheduled = small teal dot or plain "1"). When a final Stitch frame is approved, implement it in `src/components/coverage/CalendarGrid.tsx` and `CoverageClientPage.tsx`.
2. Merge `claude/review-ui-flow-7Weav` (top nav) into `main` and deploy to production.
3. Move `Email Intake` higher on `/availability` and make the review/apply workflow more obvious.
4. Keep hardening the intake parser with concrete real-message examples before changing heuristics.
5. Deploy production after significant public-surface changes (`vercel deploy --prod`) so `www.teamwise.work` matches `main`.
6. Keep manual intake first-class even if Resend inbound is healthy. It is the practical fallback path for operations.

### Verification Baseline

- `npm run lint`
- `npm run build`
- `npm run test:unit`
- `npm run test:e2e` when auth/env setup is available
- `vercel deploy --prod --yes` for production shipping

## Latest Updates (2026-04-14, session 60)

- **Inbound handwritten PDF troubleshooting** (`src/lib/openai-ocr.ts`, `src/lib/pdf-render-pages.ts`, `src/app/api/inbound/availability-email/route.ts`, tests):
  - Shipped and production-tested the inbound PDF path through several runtime fixes: worker-free page rendering, `DOMMatrix`/`ImageData`/`Path2D` polyfills, explicit `pdfjs-dist` dependency, and Vercel trace hints for the inbound webhook route.
  - Added persistence of OCR failure reasons to `availability_email_intake_items.ocr_error`, which exposed the real failure progression in production:
    1. missing `pdf.worker.mjs`
    2. missing `DOMMatrix`
    3. missing `pdfjs-dist/package.json`
    4. final state: page rendering works, OCR runs, but all pages still return `No readable scheduling text detected.`
  - Added stronger page-image OCR retries: grayscale, threshold, inverted threshold, and rotation variants, plus candidate scoring and zone-specific prompts for name/request regions.
  - Final live conclusion from the replayed HCA scan: the pipeline now works end-to-end, but that specific 21-page handwritten document remains unreadable to the current OCR approach. Stop debugging delivery/runtime if the latest `ocr_error` is the all-pages-`NO_TEXT` form.
- **Approved next design direction:** move from generic page-level OCR retries to a truly template-aware handwritten zone extractor. Spec saved in `docs/superpowers/specs/2026-04-13-handwritten-pdf-zone-extraction-design.md`; implementation plan saved in `docs/superpowers/plans/2026-04-13-handwritten-pdf-zone-extraction.md`.

## Latest Updates (2026-04-14, session 61)

- **Scanned PDF OCR recovery pass** (`src/lib/openai-ocr.ts`, `src/lib/pdf-render-pages.ts`, tests):
  - Shipped a stronger fallback that generates multiple page-image variants (grayscale, thresholded, inverted, rotated), scores OCR candidates, and adds region-specific prompts for handwritten name and request areas.
  - Production replay evidence for the HCA scan still ends in the explicit all-pages-`NO_TEXT` failure, which means the pipeline is operational but that specific 21-page handwritten document remains unreadable to the current OCR approach.
  - This is now a document-readability problem, not an email/webhook/runtime-packaging problem.
- **Operational conclusion:** do not use repeated Resend replays as the only validation signal; a replay may not create a fresh intake item row. Always confirm a truly new run via the newest `availability_email_intake_items.created_at`.

The session entries below are historical context. They may describe local-only or superseded work and should not override the snapshot above.

## Latest Updates (2026-04-12, session 56)

- **Coverage grid design exploration (Stitch / no code yet)**:
  - Reviewed the physical paper schedule (RT Night Shift, swimlane grid) as the reference mental model for the digital coverage view.
  - Explored redesigns in Stitch iterating toward: therapist name rows × date columns, week-of groupings across the top, daily tally pinned at the bottom — directly mirroring the paper format managers already know.
  - Established visual principle: **color = exception only**. Scheduled cells should be plain (white bg, small teal indicator or "1" in dark gray). Only FMLA (soft red), missing lead (amber), and gaps get color treatment. Full teal cell fills were rejected as too noisy.
  - Target implementation files when design is finalized: `src/components/coverage/CalendarGrid.tsx`, `src/app/coverage/CoverageClientPage.tsx`.
  - No code changes this session — waiting for approved Stitch frame before implementing.

## Latest Updates (2026-04-13, session 57)

- **Roster schedule view shipped in coverage** (`src/app/coverage/CoverageClientPage.tsx`, `src/components/coverage/RosterScheduleView.tsx`, tests):
  - `/coverage` now supports a second **Roster** presentation alongside the existing grid.
  - The roster view is paper-schedule-inspired: therapist rows × date columns, split into week groupings, leads pinned/highlighted, regular staff above PRN, and day/night layouts handled through the existing shift tab.
  - Managers can click roster day cells to open the shared staffing editor; non-manager leads can click staffed roster cells to change assignment status (`OC`, `LE`, `CX`, `CI`) via the same popover flow used elsewhere.
- **Saved schedule layout preference** (`src/app/profile/page.tsx`, `src/app/coverage/page.tsx`, `src/app/schedule/page.tsx`, `src/app/therapist/schedule/page.tsx`, `src/lib/schedule-helpers.ts`, migration `20260413083000_add_default_schedule_view_to_profiles.sql`):
  - Profiles can now save `default_schedule_view` (`week` or `roster`).
  - Compatibility routes no longer force `view=week`; `/coverage` resolves the default layout using profile context when no explicit `view` query is present.
- **Lead semantics hardened** (`src/lib/auth/roles.ts`, coverage/shift-board/profile/schedule mutation files, migration `20260412164000_sync_lead_eligibility_to_role.sql`):
  - Lead-only behavior is now role-driven across the app.
  - Demo seed data no longer marks ordinary therapists as lead-eligible by default.
  - Existing profile rows were synced so therapist-role users (for example Aleyce) stop appearing in lead buckets.
- **Print/export alignment** (`src/components/print-schedule.tsx`, `src/app/globals.css`):
  - Printed completed schedules now better match the paper reference layout: separate day/night sheets, full-time above PRN, and visible lead emphasis in the printed roster.
- **Onboarding + microcopy consistency pass** (`src/app/coverage/CoverageClientPage.tsx`, `src/components/availability/EmailIntakePanel.tsx`, `src/components/availability/TherapistAvailabilityWorkspace.tsx`, `src/app/availability/page.tsx`, `src/app/therapist/availability/page.tsx`):
  - Added a roster-view empty-state onboarding panel in `/coverage` so first-time managers get the same guided next steps in both Grid and Roster layouts.
  - Added explicit Email Intake flow guidance (create intake → match therapist/cycle → apply dates), plus per-card next-step messaging so managers can tell what to do next at a glance.
  - Added therapist-side onboarding reminders clarifying **Save progress** (draft) vs **Submit availability** (official submission), then aligned related feedback toasts to the same concise voice.
- **Verification:** focused Vitest coverage for schedule view routing, roster helpers, and drag-drop lead rules; `npm run lint`; `npm run build`.

## Latest Updates (2026-04-13, session 58)

- **Employee roster + name-based signup auto-link** (`supabase/migrations/20260413123000_add_employee_roster_and_name_match_signup.sql`, `src/app/team/actions.ts`, `src/app/team/page.tsx`, `src/components/team/EmployeeRosterPanel.tsx`, `src/app/signup/page.tsx`, `src/app/login/page.tsx`):
  - New **`employee_roster`** table with manager RLS; **`handle_new_user`** matches **normalized full name** to an active unmatched roster row and provisions **`profiles`** with roster role, shift, employment, weekly cap, and lead eligibility; marks roster row **`matched_profile_id`** / **`matched_at`**.
  - **`/team`**: single-row add + **bulk paste** import (`src/lib/employee-roster-bulk.ts`, `bulkUpsertEmployeeRosterAction`); list shows signed-up vs not.
  - **Signup** calls **`checkNameRosterMatchAction`** after successful **`signUp`** to choose **`/login?status=matched`** vs **`requested`** (banner-only distinction; DB truth is the trigger).
- **Ops script — email list → auth users** (`scripts/sync-team-roster.mjs`, `scripts/lib/parse-roster-line.mjs`, `npm run sync:roster`): service-role bulk create/update **therapist** profiles from a text file (separate workflow from **`employee_roster`** name pre-match).
- **Verification:** `npm run lint` on touched files; `npx tsc --noEmit`; `npx vitest run src/lib/employee-roster-bulk.test.ts src/lib/parse-roster-line.test.ts`.

## Latest Updates (2026-04-12, session 55)

- **Top nav redesign — sidebar replaced with fixed horizontal nav** (`src/components/AppShell.tsx`, `src/components/AppShell.test.ts`):
  - Sidebar removed entirely. All roles now get a **fixed top nav bar** (`h-14`, `bg-sidebar` dark teal) with logo left, nav center, notification bell + user avatar dropdown right.
  - **Manager nav** consolidates 8 flat items into 3 primary sections: **Today** (→ `/dashboard/manager`), **Schedule** (→ `/coverage`), **People** (→ `/team`). A **secondary sub-nav bar** (`h-11`) appears below the primary bar when inside Schedule or People, showing sub-items with an amber underline active indicator.
    - Schedule sub-items: Coverage · Availability · Publish · Approvals
    - People sub-items: Team · Requests (merged from old "Requests" + "User Access Requests")
  - **Staff nav** is a flat horizontal bar: Dashboard · Schedule · Availability · Open shifts. Notifications removed as a nav item (bell icon in top bar is sufficient). "Schedule Preview" (preliminary) removed as a permanent nav item.
  - **User dropdown**: avatar initials button → dropdown with Settings, Therapist view (manager only), Log out.
  - **Mobile**: hamburger in top nav opens the same slide-over drawer; manager sections shown as labeled groups.
  - Main content gets `pt-14` (primary nav only) or `pt-[100px]` (primary + secondary nav) via a wrapper div. Coverage page remains full-bleed horizontally.
  - Exported constants (`APP_SHELL_SIDEBAR_CLASS`, `APP_SHELL_ACTIVE_NAV_CLASS`, `APP_SHELL_PROFILE_CARD_CLASS`) preserved for backwards compatibility. Tests updated: 12 passing.
  - **Verification:** `npx vitest run src/components/AppShell.test.ts`, `npx eslint src/components/AppShell.tsx`
  - Branch: `claude/review-ui-flow-7Weav`
- **UI review / a11y alignment + unit test repair** (`src/app/layout.tsx`, `src/components/motion-provider.tsx`, `src/app/globals.css`, `src/components/ui/{button,badge,input}.tsx`, `src/app/page.tsx`, `src/app/login/page.tsx`, `src/app/signup/page.tsx`, `src/components/AppShell.tsx`, `src/app/publish/[id]/page.tsx`, `src/app/requests/new/page.tsx`, `src/app/shift-board/page.tsx`, `src/components/EmployeeDirectory.tsx`, `src/lib/employee-tag-badges.ts`, Vitest files under `src/app/**` and `src/components/manager/`):
  - Framer Motion respects reduced motion; token cleanup on marketing and staff surfaces; publish detail and staff **My Requests** headers aligned with **`ManagerWorkspaceHeader`**.
  - **Vitest:** full **`npx vitest run`** now **516 passing** after updating copy-based tests (approvals empty state, coverage file-contract strings, pending-setup multiline copy, manager inbox metric typography), **`publish/actions`** admin mock for preliminary snapshot close, **`auth/signout`** route test **`cookies()`** mock, and **`assignment-status`** route test **`createAdminClient`** + RPC row alignment for manager **`cancelled`** notification expectations.
- **Operational docs:** `docs/WORKFLOWS.md` and **`CLAUDE.md`** Key Shared Components / Schedule UX / Navbar sections document manager shell IA (**Today** / **Schedule** / **People**), **`/schedule` → `/coverage`** active-tab contract, and horizontal scroll on the manager secondary nav. Seeded-auth cleanup remains **`npm run cleanup:seed-users`** (see **`docs/ENVIRONMENT_CLEANUP.md`** and prior commit on this branch).
- **Verification:** `npx vitest run` (516 tests), `npm run lint`, `npm run build`.

## Latest Updates (2026-04-12, session 54)

- **Therapist-first luminous homepage on `main`** (`src/app/page.tsx`, `src/app/globals.css`, `src/app/page.test.ts`, `src/app/globals.test.ts`, `DESIGN.md`, `TODOS.md`, `README.md`):
  - Public `/` uses trust-forward RT copy, layered luminous background, glass preview shell, trust bullets, and dual CTAs (header vs hero) per `docs/superpowers/plans/2026-04-11-therapist-homepage-redesign.md`.
  - **Verification:** `npx vitest run src/app/globals.test.ts src/app/page.test.ts`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, pre-push `ci:local:quick`.

## Latest Updates (2026-04-12, session 53)

- **Login + signup UX + auth query helpers** (`src/app/login/page.tsx`, `src/app/signup/page.tsx`, `src/lib/auth/login-utils.ts`, `src/lib/auth/login-utils.test.ts`, `src/components/ui/input.tsx`, `src/app/globals.css`, `src/app/page.tsx`):
  - `extractAuthErrorFromSearchParams` + `sanitizeRedirectTo` + `buildCleanedLoginSearchParams` handle nested errors inside `redirectTo`, strip them from the stored redirect, and keep open-redirect guards.
  - Login banners: severity (warning vs destructive), dismiss (X), caps-lock hint, `redirectTo` after `signInWithPassword`, post-signup **`/login?status=requested`** acknowledgement (info banner + URL cleanup).
  - Signup: **Request access** copy, optional phone, required-field legend + `aria-*` wiring, Vitest coverage for helpers.
  - **Verification:** `npm run lint`, `npx tsc --noEmit`, `npx vitest run src/lib/auth/login-utils.test.ts`

## Latest Updates (2026-04-12, session 52)

- **Email intake apply gating fix merged to `main`** (`src/app/availability/actions.ts`, `src/app/availability/page.tsx`, `src/components/availability/EmailIntakePanel.tsx`, tests):
  - Intake cards now require both a therapist match and a schedule block match before `Apply dates` is shown.
  - Saving intake matches now persists `matched_cycle_id` along with `matched_therapist_id`.
  - The previous dead-end state from `/availability?error=email_intake_apply_failed` was caused by the UI exposing `Apply dates` too early even though the server action correctly required both matches.
  - Added regression coverage for both the action contract and the intake panel gating.
- **Local verification after merge:**
  - Confirmed the broken state is prevented: a parsed intake with therapist matched but no cycle matched shows `Save matches` and `Match schedule block`, not `Apply dates`.
  - Confirmed the happy path works: a fully matched intake redirects to `/availability?success=email_intake_applied`, marks the intake row as `applied`, and writes the expected `availability_overrides` row.

## Latest Updates (2026-04-11, session 50)

- **Coverage mutation trust-boundary hardening** (`src/app/api/schedule/drag-drop/route.ts`, `src/lib/coverage/mutations.ts`, tests):
  - Removed the client-controlled `isPostPublishModification` path from coverage mutations.
  - Post-publish audit logging is now derived server-side from the affected slot state: past dates always audit, and future slots audit when they already have active operational entries.
  - Added route/unit regressions proving callers cannot force or suppress the audit path with request-body flags.
- **Coverage client operational-state sync** (`src/app/coverage/CoverageClientPage.tsx`):
  - Status changes now keep `activeOpCodes` aligned in-memory after successful updates, so follow-up assign/unassign decisions use current operational state without needing a reload.
- **Repo health cleanup** (`src/app/availability/actions.test.ts`, lockfile/docs):
  - Fixed the pre-existing type drift in `actions.test.ts` so `npx tsc --noEmit` is green again.
  - Bumped locked Next.js packages to `16.2.3` after clearing the `npm audit` high-severity Server Components DoS advisory.
- **Verification:** `npx tsc --noEmit`, `npm run build`, `npm audit --omit=dev`, targeted Vitest lanes for availability actions + coverage mutations, Playwright CLI smoke on `/` and `/coverage?shift=day`.

## Latest Updates (2026-04-10, session 48)

- **Design improvement passes** (`/bolder`, `/clarify`, `/colorize`, `/onboard`):
  - **Bold pass:** Home page hero headline scale (`text-[6rem]` on lg), login/signup split layout (`hidden lg:flex` sidebar with `--sidebar` bg), manager dashboard h1 `text-5xl font-bold`, MetricCard values `text-4xl font-bold`
  - **Clarify pass:** Toast copy (`"Could not"` → `"Couldn't"`, `"Please try again."` → `"Try again."`), Approvals CTAs, Publish actions (`"Unpublish (keep shifts)"` → `"Take offline"`, `"Start over"` → `"Clear & restart"`), availability hint text
  - **Colorize pass:** CalendarGrid day/night card tint opacities strengthened; Live/Draft pill badges on coverage header; TeamDirectory shift-group tinted headers + colored dots in profile cards (info/teal = day, warning/amber = night)
  - **Onboard pass:** Dashboard replaces 0%/0% ScheduleProgress with "No draft started yet" card when `dayShiftsTotal === 0 && nightShiftsTotal === 0`; coverage `noCycleSelected` redesigned with icon + numbered 3-step flow; `showEmptyDraftState` redesigned with icon + dual Auto-draft / Assign-manually CTAs
- **Verification:** `npx tsc --noEmit`, live browser screenshots via preview MCP

## Latest Updates (2026-04-10, session 47)

- **Availability intake now runs through inbound email only** (`src/app/api/inbound/availability-email/route.ts`, `src/components/availability/EmailIntakePanel.tsx`):
  - Request emails are parsed into intake items and can auto-apply when confidence is high.
  - Uploaded images and PDFs are parsed through the OpenAI Responses API when `OPENAI_API_KEY` is configured.
- **Inbound email channel is configured but still vendor-blocked**:
  - `mail.teamwise.work` receiving is verified in Resend, the webhook is enabled, and production middleware now leaves `POST /api/inbound/availability-email` public so signature-verified provider calls are not redirected to `/login`.
  - The original `RESEND_API_KEY` was send-only; intake processing requires a key that can call `/emails/receiving`.
  - Even after swapping in a receiving-capable key and redeploying production, Resend still returned zero inbound emails during this session, so delivery must be resolved with Resend support.
- **Verification:** `supabase db push`, `npm run test:unit` (25 passing across intake/OCR/proxy suites), `npm run lint`, `npm run build`, `vercel deploy --prod --yes`

## Latest Updates (2026-04-10, session 46)

- **End-to-end workflow stabilization + auth signout hardening** (`e2e/*.spec.ts`, `e2e/helpers/auth.ts`, `src/app/auth/signout/route.ts`, `playwright.config.ts`):
  - Full Playwright verification now passes with the real manager auth flow enabled: **42 passed**.
  - `authenticated-flow.spec.ts` now uses the current login labels and verifies logout through `/auth/signout?next=/login`.
  - `/auth/signout` explicitly clears Supabase auth cookies on redirect responses so browser-driven logout behaves consistently in E2E.
  - Playwright default workers reduced to **2** via `PLAYWRIGHT_WORKERS`-aware config to avoid local `next dev` saturation on this machine.
- **Coverage + planner E2E tightening** (`CoverageClientPage.tsx`, `CalendarGrid.tsx`, `AssignmentStatusPopover.tsx`, coverage/planner/publish/team trust E2E specs):
  - Fixed the real coverage click-target bug where assignment-status chips could be obscured by the day-cell overlay.
  - Coverage now surfaces real backend assignment errors (for example `PRN not offered for this date`) instead of collapsing them into a generic failure message.
  - Replaced brittle toast/URL assertions across the suite with persisted-state checks where the UI intentionally redirects or updates asynchronously.
- **Verification:** `npm run test:e2e` (**42 passed**), `npm run lint`, `npx tsc --noEmit`

## Session History

Sessions 11–47 archived to `docs/SESSION_HISTORY.md`.

## Data model gotcha — publish history ≠ schedule cycles

- `publish_events` (shown at `/publish`) and `schedule_cycles` (shown as cycle pills on `/coverage`) are **separate tables**. Deleting a publish history record does NOT remove the cycle from the coverage selector.
- Preferred lifecycle action: **archive** old non-live cycles from `/publish`. That sets `schedule_cycles.archived_at` and removes the cycle from Coverage, Availability, therapist availability, and dashboard cycle pickers without deleting operational records.
- Unpublished draft cycles can still be hard-deleted through the delete-cycle flow when you explicitly want to remove the row and its dependents.
- `schedule_cycles` `ON DELETE CASCADE` covers: `shifts`, `availability_overrides`, `therapist_availability_submissions`, `availability_requests`, `publish_events`, `preliminary_snapshots`. One DB call cleans up everything when hard-delete is used.

## What This App Is

Teamwise is a respiratory therapy scheduling app replacing paper workflows.
Core domains: coverage planning, cycles, availability requests, shift board, approvals, publish flow, team management.

## Current Stack

- Next.js 16.2.3 (App Router) + TypeScript
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
- full `npx vitest run` pass (**516 tests**, session 55)
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
- `/schedule` compatibility redirect entrypoint -> `/coverage` (all roles)
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

- `src/components/ui/page-header.tsx` — `<PageHeader>` is DEPRECATED for new pages; only remaining on legacy pages not yet migrated
- `src/components/motion-provider.tsx` — client root wrapper: Framer **`MotionConfig reducedMotion="user"`** (respects **`prefers-reduced-motion`**); used from `src/app/layout.tsx`
- `src/components/manager/ManagerWorkspaceHeader.tsx` — canonical manager-style route header for `/availability`, `/coverage`, `/team`, `/approvals`, `/publish/[id]`, and staff **`/requests/new`**
- `src/components/availability/AvailabilityOverviewHeader.tsx` — manager-specific availability wrapper around the shared manager workspace header
- `src/components/ui/skeleton.tsx` — `<Skeleton>`, `<SkeletonLine>`, `<SkeletonCard>`, `<SkeletonListItem>` loading states
- `src/components/NotificationBell.tsx` — real-time bell with Supabase subscription; variants: `default` | `staff`
- `src/components/AppShell.tsx` — nav shell; manager nav is built from `buildManagerSections()` (`Today`, `Schedule`, `People`) and staff nav still uses `STAFF_NAV_ITEMS`. Keep `/schedule` treated as a coverage alias in the manager `Schedule` section, and keep the fixed secondary nav horizontally scrollable for mobile widths.
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

## Tooling Gotchas

- **`formatCycleDate` produces no year:** Uses `{ month: 'short', day: 'numeric' }` → `'Apr 13'` not `'Apr 13, 2026'`. Test fixtures asserting on date range strings must omit the year (e.g. `'Mar 17 – Apr 13'`).
- **Browser verification on auth routes:** All app routes require login. Chrome DevTools MCP always redirects to `/login` — browser verification via screenshot is not possible without credentials. Confirm changes via `tsc`, `vitest`, and code review only.
- **framer-motion `ease`:** `ease: 'easeOut'` fails `tsc` — the `Easing` type requires specific literals. Omit `ease` entirely to use framer-motion's safe default.
- **Auto-draft algorithm lives in `src/lib/coverage/generate-draft.ts`:** `generateDraftForCycle(input: GenerateDraftInput): GenerateDraftResult` is a pure function. `generateDraftScheduleAction` in `src/app/schedule/actions/draft-actions.ts` is a thin wrapper that loads DB data, calls it, then saves results. Dry-run and preview features can call `generateDraftForCycle` directly without a server action.
- **`src/app/schedule/actions.ts` is a barrel:** Real logic is in `src/app/schedule/actions/` sub-modules (`helpers.ts`, `cycle-actions.ts`, `publish-actions.ts`, `shift-actions.ts`, `draft-actions.ts`, `preliminary-actions.ts`). Each action file has `'use server'`; `helpers.ts` and `index.ts` do not.
- **FK column names in schedule tables:** `work_patterns` and `availability_overrides` use `therapist_id` (not `user_id`) as the FK column — match what `generateDraftScheduleAction` uses when writing new queries against those tables.
- **CalendarGrid has no React import:** `src/components/coverage/CalendarGrid.tsx` uses `'use client'` but has no `import ... from 'react'`. Add hooks as a fresh single import statement — don't look for an existing one to amend.
- **`CoverageClientPage.tsx` lucide imports are minimal:** Default set is `ChevronRight, Printer, Send, Sparkles`. Adding any new icon (e.g. `CalendarDays`) requires updating that import line explicitly.
- **`days` array in CalendarGrid is always populated:** Entries exist for every day in the cycle date range even before any shifts are drafted. `days[0]` reliably selects the first day and opens the shift editor — safe to use as a "Assign manually" CTA target on the `showEmptyDraftState` panel.
- **`@/components/ui/progress` not installed by default:** Run `npx shadcn@latest add progress` before importing the Progress primitive. Not in the original shadcn set for this repo (added session 21).
- **Preview MCP on Windows:** `preview_start` server tracking doesn't persist between tool calls. Chrome MCP also returns "Permission denied" on localhost. For local visual verification, use saved screenshots in `artifacts/screen-capture/latest/`. To confirm server health use `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000`.
- **Zombie dev server on Windows:** Stale `next dev` processes can hold port 3000 silently (visible as ~994MB node.exe in tasklist). Find the PID with `netstat -ano | grep ":3000" | grep LISTENING` then kill with `taskkill //PID <pid> //F`. Follow with `rm -rf .next` before rebuilding.
- **"Supabase lookup failed" in build output is not an error:** During `npm run build`, Next.js tries to statically pre-render all routes; auth routes that call `cookies()` bail out and log this message. All routes correctly render as `ƒ` (dynamic). Safe to ignore.
- **Responsive stat grids:** Always `grid-cols-2 lg:grid-cols-4` — never bare `grid-cols-4` which clips on narrower viewports.
- **Repo-local Next build lock on Windows:** if `npm run build` throws `EPERM` under `.next`, check for a running `next dev` process from this repo and stop it before rebuilding.
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

`/coverage` (`src/app/coverage/page.tsx` server entry + `src/app/coverage/CoverageClientPage.tsx` client logic + `src/components/coverage/`):

- Full-width 7-column day calendar; centered shift editor dialog + inline status popovers
- Uses the shared manager workspace header pattern at the top of the page
- Clicking a day opens the editor dialog
- Clicking an assigned therapist opens the status popover without opening the editor
- Day/Night shift tabs; therapist assignment rows live in the dialog
- **Default shift tab:** without `?shift=`, the selected tab follows signed-in `profiles.shift_type` (night → Night, else Day). **`?shift=day|night`** overrides; toggling updates the URL (`shift` query) while preserving other params. Helpers: `src/lib/coverage/coverage-shift-tab.ts`
- Optimistic status updates with rollback on save failure
- Lead/staff assignment actions still use current Teamwise mutations and rules
- Coverage E2E now validates dialog/popover workflow instead of the removed drawer
- Dialog density is controlled centrally in `src/components/coverage/shift-editor-dialog-layout.ts`
- Shift editor header includes compact coverage progress (`X / 5 covered`) with threshold colors (`<3` error, `3-5` success, `>5` warning); therapist rows show non-FT employment badges (`[PRN]`, `[PT]`); and editable shifts with no lead show an amber lead-required banner.
- **Constraint warning gotcha:** `constraintBlockedSlotKeys` in `CoverageClientPage.tsx` is built from unfilled shift rows (`user_id IS NULL`). After the loop, any slot key that also has an assigned therapist is deleted from the set — so "No eligible therapists (constraints)" only appears for truly empty slots; manually assigned therapists suppress it.
- **Day-card warning treatment:** `hasCoverageIssue` in `CalendarGrid.tsx` is `day.constraintBlocked` only — **not** `missingLead || constraintBlocked`. Missing-lead-only days show their warning exclusively through the lead sub-section widget inside the card (which uses `day.leadShift` directly). Do not restore `missingLead` to `hasCoverageIssue` — it caused the entire 6-week calendar to look permanently alarmed in the demo data.
- **Coverage empty states:** Two distinct flags in `CoverageClientPage.tsx` (around line 703): `noCycleSelected` (no cycle row active) and `showEmptyDraftState` (`activeCycleId` set but `selectedCycleHasShiftRows` is false). They render separate `<section>` panels before `<CalendarGrid>`. Edit those blocks to change empty state copy or layout.

## Team UX

`/team` is now the canonical manager roster-management surface.

- Clicking a team member card opens a quick-edit modal on the same page
- Sections are grouped by: managers, day shift (Lead Therapists, Therapists), night shift (Lead Therapists, Therapists), inactive
- Quick edit is meant for roster/access fields: name, app role, shift type, employment type, FMLA, FMLA return date, active/inactive, recurring **work pattern** (works/offs DOW, hard/soft works mode, weekend rotation + anchor) for therapist/lead rows
- **Employee roster (signup pre-match):** below the directory, **`EmployeeRosterPanel`** (`src/components/team/EmployeeRosterPanel.tsx`) edits **`employee_roster`** — preload **full names** (and optional role/shift/employment via bulk paste) so first-time signup can auto-link by **name** (see **Auth entry** above). Do not confuse this with **`npm run sync:roster`**, which is an email-list **auth/profile** sync for ops.
- `Lead Therapist` is the visible manager-facing role label; the separate `Coverage lead` control was removed from `/team`
- The page now shares the quieter manager workspace header pattern and lighter card framing used on `/availability` and `/approvals`
- `/directory` should be treated as a compatibility redirect only, not a feature surface

## Schedule UX

`/coverage` is the shared schedule workspace for all roles; actions and edits are permission-gated.
`/schedule` is retained as a compatibility route and redirects into `/coverage`.
The manager shell must still show the `Schedule` primary section as active on `/schedule`, with the `Coverage` secondary tab highlighted because that route is a legacy alias into the same workflow.

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
- Real-time updates via Supabase postgres_changes subscription
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

## Design System

Always read `DESIGN.md` before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match `DESIGN.md`.
