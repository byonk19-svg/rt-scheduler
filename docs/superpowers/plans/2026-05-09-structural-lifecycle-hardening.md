# Structural Lifecycle Hardening Implementation Plan

## Goal

Close the structural gaps identified across operational shift status, availability intent, Shift Board transitions, Schedule Block lifecycle, intake apply semantics, publish/preliminary consistency, Coverage permission feedback, publish code organization, and Team feedback contracts.

This is a correctness and lifecycle plan, not a UI redesign. Keep changes incremental, preserve existing user-facing workflows, and use current domain language from `CONTEXT.md`.

## Decisions Locked

- `shift_operational_entries` is the source of truth for live operational status.
- `shifts.status` and `shifts.assignment_status` are legacy compatibility fields and must not be treated as authoritative live state.
- `availability_overrides.source` says who/channel wrote a row, not why it exists.
- Availability intent must be explicit and queryable.
- Schedule Block lifecycle should first be centralized in code as a resolved state before introducing a durable DB enum.
- Publishing a Schedule Block must supersede any active preliminary snapshot for that block.
- Shift Board stays one workflow, but its transitions should be explicit domain commands.
- Intake parser confidence is not applied state; an item is applied only after availability writes succeed.
- Client Coverage permissions are display hints; server actions and API routes remain authority and must report denied states clearly.

## Phase 0 - Safety Inventory

Purpose: prove current behavior before changing lifecycle code.

Tasks:

- Add or extend source-contract tests that locate remaining direct reads of live operational status from `shifts.assignment_status`.
- Add a DB migration/source test that identifies impossible legacy status pairs in `shifts`.
- Add a route/source test documenting current split publish action locations.
- Add a source-contract test for Team feedback keys emitted by `src/app/(app)/team/actions.ts` versus displayed by `src/app/(app)/team/page.tsx`.

Primary files:

- `src/lib/coverage/status-ui.test.ts`
- `src/app/api/schedule/assignment-status/route.test.ts`
- `src/app/api/shift-posts/route.test.ts`
- `src/app/(app)/publish/actions.test.ts`
- `src/app/(app)/team/actions.test.ts`
- new focused tests under the closest existing test locations

Verification:

- `npm run test:unit -- <focused files>`
- `npx eslint <focused files>`

## Phase 1 - Operational Status Source Of Truth (#2)

Purpose: stop future status-column drift without pretending legacy columns are still authoritative.

Tasks:

- Create `src/lib/operational-status/state.ts` or extend `src/lib/operational-codes.ts` with one canonical resolver from planned shift row plus active operational entry to UI/domain status.
- Update remaining request/swap/eligibility paths that still check `shifts.assignment_status` for live locks to query `shift_operational_entries`.
- Keep `toCoverageAssignmentPayload()` only as a compatibility mapper for legacy UI/API responses, and document that in code.
- Add a Supabase migration that:
  - comments on `shifts.status` and `shifts.assignment_status` as compatibility mirrors
  - adds a non-blocking validation query or check function for impossible pairs
  - optionally adds a trigger only if legacy direct writes still need pairing enforcement
- Update `docs/DATA_MODEL.md`, `docs/WORKFLOWS.md`, and `docs/DECISIONS.md` to state the operational source of truth plainly.

Risks:

- Some RPCs still use legacy fields for scheduled-working checks. Migrate those carefully so pickup/swap eligibility remains unchanged except where it was stale.

Verification:

- Unit tests for operational status resolver.
- Request workflow tests for call-in/cancelled/on-call locks.
- Focused E2E if local Supabase is available: `e2e/requests-workflow.spec.ts`, `e2e/lottery-operational-flow.spec.ts`.

## Phase 2 - Availability Override Intent (#3)

Purpose: make "who wrote this" separate from "why this row exists."

Tasks:

- Add an enum/text check column to `availability_overrides`, recommended name `intent`.
- Initial values:
  - `therapist_need_off`
  - `therapist_need_to_work`
  - `manager_block`
  - `manager_force`
- Preserve `source`, `source_intake_id`, and `source_intake_item_id` as actor/provenance fields.
- Backfill existing rows conservatively:
  - `source = therapist`, `force_off` -> `therapist_need_off`
  - `source = therapist`, `force_on` -> `therapist_need_to_work`
  - `source = manager`, `force_off` -> `manager_block`
  - `source = manager`, `force_on` -> `manager_force`
- Update write helpers:
  - therapist availability saves must set therapist intents
  - manager planner saves must set manager intents
  - email intake must set the therapist intent when trusted inbound applies on behalf of therapist; manual manager apply should use manager provenance plus the appropriate imported therapist intent only if the source truly represents therapist-submitted availability
- Update RLS/business rules to use `intent` for "therapists cannot modify manager plans" style rules instead of scattered `source` checks.
- Update analytics/preflight signals to display therapist exceptions and manager plans separately when both exist.

Primary files:

- `src/app/(app)/availability/actions.ts`
- `src/lib/availability-planner.ts`
- `src/app/(app)/schedule/actions/draft-actions.ts`
- `src/app/api/inbound/availability-email/route.ts`
- `src/app/(app)/schedule/schedule-roster-live-data.ts`
- `src/app/(app)/schedule/types.ts`
- `src/lib/coverage/types.ts`
- `supabase/migrations/*_add_availability_override_intent.sql`

Verification:

- Availability action unit tests.
- Planner tests for manager-only filtering.
- Draft/preflight tests for Need Off / Need to Work handling.
- Migration source test asserting all override inserts include `intent`.

## Phase 3 - Schedule Block State Machine (#8)

Purpose: centralize lifecycle decisions before schema changes.

Tasks:

- Add `src/lib/schedule-block-state.ts`.
- Define `ScheduleBlockState`:
  - `draft_empty`
  - `draft_building`
  - `preliminary_active`
  - `published_live`
  - `offline`
  - `archived`
- Resolver inputs:
  - `published`
  - `archived_at`
  - active preliminary snapshot status
  - shift count
  - optional offline/taken-offline marker if current schema supports it; otherwise map unpublished-with-prior-publish through existing publish history where needed
- Replace ad hoc `!activeCyclePublished`, preliminary-live, and archive checks in high-risk surfaces first:
  - Coverage publish controls
  - publish history actions
  - therapist dashboard workflow resolver
  - manager dashboard readiness
- Add exhaustive transition tests:
  - create draft
  - build shifts
  - send preliminary
  - publish
  - take offline/unpublish
  - archive

Primary files:

- `src/lib/schedule-block-state.ts`
- `src/app/(app)/coverage/coverage-page-data.ts`
- `src/app/(app)/coverage/CoverageClientPage.tsx`
- `src/lib/therapist-workflow.ts`
- `src/lib/manager-workflow.ts`
- `src/app/(app)/publish/actions.ts`
- `src/app/(app)/schedule/actions/publish-actions.ts`

Verification:

- Unit tests for every resolved state and allowed transition.
- Existing publish and role journey tests.

## Phase 4 - Atomic Publish And Preliminary Cleanup (#6)

Purpose: prevent a block from being both preliminary-active and published-live.

Tasks:

- Move publish finalization into a DB RPC or a server-side transactional helper using admin client.
- In the same transaction:
  - verify actor/site permission
  - validate current block state
  - set `schedule_cycles.published = true`
  - update active `preliminary_snapshots` for the cycle to `superseded`
  - write publish audit event or return enough data for the existing publish event code
- Add a reconciliation helper:
  - finds `published = true` cycles with active preliminary snapshots
  - reports and optionally supersedes them
- Surface a manager warning if a diverged state is detected before reconciliation.
- Keep email queue processing after state finalization; email failure must not reopen preliminary state.

Primary files:

- `src/app/(app)/schedule/actions/publish-actions.ts`
- `src/lib/preliminary-schedule/mutations.ts`
- `src/app/(app)/publish/actions.ts`
- new migration for publish finalization RPC if chosen

Verification:

- Unit/source tests for publish action ordering.
- DB/RPC tests if local Supabase is available.
- `e2e/coverage-publish-flow.spec.ts`
- `e2e/publish-history-lifecycle.spec.ts`

## Phase 5 - Shift Board Transition Model (#4)

Purpose: keep one Shift Board workflow while making transitions explicit.

Tasks:

- Create `src/lib/shift-board/lifecycle.ts`.
- Model:
  - post kinds: direct swap, direct give-up, open swap, open give-up/pickup, call-in help
  - waiting states: waiting on teammate, waiting on manager, open for responders, approved, denied, withdrawn, expired
  - actor classes: requester, direct recipient, responder, manager, lead where applicable
- Add command validators:
  - `createShiftBoardPost`
  - `respondToDirectRequest`
  - `withdrawShiftBoardPost`
  - `expressOpenShiftInterest`
  - `withdrawOpenShiftInterest`
  - `reviewShiftBoardPost`
  - `denyOpenShiftResponder`
- Refactor `src/app/api/shift-posts/route.ts` into small command handlers that delegate to lifecycle validation plus existing RPCs.
- Keep DB RPCs as trusted mutation enforcement.
- Add invalid-transition tests for stale/duplicate/replayed actions.

Verification:

- `npm run test:unit -- src/app/api/shift-posts/route.test.ts <new lifecycle tests>`
- Request workflow E2E when local auth is available.

## Phase 6 - Intake Applied Semantics (#5)

Purpose: make "ready" and "applied" impossible to confuse.

Tasks:

- Add item-level fields if missing:
  - `applied_at`
  - `applied_by`
  - `apply_method` (`auto` or `manual`)
- Treat parser confidence separately from apply status:
  - `needs_review`
  - `ready_to_apply`
  - `failed`
  - `applied`
- Rename UI copy:
  - "Ready to apply automatically" before write
  - "Applied automatically" only after override write success
  - "Applied by manager" for manual apply
- Update inbound route so item status becomes applied only after `availability_overrides` upsert succeeds.
- Add failure state for auto-apply write failure instead of silently leaving a misleading applied badge.

Primary files:

- `src/lib/availability-email-intake.ts`
- `src/app/api/inbound/availability-email/route.ts`
- `src/app/(app)/availability/actions.ts`
- `src/components/availability/EmailIntakePanel.tsx`
- `supabase/migrations/*_clarify_intake_apply_state.sql`

Verification:

- Existing email intake parser/action/panel tests.
- Add tests for failed auto-apply write.

## Phase 7 - Coverage Permission Feedback (#7)

Purpose: prevent stale client permission snapshots from becoming silent UX failures.

Tasks:

- Rename or wrap `canManageCoverage` as initial snapshot/display state.
- Add a shared mutation error mapper for Coverage/Team Schedule controls.
- Ensure server/API permission failures return specific machine-readable codes.
- Show clear denied-state feedback on mutation failure:
  - access changed
  - refresh required
  - not authorized
- Prefer disabled explanatory controls over disappearing controls when a stale snapshot is detected.

Primary files:

- `src/app/(app)/coverage/CoverageClientPage.tsx`
- `src/app/(app)/coverage/coverage-page-data.ts`
- `src/app/api/schedule/drag-drop/route.ts`
- `src/app/api/schedule/assignment-status/route.ts`
- `src/lib/coverage/mutations.ts`

Verification:

- Unit tests for mutation error mapping.
- API route tests for permission codes.

## Phase 8 - Publish Action Organization (#9)

Purpose: make the publish flow discoverable without broad behavior changes.

Tasks:

- Create a publish domain folder, for example `src/lib/publish-workflow/`.
- Move shared lifecycle helpers there:
  - final publish
  - take offline/unpublish
  - start over
  - archive
  - requeue/process email
- Keep Next server-action files as thin route-specific adapters.
- Update `CLAUDE.md`, `README.md`, and `docs/WORKFLOWS.md` with one canonical "publish workflow files" map.

Verification:

- Existing publish tests unchanged in behavior.
- Source-contract test that references the new canonical module.

## Phase 9 - Typed Team Feedback Contract (#10)

Purpose: prevent action redirects from silently producing unmapped feedback.

Tasks:

- Add `src/lib/team-feedback.ts` with typed success/error keys and message mapping.
- Use helper builders in server actions instead of raw string literals.
- Use the same mapping in `src/app/(app)/team/page.tsx`.
- Add a test that every emitted team feedback key has a display message.

Primary files:

- `src/app/(app)/team/actions.ts`
- `src/app/(app)/team/page.tsx`
- `src/lib/team-feedback.ts`
- `src/app/(app)/team/actions.test.ts`

Verification:

- Team action tests.
- New feedback contract test.

## Recommended Execution Order

1. Phase 0 safety inventory.
2. Phase 1 operational source of truth.
3. Phase 3 Schedule Block state resolver.
4. Phase 4 atomic publish/preliminary cleanup.
5. Phase 2 availability intent.
6. Phase 6 intake applied semantics.
7. Phase 5 Shift Board transition model.
8. Phase 7 Coverage permission feedback.
9. Phase 9 Team feedback contract.
10. Phase 8 publish organization cleanup.

This order fixes the highest corruption and contradictory-state risks before organization-only cleanup.

## Definition Of Done

- No live-status logic treats `shifts.assignment_status` as authoritative.
- Availability override rows have explicit intent separate from source/provenance.
- Schedule Block state is resolved by one shared helper in high-risk workflows.
- Publish cannot leave an active preliminary snapshot behind.
- Shift Board transition tests cover invalid, replayed, stale, and wrong-actor actions.
- Intake items say applied only after availability writes succeed.
- Coverage mutation permission failures produce clear feedback.
- Publish workflow files are discoverable from docs.
- Team feedback keys are typed and exhaustively mapped.
