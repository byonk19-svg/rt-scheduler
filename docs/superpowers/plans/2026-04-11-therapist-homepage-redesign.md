# Therapist-First Homepage Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the public homepage into a therapist-first, trust-forward landing page with a luminous clinical aesthetic while keeping the existing route, CTA structure, and product preview flow.

**Architecture:** Keep the work narrowly scoped to `src/app/page.tsx` and `src/app/globals.css`. Use the existing server-component homepage, current button primitives, and CSS utilities rather than introducing new dependencies or converting the page to a client component. Replace the stale homepage test contract first, then add the new visual utilities, then implement the final page markup and verify it in the browser.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS 4, `next/image`, Lucide, Vitest, Playwright-configured local dev server

---

## File Map

| File                      | Action | What changes                                                                               |
| ------------------------- | ------ | ------------------------------------------------------------------------------------------ |
| `src/app/globals.css`     | Modify | Add homepage-specific color tokens and luminous background / preview-shell utility classes |
| `src/app/globals.test.ts` | Create | Lock the new homepage CSS token and utility contract with a read-from-disk Vitest file     |
| `src/app/page.tsx`        | Modify | Replace the current generic hero composition with the therapist-first luminous redesign    |
| `src/app/page.test.ts`    | Modify | Replace stale homepage assertions with a new trust-forward homepage contract               |

---

## Task 1: Lock the homepage visual utility contract

**Files:**

- Modify: `src/app/globals.css`
- Create: `src/app/globals.test.ts`

- [ ] **Step 1: Write the failing CSS contract test**

Create `src/app/globals.test.ts` with:

```ts
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const cssSource = fs.readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf8')

describe('homepage luminous visual system', () => {
  it('defines the homepage-specific glow tokens', () => {
    expect(cssSource).toContain('--home-glow-warm: rgba(241, 190, 105, 0.22);')
    expect(cssSource).toContain('--home-glow-cool: rgba(32, 122, 128, 0.16);')
    expect(cssSource).toContain('--home-panel: rgba(255, 251, 245, 0.78);')
    expect(cssSource).toContain('--home-panel-border: rgba(255, 255, 255, 0.72);')
    expect(cssSource).toContain('--home-shadow: rgba(15, 23, 42, 0.18);')
  })

  it('defines the homepage background and preview-shell utilities', () => {
    expect(cssSource).toContain('.teamwise-home-luminous {')
    expect(cssSource).toContain('.teamwise-home-grid {')
    expect(cssSource).toContain('.teamwise-home-preview-shell {')
    expect(cssSource).toContain('.teamwise-home-preview-sheen {')
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run:

```bash
npx vitest run src/app/globals.test.ts
```

Expected: FAIL because the homepage-specific tokens and utility classes do not exist yet.

- [ ] **Step 3: Add the homepage design tokens to `globals.css`**

In the `:root` block in `src/app/globals.css`, add these variables directly after `--attention`:

```css
--home-glow-warm: rgba(241, 190, 105, 0.22);
--home-glow-cool: rgba(32, 122, 128, 0.16);
--home-panel: rgba(255, 251, 245, 0.78);
--home-panel-border: rgba(255, 255, 255, 0.72);
--home-shadow: rgba(15, 23, 42, 0.18);
```

- [ ] **Step 4: Add the homepage utility classes to `globals.css`**

Insert these utilities after the existing `.teamwise-aurora-bg` block:

```css
.teamwise-home-luminous {
  background-image:
    radial-gradient(circle at 12% 18%, var(--home-glow-warm), transparent 28%),
    radial-gradient(circle at 82% 16%, var(--home-glow-cool), transparent 34%),
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.62) 0%,
      rgba(248, 244, 236, 0.16) 42%,
      transparent 100%
    );
}

.teamwise-home-grid {
  background-image:
    linear-gradient(rgba(106, 165, 200, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(106, 165, 200, 0.05) 1px, transparent 1px);
  background-size: 28px 28px;
  mask-image: linear-gradient(
    180deg,
    rgba(0, 0, 0, 0.7) 0%,
    rgba(0, 0, 0, 0.18) 62%,
    transparent 100%
  );
}

.teamwise-home-preview-shell {
  background: linear-gradient(180deg, var(--home-panel) 0%, rgba(250, 247, 241, 0.92) 100%);
  border: 1px solid var(--home-panel-border);
  box-shadow:
    0 32px 72px -28px var(--home-shadow),
    inset 0 1px 0 rgba(255, 255, 255, 0.74);
  backdrop-filter: blur(14px);
}

.teamwise-home-preview-sheen {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.45), transparent);
}
```

- [ ] **Step 5: Run the CSS contract test and confirm it passes**

Run:

```bash
npx vitest run src/app/globals.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 6: Commit the CSS utility contract**

```bash
git add src/app/globals.css src/app/globals.test.ts
git commit -m "feat: add luminous homepage visual utilities"
```

---

## Task 2: Replace the stale homepage test contract

**Files:**

- Modify: `src/app/page.test.ts`

- [ ] **Step 1: Replace the current homepage test file with the new redesign contract**

Overwrite `src/app/page.test.ts` with:

```ts
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const pageSource = fs.readFileSync(path.join(process.cwd(), 'src/app/page.tsx'), 'utf8')

describe('public homepage redesign contract', () => {
  it('uses therapist-first trust-forward copy', () => {
    expect(pageSource).toContain('Keep your schedule, availability, and coverage in one calm view.')
    expect(pageSource).toContain(
      'Built for respiratory therapists who need quick shift clarity, fewer back-and-forth messages, and a workspace they can trust before the next handoff.'
    )
  })

  it('keeps the header and hero CTA roles aligned', () => {
    const signInMatches = pageSource.match(/>Sign in</g) ?? []
    expect(signInMatches.length).toBeGreaterThanOrEqual(2)

    expect(pageSource).toContain('<Link href="/signup">Get started</Link>')
    expect(pageSource).toContain('<Link href="/signup">Create account</Link>')
  })

  it('keeps the approval note and trust bullets visible', () => {
    expect(pageSource).toContain(
      'Your manager will need to approve your account before your first sign-in.'
    )
    expect(pageSource).toContain('Availability stays visible before the next handoff.')
    expect(pageSource).toContain('Coverage changes stay clear without the back-and-forth.')
  })

  it('uses the luminous clinical wrapper classes', () => {
    expect(pageSource).toContain('teamwise-home-luminous')
    expect(pageSource).toContain('teamwise-home-grid')
    expect(pageSource).toContain('teamwise-home-preview-shell')
    expect(pageSource).toContain('teamwise-home-preview-sheen')
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails for the right reasons**

Run:

```bash
npx vitest run src/app/page.test.ts
```

Expected: FAIL on the new copy and class-name assertions because `src/app/page.tsx` has not been updated yet.

Note: the current `page.test.ts` is already stale and red. This replacement is intentional and establishes the correct target contract before implementation.

---

## Task 3: Implement the therapist-first homepage redesign

**Files:**

- Modify: `src/app/page.tsx`
- Modify: `src/app/page.test.ts`

- [ ] **Step 1: Replace `src/app/page.tsx` with the redesigned homepage**

Overwrite `src/app/page.tsx` with:

```tsx
import Image from 'next/image'
import Link from 'next/link'
import { CalendarDays } from 'lucide-react'

import { Button } from '@/components/ui/button'

const trustNotes = [
  'Availability stays visible before the next handoff.',
  'Coverage changes stay clear without the back-and-forth.',
]

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background">
      <header className="relative z-20 border-b border-white/60 bg-background/88 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--attention)] shadow-[0_14px_30px_-18px_var(--home-shadow)]">
              <CalendarDays className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="font-heading text-sm font-bold tracking-[-0.02em] text-foreground">
                Teamwise
              </p>
              <p className="text-[0.72rem] font-medium text-muted-foreground">
                Respiratory Therapy
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-foreground/80 hover:bg-white/60"
            >
              <Link href="/login">Sign in</Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="rounded-xl px-5 shadow-[0_14px_30px_-18px_var(--home-shadow)]"
            >
              <Link href="/signup">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="teamwise-home-luminous relative overflow-hidden">
        <div aria-hidden className="teamwise-home-grid absolute inset-0" />
        <div
          aria-hidden
          className="absolute left-[4%] top-24 h-40 w-40 rounded-full bg-[var(--home-glow-warm)] blur-3xl"
        />
        <div
          aria-hidden
          className="absolute right-[8%] top-16 h-56 w-56 rounded-full bg-[var(--home-glow-cool)] blur-3xl"
        />

        <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-16 pt-16 lg:gap-14 lg:pb-24 lg:pt-24">
          <div className="max-w-3xl space-y-6 fade-up">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--attention)]/25 bg-white/55 px-3.5 py-1.5 text-xs font-semibold tracking-[0.01em] text-[var(--attention)]">
              <CalendarDays className="h-3 w-3" />
              Built for respiratory therapy teams
            </div>

            <div className="space-y-6">
              <h1 className="max-w-[12ch] font-heading text-[3.4rem] font-bold leading-[0.97] tracking-[-0.055em] text-foreground sm:text-[4.8rem] lg:text-[6.4rem]">
                Keep your schedule, availability, and coverage in one calm view.
              </h1>
              <p className="max-w-xl text-[1.05rem] leading-7 text-foreground/72 sm:text-lg">
                Built for respiratory therapists who need quick shift clarity, fewer back-and-forth
                messages, and a workspace they can trust before the next handoff.
              </p>
            </div>
          </div>

          <div
            className="fade-up flex flex-col gap-4 sm:flex-row sm:items-center"
            style={{ animationDelay: '80ms' }}
          >
            <Button
              asChild
              size="lg"
              className="h-12 min-w-[170px] rounded-xl text-base shadow-[0_20px_36px_-22px_var(--home-shadow)]"
            >
              <Link href="/login">Sign in</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-12 min-w-[170px] rounded-xl border-white/70 bg-white/65 text-base hover:bg-white"
            >
              <Link href="/signup">Create account</Link>
            </Button>
          </div>

          <div className="fade-up flex flex-col gap-3" style={{ animationDelay: '120ms' }}>
            <p className="text-sm text-muted-foreground">
              Your manager will need to approve your account before your first sign-in.
            </p>
            <ul className="flex flex-col gap-2 text-sm text-foreground/62 sm:flex-row sm:flex-wrap sm:gap-x-6">
              {trustNotes.map((note) => (
                <li key={note} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]/70" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="fade-up relative mt-2 w-full" style={{ animationDelay: '160ms' }}>
            <div
              aria-hidden
              className="absolute inset-x-10 -bottom-10 h-16 rounded-full bg-[var(--home-glow-cool)]/60 blur-3xl"
            />
            <div className="teamwise-home-preview-shell relative overflow-hidden rounded-[2rem] p-3 md:p-4">
              <div
                aria-hidden
                className="teamwise-home-preview-sheen absolute inset-x-0 top-0 h-24"
              />
              <div className="relative min-h-[320px] overflow-hidden rounded-[1.5rem] border border-black/5 bg-white/80 sm:min-h-[420px] lg:min-h-[500px]">
                <Image
                  src="/images/app-preview.png"
                  alt="Teamwise schedule view"
                  fill
                  className="object-cover object-top"
                  priority
                  unoptimized
                />
                <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[var(--background)] via-[rgba(245,241,234,0.84)] to-transparent" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
```

- [ ] **Step 2: Run the homepage tests and confirm they pass**

Run:

```bash
npx vitest run src/app/globals.test.ts src/app/page.test.ts
```

Expected: all 6 tests pass.

- [ ] **Step 3: Run formatting if needed**

Run:

```bash
npx prettier --write src/app/page.tsx src/app/page.test.ts src/app/globals.css src/app/globals.test.ts
```

Expected: files are formatted with no syntax changes beyond whitespace.

- [ ] **Step 4: Re-run the homepage tests after formatting**

Run:

```bash
npx vitest run src/app/globals.test.ts src/app/page.test.ts
```

Expected: all tests still pass.

- [ ] **Step 5: Commit the homepage redesign**

```bash
git add src/app/page.tsx src/app/page.test.ts src/app/globals.css src/app/globals.test.ts
git commit -m "feat: redesign the homepage for therapist-first trust"
```

---

## Task 4: Full verification and responsive check

**Files:**

- Modify: none unless verification reveals issues

- [ ] **Step 1: Run the targeted unit verification**

Run:

```bash
npx vitest run src/app/globals.test.ts src/app/page.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run lint**

Run:

```bash
npm run lint
```

Expected: no ESLint errors.

- [ ] **Step 3: Run the production build**

Run:

```bash
npm run build
```

Expected: successful Next.js production build with no compile errors.

- [ ] **Step 4: Run the homepage locally for manual responsive verification**

Run:

```bash
npm run dev
```

Expected: local dev server starts on `http://127.0.0.1:3000` (or the configured `PORT`).

Manual check list:

- Desktop width around 1440px: hero headline stays on a tight measure, preview frame feels anchored, no obvious empty dead zone
- Mobile width around 390px: header actions remain tappable, headline wraps cleanly, preview keeps rounded framing and does not overflow
- CTA hierarchy remains clear: header uses `Get started`, hero uses `Create account`
- No console errors on initial page load

- [ ] **Step 5: Capture final status**

Run:

```bash
git status --short
```

Expected: clean working tree. If verification required follow-up edits, make them before concluding and create one final commit with the fix.

---

## Self-Review

### Spec coverage

- Therapist-first audience: covered in Task 2 test contract and Task 3 copy implementation
- Luminous clinical visual system: covered in Task 1 token and utility work plus Task 3 layout
- Warm light as the dominant move with grid as texture: covered in Task 1 CSS utilities and Task 3 wrapper classes
- Existing homepage architecture preserved: covered in Task 3 single-page implementation
- Verification at desktop and mobile plus console sanity: covered in Task 4

### Placeholder scan

- No `TODO`, `TBD`, or deferred implementation notes remain
- All file paths are explicit
- All code-changing steps include the exact code to add or replace

### Type and naming consistency

- Homepage utility names are consistent across CSS tests, CSS implementation, and page markup:
  - `teamwise-home-luminous`
  - `teamwise-home-grid`
  - `teamwise-home-preview-shell`
  - `teamwise-home-preview-sheen`
- Copy strings used in tests exactly match the planned `page.tsx` content
