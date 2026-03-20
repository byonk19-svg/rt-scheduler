# Teamwise Scheduler

Updated: 2026-03-20 (session 8)

## Latest Updates (2026-03-20)

- **Manager-facing routes now share one quieter workspace header language**:
  - New shared component:
    - `src/components/manager/ManagerWorkspaceHeader.tsx`
  - Manager pages now use the same top-level rhythm instead of ad hoc chip-heavy headers:
    - `/availability`
    - `/coverage`
    - `/team`
    - `/approvals`
  - The pattern is:
    - compact title + small supporting subtitle
    - restrained summary text row
    - actions grouped at the right
  - This is the canonical manager page-header direction going forward.

- **`/availability` was rebuilt into a cleaner manager workflow**:
  - Manager sections now read in order:
    - `Plan staffing`
    - `Check responses`
    - `Review requests`
  - New manager-specific UI pieces:
    - `src/components/availability/AvailabilityOverviewHeader.tsx`
    - `src/components/availability/AvailabilityStatusSummary.tsx`
  - `Check responses` is now triage-first:
    - `Not submitted yet` appears first and stays expanded
    - `Submitted` is summarized by default and expandable
  - The old manager-only `Add therapist-reported availability` form was removed from `/availability`
    - managers should use `Staff Scheduling Inputs`
    - therapists still use their own self-service availability form

- **Shell/sidebar visual weight was intentionally reduced**:
  - `src/components/AppShell.tsx` now uses a calmer active-nav treatment, lighter hover states, and a less heavy profile block
  - Goal: manager content should lead, not the nav chrome

- **`/team` and `/approvals` now visually match the newer manager surfaces**:
  - `/team` keeps the same roster/edit behavior, but card and section framing are lighter
  - `/approvals` now reads more like a review queue than a standalone utility page

## What This App Is

Teamwise is a respiratory therapy scheduling app replacing paper workflows.
Core domains: coverage planning, cycles, availability requests, shift board, approvals, publish flow, team management.

## Latest Updates (2026-03-18)

- **`/team` roster is now shift-grouped and supports soft archive**:
  - Managers remain in a top-level section with no shift designation
  - Active non-managers are now split visually into:
    - `Day Shift` -> `Lead Therapists`, `Therapists`
    - `Night Shift` -> `Lead Therapists`, `Therapists`
  - Inactive team members remain in a separate `Inactive` section
  - Inactive team members no longer show the normal app-permissions checklist in quick edit; the modal now states they have no app access while inactive
  - Inactive team members can now be soft archived from `/team`
    - archive keeps historical data
    - archive removes the user from `/team`
    - archive removes app access
  - New migration required for live DBs:
    - `supabase/migrations/20260319101500_add_profile_archival_fields.sql`
    - adds `profiles.archived_at` and `profiles.archived_by`
  - Middleware and permission checks now treat inactive or archived users as having no app access
  - Login/signout flow now redirects inactive or archived users out of the app with an account-inactive message on `/`

- **Coverage dialog compaction pass complete**:
  - `src/components/coverage/ShiftEditorDialog.tsx` now uses extracted layout tokens from `src/components/coverage/shift-editor-dialog-layout.ts`
  - The day editor dialog was tightened twice and currently sits at the approved "even compact" density:
    - narrower modal (`sm:max-w-[540px]`)
    - smaller header/title rhythm
    - smaller therapist rows, avatars, lead badge, and assign toggles
  - Guardrail: if the user asks to make it even smaller again, the next step starts trading away readability and tap comfort.
  - Targeted regression test added: `src/components/coverage/shift-editor-dialog-layout.test.ts`

- **`/team` is now the manager-facing staff management surface**:
  - Clicking a team member card opens a centered quick-edit modal on `/team`
  - `/team` now shows:
    - managers
    - day-shift lead therapists
    - day-shift therapists
    - night-shift lead therapists
    - night-shift therapists
    - inactive team members
  - Quick edit now covers:
    - name
    - role (`manager`, `lead`, `therapist`)
    - shift type
    - employment type
    - FMLA
    - FMLA return date
    - active/inactive
    - archive action for inactive team members
  - Team cards now show FMLA return date and inactive state directly in the roster
  - Behavioral note: if quick edit marks someone inactive, on FMLA, or manager, future draft shifts are realigned

- **App role model moved to `manager` / `lead` / `therapist`**:
  - `lead` is now a real app role in code, not just implied by `is_lead_eligible`
  - Assignment status updates are now permissioned by role:
    - `manager` and `lead` can update assignment status
    - `therapist` cannot, even if coverage-lead eligible
  - `is_lead_eligible` still exists separately for staffing/coverage rules
  - New migration required for live DBs:
    - `supabase/migrations/20260318143000_add_lead_role_to_profiles.sql`
    - This updates `profiles_role_check` to allow `lead`

- **`/directory` retired from normal manager flow**:
  - Manager nav and workflow links now point to `/team`
  - `src/app/directory/page.tsx` is now only a redirect to `/team`
  - Redirect coverage added in `src/app/directory/page.test.ts`

- **Windows build gotcha confirmed**:
  - On this repo, `next build` can fail with `EPERM ... unlink .next/...` if a repo-local Next dev server is still running and holding `.next`
  - Fix: stop the repo's `next dev` worker processes first, then rerun `npm run build`

## Latest Updates (2026-03-19)

- **`/availability` now has a manager scheduling planner**:
  - Managers now get a dedicated `Staff Scheduling Inputs` workspace at the top of `/availability`
  - The planner is cycle-scoped and therapist-specific
  - Manager-facing labels are now:
    - `Will work`
    - `Cannot work`
  - Planner saves still use `availability_overrides`:
    - `Will work` -> `force_on`
    - `Cannot work` -> `force_off`
    - `source='manager'`
  - Main files:
    - `src/app/availability/actions.ts`
    - `src/components/availability/ManagerSchedulingInputs.tsx`
    - `src/lib/availability-planner.ts`
  - The older override UI in `EmployeeDirectory` is now secondary copy-wise; `/availability` is the primary manager planning surface

- **Auto-draft now honors manager hard dates more explicitly**:
  - Manager `force_on` dates are treated as forced scheduling signals and prioritized over ordinary eligible candidates when legal
  - Manager `force_off` still blocks
  - Forced manager dates do **not** bypass:
    - weekly cap
    - one shift per day
    - inactive/FMLA blocks
    - lead rules
  - If auto-draft cannot honor every manager `Will work` date, the draft still saves and the feedback now reports how many forced dates were missed
  - Main files:
    - `src/lib/coverage/resolve-availability.ts`
    - `src/lib/schedule-helpers.ts`
    - `src/app/schedule/actions.ts`

- **PRN rule tightened to explicit-date-only for auto-draft**:
  - PRN should only enter auto-draft on explicit `force_on` dates
  - Recurring PRN weekday patterns are no longer enough by themselves for auto-draft eligibility
  - This now lines up with the new manager planner workflow on `/availability`

- **Preliminary schedule workflow added**:
  - Managers can now send a staff-visible preliminary schedule from `/coverage`
  - A sent preliminary snapshot stays live and can be refreshed in place from the same page
  - The coverage header now shows:
    - `Send preliminary`
    - `Refresh preliminary`
    - `Preliminary live` status badge
  - New server action lives in:
    - `src/app/schedule/actions.ts` -> `sendPreliminaryScheduleAction`

- **New preliminary schedule data model**:
  - New migration:
    - `supabase/migrations/20260319113000_add_preliminary_schedule_tables.sql`
  - Adds:
    - `public.preliminary_snapshots`
    - `public.preliminary_shift_states`
    - `public.preliminary_requests`
  - Purpose:
    - separate staff-visible preliminary workflow from final publish
    - lock open-slot claims live
    - keep manager approval as the source of truth
  - This migration was pushed successfully with `supabase db push` on 2026-03-19

- **Shared preliminary schedule logic added**:
  - `src/lib/preliminary-schedule/types.ts`
  - `src/lib/preliminary-schedule/selectors.ts`
  - `src/lib/preliminary-schedule/mutations.ts`
  - Core helpers now handle:
    - sending or refreshing one active snapshot per cycle
    - immediate reservation of open-slot claims
    - change requests on tentative assignments
    - manager approve/deny
    - therapist cancel of pending requests

- **`/approvals` is now a real manager queue**:
  - Old redirect-to-shift-board behavior was removed
  - `/approvals` now shows pending preliminary requests directly
  - Managers can approve or deny from the queue
  - Approval actions live in:
    - `src/app/approvals/actions.ts`
  - Current behavior:
    - approving a claim assigns that therapist onto the draft shift
    - approving a change request clears the draft assignment for manager follow-up
    - denying leaves the draft assignment unchanged or releases the slot appropriately

- **New therapist-facing `/preliminary` route**:
  - Therapists and leads can now review the active preliminary schedule in-app
  - They can:
    - claim open help-needed slots
    - request change on their own tentative assignment
    - cancel their own pending preliminary requests
  - Main files:
    - `src/app/preliminary/page.tsx`
    - `src/app/preliminary/actions.ts`
    - `src/components/preliminary/PreliminaryScheduleView.tsx`
    - `src/components/preliminary/PreliminaryShiftCard.tsx`
    - `src/components/preliminary/PreliminaryRequestHistory.tsx`

- **Notifications and navigation updated for preliminary flow**:
  - Therapist nav now includes `/preliminary`
  - Manager nav now includes `/approvals`
  - `src/components/NotificationBell.tsx` now routes:
    - preliminary-request manager notifications -> `/approvals`
    - other preliminary notifications -> `/preliminary`
  - Product decision:
    - preliminary notifications are in-app only
    - no extra email or push notification layer was added

- **Verification for the preliminary feature**:
  - Unit tests added:
    - `src/lib/preliminary-schedule/selectors.test.ts`
    - `src/lib/preliminary-schedule/mutations.test.ts`
    - `src/app/schedule/preliminary-actions.test.ts`
    - `src/app/approvals/page.test.ts`
    - `src/components/preliminary/PreliminaryScheduleView.test.ts`
  - Verified passing during implementation:
    - `npm run test:unit -- src/lib/preliminary-schedule/selectors.test.ts src/lib/preliminary-schedule/mutations.test.ts src/app/schedule/preliminary-actions.test.ts src/app/approvals/page.test.ts src/components/preliminary/PreliminaryScheduleView.test.ts`
    - `npm run build`

## Latest Updates (2026-03-16)

- **Coverage constraint warning fix**: "No eligible therapists (constraints)" badge no longer appears on slots that have manually-assigned therapists.
  - Root cause: `constraintBlockedSlotKeys` was built from unfilled rows but never cleared when therapists were manually assigned.
  - Fix: track `assignedSlotKeys` in the same loop; after the loop, delete overlapping keys from `constraintBlockedSlotKeys`.
  - See **Coverage UX** section for full gotcha note.

- **Worker automation complete** — publish email queue now runs automatically on a 1-minute Vercel cron:
  - `vercel.json` cron schedule: `"* * * * *"` → `/api/cron/process-publish`
  - New route: `src/app/api/cron/process-publish/route.ts`
    - Verifies `Authorization: Bearer <CRON_SECRET>` (Vercel cron standard)
    - Builds HMAC-SHA256 signed request (method + path + timestamp) using `PUBLISH_WORKER_SIGNING_KEY`
    - POSTs to `/api/publish/process` with `batch_size: 25`
  - All required env vars are now set in Vercel (production):
    - `NEXT_PUBLIC_APP_URL` = `https://www.teamwise.work` (was incorrectly `http://localhost:3000`)
    - `PUBLISH_WORKER_KEY`, `PUBLISH_WORKER_SIGNING_KEY`, `CRON_SECRET` — all set
    - `PUBLISH_EMAIL_FROM` = `Teamwise <noreply@mail.teamwise.work>` (matches verified Resend domain)
    - `RESEND_API_KEY` — set
  - `.env.example` updated with `CRON_SECRET`

- **Production deployment**: code pushed to GitHub (`byonk19-svg/rt-scheduler`, commit c776059). Vercel GitHub auto-deploy is **not** wired — run `vercel --prod` from the project root to deploy latest code.

- **Resend domain**: `mail.teamwise.work` is **Verified** in Resend. No longer in test-mode restriction. Emails will go to all recipients once deployed.

- **Vercel project**: `rt-scheduler` (prj_rmfvUgtS9OFcH6ZBbylK14qFxPX3), team "bri's projects" (team_WrUwb5MAzpsjazNeTVAidXLA). Domains: `teamwise.work`, `www.teamwise.work`.

## Latest Updates (2026-03-14)

- `/coverage` now uses the Lovable interaction model:
  - clicking a day opens a centered edit dialog
  - clicking an assigned therapist opens an inline status popover
  - legacy `ShiftDrawer` was removed
- Coverage status UI was normalized so `call_in` stays distinct from `cancelled`.
- Added coverage-specific UI helpers and tests:
  - `src/lib/coverage/status-ui.ts`
  - `src/lib/coverage/status-ui.test.ts`
  - updated `e2e/coverage-overlay.spec.ts`
- Important handoff: the interaction model is correct, but the visual shell is still not matching the Lovable reference closely enough.
  - Do **not** keep doing tiny font/spacing tweaks in place.
  - Next pass should be a direct visual rebuild of the `/coverage` shell and day-card composition against the Lovable screenshot/reference.

- Lovable UI is now the baseline visual direction across manager-facing scheduling routes.
- `/coverage` is the canonical manager scheduling workspace and was restyled to match the new design.
- `/schedule` now acts as a compatibility redirect:
  - managers -> `/coverage`
  - staff -> `/therapist/schedule`
- Legacy schedule shell components were retired to prevent old UI from rendering:
  - `src/components/AttentionBar.tsx`
  - `src/components/ScheduleHeader.tsx`
  - `src/components/CalendarToolbar.tsx`
  - `src/components/manager-month-calendar.tsx`
  - `src/components/manager-week-calendar.tsx`
- Legacy `/staff/*` pages now redirect into current routes so only one shell remains active.
- Added tooling for future merge audits: `tools/design_merge_audit.py`.
- Shift Board now separates use-cases more explicitly for non-technical users:
  - published schedule changes (swap/pickup) vs upcoming cycle planning.
- Availability flow was simplified for all employees:
  - PRN-specific labels removed from staff UI.
  - All staff can submit either `Need off` or `Available to work`.
  - Form copy uses plain language (`Request type`, `Save request`).
- Desktop clarity pass completed on Availability:
  - 2-step form structure (`Step 1` cycle/date, `Step 2` request details).
  - Staff saved-requests section simplified (`My Saved Availability Requests`).

## Current Stack

- Next.js 16.1.6 (App Router) + TypeScript
- Supabase (Auth + Postgres + RLS + RPC)
- Tailwind + shadcn/ui patterns
- Vitest (unit) + Playwright (e2e)

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

All checks currently green:

- `npx tsc --noEmit` pass
- `npm run lint` pass
- `npm run format:check` pass (whole-repo Prettier; `.claude/**` excluded from ESLint)
- `npm run build` pass
- `npm run test:unit` pass (**212 tests** across 26 files)
- `npm run test:e2e` pass (39 passed, 1 skipped)

CI gates: format check â†’ lint â†’ tsc â†’ build â†’ Playwright E2E

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
- `/coverage` dedicated coverage UI (client page, full-width calendar + dialog/popover editing model)
- `/schedule` role-aware redirect entrypoint (manager -> `/coverage`, staff -> `/therapist/schedule`)
- `/approvals`
- `/availability`
- `/shift-board`
- `/directory` compatibility redirect to `/team`
- `/profile`
- `/requests`, `/requests/new` shift request workflow
- `/publish`, `/publish/[id]` publish history + async email queue
- `/staff/*` legacy compatibility routes (redirects)

## Role Model

Role source: `profiles.role`.

- `manager`: full scheduling + publish + team management controls
- `lead`: therapist experience plus assignment-status updates
- `therapist`: standard staff experience

Coverage lead eligibility remains separate at `profiles.is_lead_eligible`.
On the `/team` surface, lead eligibility is derived from the selected role when saving quick edit.
All permission checks go through `can(role, permission)` in `src/lib/auth/can.ts`, and inactive or archived users should be denied there.

## Key Shared Components

- `src/components/ui/page-header.tsx` â€” `<PageHeader>` is DEPRECATED for new pages; only remaining on legacy pages not yet migrated
- `src/components/manager/ManagerWorkspaceHeader.tsx` â€” canonical manager route header for `/availability`, `/coverage`, `/team`, and `/approvals`
- `src/components/availability/AvailabilityOverviewHeader.tsx` â€” manager-specific availability wrapper around the shared manager workspace header
- `src/components/ui/skeleton.tsx` â€” `<Skeleton>`, `<SkeletonLine>`, `<SkeletonCard>`, `<SkeletonListItem>` loading states
- `src/components/NotificationBell.tsx` â€” real-time bell with Supabase subscription; variants: `default` | `staff`
- `src/components/AppShell.tsx` â€” nav shell; add routes to `MANAGER_NAV` / `STAFF_NAV` arrays
- `src/components/feedback-toast.tsx` â€” `<FeedbackToast message variant>` for success/error toasts
- `src/lib/auth/can.ts` â€” `can(role, permission)` â€” all permission checks go through here
- `src/lib/coverage/selectors.ts` â€” `buildDayItems`, `toUiStatus`
- `src/lib/coverage/mutations.ts` â€” `assignCoverageShift`, `unassignCoverageShift`
- `src/lib/calendar-utils.ts` â€” `toIsoDate`, `dateRange`, `buildCalendarWeeks`, etc.

## Design System

CSS tokens (defined in `src/app/globals.css`):

- `--primary` (`#0667a9`) â€” all primary actions: buttons, nav pills, links, focus rings
- `--attention` (`#d97706`) â€” brand personality only: user avatar, logo accent; **not** for primary actions
- `--warning-*` / `--success-*` / `--error-*` / `--info-*` â€” all status badge families
- `--foreground`, `--muted-foreground`, `--border`, `--card`, `--muted`, `--secondary` â€” layout tokens

Rules (enforced):

- No hardcoded hex colors â€” use CSS vars or Tailwind semantic classes
- No `fontFamily` JSX literals â€” use `font-sans` or `var(--font-sans)`
- `bg-white` â†’ `bg-card`
- Focus rings â†’ `focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none`
- `fontWeight 800` reserved for display-level; section headers use `600`/`700`
- All Lucide icons â€” no emoji icons in UI

Typography classes:

- `app-page-title` â€” page-level h1
- `app-section-title` â€” card/section headers

## Tooling Gotchas

- **framer-motion `ease`:** `ease: 'easeOut'` fails `tsc` — the `Easing` type requires specific literals. Omit `ease` entirely to use framer-motion's safe default.
- **Preview MCP on Windows:** `preview_start` server tracking doesn't persist between tool calls. Use `tabs_context_mcp` + Chrome browser MCP tools (`computer screenshot`, `navigate`) for visual verification instead.
- **Responsive stat grids:** Always `grid-cols-2 lg:grid-cols-4` — never bare `grid-cols-4` which clips on narrower viewports.
- **Repo-local Next build lock on Windows:** if `npm run build` throws `EPERM` under `.next`, check for a running `next dev` process from this repo and stop it before rebuilding.
- **Session end workflow:** update CLAUDE.md with learnings → `git add CLAUDE.md && git commit && git push`

## Scheduling Rules

- Coverage target: 3â€“5 per shift slot
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
  - therapist `force_off` / `force_on` still affect date eligibility, but manager planner is the strongest operational signal
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

`/coverage` (`src/app/coverage/page.tsx` + `src/components/coverage/`):

- Full-width 7-column day calendar; centered shift editor dialog + inline status popovers
- Uses the shared manager workspace header pattern at the top of the page
- Clicking a day opens the editor dialog
- Clicking an assigned therapist opens the status popover without opening the editor
- Day/Night shift tabs; therapist assignment rows live in the dialog
- Optimistic status updates with rollback on save failure
- Lead/staff assignment actions still use current Teamwise mutations and rules
- Coverage E2E now validates dialog/popover workflow instead of the removed drawer
- Dialog density is controlled centrally in `src/components/coverage/shift-editor-dialog-layout.ts`
- **Constraint warning gotcha:** `constraintBlockedSlotKeys` in `coverage/page.tsx` is built from unfilled shift rows (`user_id IS NULL`). After the loop, any slot key that also has an assigned therapist is deleted from the set — so "No eligible therapists (constraints)" only appears for truly empty slots; manually assigned therapists suppress it.

## Team UX

`/team` is now the canonical manager roster-management surface.

- Clicking a team member card opens a quick-edit modal on the same page
- Sections are grouped by:
  - managers
  - day shift (`Lead Therapists`, `Therapists`)
  - night shift (`Lead Therapists`, `Therapists`)
  - inactive
- Quick edit is meant for roster/access fields:
  - name
  - app role
  - shift type
  - employment type
  - FMLA
  - FMLA return date
  - active/inactive
- `Lead Therapist` is the visible manager-facing role label; the separate `Coverage lead` control was removed from `/team`
- The page now shares the quieter manager workspace header pattern and lighter card framing used on `/availability` and `/approvals`
- `/directory` should be treated as a compatibility redirect only, not a feature surface

## Schedule UX

`/coverage` is the manager editing workspace.
`/schedule` is retained as a compatibility route and redirects by role.

## Navbar / Branding

- Logo: amber icon (`var(--attention)`) + Teamwise wordmark
- Active nav pill: `var(--primary)` blue
- User avatar: `var(--attention)` amber
- Manager badge: `bg-[var(--warning-subtle)] text-[var(--warning-text)] border-[var(--warning-border)]`
- App shell header `z-30`; coverage slide-over `z-50`
- Manager nav order: Dashboard -> Schedule -> Availability -> Shift Swaps -> Team -> Publish History

## Assignment Status

Backend values: `scheduled`, `call_in`, `cancelled`, `on_call`, `left_early`

Shift fields: `assignment_status`, `status_note`, `left_early_time`, `status_updated_at`, `status_updated_by`

Write path: `POST /api/schedule/assignment-status` with optimistic local update + rollback.

## Notifications

- `NotificationBell` in top nav: unread badge, divider-based list, "mark all read" CTA
- Real-time updates via Supabase postgres_changes subscription
- APIs: `GET /api/notifications`, `POST /api/notifications/mark-read`

## Publish Flow

- Manager publishes from `/coverage` -> triggers email queue via `notification_outbox`
- `POST /api/publish/process` processes queued rows (batch_size param)
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
PUBLISH_WORKER_KEY               # worker key id sent in x-publish-worker-key header
PUBLISH_WORKER_SIGNING_KEY       # HMAC-SHA256 signing secret for cron → process requests
CRON_SECRET                      # Vercel cron auth secret (Authorization: Bearer <CRON_SECRET>)
```

All 9 vars above are confirmed set in Vercel production environment (2026-03-16).

Supabase Auth (production):

- Site URL: `https://www.teamwise.work`
- Redirect URL: `https://www.teamwise.work/auth/callback`

Resend: `mail.teamwise.work` is **Verified**. No test-mode restriction — emails go to all recipients.

## Data Model Snapshot

Core tables:

- `profiles` â€” `full_name`, `email`, `role`, `shift_type`, `employment_type`, `max_work_days_per_week`, `is_lead_eligible`, `on_fmla`, `is_active`, `default_calendar_view`, `default_landing_page`, `site_id`
- `schedule_cycles`
- `shifts` â€” `cycle_id`, `user_id`, `date`, `shift_type`, `status`, `role`, `unfilled_reason`, assignment-status fields, `site_id`
- `work_patterns` â€” `works_dow`, `offs_dow`, `weekend_rotation`, `weekend_anchor_date`, `works_dow_mode`
- `availability_overrides` â€” active cycle-scoped override model (`force_off` / `force_on`, `source`)
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

## Next High-Value Priorities

1. **Deploy to production** — run `vercel --prod` from project root. GitHub auto-deploy is NOT wired to Vercel; CLI deploy is the current method. All env vars and code are ready.
2. **Verify end-to-end publish email flow in production** — publish a schedule from `/coverage`, check `/publish` for queue status, confirm recipient receives email from `noreply@mail.teamwise.work`.
3. **Wire GitHub → Vercel auto-deploy** (optional) — connect `byonk19-svg/rt-scheduler` repo in Vercel dashboard under Git Integration so pushes trigger builds automatically.
4. **Production UAT for the newer manager workflows** — verify `/availability`, `/coverage`, `/team`, `/approvals`, `/preliminary`, and `/publish` together against a real cycle before broader visual/branding work.

UI audit (2026-03-16) complete: manager surfaces now follow the quieter workspace-header direction, dashboard grid is responsive, Publish History is in nav, and denial reason is surfaced on Shift Board.
