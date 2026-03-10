# Teamwise Scheduler

Updated: 2026-03-08

## What This App Is

Teamwise is a respiratory therapy scheduling app replacing paper workflows.
Core domains: coverage planning, cycles, availability requests, shift board, approvals, publish flow, directory.

## Latest Updates (2026-03-08)

- Staff can now access `/shift-board` directly (no manager-only middleware block).
- Staff navigation wording is clearer:
  - `Future Availability`
  - `Shift Swaps (Published)`
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

## Quality Status

All checks currently green:

- `npx tsc --noEmit` pass
- `npm run lint` pass
- `npm run format:check` pass (whole-repo Prettier; `.claude/**` excluded from ESLint)
- `npm run build` pass
- `npm run test:unit` pass (**201 tests** across 23 files)
- `npm run test:e2e` pass (39 passed, 1 skipped)

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
- `/coverage` dedicated coverage UI (client page, full-width calendar + slide-over panel)
- `/schedule` schedule workspace (Week/Month views only; Grid/List removed)
- `/approvals`
- `/availability`
- `/shift-board`
- `/directory` (manager team directory)
- `/profile`
- `/requests`, `/requests/new` shift request workflow
- `/publish`, `/publish/[id]` publish history + async email queue
- `/staff/` staff-scoped layout with staff-specific schedule and requests sub-routes

## Role Model

Role source: `profiles.role`.

- `manager`: full scheduling + publish + directory controls
- `therapist`: staff experience

Lead capability: `profiles.is_lead_eligible`. All permission checks go through `can(role, permission)` in `src/lib/auth/can.ts`.

## Key Shared Components

- `src/components/ui/page-header.tsx` — `<PageHeader title subtitle badge? actions?>` used on every page
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
  - `force_off` blocks date in that cycle
  - `force_on` allows date in that cycle (except inactive/FMLA)
  - fallback to recurring pattern if no override
- PRN strict policy:
  - eligible only when cycle override `force_on` exists, OR recurring pattern offers that weekday (`works_dow`) and hard constraints pass
  - PRN without `force_on` and without offered recurring day = not eligible

Auto-generate (`src/lib/schedule-helpers.ts`):

- Targets 4 therapists first; slot is "unfilled" only below 3
- Excludes inactive + FMLA by default
- Marks constraint-caused unfilled slots: `unfilled_reason='no_eligible_candidates_due_to_constraints'`

Assignment status is informational only (does not affect coverage counts or publish blockers).

## Coverage UX

`/coverage` (`src/app/coverage/page.tsx` + `src/components/coverage/`):

- Full-width 7-column day calendar; fixed right slide-over panel (`z-50`)
- Click backdrop (`z-40`) or close button to dismiss; click same day again toggles panel closed
- Day/Night shift tabs; accordion therapist rows in panel
- Optimistic status updates with rollback on save failure
- Assignment picker: Staff/Lead pill toggle; Lead filters to eligible therapists only
- Workload shown per therapist: `· N this wk, M this cyc` (zero extra network requests)
- Calendar chips reflect assignment status: `OC` (on call), `LE` (leave early), `X` (cancelled)
- PRN not offered for date is disabled in picker with tooltip; override-enabled PRN labeled `Offered`

## Schedule UX

`/schedule`: Week and Month views only.
Legacy `view=grid` and `view=list` URLs normalize to `view=week`.

## Navbar / Branding

- Logo: amber icon (`var(--attention)`) + Teamwise wordmark
- Active nav pill: `var(--primary)` blue
- User avatar: `var(--attention)` amber
- Manager badge: `bg-[var(--warning-subtle)] text-[var(--warning-text)] border-[var(--warning-border)]`
- App shell header `z-30`; coverage slide-over `z-50`
- Manager nav order: Dashboard → Coverage → Team → Requests

## Assignment Status

Backend values: `scheduled`, `call_in`, `cancelled`, `on_call`, `left_early`

Shift fields: `assignment_status`, `status_note`, `left_early_time`, `status_updated_at`, `status_updated_by`

Write path: `POST /api/schedule/assignment-status` with optimistic local update + rollback.

## Notifications

- `NotificationBell` in top nav: unread badge, divider-based list, "mark all read" CTA
- Real-time updates via Supabase postgres_changes subscription
- APIs: `GET /api/notifications`, `POST /api/notifications/mark-read`

## Publish Flow

- Manager publishes from `/schedule` → triggers email queue via `notification_outbox`
- `POST /api/publish/process` processes queued rows (batch_size param)
- History at `/publish`; detail + retry at `/publish/[id]`
- Key files: `src/app/publish/`, `src/lib/publish-events.ts`, `src/app/publish/actions.ts`

Required env vars:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL
RESEND_API_KEY
PUBLISH_EMAIL_FROM
PUBLISH_WORKER_KEY            # optional; worker key id/header
PUBLISH_WORKER_SIGNING_KEY    # optional; required with worker key for signed processing endpoint
```

Supabase Auth (production):

- Site URL: `https://www.teamwise.work`
- Redirect URL: `https://www.teamwise.work/auth/callback`

**Current blocker:** Resend test-mode restricts non-owner recipients until a verified domain is set as `PUBLISH_EMAIL_FROM`.

## Data Model Snapshot

Core tables:

- `profiles` — `full_name`, `email`, `role`, `shift_type`, `employment_type`, `max_work_days_per_week`, `is_lead_eligible`, `on_fmla`, `is_active`, `default_calendar_view`, `default_landing_page`, `site_id`
- `schedule_cycles`
- `shifts` — `cycle_id`, `user_id`, `date`, `shift_type`, `status`, `role`, `unfilled_reason`, assignment-status fields, `site_id`
- `work_patterns` — `works_dow`, `offs_dow`, `weekend_rotation`, `weekend_anchor_date`, `works_dow_mode`
- `availability_overrides` — active cycle-scoped override model (`force_off` / `force_on`, `source`)
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

1. **Publish flow production rollout** — verify domain in Resend, set `PUBLISH_EMAIL_FROM` to verified sender, run `vercel --prod`
2. **Worker automation** — wire cron/webhook to `POST /api/publish/process` with signed headers using `PUBLISH_WORKER_KEY` + `PUBLISH_WORKER_SIGNING_KEY`
