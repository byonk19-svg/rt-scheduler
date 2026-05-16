# Role Permissions and Access Safety Audit

Last updated: 2026-05-16

## Scope

This audit covers role-based access for therapists, leads, and managers across route protection, server actions, API routes, Supabase/RLS boundaries, navigation, UI action buttons, Day/Night/Both visibility, and read-only versus editable states.

No schema changes were made. RLS was not weakened.

## Canonical Role Model

| Role      | Expected access                                                                                                               | Editable surfaces                                                                                            |
| --------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Therapist | Personal schedule, Team Schedule visibility, personal availability, own shift requests, own Lottery context                   | Own availability while the window is open; own request lifecycle actions                                     |
| Lead      | Therapist access plus operational lead tools and broader Team Schedule/Lottery visibility                                     | Assignment status updates where lead tools are allowed; no manager final approval or schedule-build controls |
| Manager   | Full scheduling, coverage, availability management, publish, approvals, roster, exports, audit log, Lottery decision controls | Manager-owned scheduling, staffing, publish, approval, roster, export, and audit workflows                   |

Shift visibility is not edit permission. Day, Night, and Both are display or availability scope controls unless an explicit role permission also grants the action.

## Current Safe Patterns

- `src/lib/auth/can.ts` is the shared permission gate. It already rejects inactive or archived actors when callers pass lifecycle context.
- `src/proxy.ts` blocks unauthenticated users, pending users, inactive users, and archived users before app routes render.
- `src/app/(app)/schedule/schedule-grid-data.ts` derives schedule edit flags from role permissions, not from the selected Day/Night tab.
- `src/components/schedule-grid/ScheduleGrid.tsx` and `ScheduleGridToolbar.tsx` hide or no-op manager controls when `canManageCoverage` is false.
- Supabase migrations keep core schedule, shift post, lottery, and schedule-mutating RPC paths behind role/site checks or server-mediated execution.

## Fixes Applied

### Lifecycle-aware server action checks

Several server action helpers previously returned or checked only `role`. They now include lifecycle state so inactive or archived users with a stale manager/lead role cannot continue privileged mutations.

- `src/app/(app)/schedule/actions/helpers.ts`
  - `getRoleForUser()` now selects `role, is_active, archived_at` and returns `null` for inactive or archived profiles.
- `src/app/(app)/availability/_actions/shared.ts`
  - `getAuthenticatedUserWithRole()` now returns `permissionContext`.
- Availability manager action modules now pass that context into `can()` before planner, manager-request, copy, reminder, window, and email-intake mutations.
- `src/app/(app)/publish/actions.ts` and `src/app/(app)/approvals/actions.ts` now use lifecycle-aware manager checks.

### Lifecycle-aware restricted exports and pages

Broad exports and manager-only pages now pass lifecycle context into `can()`.

- `src/app/api/availability/export/route.ts`
- `src/app/api/schedule/export/route.ts`
- `src/app/api/team/roster/export/route.ts`
- `src/app/(app)/availability/page.tsx`
- `src/app/(app)/availability/intake/page.tsx`
- `src/app/(app)/publish/page.tsx`
- `src/app/(app)/approvals/page.tsx`
- `src/app/(app)/settings/audit-log/page.tsx`
- `src/app/(app)/team/page.tsx`
- `src/app/(app)/team/import/page.tsx`
- `src/app/(app)/requests/page.tsx`
- `src/app/(app)/requests/user-access/page.tsx`
- `src/app/(app)/publish/[id]/page.tsx`
- `src/app/(app)/staff/history/page.tsx`
- `src/app/(app)/dashboard/manager/page.tsx`

### Lottery actor lifecycle gate

`src/lib/lottery/service.ts` now rejects inactive or archived profiles in `loadLotteryActor()`. This protects Lottery page/API entry points that rely on the actor object.

Lottery page visibility remains intentionally broader than manager-only because existing product docs describe Lottery visibility for therapists and leads. Manager-only operations still remain manager-gated inside the Lottery service.

## Tests Added Or Updated

- `src/app/(app)/availability/actions.test.ts`
  - Added regression coverage that an inactive manager is blocked before manager planner mutations.
- `src/app/api/role-access.source.test.ts`
  - Locks broad export endpoints to lifecycle-aware `can()` checks.
- `src/lib/lottery/actor-access.source.test.ts`
  - Locks `loadLotteryActor()` to lifecycle-aware actor loading.
- `src/app/(app)/schedule/actions/role-lifecycle.source.test.ts`
  - Locks schedule action role lookup to lifecycle-aware behavior.
- Existing page/action tests were updated where mocks expected the older role-only profile select.

## Permission Rules That Remain Unclear

These should stay documented until product/security rules are made explicit.

- Lead Lottery scope: docs say leads need Lottery visibility and day-of operational access, while manager-only apply/override controls remain enforced. Do not convert `/lottery` to manager-only without confirming whether lead read access should survive.
- Therapist Lottery scope: docs say therapists can see their lottery order/context without manager controls. Keep action controls gated separately from page visibility.
- `both` availability scope: `both` is valid for availability overrides, but schedule mutation RPCs apply only Day/Night slots. Treat `both` as availability intent, not as schedule edit scope.
- Service-role RPC identity: schedule-mutating RPCs pass `p_actor_id`; future changes should preserve app-layer human authorization before service-role execution.

## Remaining Watch Items

- Some manager pages still rely on proxy plus page-level checks. The highest-risk mutation/export paths are now lifecycle-aware, but future privileged pages should select `role, is_active, archived_at` by default.
- Supabase policy rewrites for performance should be periodically verified as effective table/action/role matrices, especially after RLS migrations.
