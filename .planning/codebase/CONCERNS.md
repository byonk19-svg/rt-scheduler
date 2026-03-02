# Codebase Concerns

**Analysis Date:** 2026-02-25

## Tech Debt

**Dual manager coverage experiences:**

- Issue: two overlapping manager schedule/coverage paths exist (`/schedule` with manager calendars and `/coverage` custom page).
- Why: iterative migration to new UI while legacy scheduling surface remains active.
- Impact: behavior mismatch and confusion (publish/assign/status flows differ by page).
- Fix approach: consolidate manager scheduling into one canonical route and mutation path.

**Mutation path split (server actions + API routes):**

- Issue: same domain mutations implemented in multiple channels.
- Files: `src/app/schedule/actions.ts`, `src/app/api/schedule/drag-drop/route.ts`, `src/app/coverage/page.tsx`.
- Impact: duplicated validation, inconsistent UX outcomes, higher regression risk.
- Fix approach: normalize to one mutation backend per operation and share typed DTOs.

## Known Bugs / Operational Risks

**Role naming drift:**

- Symptoms: logic must normalize `manager`, `staff`, `therapist`, `lead` in multiple places.
- Files: `src/proxy.ts`, role checks in server actions/routes.
- Workaround: normalization fallback currently in middleware.
- Root cause: schema/history evolved while preserving backward compatibility.

**Publish feedback drift across surfaces:**

- Symptoms: one page may show rich publish errors while another may show generic tokens unless kept in sync.
- Files: `src/lib/schedule-helpers.ts`, `src/app/coverage/page.tsx`, `src/app/schedule/page.tsx`.
- Fix approach: centralize display mapping and consume in all manager surfaces.

## Security Considerations

**Client-side direct inserts/updates require strict RLS confidence:**

- Risk: any policy gap could allow unauthorized writes.
- Current mitigation: manager-only policies in migrations + route/session checks.
- Recommendation: keep privileged writes in server/API boundaries where possible and add RLS regression tests.

**Secret handling hygiene:**

- Risk: broad codebase mapping/AI tooling can expose env files if permissions are too open.
- Current mitigation: `.env.local` gitignored.
- Recommendation: enforce deny-read patterns for secret files in assistant settings.

## Performance Bottlenecks

**Large scheduling files:**

- Problem: very large client components and action files increase cognitive and change risk.
- Files: `src/components/manager-month-calendar.tsx`, `src/app/schedule/actions.ts`, `src/app/coverage/page.tsx`.
- Cause: feature accumulation in single files.
- Improvement path: split by concerns (queries, validators, UI sub-sections).

## Fragile Areas

**Schedule rule interactions:**

- Why fragile: weekly limits, lead rules, coverage counts, and swap/publish constraints interact tightly.
- Common failures: one rule fix regresses another flow.
- Safe modification: add/extend unit tests in `src/lib/*test.ts` and route tests before behavior edits.

**Schema evolution compatibility:**

- Why fragile: code supports newer fields (`assignment_status`, availability override metadata) and legacy fallback queries.
- Common failures: missing migration state causes runtime query errors.
- Safe modification: verify migration order and backward checks in page/server logic.

## Scaling Limits

**Manual state-sync reliance in client UIs:**

- Current capacity: manageable for solo-dev iteration.
- Limit: as UI variants increase, stale client state/reload dependencies become harder to reason about.
- Scaling path: central query caching/invalidation strategy and thinner mutation entry points.

## Dependencies at Risk

**Fast-moving framework baseline:**

- Risk: Next/React modern versions can shift behavior across minor upgrades.
- Impact: subtle runtime/build changes in App Router/client boundary behavior.
- Migration plan: pin and upgrade intentionally with CI + smoke checks.

## Test Coverage Gaps

**End-to-end manager scheduling parity:**

- Gap: no single E2E flow validates both manager surfaces produce equivalent outcomes.
- Risk: one surface can silently drift.
- Priority: High.

**RLS and role-routing regression coverage:**

- Gap: middleware + DB policy interactions not fully validated in automated integration tests.
- Risk: access or routing regressions when roles/claims evolve.
- Priority: High.

---

_Concerns audit: 2026-02-25_
_Update as concerns are resolved or newly discovered_
