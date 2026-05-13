# Supabase Constraint Remediation Plan

Generated: 2026-05-10
Project: rt-scheduler (`fjbkfgvdzidvfaxrqzjz`)
Source artifacts:

- `output/supabase-schema-audit-2026-05-10.md`
- Live catalog checks for constraints, indexes, foreign keys, and current data violations

## Objective

Fix every schema issue identified in the audit thread without breaking existing data, RLS behavior, server actions, or workflow lifecycle rules.

The safe path is not one giant migration. Use staged migrations with explicit preflight checks, tiny backfills, `NOT VALID` checks where useful, validation after cleanup, and focused tests around the affected workflows.

## Implementation Status

Status: implemented locally and applied to the linked Supabase database.

Primary migration: `supabase/migrations/20260510015047_harden_schema_constraints.sql`
Advisor migration: `supabase/migrations/20260510023115_remediate_rls_performance_advisors.sql`
Rollback coverage: `supabase/rollback/20260510015047_harden_schema_constraints.rollback.sql`

Completed fixes:

- Legacy nullable catalog gaps are closed for role, created timestamps, cycle publication state, and reminder outbox ownership fields.
- Duplicate-prone identities now have unique protection for normalized profile email, roster-to-profile matching, cycle site/date ranges, and pending standard shift posts.
- Soft site references now point at a canonical `public.sites` table with RLS enabled and validated FKs from the existing site-scoped tables.
- Email-intake provenance columns on availability overrides now have validated nullable FKs.
- Lifecycle and value constraints are in place for schedule cycle dates, work-pattern shift preference, status-change values, notification/audit target values, reminder/intake counters, shift-post/direct-request state, pickup-interest response timestamps, left-early metadata, availability override metadata, preliminary approvals, and lottery suppression/invalidation metadata.
- The known live pickup-interest cleanup is handled narrowly by clearing `responded_at` only for rows still in `pending` or `selected` state.
- Targeted Supabase advisor findings were remediated: missing FK indexes, duplicate `work_patterns` permissive policy shape, mutable `search_path` on flagged touch functions, and broad execute grants on trigger/internal helper functions.
- Remaining Supabase performance advisor findings were remediated in a follow-up migration by consolidating overlapping permissive policies, splitting broad `ALL` policies where they overlapped reads, and wrapping RLS `auth.uid()` / `auth.role()` calls in `(select ...)`.
- `src/lib/supabase/database.types.ts` was regenerated from the local schema and patched where RPC nullability is still more precise than generated output.
- Demo seed scripts now create the relevant `sites` row before inserting site-scoped profiles.

Verification completed:

- `npx supabase db reset --local --no-seed`
- `npx supabase db lint --local`
- Targeted catalog re-audit:
  - `unindexed_fk_count = 0`
  - `missing_expected_constraints = 0`
  - `nullable_expected_not_null_columns = 0`
  - trigger/internal helper function execute grants for `anon`, `authenticated`, and `public` are `0`
  - flagged touch functions have fixed `search_path`
  - `public.sites` has RLS enabled
- `npx supabase db advisors --local --level warn --type security -o json` returned `No issues found`.
- `npx supabase db advisors --local --level warn --type performance -o json` returned `No issues found`.
- `npx supabase db push` applied the pending migrations to the linked Supabase database.
- Remote migration history is synced through `20260510023115_remediate_rls_performance_advisors.sql`.
- Remote `npx supabase db advisors --db-url ... --level warn --type security -o json` returned `No issues found`.
- Remote `npx supabase db advisors --db-url ... --level warn --type performance -o json` returned `No issues found`.
- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- Focused migration coverage in `src/lib/schema-constraint-remediation.test.ts`.

Remaining operational note:

- Supabase Auth leaked-password protection was not reported by the final remote security advisor run. If it appears in the dashboard separately, treat it as a project Auth configuration setting rather than a SQL schema migration.

## Live Data Precheck Summary

Current data is mostly ready for constraints:

- Nullability candidates currently have `0` null rows.
- Duplicate candidates currently have `0` duplicate groups.
- Date-range candidate `schedule_cycles.end_date >= start_date` has `0` violations.
- Most lifecycle cross-field candidates have `0` violations.
- One known live cleanup is required before adding a pickup-interest timestamp invariant:
  - `shift_post_interests.responded_at_set_for_pending_selected = 1`

## Phase 1 - Low-Risk Column Constraints

Add constraints that current data already satisfies and app code already appears to expect.

### 1.1 Set legacy nullable timestamps to `NOT NULL`

Columns:

- `public.profiles.created_at`
- `public.schedule_cycles.created_at`
- `public.availability_requests.created_at`
- `public.shift_posts.created_at`
- `public.shifts.created_at`

Migration shape:

- Backfill any future drift defensively with `coalesce(column, now())`.
- `alter table ... alter column ... set not null`.

Risk:

- Low. Current live precheck shows zero nulls.

Verification:

- Query each column for null count after migration.
- Run typecheck and schedule/request unit tests that insert these rows.

### 1.2 Make `schedule_cycles.published` `NOT NULL`

Migration shape:

- `update public.schedule_cycles set published = false where published is null`.
- `alter table public.schedule_cycles alter column published set not null`.

Risk:

- Low. Existing code already treats it as boolean and often uses `Boolean(cycle.published)`.

Verification:

- Check no nulls.
- Run schedule create/delete/publish action tests.

### 1.3 Make `profiles.role` `NOT NULL`

Migration shape:

- Preflight query for null roles.
- If nulls ever appear, backfill only from trusted roster/auth mapping; do not guess roles silently.
- Current live data has zero nulls, so the migration can fail fast if nulls appear.
- `alter table public.profiles alter column role set not null`.

Risk:

- Moderate because signup/profile creation touches this column.

App/test impact:

- Verify `handle_new_user`, signup bootstrap, roster-matching, and onboarding tests still insert role.

## Phase 2 - Uniqueness And Identity Constraints

### 2.1 Unique normalized profile email

Issue:

- `profiles.email` is not unique.

Migration shape:

- Add unique index on `lower(email)`:
  - `create unique index if not exists profiles_lower_email_unique_idx on public.profiles (lower(email));`

Risk:

- Moderate. Email is app identity-adjacent.

Preflight:

- `select lower(email), count(*) from public.profiles group by lower(email) having count(*) > 1;`
- Current live duplicate groups: `0`.

App/test impact:

- Verify seeded/demo users do not reuse email case variants.

### 2.2 One roster row per matched profile

Issue:

- `employee_roster.matched_profile_id` is not unique.

Migration shape:

- Add partial unique index:
  - `create unique index if not exists employee_roster_matched_profile_unique_idx on public.employee_roster (matched_profile_id) where matched_profile_id is not null;`

Risk:

- Low to moderate. Current duplicate groups: `0`.

Verification:

- Roster import and signup matching tests.

### 2.3 Prevent duplicate cycles per site/date range

Issue:

- `schedule_cycles` has no uniqueness for the same `site_id/start_date/end_date`.

Migration shape:

- Add unique index:
  - `create unique index if not exists schedule_cycles_site_date_range_unique_idx on public.schedule_cycles (site_id, start_date, end_date);`

Risk:

- Moderate. Cycle labels can repeat, but exact duplicate date ranges per site should not.

Rejected:

- Unique `(site_id, lower(label))` for now. Labels can be user-facing and may be reused historically.

Verification:

- Cycle creation tests and live preflight duplicate query.

### 2.4 Prevent duplicate active standard shift posts

Issue:

- Only pending call-in posts have a uniqueness guard. Pending standard posts can duplicate per shift/type.

Migration shape:

- Add partial unique index:
  - `create unique index if not exists shift_posts_one_pending_standard_per_shift_type_idx on public.shift_posts (shift_id, type) where request_kind = 'standard' and status = 'pending' and shift_id is not null;`

Risk:

- Moderate because request workflows depend on exact duplicate semantics.

Preflight:

- Current duplicate groups: `0`.

Verification:

- Shift-board request creation, direct request, pickup queue, and manager approval tests.

## Phase 3 - Missing CHECK Constraints

### 3.1 Schedule cycle date range

Issue:

- No check enforcing `end_date >= start_date`.

Migration shape:

- `alter table public.schedule_cycles add constraint schedule_cycles_date_range_check check (end_date >= start_date) not valid;`
- Validate after preflight.

Risk:

- Low. Current violations: `0`.

### 3.2 Work pattern shift preference

Issue:

- `work_patterns.shift_preference` is text with no allowed-value check.

Migration shape:

- `alter table public.work_patterns add constraint work_patterns_shift_preference_check check (shift_preference in ('day', 'night', 'either')) not valid;`
- Validate after preflight.

Risk:

- Low. Current violations: `0`.

### 3.3 Shift status-change values

Issue:

- `shift_status_changes.from_status` and `to_status` are unconstrained text.

Migration shape:

- Add checks allowing known legacy/planned and operational status values:
  - `scheduled`, `on_call`, `sick`, `called_off`, `call_in`, `cancelled`, `left_early`

Risk:

- Moderate because this table bridges legacy `shifts.status` and `assignment_status`.

Verification:

- Assignment-status RPC tests and schedule operational-entry tests.

### 3.4 Notification and audit event/target values

Issues:

- `notifications.event_type`, `notifications.target_type`, `audit_log.action`, `audit_log.target_type`, and `resend_webhook_receipts.event_type` are unconstrained text.

Migration shape:

- First create a repo-derived enum list from current notification/audit producers.
- Add checks only for values emitted by app code and existing rows.
- Prefer `NOT VALID` then validate.

Risk:

- Moderate to broad. Event names change over time and can be produced by background jobs.

Implementation note:

- Do not freeze an incomplete event list. Search all inserts into these tables before writing the check.

### 3.5 Non-negative counters

Issues:

- `shift_reminder_outbox.attempt_count` lacks `>= 0`.
- `availability_email_intakes.item_count`, `auto_applied_count`, `needs_review_count`, `failed_count` lack `>= 0`.

Migration shape:

- Add non-negative checks.
- Consider an additional consistency check:
  - `item_count >= auto_applied_count + needs_review_count + failed_count`

Risk:

- Low for non-negative checks; moderate for the aggregate consistency check.

## Phase 4 - Foreign-Key And Site Integrity Gaps

### 4.1 Link availability override intake source columns

Issue:

- `availability_overrides.source_intake_id` and `source_intake_item_id` are UUID columns with indexes but no FK.

Migration shape:

- Add nullable FKs:
  - `source_intake_id -> availability_email_intakes(id) on delete set null`
  - `source_intake_item_id -> availability_email_intake_items(id) on delete set null`

Risk:

- Low. They are nullable provenance links.

Preflight:

- Find non-null values that do not exist in target tables before adding constraints.

### 4.2 Normalize `site_id`

Issue:

- Many tables carry `site_id text`, but there is no `sites` table.

Migration shape:

- Add `public.sites(id text primary key, name text not null, created_at timestamptz not null default now())`.
- Seed `('default', 'Default')`.
- Add FKs from `profiles`, `schedule_cycles`, `shifts`, `cycle_templates`, `lottery_*` site columns to `sites(id)`.

Risk:

- Broad. This touches tenant scoping and RLS assumptions.

Safe sequencing:

- Add `sites` table and seed first.
- Add FKs as `NOT VALID`.
- Validate after confirming every existing `site_id` has a matching site row.

### 4.3 `resend_webhook_receipts.email_id`

Issue:

- `email_id` is a soft external email id. No internal email/send table owns it directly.

Plan:

- Do not add an FK unless a durable sent-email table is introduced.
- Add documentation/comment explaining that `svix_id` is the idempotency key and `email_id` is provider metadata.
- Optionally add a non-unique index on `email_id` where not null for diagnostics.

## Phase 5 - Lifecycle Cross-Field Constraints

Use `CHECK ... NOT VALID` for all of these, with preflight functions or queries. These constraints protect invariants even when writes bypass app code.

### 5.1 `shift_posts`

Constraints:

- Approved posts require `claimed_by is not null`.
- Expired posts require `expired_at is not null`.
- Direct posts require `recipient_response is not null`.
- Team posts require `recipient_response is null`.
- `recipient_responded_at` requires `recipient_response in ('accepted', 'declined')`.
- For direct accepted/declined requests, `recipient_responded_at is not null`.

Risk:

- Moderate. Must align with direct-request lifecycle RPCs and historical rows.

### 5.2 `shift_post_interests`

Constraints:

- `status in ('withdrawn', 'declined')` requires `responded_at is not null`.
- `status in ('pending', 'selected')` should require `responded_at is null`.

Known cleanup:

- One current row violates the second rule. Normalize that row first if it is truly active.

### 5.3 `shifts`

Constraints:

- `assignment_status = 'left_early'` requires `left_early_time is not null`.
- `left_early_time is not null` requires `assignment_status = 'left_early'`.
- `availability_override = true` requires reason, actor, and timestamp.
- `availability_override = false` requires override metadata to be null.

Risk:

- Moderate because `assignment_status` is a legacy mirror and active operational truth now lives in `shift_operational_entries`.

### 5.4 Preliminary workflow

Constraints:

- `preliminary_requests.status = 'approved'` requires `approved_by` and `approved_at`.
- Non-approved preliminary requests should not carry approval metadata.

Risk:

- Low. Current violations: `0`.

### 5.5 Lottery workflow

Constraints:

- Suppressed lottery requests require `suppressed_at` and `suppressed_by`.
- Active lottery requests should not carry suppression metadata.
- Invalidated lottery history entries require `invalidated_by` and `invalidated_reason`.
- Non-invalidated entries should not carry invalidation metadata.

Risk:

- Low. Current violations: `0`.

## Phase 6 - Supabase Advisor Findings

### 6.1 SECURITY DEFINER functions executable by `anon` / broad `authenticated`

Issue:

- Advisors flagged public executable security-definer functions.

Plan:

- Inventory every flagged function.
- Split into trigger-only helpers, internal service-role RPCs, and intentionally authenticated RPCs.
- Revoke trigger-only helpers from `public`, `anon`, and `authenticated`.
- Keep authenticated grants only for functions intentionally called from client/server authenticated contexts.
- Add comments documenting intent.

Risk:

- High if done blindly. Some authenticated RPCs are expected app entrypoints.

Verification:

- Run route/action tests for shift posts, pickup interest, schedule lifecycle, and lottery after revokes.

### 6.2 Mutable function `search_path`

Issue:

- Advisors flagged missing fixed `search_path` on `touch_therapist_availability_submissions_updated_at` and `touch_employee_roster_updated_at`.

Plan:

- Recreate both functions with `set search_path = public`.
- Preserve function body and ownership.

Risk:

- Low.

### 6.3 Unindexed foreign keys

Issue:

- Performance advisor flagged many FK columns without covering indexes.

Plan:

- Add indexes only for high-use joins/filter paths first:
  - availability email intake matched/review actor fields
  - availability overrides therapist/created_by if not covered
  - lottery actor/decision references used by history/admin views
  - employee roster matched/actor references
- Avoid indexing every nullable audit actor column if no query path uses it.

Risk:

- Low to moderate. Too many indexes can slow writes, so this should be targeted.

### 6.4 Multiple permissive `work_patterns` policies

Issue:

- Advisor flags overlapping permissive policies.

Plan:

- Consolidate manager/therapist policies by command where possible.
- Preserve exact visibility and write semantics.
- Add RLS regression tests or SQL policy smoke checks.

Risk:

- Moderate because RLS regressions are easy to miss.

### 6.5 Leaked password protection disabled

Issue:

- Auth setting, not schema.

Plan:

- Enable leaked password protection in Supabase Auth dashboard or through supported config/API if available.
- This is not a migration-file fix.

Risk:

- Low operationally, but it can affect test/demo accounts with weak passwords.

## Phase 7 - App And Type Updates

After migrations:

- Regenerate `src/lib/supabase/database.types.ts`.
- Update tests/mocks that insert rows missing newly required fields.
- Search for inserts into affected tables and confirm defaults cover omitted fields.
- Add focused SQL or unit tests for:
  - schedule cycle date range
  - profile role not null
  - shift-post lifecycle checks
  - pickup-interest timestamp normalization
  - work pattern shift preference
  - notification/audit event checks

## Phase 8 - Verification Sequence

Run in this order:

1. `npx supabase migration new harden_schema_constraints`
2. Build the migration in small sections.
3. `npx supabase db reset --local --no-seed`
4. `npx supabase db lint --local`
5. Direct SQL preflight queries against local and remote.
6. `npx supabase db push --dry-run`
7. `npm run lint`
8. `npx tsc --noEmit`
9. `npm run test:unit`
10. Focused E2E only where auth/env is available and workflows are affected.

Do not push to remote until local reset/lint and dry-run are clean.

## Rollback Strategy

- Each constraint/index must be named explicitly.
- For every migration section, keep a matching rollback snippet in `supabase/rollback/`.
- Prefer additive constraints and indexes so rollback is dropping named constraints/indexes.
- Avoid destructive data rewrites. The only known data cleanup is clearing `responded_at` on one active `shift_post_interests` row if confirmed by row inspection.

## Execution Order Recommendation

1. Add low-risk nullability and simple checks.
2. Add uniqueness constraints with clean duplicate prechecks.
3. Add missing FKs except `sites`.
4. Add lifecycle cross-field checks as `NOT VALID`, then validate.
5. Add `sites` table and validate tenant FKs in a separate migration.
6. Remediate advisors in separate security/performance migrations.
7. Regenerate types and update tests after schema is stable.
