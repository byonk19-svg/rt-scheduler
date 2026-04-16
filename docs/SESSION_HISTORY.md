# Session History

## Session 80 - 2026-04-16

- Standardized the sitewide header system around shared shell primitives in `src/components/shell/`: one sticky authenticated `AppHeader`, route-driven `LocalSectionNav`, and shared `PageIntro` treatment for manager/page headers.
- Added `src/components/public/PublicHeader.tsx` and mounted it from `src/app/(public)/layout.tsx`, removing repeated top-bar markup from `/`, `/login`, `/signup`, and `/reset-password`.
- Rebased `AppShell` onto `app-shell-config.ts`, removed the old stacked dark secondary sticky bar, and kept `/schedule` inside the authenticated shell as a read-only roster surface rather than a standalone top-header screen.
- `/schedule` is live for managers/leads: `loadScheduleRosterPageData` / `schedule-roster-live-data.ts` (cycles, shifts, therapist submissions, overrides); `schedule-roster-data.ts` maps rows to the roster store. Removed mock/demo roster paths, `EmptyStateBanner`, and public `/schedule` in `src/proxy.ts`; non-privileged users redirect away from `/schedule`.
- Verified with targeted Vitest (`app-shell-config`, `AppShell`, `ManagerWorkspaceHeader`, public signup shell, schedule roster data) and ESLint. Repo-wide `npx tsc --noEmit` still fails on the unrelated `EmployeeRosterPanel.test.ts` fixture missing `matched_email`.

## Session 78 - 2026-04-16

- `/coverage` now ships both day and night therapist/roster datasets in the initial server snapshot and swaps them locally, eliminating the old post-hydration Supabase reads when managers switch shift tabs.
- Removed the decorative `framer-motion` wrappers from `CoverageClientPage.tsx`; the production build now reports the `/coverage` entry chunk at about `89.7 KB` instead of `91.3 KB`.
- `/availability` now loads email-intake rows only on the intake tab and skips planner override reads there, while `shift-board` approve/deny actions stop reloading the entire board after a successful save.

## Session 77 - 2026-04-16

- Removed the authenticated-layout `MotionProvider` wrapper so `framer-motion` no longer ships across the full app shell.
- Added `DeferredNotificationBell` to keep the unread badge in the shell while deferring the full notification dropdown client logic until after hydration.
- Lazy-loaded closed dialogs on `/coverage` and code-split the directory vs roster-admin panels on `/team`, cutting the measured route chunks to about `91.3 KB` for `/coverage` and `7.8 KB` for the `/team` entry chunk in the production build.

## Session 76 - 2026-04-16

- Split the App Router tree into public and authenticated route groups so the root layout stays lightweight while app-shell auth, unread counts, motion, and nav chrome live in `src/app/(app)/layout.tsx`.
- Converted `/dashboard/manager` to server-first rendering with a route loading shell, and removed the old client bootstrapping path.
- Refactored `/coverage` to hydrate from a server-generated snapshot (`coverage-page-data.ts` / `coverage-page-snapshot.ts`), deferred notification panel fetches until open, parallelized `/team` reads, and reduced schedule grid/roster recomputation.

## Session 74 - 2026-04-16

- Replaced the old `/schedule` redirect entrypoint with a standalone mock manager roster screen built from `src/components/schedule-roster/*` and `src/lib/mock-coverage-roster.ts`.
- Made `/schedule` public in `src/proxy.ts` so the mock screen can be reviewed without auth, while leaving `/coverage` as the protected live scheduling workspace.
- Tightened the roster matrix so all 6 weeks fit on standard desktop widths and replaced the oversized gap before `PRN coverage` with a bold divider.

## Session 72 - 2026-04-15

- Reworked `/coverage` into a compact scheduling workspace: tighter header, unified planning toolbar, lighter summary cards, slim setup/live-status banners, denser weekly grid, and tighter roster matrix.
- Simplified grid day cells and tightened the shift editor: less repeated text, more visual status signaling, ranked modal candidates, and stronger selected-state treatment.
- Fixed slow roster `+` clicks by opening the day editor immediately and reducing roster re-render cost with memoized roster sections/tables plus a deferred selected-day highlight.

## Session 71 - 2026-04-15

- Removed the public signup roster-match check so `/signup` no longer leaks whether a full name exists in `employee_roster`.
- Successful signup now always redirects to `/login?status=requested`; matched users can still be auto-provisioned server-side by the signup trigger, but the public UI no longer exposes that distinction.
- Hardened `GET /auth/signout` with the same trusted-origin gate as `POST /auth/signout` to block cross-origin logout requests without breaking same-origin cleanup redirects.

## Session 69 - 2026-04-15

- Availability intake parser hardening:
  - reduced PTO employee-block emails now split on repeated `Employee Name:` headers
  - repeated blocks for the same employee merge back into one intake item
  - weekday recurrence phrases like `Off Tuesday + Wednesdays` expand across the active block when the cycle window is known
  - malformed OCR fragments stay in `needs_review` instead of creating guessed work dates

## Session 66 - 2026-04-14

- `/availability` moved to the current planner-first manager structure.
- The manager page now uses header summary chips, planner/intake tabs, and the 3-column planner workbench.
- The calendar-centered planner became the baseline direction for later polish.

## Session 67 - 2026-04-14

- Final polish pass on `/availability`:
  - retained the current header and 3-column planner workspace
  - compacted the lower half into one shared **Secondary workflow** surface
  - tabbed **Response roster** and **Request inbox**
  - denser roster rows with initials, compact status, request signal, and last activity
  - compact inbox empty state instead of a large blank table region
  - disabled planner save text changed to **`Select dates to save`**
- `/team` now uses dedicated workspace/filter/row/table components for denser team management and employee-roster administration.
- Availability intake utilities gained additional parser/edit coverage in `src/lib/availability-email-intake.ts`.
