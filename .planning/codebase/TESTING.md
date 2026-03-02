# Testing Patterns

**Analysis Date:** 2026-02-25

## Test Framework

**Unit runner:**

- Vitest (`vitest.config.ts`).
- include pattern: `src/**/*.test.ts`.
- environment: `node`.

**E2E runner:**

- Playwright (`playwright.config.ts`).
- test directory: `e2e/`.

**Run commands:**

```bash
npm run test:unit            # vitest run
npm run test:e2e             # playwright test
npm run lint
npm run build
```

## Test File Organization

**Unit tests (collocated in src):**

- examples:
  - `src/app/api/schedule/drag-drop/route.test.ts`
  - `src/lib/schedule-rule-validation.test.ts`
  - `src/lib/employee-directory.test.ts`.

**E2E tests:**

- examples:
  - `e2e/authenticated-flow.spec.ts`
  - `e2e/public-pages.spec.ts`
  - `e2e/availability-override.spec.ts`.

## Test Structure Patterns

Common vitest pattern:

- `describe` suites with scenario builders/factories.
- heavy use of dependency mocking (`vi.mock(...)`).
- assertions on behavior + side effects.

Example style appears in `src/app/api/schedule/drag-drop/route.test.ts`:

- mock Supabase clients/helpers.
- create scenario object.
- execute route handler and assert status/payload.

## Mocking Patterns

- `vi.mock()` for module boundaries:
  - supabase server client
  - notifications/audit helpers
  - specialized mutations.
- mock factories emulate chained query APIs to test branching logic.

## Coverage and CI

- No explicit minimum coverage threshold configured in repo files.
- practical gate is CI quality workflow:
  - lint + build always
  - Playwright E2E when secrets are available.

## Async and Error Testing

- async route/action tests assert HTTP codes and JSON error bodies.
- conflict/validation rules are tested with focused scenarios.

## Where to add new tests

- route/API behavior: add `*.test.ts` beside route domain file in `src/`.
- shared rule helper: add tests in same `src/lib/` module area.
- multi-page user flow: add Playwright spec in `e2e/`.

## Risk/Gaps to watch

- mutation-heavy client flows can drift from API behavior if not covered with integration tests.
- some new UI-only pages rely on manual verification more than automated tests.

---

_Testing analysis: 2026-02-25_
_Update when CI gates or framework config changes_
