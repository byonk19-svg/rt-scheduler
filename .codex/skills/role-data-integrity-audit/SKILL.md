---
name: role-data-integrity-audit
description: Audit and fix rt-scheduler role permissions, lifecycle-aware access checks, archived/inactive actor handling, analytics truth, shift-board/request data integrity, and intent-scoped verification. Use for permission boundaries, manager-only actions, therapist visibility versus edit rights, archived users, or scheduling data-truth bugs.
version: 1.0.0
---

# Role and data integrity audit

Use this when the task combines authorization, actor lifecycle, and scheduling data truth. Past sessions repeatedly found bugs where role-only checks ignored inactive/archive state, or analytics used the wrong canonical key.

## Defaults

- Treat "full audit plus fixes, docs, tests, and verification" as implementation plus evidence, not report-only.
- Do not weaken RLS.
- Do not expose manager-only actions to therapists.
- Do not assume schedule visibility equals edit permission.
- Do not change schema unless absolutely necessary.
- Document unclear permission rules instead of guessing.

## Map first

Inspect the real seams before editing:

- `src/lib/auth/can.ts`
- `src/lib/auth/roles.ts`
- `src/proxy.ts`
- `src/components/shell/app-shell-config.ts`
- manager route pages/actions
- `/api/shift-posts`
- `shift-board-snapshot`
- analytics/query helpers
- reminder/export/intake actions that select staff recipients

## Guardrail rules

- Pass lifecycle context into permission checks: role plus `is_active` and `archived_at`.
- Fail closed for inactive, archived, missing, or roleless actors before RPC calls or workflow snapshots.
- Keep therapist read visibility separate from manager edit authority.
- Exclude archived staff from active compliance denominators and reminder recipients unless product rules explicitly say otherwise.
- Use canonical schema fields for reporting. In known availability submission logic, `therapist_availability_submissions.schedule_cycle_id` is the official Schedule Block key; do not use `cycle_id`.

## Commit prep

If the worktree is dirty, inspect suspicious mixed-purpose files before staging. A file can be a real permission seam even if it looks like UI, for example `src/app/(app)/availability/page.tsx`.

Stage by intent:

- permission/lifecycle gate fixes
- data-truth/analytics fixes
- docs/report artifacts
- tests

Use `.codex/skills/accurate-commits/SKILL.md` or `.codex/skills/finish-worktree-lane/SKILL.md` when the user asks to commit, push, land, or clean up.

## Tests and docs

- Add source-contract tests for role lifecycle and access boundaries.
- Add analytics/query tests for canonical field usage.
- Add route/action tests for inactive/archive rejection.
- Use a short docs artifact only when unresolved permission/product decisions need to survive the session.

## Verification

```powershell
npm run test:unit -- <focused tests>
npm run format:check
npm run lint
npm run typecheck
npm run build
```

## Suggested subagents

- `/prompts:scheduler-permission-auditor` for read-only role/data-truth gap mapping.
- `/prompts:schedule-lifecycle-auditor` when the permission issue affects scheduling state transitions.
