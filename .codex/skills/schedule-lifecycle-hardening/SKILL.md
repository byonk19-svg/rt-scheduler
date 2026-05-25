---
name: schedule-lifecycle-hardening
description: Harden rt-scheduler schedule-changing workflows for lifecycle correctness, state transitions, concurrent safety, notifications, and regression coverage. Use when auditing or fixing Schedule Block Planning, schedule grid mutations, publish/unpublish, availability lock/reopen, shift posts, approvals, call-ins, cancellations, left-early status, pickup queues, or direct-request lifecycle gaps.
version: 1.0.0
---

# Schedule lifecycle hardening

Use this when the task is about scheduling workflow safety, not visual polish. Past sessions repeatedly found that the real risk is silent or conflicting lifecycle mutation.

## Defaults

- Treat lifecycle work as end-to-end proof, not a single-page patch.
- Prefer service-layer and server-action guardrails plus tests before schema changes.
- Do not change Supabase schema or weaken RLS unless the current code proves that lower layers cannot enforce the invariant.
- Every lifecycle state needs entry, exit, visibility, reversal, and notification behavior.
- Hidden form fields and current UI state are not authority. Reload current database state before final mutation.
- Staff-facing copy should not use manager verbs like "publish"; user-facing schedule copy should say `Schedule Block`.

## First pass

1. Map all mutation surfaces for the requested workflow:
   - route handlers under `src/app/api`
   - server actions under `src/app/(app)`
   - shared services under `src/lib`
   - UI controls that can trigger mutation
   - existing tests and E2E specs for the same state path
2. Identify authoritative state:
   - current schedule block status
   - assignment/request status
   - actor role plus active/archive state
   - timestamp fields like lock/reopen/publish metadata
   - notification side effects
3. List invalid transitions before editing. Include stale-current-state, duplicate-action, wrong-actor, and already-finalized cases.

## Implementation rules

- Validate current state immediately before mutation.
- Fail closed for inactive, archived, missing, or roleless actors.
- Keep manager-only actions manager-only; do not infer edit permission from schedule visibility.
- Confirm destructive or incident statuses in the UI when one click would otherwise mutate production-like schedule truth.
- Require secondary inputs for states that need them, such as `left_early` needing a valid end time.
- Preserve compatibility redirects and aliases unless the task explicitly retires them.
- Keep fixes narrow. If a broader product rule is unclear, document the ambiguity instead of guessing.

## Common seams

- Schedule grid status changes: `StatusCellPopover.tsx`, `/api/schedule/assignment-status`
- Schedule Block Planning: `src/app/(app)/schedule/planning`, `planning-actions.ts`
- Publish state: `publish-actions.ts`
- Availability lock/reopen: `availability-window-action-impl.ts`
- Shift posts and request review: `src/app/api/shift-posts/route.ts`, shift-board snapshot loaders
- Coverage/create-draft context: `CycleManagementDialog.tsx`, `CoverageClientPage.tsx`, `createCycleAction`

## Tests

Add or update focused regression coverage for each changed invariant:

- valid transition succeeds
- stale or already-finalized transition is rejected
- wrong actor is rejected
- required secondary input is enforced
- notification or audit behavior is preserved when applicable

Prefer targeted Vitest/source tests for server/action invariants, plus one Playwright proof when the workflow depends on browser navigation or multi-actor state.

## Verification

Run the lightest command set that proves the lane, then broaden for shared lifecycle code:

```powershell
npm run test:unit -- <focused tests>
npm run format:check
npm run lint
npm run typecheck
npm run build
```

For browser-critical changes, run the relevant `npx playwright test ... --project=chromium --workers=1` spec after the app/auth prerequisites are available.

## Suggested subagents

- `/prompts:schedule-lifecycle-auditor` for read-only invariant mapping and gap finding.
- `/prompts:scheduler-permission-auditor` when actor/role/archive state is part of the mutation.
- `/prompts:playwright-stabilizer` when the proof depends on E2E fixtures or route readiness.
