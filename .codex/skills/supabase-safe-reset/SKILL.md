---
name: supabase-safe-reset
description: Perform or review rt-scheduler Supabase reset, reseed, advisor, and migration cleanup work safely. Use for demo/e2e data reset scripts, local seeding, Auth-user cleanup, live advisor verification, foreign-key index remediation, grants/RPC boundaries, or schema-derived destructive operations.
version: 1.0.0
---

# Supabase safe reset and audit

Use this for Supabase tasks with destructive or security-sensitive blast radius. Past sessions established several hard safety rules for this repo family.

## Safety defaults

- By default, do not delete Supabase Auth users.
- Auth cleanup is opt-in only.
- Always delete app/public table data first, in dependency-safe order.
- Do not manually assume table names. Inspect migrations/schema and existing seed scripts first.
- Print counts before deleting.
- Print exactly which Auth emails would be deleted when Auth cleanup is explicitly enabled.
- Prefer dry-run previews for reset scripts and live data operations.
- Keep schema remediation narrowly evidence-based. Do not clear unrelated warnings just because they exist.

## Discovery

Before writing reset/audit code, inspect:

- `supabase/migrations`
- `scripts/seed-functional-demo.mjs`
- `scripts/seed-dev.mjs`
- generated database types
- existing reset/delete helpers
- `.env.local` only for local runtime availability; do not print secrets

Derive table order from real schema relationships and seed code, not memory.

## Advisor/remediation rules

- For live advisor cleanup, capture before/after evidence.
- Add only missing foreign-key indexes that are justified by real advisor output or query path.
- Keep privileged RPC/grant fixes at the server/service boundary.
- Do not move broad privileged execution into browser/client code.
- If account permissions block live verification, state the exact blocker and keep local/migration proof separate from live proof.

## Reset script output contract

For destructive or dry-run commands, report:

- target Supabase project/source
- dry-run or apply mode
- tables selected and why
- per-table row counts before delete
- Auth cleanup enabled/disabled
- exact Auth emails that would be deleted, if enabled
- final counts or blocked step

## Verification

Use the narrowest meaningful verification:

```powershell
npm run test:unit -- <seed/reset/advisor tests>
npm run typecheck
npm run lint
npm run build
```

For live advisor work, rerun the advisor query/check and include before/after eliminated warnings.

## Suggested subagent

- `/prompts:supabase-safety-auditor` for dry-run blast-radius review and schema/advisor evidence checks.
