# Teamwise Scheduler — Session History

Sessions 11–38 predate this archive file and were not captured here.

---

## Session 39 (2026-04-09)

- **Schedule / Coverage (`/coverage`) — default shift tab + URL sync** (`page.tsx`, `coverage-shift-tab.ts`, tests):
  - Default **Day Shift** / **Night Shift** tab from signed-in `profiles.shift_type` when `?shift=` is absent; **`?shift=day|night`** overrides (case-insensitive).
  - **Toggle** calls **`router.replace`** so the query string stays aligned; **cycle pills** and **View published schedule** preserve the active shift.
  - Helpers live in **`src/lib/coverage/coverage-shift-tab.ts`** (parse, profile default, query value); **`/schedule`** redirect already passes query through to `/coverage`.
- **Schedule screen polish (prior pass, same files)** (`CalendarGrid.tsx`, `page.tsx`): **Schedule cycle** label above pills; stronger **coverage** count pill; softer **lead** block; trimmed duplicate live copy near title; **View published schedule** link with chevron + focus/hover.
- **Team (`/team`) — recurring pattern in quick edit** (`TeamDirectory.tsx`, `team-quick-edit.ts`, `team/actions.ts`, `page.tsx`, tests):
  - Quick-edit modal can capture **work pattern** fields (works/offs DOW, mode, weekend rotation/anchor) for therapist/lead rows.
- **Lib — copy availability between cycles (pure)** (`copy-cycle-availability.ts`, tests): **`shiftOverridesToCycle`** maps override dates from a source cycle into a target window (gap from cycle starts); supports future copy-availability UX.
- **Verification:** `npx tsc --noEmit`, ESLint on touched files, `npx vitest run` (**439 tests** passing, including **`copy-cycle-availability.test.ts`**).

---

## Session 40 (2026-04-08)

- **Team (`/team`) — Scheduling Constraints UI** (`TeamDirectory.tsx`, `team-quick-edit.ts`, `team/actions.ts`, `page.tsx`, tests):
  - **"Days they never work"** (always-visible red pills in quick edit) — populates `offs_dow` on `work_patterns`; shows for all therapist/lead rows regardless of pattern toggle.
  - **"Has a fixed weekly pattern" toggle** — reveals blue work-day pills (`works_dow`), a hard/soft strictness radio, and weekend rotation + anchor-date controls; hidden inputs bridge pill state to server action form post.
  - Upserts `work_patterns` row on save (one per therapist); deletes the row when the toggle is off.
  - **Rotating shift limitation (documented):** Patterns like "4 on, 1 off, 2 on, 7 off" (14-day rotation) cannot be expressed in `work_patterns` — only weekly recurring patterns are supported. Recommended workflow for rotating-schedule workers: submit per-cycle availability + use copy-from-last-block.
- **Availability (`/availability`) — copy manager overrides from the last block** (`src/app/availability/actions.ts`, `page.tsx`, `ManagerSchedulingInputs.tsx`, tests):
  - Managers now get a **Copy from last block** action in planner controls for the selected therapist and cycle.
  - The server action finds the most recent other cycle with manager-entered overrides for that therapist, shifts dates by the cycle-start gap, and upserts only dates that still land inside the target cycle.
  - Existing target-cycle manager overrides are preserved; conflicting shifted dates are skipped instead of overwritten.
  - Toast feedback covers: **copied N dates**, **no previous block found**, **nothing new to copy**, and **copy failed**.
- **Lib — cycle copy helper** (`src/lib/copy-cycle-availability.ts`, tests):
  - `shiftOverridesToCycle` is the pure helper for date shifting, target-window filtering, and conflict skipping.
- **Verification:** `npx tsc --noEmit`, `npx vitest run` (**444 tests** passing).

---

## Session 41 (2026-04-09)

- **Publish flow — immediate email processing, no deploy-blocking Vercel cron requirement** (`src/app/schedule/actions/publish-actions.ts`, `src/lib/publish-events.ts`, `src/app/api/publish/process/route.ts`, tests):
  - Publishing a cycle still writes `publish_events` and queues `notification_outbox` rows, but now the publish action immediately processes the queued emails in the same flow.
  - `/api/publish/process` now reuses the same shared processor as the publish action for retry/manual processing instead of owning a separate Resend loop.
  - `vercel.json` cron config was removed, so Hobby-plan production deploys are no longer blocked by the old every-minute cron expression.
- **Published schedule operations — clearer live status visibility** (`CoverageClientPage.tsx`, assignment-status route, published-schedule notifications, tests):
  - Shared `/coverage` live-schedule UI now explicitly calls out operational status badges on the published schedule: **On Call**, **Leave Early**, **Cancelled**, **Call In**.
  - Published assignment-status changes now trigger `published_schedule_changed` notifications for the affected therapist.
  - Staff still need to refresh or reopen the schedule to see a manager's latest status change; realtime cross-client syncing is intentionally not implemented yet.
- **Verification:** `npm run lint`, `npx vitest run` (**453 tests** passing), `npm run build`.

---

## Session 42 (2026-04-09)

- **Public auth + pending access onboarding** (`src/app/page.tsx`, `src/app/login/page.tsx`, `src/app/signup/page.tsx`, `src/app/reset-password/page.tsx`, `src/app/pending-setup/page.tsx`, tests):
  - Homepage is now homepage-first with practical copy and prominent **Sign in** / **Create account** CTAs.
  - Dedicated auth routes now own their own copy and UX: sign-in, create account, forgot-password email request, and waiting-for-approval.
  - Public self-signup no longer asks for role; accounts are created as pending and redirected to `/pending-setup` after immediate sign-in.
- **Manager access approvals under Requests** (`src/app/requests/page.tsx`, `src/app/requests/user-access/*`, `src/components/AppShell.tsx`, `src/proxy.ts`, tests):
  - Added **User Access Requests** manager flow under `/requests/user-access` with desktop table + mobile cards.
  - Approve action requires role selection (**Therapist** or **Lead**) before activation; decline deletes pending account via admin API.
  - Manager nav now includes **Requests** and **User Access Requests** with pending-count badges.
- **Schema/auth hook support for pending users** (`supabase/migrations/20260409124000_pending_signup_access_requests.sql`, `20260409145500_fix_custom_access_token_hook_for_pending_users.sql`):
  - `profiles.role` now supports null (pending users).
  - `handle_new_user` stores pending signups with `role = null` when role is not explicitly provisioned.
  - `custom_access_token_hook` now omits `user_role` claim when role is null so pending users can authenticate cleanly.
- **Verification:** `npx tsc --noEmit`, `npm run lint`, `npx vitest run src/app/page.test.ts src/app/requests/user-access/actions.test.ts src/components/manager/ManagerTriageDashboard.test.ts`, `npx playwright test e2e/public-pages.spec.ts`.

---

## Session 43 (2026-04-09)

- **Home page + pending-setup polish** (`src/app/page.tsx`, `src/app/pending-setup/page.tsx`, `public/images/app-preview.png`, tests):
  - Home page now shows a faded coverage calendar screenshot below the CTAs + a one-line approval note ("Your manager will need to approve your account before your first sign-in.").
  - `next/image` with `fill` + `unoptimized` used for the preview; container is `h-[360px] rounded-2xl` with a `h-2/3` gradient fade to `var(--background)`.
  - Pending-setup body copy updated to "No action needed on your end. Sit tight while your manager reviews your account…" (h1 and sign-out button unchanged).
- **Spec/plan docs added:** `docs/superpowers/specs/2026-04-09-home-and-pending-setup-design.md`, `docs/superpowers/plans/2026-04-09-home-and-pending-setup.md`.

---

## Session 45 (2026-04-09)

- **Manager Inbox dashboard layout rebuild** (`src/components/manager/ManagerTriageDashboard.tsx`, `src/app/dashboard/manager/page.tsx`, `src/components/manager/ManagerTriageDashboard.test.ts`):
  - Two-column layout `xl:grid-cols-[2fr_1fr]`: left column (3 metric cards → ScheduleProgress → Coverage Risks → Recent Activity), sticky right sidebar (Manager Inbox + Upcoming Days).
  - 4th metric card "Publish Readiness" removed — redundant with `ScheduleProgress` overall %.
  - `activeCycleDateRange` computed on the manager page from the active cycle (`formatCycleDate(start) – formatCycleDate(end)`, year-free) and passed as a header pill next to the risk/pending/shift badges.
- **Screenshots:** `npm run screens:all` (dev server on `127.0.0.1:3000` + `.env.local` with `NEXT_PUBLIC_SUPABASE_*`) writes PNGs under `artifacts/screen-capture/<iso-timestamp>/` and mirrors the same set to `artifacts/screen-capture/latest`.
- **Plan doc:** `docs/superpowers/plans/2026-04-09-manager-dashboard-layout-rebuild.md`
- **Verification:** `npx vitest run src/components/manager/ManagerTriageDashboard.test.ts`, `npx tsc --noEmit`, `npm run lint`

---

## Session 46 (2026-04-10)

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

---

## Session 47 (2026-04-10)

- **Availability intake now has a manager-controlled fallback path** (`src/app/availability/actions.ts`, `src/app/availability/page.tsx`, `src/components/availability/EmailIntakePanel.tsx`, `supabase/migrations/20260410162000_allow_manual_email_intake_provider.sql`):
  - `/availability` now lets managers create intake items directly by choosing therapist + cycle, pasting request text, and/or uploading a request-form image/PDF.
  - The manual form stores rows in the same `availability_email_intakes` / `availability_email_attachments` tables as the webhook path, so review/apply behavior stays identical across channels.
  - Uploaded images can be OCR'd through the OpenAI Responses API when `OPENAI_API_KEY` is configured; PDFs are stored for review but still require manual reading.
- **Inbound email channel is configured but still vendor-blocked**:
  - `mail.teamwise.work` receiving is verified in Resend, the webhook is enabled, and production middleware now leaves `POST /api/inbound/availability-email` public so signature-verified provider calls are not redirected to `/login`.
  - The original `RESEND_API_KEY` was send-only; intake processing requires a key that can call `/emails/receiving`.
  - Even after swapping in a receiving-capable key and redeploying production, Resend still returned zero inbound emails during this session, so the manual intake form is the operational path while inbound delivery is investigated with Resend.
- **Verification:** `supabase db push`, `npm run test:unit` (25 passing across intake/OCR/proxy suites), `npm run lint`, `npm run build`, `vercel deploy --prod --yes`

---

## Session 48 (2026-04-10)

- **Design improvement passes** (`/bolder`, `/clarify`, `/colorize`, `/onboard`):
  - **Bold pass:** Home page hero headline scale (`text-[6rem]` on lg), login/signup split layout (`hidden lg:flex` sidebar with `--sidebar` bg), manager dashboard h1 `text-5xl font-bold`, MetricCard values `text-4xl font-bold`
  - **Clarify pass:** Toast copy (`"Could not"` → `"Couldn't"`, `"Please try again."` → `"Try again."`), Approvals CTAs, Publish actions (`"Unpublish (keep shifts)"` → `"Take offline"`, `"Start over"` → `"Clear & restart"`), availability hint text
  - **Colorize pass:** CalendarGrid day/night card tint opacities strengthened; Live/Draft pill badges on coverage header; TeamDirectory shift-group tinted headers + colored dots in profile cards (info/teal = day, warning/amber = night)
  - **Onboard pass:** Dashboard replaces 0%/0% ScheduleProgress with "No draft started yet" card when `dayShiftsTotal === 0 && nightShiftsTotal === 0`; coverage `noCycleSelected` redesigned with icon + numbered 3-step flow; `showEmptyDraftState` redesigned with icon + dual Auto-draft / Assign-manually CTAs
- **Verification:** `npx tsc --noEmit`, live browser screenshots via preview MCP
