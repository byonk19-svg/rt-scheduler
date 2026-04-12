# Teamwise Scheduler

Updated: 2026-04-12 (session 51)

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
- Uploaded images can OCR through the OpenAI Responses API when `OPENAI_API_KEY` is configured. PDFs are stored for review but are not OCR'd automatically yet.
- Managers can now fix therapist matches inline on the intake card and then apply parsed dates from the same surface.
- Mixed off/work sentences are parsed more accurately than before, but parser changes should continue to be driven by real inbound examples.
- `RESEND_API_KEY` must support receiving APIs, not just sending. A send-only key fails on `/emails/receiving` with `401 restricted_api_key`.

### Local In-Progress Work

No intentional local-only product changes are pending. The current tracked changes in this session are intended to be committed truth.

### Where We Want To Go

1. Move `Email Intake` higher on `/availability` and make the review/apply workflow more obvious.
2. Keep hardening the intake parser with concrete real-message examples before changing heuristics.
3. Review and intentionally commit the current local design-pass files instead of leaving them as ambiguous working-tree state.
4. Keep manual intake first-class even if Resend inbound is healthy. It is the practical fallback path for operations.

### Verification Baseline

- `npm run lint`
- `npm run build`
- `npm run test:unit`
- `npm run test:e2e` when auth/env setup is available
- `vercel deploy --prod --yes` for production shipping

The session entries below are historical context. They may describe local-only or superseded work and should not override the snapshot above.

## Latest Updates (2026-04-12, session 51)

- **CLAUDE.md rework** (`docs/SESSION_HISTORY.md`):
  - Created `docs/SESSION_HISTORY.md` and archived sessions 39–49 there.
  - Trimmed inline session history to the two most-recent sessions only.
  - Fixed mojibake encoding (`â€"` / `â€™`) in archived entries.
  - Updated "Next High-Value Priorities" — production is already live; removed stale deploy item.
  - Updated header date.

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

## Session History

Sessions 11–49 archived to `docs/SESSION_HISTORY.md`.

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
- [ ] **#8** Coverage empty state: guided first-time manager flow

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

Current session checks green:

- `npx tsc --noEmit` pass
- `npm run build` pass
- `npm audit --omit=dev` pass
- targeted `npx vitest run src/app/availability/actions.test.ts src/app/api/schedule/drag-drop/route.test.ts src/lib/coverage/mutations.test.ts` pass
- targeted `npx eslint` on touched files pass
- Playwright CLI smoke pass on `/` and `/coverage?shift=day` (redirect to login as expected, no console warnings)

Broader historical baseline:

- `npm run test:e2e` pass (**42 passed**) with default Playwright workers set to `2`
- Full `npx vitest run` may require `.env.local` (for example `assignment-status` route test uses admin client env vars)
- Auth E2E happy path requires `.env.local` (or shell env) entries for `E2E_USER_EMAIL` and `E2E_USER_PASSWORD`

CI gates: format check → lint → tsc → build → Playwright E2E

E2E specs:

- `e2e/coverage-overlay.spec.ts` (14 tests)
- `e2e/directory-date-override.spec.ts` (12 tests)
- `e2e/availability-override.spec.ts` (2 tests)
- `e2e/publish-process-api.spec.ts` (2 tests)
- `e2e/auth-redirect.spec.ts`, `e2e/authenticated-flow.spec.ts`, `e2e/public-pages.spec.ts`

## Primary Routes

- `/` public marketing
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
- `src/components/manager/ManagerWorkspaceHeader.tsx` — canonical manager route header for `/availability`, `/coverage`, `/team`, and `/approvals`
- `src/components/availability/AvailabilityOverviewHeader.tsx` — manager-specific availability wrapper around the shared manager workspace header
- `src/components/ui/skeleton.tsx` — `<Skeleton>`, `<SkeletonLine>`, `<SkeletonCard>`, `<SkeletonListItem>` loading states
- `src/components/NotificationBell.tsx` — real-time bell with Supabase subscription; variants: `default` | `staff`
- `src/components/AppShell.tsx` — nav shell; add routes to `MANAGER_NAV` / `STAFF_NAV` arrays
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

Auto-generate (`src/lib/schedule-helpers.ts`):

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
- **Constraint warning gotcha:** `constraintBlockedSlotKeys` in `CoverageClientPage.tsx` is built from unfilled shift rows (`user_id IS NULL`). After the loop, any slot key that also has an assigned therapist is deleted from the set — so "No eligible therapists (constraints)" only appears for truly empty slots; manually assigned therapists suppress it.
- **Day-card warning treatment:** `hasCoverageIssue` in `CalendarGrid.tsx` is `day.constraintBlocked` only — **not** `missingLead || constraintBlocked`. Missing-lead-only days show their warning exclusively through the lead sub-section widget inside the card (which uses `day.leadShift` directly). Do not restore `missingLead` to `hasCoverageIssue` — it caused the entire 6-week calendar to look permanently alarmed in the demo data.
- **Coverage empty states:** Two distinct flags in `CoverageClientPage.tsx` (around line 703): `noCycleSelected` (no cycle row active) and `showEmptyDraftState` (`activeCycleId` set but `selectedCycleHasShiftRows` is false). They render separate `<section>` panels before `<CalendarGrid>`. Edit those blocks to change empty state copy or layout.

## Team UX

`/team` is now the canonical manager roster-management surface.

- Clicking a team member card opens a quick-edit modal on the same page
- Sections are grouped by: managers, day shift (Lead Therapists, Therapists), night shift (Lead Therapists, Therapists), inactive
- Quick edit is meant for roster/access fields: name, app role, shift type, employment type, FMLA, FMLA return date, active/inactive, recurring **work pattern** (works/offs DOW, hard/soft works mode, weekend rotation + anchor) for therapist/lead rows
- `Lead Therapist` is the visible manager-facing role label; the separate `Coverage lead` control was removed from `/team`
- The page now shares the quieter manager workspace header pattern and lighter card framing used on `/availability` and `/approvals`
- `/directory` should be treated as a compatibility redirect only, not a feature surface

## Schedule UX

`/coverage` is the shared schedule workspace for all roles; actions and edits are permission-gated.
`/schedule` is retained as a compatibility route and redirects into `/coverage`.

## Navbar / Branding

- Logo: amber icon (`var(--attention)`) + Teamwise wordmark
- Active nav pill: `var(--primary)` blue
- User avatar: `var(--attention)` amber
- Manager badge: `bg-[var(--warning-subtle)] text-[var(--warning-text)] border-[var(--warning-border)]`
- App shell header `z-30`; coverage slide-over `z-50`
- Manager nav order: Inbox -> Schedule -> Availability -> Requests -> User Access Requests -> Team -> Approvals -> Publish History

## Assignment Status

Backend values: `scheduled`, `call_in`, `cancelled`, `on_call`, `left_early`

Shift fields: `assignment_status`, `status_note`, `left_early_time`, `status_updated_at`, `status_updated_by`

Write path: `POST /api/schedule/assignment-status` with optimistic local update + rollback.

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
- `RESEND_API_KEY` must support receiving APIs, not just sending. A send-only key fails on `/emails/receiving` with `401 restricted_api_key`.
- If inbound email still does not appear in Resend after receiving is verified, use the manual intake form on `/availability` to keep validating the scheduling workflow.

## Data Model Snapshot

Core tables:

- `profiles` — `full_name`, `email`, `phone_number`, `role` (nullable for pending users), `shift_type`, `employment_type`, `max_work_days_per_week`, `is_lead_eligible`, `on_fmla`, `is_active`, `default_calendar_view`, `default_landing_page`, `site_id`
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

## Next High-Value Priorities

1. **Verify end-to-end publish email flow in production** — publish a schedule from `/coverage`, check `/publish` for queue status, confirm recipient receives email from `noreply@mail.teamwise.work`.
2. **Production UAT for the newer manager workflows** — verify `/availability`, `/coverage`, `/team`, `/approvals`, `/preliminary`, and `/publish` together against a real cycle before broader visual/branding work.
3. **Wire GitHub → Vercel auto-deploy** (optional) — connect `byonk19-svg/rt-scheduler` repo in Vercel dashboard under Git Integration so pushes trigger builds automatically.
4. **Move Email Intake higher on `/availability`** — make the review/apply workflow more visually prominent.
5. **Harden the intake parser** with concrete real-message examples before changing heuristics.
