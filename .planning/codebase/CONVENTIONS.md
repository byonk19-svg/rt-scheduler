# Coding Conventions

**Analysis Date:** 2026-02-25

## Naming Patterns

**Files:**

- kebab-case for module files in `src/components` and `src/lib`.
- Next.js route conventions in `src/app`: `page.tsx`, `layout.tsx`, `route.ts`.
- unit tests: `*.test.ts` in `src/`.

**Functions/variables/types:**

- `camelCase` for functions and locals.
- `PascalCase` for types/components.
- constants often `UPPER_SNAKE_CASE` (`MAX_SHIFT_COVERAGE_PER_DAY`) in domain libs.

## Code Style

**Formatting reality:**

- No dedicated Prettier config found.
- Style is mostly:
  - single quotes in TypeScript source
  - semicolons often omitted in app code
  - explicit type annotations for public/shared boundaries.

**Linting:**

- ESLint via `eslint.config.mjs` extending Next core-web-vitals + TypeScript.
- run command: `npm run lint`.

## Import Organization

Common pattern in source files:

1. framework imports (`next/*`, `react`, third-party packages)
2. internal alias imports (`@/lib/*`, `@/components/*`)
3. type imports (sometimes inline, sometimes grouped)

Path alias:

- `@/*` maps to `./src/*` (`tsconfig.json`).

## Error Handling

**Server actions:**

- use `redirect(...)` with query params for success/error states.
- often log server-side failure via `console.error` first.

**Route handlers:**

- return `NextResponse.json(...)` with status codes.
- explicit branch-based validation and early returns.

**Client mutations:**

- optimistic UI where useful, rollback on failure.
- surface issue via banner/toast/alert.

## Logging

- No centralized logger dependency detected.
- convention is `console.warn`/`console.error` with context labels.

## Comments

- Comments are sparse and usually explain intent for non-obvious branches.
- TODO-style markers exist where implementation is staged.

## Function and Module Design

- Domain logic extracted into `src/lib/*` helpers used by pages/actions.
- Scheduling mutations concentrated in:
  - `src/app/schedule/actions.ts`
  - `src/app/api/schedule/drag-drop/route.ts`.
- Components tend to be feature-rich files rather than micro-file split.

## Practical guidance for new changes

- Match existing import style and alias usage (`@/`).
- Keep business rules in `src/lib/` when shared by multiple endpoints/pages.
- Preserve redirect/error token patterns for server actions.
- Add unit test alongside new domain helper or route logic.

---

_Convention analysis: 2026-02-25_
_Update after lint/style policy changes_
