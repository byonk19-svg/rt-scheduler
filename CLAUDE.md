# Teamwise Scheduler

Updated: 2026-05-13

## Handoff Snapshot

### Current Truth

- **Brand color source of truth:** the `Refined.html` design handoff from `claude.ai/design`, locked into the codebase as `--primary: hsl(174 48% 29%)` (`#276e66`, the design's `--teal-btn`) and `--marketing-hero-bg: hsl(174 35% 16%)` (`#1b3836`, the design's `--teal-dark`). `--marketing-hero-bg` is **not** an alias for `--primary` — the hero needs the deeper near-black-green tone. Earlier sessions kept reverting to the older 187°/`#1e5c64` teal by re-reading stale docs; that drift is now locked out by `globals.test.ts` and `page.test.ts` regression guards. See `DESIGN.md` → "Refined design handoff (2026-04-27)" for the full token mapping.
- Production is live on `https://www.teamwise.work`.
- The working inbound availability webhook URL is:
  - `https://www.teamwise.work/api/inbound/availability-email`
- `mail.teamwise.work` receiving is verified in Resend.
- Availability intake currently supports:
  - inbound email webhook
  - manager-created manual intake from pasted text
  - uploaded form image/PDF on `/availability`
- Uploaded images and PDFs OCR via the OpenAI Responses API (`OPENAI_API_KEY` required). PDFs try direct text extraction first, then image OCR. The parser reads both `output_text` and nested `output[].content[].text`. The inbound webhook returns immediately; OCR continues in `after()` to prevent Resend retries.
- OCR ceiling: some handwritten or low-quality documents remain unreadable. Treat as a document-readability limit, not a transport bug. Future progress requires template-anchored field extraction or a manager rescue workflow.
- Replaying the same Resend inbound event does **not** reliably create a fresh processed intake row every time. Use `created_at` on the newest intake item rows to confirm whether a replay actually exercised the latest production code.
- **Intake card workflow:** Managers must match both the therapist and the schedule block before `Apply dates` appears. Managers can fix therapist matches inline, inspect the stored email body + OCR text directly on the card, reparse after OCR/parser changes, and delete troubleshooting/replay batches from `/availability`.
- **Unified Schedule grid:** `/schedule` is the canonical live schedule surface for managers, leads, and therapists. `/coverage`, `/staff/schedule`, `/staff/my-schedule`, and `/therapist/schedule` are compatibility redirects that preserve query params. The old Coverage block board, Coverage roster toggle, and read-only schedule-roster screen were removed.
- **Email intake tab stability:** intake date chip toggles and **Apply dates** refresh in place (`router.refresh` / `router.replace` with `tab=intake`) so managers are not bounced back to the **Planner** tab after saves. Intake request chips cycle **`force_off` ↔ `force_on`** only; removing a date uses an explicit **Remove** path with confirmation instead of a silent third-click delete.
- **Theme support:** the root layout now reads the `tw-theme` cookie on the server, applies the initial `dark` class without any inline script, and renders a plain `<body>` without importing `ThemeProvider`. `ThemeProvider` now lives in `src/components/AppShell.tsx` so the theme boundary stays client-to-client and avoids the webpack HMR lazy-element crash path; `/profile` still includes an **Appearance** section with **Light / System / Dark** controls. Client-side theme changes keep `localStorage` and the `tw-theme` cookie in sync through `src/lib/theme.ts`, `.dark` token overrides live in `src/app/globals.css`, and print explicitly forces light token values.
- **Schedule grid data path:** `src/app/(app)/schedule/schedule-grid-data.ts` loads the visible cycle, date range, active shifts, force-off markers, operational status entries, daily totals, and role permissions. `src/components/schedule-grid/*` renders toolbar, grid, assign popover, and status/lead popover.
- **Auth entry (`/login`, `/signup`):** `src/lib/auth/login-utils.ts` parses auth errors from top-level query params **or nested inside `redirectTo`** (e.g. `/availability?error=...`), maps friendly copy, and `router.replace` cleans error keys while preserving a sanitized `redirectTo`. Approval/allowlist copy shows as a **warning** banner with optional **Request access** link and dismiss; credential failures stay **destructive**. Successful access **request** redirects to **`/login?status=requested`** with an **info** banner (dismiss + URL strip); signup no longer auto-signs-in before that redirect, and the public signup page now always uses that same generic redirect instead of exposing roster-match state. **Name roster auto-match:** managers maintain **`employee_roster`** on **`/team`** (single row, **bulk paste**, or ops script). On signup, **`handle_new_user`** still matches **normalized full name** to an active roster row on the server; matched users can receive roster **role/settings** immediately (non-pending), and the roster row records **`matched_profile_id`**, but the public UX no longer discloses whether that match happened. Unmatched signups stay **`profiles.role = null`** pending approval. **Migration:** `20260413123000_add_employee_roster_and_name_match_signup.sql`. **Ops:** `npm run sync:roster` bulk-creates **auth + profiles** from an email list file (separate from **`employee_roster`** name pre-match). **Public homepage (`/`):** deep teal hero (`bg-[var(--marketing-hero-bg)]` = `#1b3836`, hue 174°) with subtle grid texture and amber right stripe; headline "Scheduling that keeps care moving."; amber **Sign in** primary CTA + outline **Request access** secondary; warm `bg-background` feature strip below (3-up amber-line cards from the design handoff). `PublicHeader` also uses `bg-[var(--marketing-hero-bg)]` for the dark homepage variant — the header renders outside `<main>` in the public layout so transparent would land on the light wrapper background. **Do not** swap `--marketing-hero-bg` for `--primary` on the hero — that is the "wrong teal" regression users surfaced and `page.test.ts` now guards against. Vitest contracts in `src/app/page.test.ts` and `src/app/globals.test.ts`. Shared **Input** focus ring uses **`--ring`**; **`:autofill`** + **`-webkit-autofill`** theming lives in `globals.css`.
- **Next 16 request guard:** authenticated route protection lives in `src/proxy.ts`, which is the active Next 16 file convention replacing `middleware.ts`. Do **not** add a duplicate `src/middleware.ts` shim unless the app is intentionally downgraded to a Next version that still requires the older convention. `e2e/proxy-routing.spec.ts` proves an unmatched protected route redirects through Proxy before rendering a 404.
- **Layout split + authenticated shell performance pass:** the universal root layout is now lightweight (`src/app/layout.tsx`), public pages get the display font through `src/app/(public)/layout.tsx`, and authenticated shell work lives in `src/app/(app)/layout.tsx`. The authenticated layout is intentionally `force-dynamic` because it reads auth cookies and server-loads shell state. The shell no longer wraps the full authenticated tree in `MotionProvider`; `framer-motion` now stays local to the small surfaces that actually animate. The top-nav notification control now hydrates through `DeferredNotificationBell` so the unread badge can render immediately without loading the full dropdown/fetch logic on first paint. Prefer design tokens over raw **`text-white`** / **`bg-white`** / stray **`dark:`** on shared surfaces; destructive actions use **`text-destructive-foreground`**. **`globals.css`:** stronger **`--muted-foreground`**, **`--color-destructive-foreground`** in **`@theme`**, table row hover scoped to **`table:not(.no-row-hover)`**, marketing header + home preview shell reduce **`backdrop-filter`** under **`prefers-reduced-motion: reduce`**. **`/requests/new`** and **`/publish/[id]`** use **`ManagerWorkspaceHeader`**. **`LEAD_ELIGIBLE_BADGE_CLASS`** uses **`--info-*`** tokens (`src/lib/employee-tag-badges.ts`).
- **Manager `/availability` planner shell:** URL tabs **`?tab=planner|intake`** under **`AvailabilityOverviewHeader`**. **Planner** = **`ManagerSchedulingInputs`** inside **`AvailabilityWorkspaceShell`**. **Saved planner dates** and primary planner actions belong in the shell **`controls`** slot (left column, muted background). Use **`lower={null}`** for that surface — **`lower`** renders **outside** the primary card. Calendar month UI: **`AvailabilityCalendarPanel`** (`src/components/availability/availability-calendar-panel.tsx`).
- **Cycle templates:** managers can save a published cycle as a reusable staffing template and apply a template into a draft cycle from Schedule. Templates serialize shifts as `day_of_cycle` rows only; they intentionally do **not** include availability overrides.
- **Therapist scheduled conflict warning:** `/therapist/availability` warns when a therapist marks a date as **Need Off** (`force_off`) while they already have a `scheduled` shift on that date. Dismissible warning only; does not block saving.
- **Therapist recurring pattern vs future availability:** `/therapist/recurring-pattern` is now the default-template editor, while `/therapist/availability` is the generated cycle workspace. Future Availability starts from the saved recurring pattern and stores only cycle-specific overrides; editing the cycle must not mutate the recurring template.
- **Advanced recurring work patterns:** `work_patterns` now supports `pattern_type`, `weekly_weekdays`, `weekend_rule`, `cycle_anchor_date`, and `cycle_segments` in addition to the legacy weekly columns. Use `/team/work-patterns/[therapistId]` for repeating-cycle patterns — legacy quick-edit surfaces on `/team` are weekly-only and must not be used to rewrite repeating-cycle patterns.
- **Schedule pre-flight check:** the auto-draft flow on `/schedule` can show a pre-flight summary before running draft generation. The report uses the same pure draft engine as generation, includes real existing shifts, and summarizes unfilled slots, missing leads, and forced must-work misses.
- **Shift reminders:** `vercel.json` now schedules `/api/cron/shift-reminders` at `0 6 * * *`. The cron route requires `CRON_SECRET`, queues rows in `shift_reminder_outbox`, sends 24h reminder emails for next-day `scheduled` shifts only, and writes matching in-app notifications.
- **Manager analytics:** `/analytics` now provides cycle fill rates, therapist submission compliance, and force-on miss reporting using server-side Supabase queries plus simple CSS-based summary components.

### Local In-Progress Work

All features from merged PRs are now on `main` and live: dark mode, cycle templates, CSV import wizard, bulk therapist status actions, audit log UI, availability conflict warning, coverage pre-flight, shift reminders, manager analytics, work-patterns page, roster segmentation fix, dark teal homepage (PR `#42`), and therapist workflow accuracy pass (PR `#43`).
Key additions from PR `#43`: centralized therapist workflow state (`src/lib/therapist-workflow.ts`), trusted shift-post mutation route (`src/app/api/shift-posts/route.ts`), deterministic pickup queue via `shift_post_interests.status`, RLS hardening for direct posts, and shared cleanup path in `src/lib/shift-post-cleanup.ts`. Note: `supabase db reset` pending (Docker Desktop unavailable locally).

### Where We Want To Go

1. **Verify end-to-end publish email flow in production** - publish a schedule from `/schedule`, check `/publish` for queue status, confirm recipient receives email from `noreply@mail.teamwise.work`.
2. **Production UAT for newer manager workflows** - verify `/availability`, `/schedule`, `/team`, `/approvals`, `/preliminary`, and `/publish` together against a real cycle before broader visual/branding work.
3. Run a full browser QA pass on desktop, tablet, and mobile before shipping (shared headers, `/schedule`, `/team/import`, `/settings/audit-log`).
4. **Add "Send reminders" bulk action** to the response roster on `/availability` — bulk email nudge for non-respondents is still the top operational gap.
5. **Print confidentiality footer** - unified schedule printing still needs an "Internal Use Only" footer.
6. **Wire GitHub -> Vercel auto-deploy** (optional) - connect `byonk19-svg/rt-scheduler` repo in Vercel dashboard under Git Integration so pushes trigger builds automatically.
7. Keep hardening the intake parser with concrete real-message examples before changing heuristics.
8. Deploy production after significant public-surface changes (`vercel deploy --prod`) so `www.teamwise.work` matches `main`.

### Verification Baseline

- As of 2026-05-05 on `main`, `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run test:unit` are the baseline quality gates; the latest full unit lane covered 1027 tests across 189 files.
- **Therapist browser validation path:** for `/therapist/settings`, `/therapist/recurring-pattern`, and `/therapist/availability`, prefer an automation-only auth setup over a human session. The validated local pattern is: read repo `.env.local`, create a temporary therapist user with the service-role client, authenticate Playwright/headless browser via Supabase SSR cookies on `127.0.0.1:3000`, capture the therapist routes, then delete the temporary user. Treat `SHOT_STAFF_EMAIL` / `SHOT_PASSWORD` as optional shortcuts only; if they fail, fall back to temp-user creation instead of giving up on the visual pass.
- `npm run lint`
- `npm run build`
- `npm run test:unit`
- `npm run test:e2e` when auth/env setup is available
- `vercel deploy --prod --yes` for production shipping
- Targeted availability lane: `npx vitest run src/app/availability/`
- Targeted schedule grid lane: `npx vitest run src/components/schedule-grid/schedule-grid-utils.test.ts src/components/schedule-grid/ScheduleGridTable.test.ts "src/app/(app)/schedule/page.test.ts" "src/app/(app)/coverage/page.test.ts" "src/components/shell/app-shell-config.test.ts"`
- Targeted shell/header lane: `npx vitest run src/components/shell/app-shell-config.test.ts src/components/AppShell.test.ts src/components/manager/ManagerWorkspaceHeader.test.ts src/app/(public)/signup/page.test.ts`
- Targeted theme lane: `npm run test:unit -- src/lib/theme.test.ts src/app/layout.theme.test.ts src/app/profile/theme-controls.test.ts src/app/globals.test.ts`
- Targeted template lane: `npm run test:unit -- src/lib/cycle-template.test.ts src/app/api/schedule/templates/route.test.ts src/app/schedule/template-wiring.test.ts`
- Targeted team import lane: `npm run test:unit -- src/lib/csv-import-parser.test.ts src/app/team/import/page.test.ts src/app/team/import/actions.source.test.ts src/components/team/EmployeeRosterPanel.test.ts`
- Targeted therapist conflict lane: `npm run test:unit -- src/lib/availability-scheduled-conflict.test.ts src/components/availability/TherapistAvailabilityWorkspace.test.ts src/app/(app)/availability/page.test.ts src/app/(app)/therapist/availability/page.test.ts`
- Targeted pre-flight lane: `npm run test:unit -- src/lib/coverage/pre-flight.test.ts src/app/api/schedule/pre-flight/route.test.ts src/app/(app)/schedule/preflight-wiring.test.ts`
- Targeted shift reminder lane: `npm run test:unit -- src/lib/shift-reminders.test.ts src/app/api/cron/shift-reminders/route.test.ts`
- Targeted analytics lane: `npm run test:unit -- src/lib/analytics-queries.test.ts src/app/analytics/page.test.ts src/components/shell/app-shell-config.test.ts`
- Targeted work-pattern lane: `npm run test:unit -- src/components/team/WorkPatternCard.test.ts src/components/team/WorkPatternEditDialog.test.ts src/app/team/work-patterns/page.test.ts`

## Recent changelog

**Session 88 (2026-04-25)** — Design system font swap + auth panel polish:

- Swapped DM Sans → Plus Jakarta Sans (UI font) and Fraunces → Instrument Serif (display/hero); updated `--font-sans` CSS variable in `globals.css`.
- Auth left panels (`/login`, `/signup`): dark teal background (`var(--marketing-hero-bg)`), amber right stripe, grid texture, Instrument Serif headline at `font-normal text-[2.625rem]` matching the homepage hero.
- Updated `DESIGN.md` typography section. Trimmed `CLAUDE.md` from 655 → 503 lines.

**Session 87 (2026-04-25)** — Homepage redesign to dark teal "Teamwise Refined" style (PR `#42`):

- Replaced the luminous light-mode homepage with a dark teal hero. As of session 89 (2026-04-27) the hero uses `bg-[var(--marketing-hero-bg)]` (not `bg-[var(--primary)]`) so the deeper `#1b3836` from the `Refined.html` design handoff renders correctly; subtle white grid texture, amber right stripe, amber eyebrow, serif headline "Scheduling that keeps care moving.", feature strip below.
- `PublicHeader` uses `bg-[var(--marketing-hero-bg)]` for the dark homepage variant so white text stays readable above the layout wrapper.
- Updated `src/app/page.test.ts` Vitest contracts to assert the new design.

Per-session detail for earlier sessions lives in `docs/SESSION_HISTORY.md` or `git log --oneline`.

For sessions 47–88 see `docs/SESSION_HISTORY.md` or `git log --oneline`.

## Data model gotcha — publish history ≠ schedule cycles

- `publish_events` (shown at `/publish`) and `schedule_cycles` (shown in `/schedule` selectors) are **separate tables**. Deleting a publish history record does NOT remove the cycle from the schedule selector.
- Preferred lifecycle action: **archive** old non-live cycles from `/publish`. That sets `schedule_cycles.archived_at` and removes the cycle from Schedule, Availability, therapist availability, and dashboard cycle pickers without deleting operational records.
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

## Source Structure

```
src/
├── app/
│   ├── (public)/     # Marketing, login, signup — public layout
│   ├── (app)/        # Authenticated routes — app shell layout
│   │   ├── coverage/ # /coverage - compatibility redirect
│   │   ├── schedule/ # /schedule - unified schedule grid + actions
│   │   ├── team/     # /team, /team/import, /team/work-patterns
│   │   ├── availability/, analytics/, approvals/, shift-board/
│   │   └── dashboard/manager/, dashboard/staff/
│   └── api/          # Route handlers (auth, schedule, inbound, cron)
├── components/
│   ├── ui/           # shadcn primitives
│   ├── schedule-grid/# Unified schedule grid components
│   ├── availability/ # Therapist + manager availability components
│   ├── shell/        # AppShell, AppHeader, app-shell-config.ts
│   └── public/       # PublicHeader, marketing components
└── lib/
    ├── auth/         # can.ts, login-utils.ts, supabase clients
    ├── coverage/     # generate-draft.ts, mutations.ts, selectors.ts
    └── calendar-utils.ts, theme.ts, ...
```

## Open UX Items

- [ ] **#4** After preliminary claim submit, add link to see pending request status
- [ ] **#5** Auto-draft result: surface summary (shifts assigned, unfilled, forced-date misses)
- [ ] **#6** Approvals: sort by age, add urgency signal
- [ ] **#7** Availability deadline: countdown chip on therapist dashboard

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
- full `npm run test:unit` pass (**1027 tests across 189 files** as of 2026-05-05)
- targeted `npx vitest run src/app/availability/actions.test.ts src/app/api/schedule/drag-drop/route.test.ts src/lib/coverage/mutations.test.ts` pass
- targeted `npx eslint` on touched files pass
- Playwright CLI smoke pass on `/` and `/schedule?shift=day` (redirect to login as expected, no console warnings)

Broader historical baseline:

- `npm run test:e2e` pass when Supabase service env is available; there are 26 Playwright spec files as of 2026-05-05 and default workers are set to `2`
- Full `npx vitest run` is green without real Supabase admin env: **`assignment-status`** route tests mock **`@/lib/supabase/admin`** (`createAdminClient`).
- Local auth E2E defaults to the `reset:e2e` / `seed:functional` demo manager (`demo-manager@teamwise.test` / `Teamwise123!`) when `CI` is not set; CI should still provide explicit credentials.

CI gates: format check → lint → tsc → build → Playwright E2E

Representative E2E specs:

- `e2e/proxy-routing.spec.ts` guards the active Next 16 Proxy route protection.
- `e2e/auth-redirect.spec.ts`, `e2e/authenticated-flow.spec.ts`, and `e2e/public-pages.spec.ts` cover auth and public entry surfaces.
- Workflow specs cover coverage, availability, lottery, requests, role journeys, publish lifecycle, staff onboarding, team quick edit, and therapist schedule trust.

## Primary Routes

- `/` public marketing (therapist-first luminous homepage; `globals.test` + `page.test` contracts)
- `/login`, `/signup`
- `/auth/signout`
- `/pending-setup` post-signup onboarding gate
- `/onboarding` authenticated first-run setup gate for therapists and leads
- `/dashboard` role redirect
- `/dashboard/manager`, `/dashboard/staff`
  - `/dashboard/manager` is the manager **Inbox** — h1 and nav label both read "Inbox"
- `/schedule` canonical unified schedule grid for manager editing, lead status updates, and therapist read-only team view
- `/coverage` compatibility redirect to `/schedule`
- `/approvals`
- `/availability`
- `/shift-board`
- `/lottery` shift lottery workflow (manager-facing, listed under Schedule in shell)
- `/notifications` authenticated notification history
- `/preliminary` preliminary schedule snapshot and approval flow
- `/swaps` — compatibility redirect → `/shift-board`
- `/settings` — compatibility redirect → `/profile`; `/settings/audit-log` is the audit log surface (People → Audit log)
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
- `therapist` / `lead` with `staff_onboarding_required = true` and no `staff_onboarding_completed_at`: authenticated staff user gated to `/onboarding` until required first-run setup is finished

Coverage lead eligibility remains separate at `profiles.is_lead_eligible`.
On the `/team` surface, lead eligibility is derived from the selected role when saving quick edit.
All permission checks go through `can(role, permission)` in `src/lib/auth/can.ts`, and inactive or archived users should be denied there.

## Staff Onboarding

- Required first-run route: `/onboarding`
- Applies to: `therapist` and `lead` only; managers skip it entirely
- Required steps:
  - `Set your normal schedule`
  - `Choose schedule preferences`
  - `Choose notifications and appearance`
- Recommended but non-blocking:
  - `Review Future Availability`
- Therapist settings now treat `No preference` as a first-class preferred-work-days answer. It must not be treated as missing setup.
- Approval resets onboarding-owned state (`preferred_work_days`, `preferred_work_days_mode`, onboarding confirmation timestamps, and `work_patterns`) so a re-approved staff account starts clean.

## Key Shared Components

- `src/components/ui/page-header.tsx` — `<PageHeader>` is a compatibility wrapper around `PageIntro`; use the shell primitives directly for new work
- `src/components/motion-provider.tsx` — client root wrapper: Framer **`MotionConfig reducedMotion="user"`** (respects **`prefers-reduced-motion`**); used from `src/app/layout.tsx`
- `src/components/manager/ManagerWorkspaceHeader.tsx` - canonical manager-style route header for `/availability`, `/schedule`, `/team`, `/approvals`, `/publish/[id]`, and staff **`/requests/new`**
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

- `--primary` (`#276e66`, `hsl(174 48% 29%)`) — primary buttons, nav pills, links, focus rings. Source: `Refined.html` design handoff `--teal-btn`. Do **not** revert to the older `#1e5c64`/`hsl(187 55% 28%)`; that hue is locked out by `globals.test.ts`.
- `--marketing-hero-bg` (`#1b3836`, `hsl(174 35% 16%)`) — homepage hero, `/login` and `/signup` left brand panels, `PublicHeader` dark variant. Distinct from `--primary` on purpose (deeper near-black-green). Do **not** alias back to `var(--primary)`.
- `--attention` (`#f0a030`, `hsl(38 90% 55%)`) — brand personality only: user avatar, logo accent, hero CTA fill; **not** for primary actions.
- `--warning-*` / `--success-*` / `--error-*` / `--info-*` — all status badge families.
- `--foreground`, `--muted-foreground`, `--border`, `--card`, `--muted`, `--secondary` — layout tokens.

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
- **Schedule grid is the only live schedule layout:** new schedule UI work belongs under `src/components/schedule-grid/` and `src/app/(app)/schedule/`; `/coverage` should remain a redirect-only compatibility route.
- **Schedule grid cell actions route through existing mutations:** assignment/unassignment uses `src/lib/coverage/mutations.ts`, status updates use the existing schedule assignment-status API, and lead designation uses the existing `set_lead` mutation path.
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

## Schedule UX

`/schedule` is the canonical live schedule workspace for all roles:

- Managers can assign and unassign therapists from grid cells in draft cycles.
- Managers can designate a scheduled therapist as lead from the cell status popover.
- Managers and leads can update published assignment status (`Scheduled`, `On call`, `Cancelled`, `Call-in`, `Left early`) from staffed cells; leads cannot assign new therapists.
- Therapists see the same grid read-only, with their own row pinned at the top and labeled `You`.
- `Need Off` (`force_off`) renders as an informational `*` marker and warning in the assign/status popover; it does not hard-block manager assignment.
- Day/Night shift tabs use `src/lib/coverage/coverage-shift-tab.ts` and update the `shift` query while preserving other params.
- `/coverage`, `/staff/schedule`, `/staff/my-schedule`, and `/therapist/schedule` are compatibility redirects to `/schedule` and should not regain UI ownership.

Key files:

- `src/app/(app)/schedule/page.tsx` - canonical server route
- `src/app/(app)/schedule/schedule-grid-data.ts` - server loader
- `src/components/schedule-grid/ScheduleGrid.tsx` - client wiring
- `src/components/schedule-grid/ScheduleGridTable.tsx` - grid rendering
- `src/components/schedule-grid/AssignCellPopover.tsx` and `StatusCellPopover.tsx` - cell actions

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

## Navbar / Branding

- Logo: amber icon (`var(--attention)`) + Teamwise wordmark
- Active nav pill: `var(--primary)` teal (`#276e66`, hue 174°)
- User avatar: `var(--attention)` amber
- Manager badge: `bg-[var(--warning-subtle)] text-[var(--warning-text)] border-[var(--warning-border)]`
- App shell header `z-30`; schedule cell popovers must render above grid scroll containers.
- Manager nav (top bar): Dashboard → Schedule → People (user avatar dropdown → Settings / Therapist view / Log out)
  - Schedule sub-nav: Schedule (`/schedule`) -> Analytics -> Availability -> Lottery -> Publish -> Approvals
  - People sub-nav: Team → Requests (includes access requests with badge) → Shift Board → Audit log (`/settings/audit-log`)
- **Old sidebar is gone** — do not restore it. Nav is now a fixed horizontal top bar.
- Manager shell IA uses primary sections `Dashboard`, `Schedule`, and `People`
- `Schedule` secondary nav items are `Schedule`, `Analytics`, `Availability`, `Lottery`, `Publish`, and `Approvals`
- `People` secondary nav items are `Team`, `Requests`, `Shift Board`, and `Audit log`
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

- Manager publishes from `/schedule` -> triggers email queue via `notification_outbox` and immediately processes the queued emails in the publish action
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

- `20260409124000_pending_signup_access_requests.sql` (nullable `profiles.role`, pending-aware `handle_new_user`)
- `20260409145500_fix_custom_access_token_hook_for_pending_users.sql` (omit null `user_role` claim)
- `20260412164000_sync_lead_eligibility_to_role.sql` (sync legacy `is_lead_eligible` to `role`)
- `20260413083000_add_default_schedule_view_to_profiles.sql` (`profiles.default_schedule_view`)
- `20260513150000_freeze_default_schedule_view.sql` freezes the retired layout preference at `week` for Schedule Grid Unification compatibility.
- `20260413123000_add_employee_roster_and_name_match_signup.sql` (`employee_roster`, name-match **`handle_new_user`**)
- `20260424190000_add_shift_post_visibility.sql`
- `20260424203000_add_shift_post_recipient_response.sql`
- `20260424213000_enforce_direct_request_acceptance.sql`
- `20260424233000_add_shift_post_interests.sql` (`shift_post_interests.status`, deterministic pickup queue)
- `20260425100000_add_shift_post_request_kind.sql`
- `20260425113000_add_shift_post_withdrawn_status.sql`
- `20260425124500_add_direct_request_decline_withdraw_notifications.sql`
- `20260425133000_add_direct_request_manager_resolution_notifications.sql`
- `20260425143000_add_shift_post_interest_selected_guard.sql`
- `20260426090000_harden_shift_post_request_mutations.sql`
- `20260426120000_expand_work_patterns_for_therapist_recurring_templates.sql` (advanced `work_patterns` fields: `pattern_type`, `weekly_weekdays`, `weekend_rule`, `cycle_anchor_date`, `cycle_segments`)
- `20260428123000_fix_shift_post_request_operational_entry_check.sql`
- `20260429100000_reassert_shift_post_approval_transfer_trigger.sql`
- `20260429103000_apply_pickup_transfer_inside_review_rpc.sql`
- `20260429110000_finalize_direct_request_eligibility.sql`
- `20260429134500_add_staff_onboarding_gate.sql` (`staff_onboarding_required` flag, onboarding gate route)
- `20260429135500_require_staff_onboarding_for_matched_signups.sql`
- `20260504153000_preserve_team_swap_partner_selections.sql`
- `20260504154500_fix_team_swap_partner_operational_entry_guard.sql`
- `20260504210500_allow_manager_approval_for_direct_pickups.sql`

## Health Stack

- typecheck: npx tsc --noEmit
- lint: npm run lint
- test: npm run test:unit
- deadcode: npx knip
