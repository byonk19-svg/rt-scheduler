# Home Page & Pending-Setup Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill the home page empty space with an approval note + faded app preview screenshot, and update the pending-setup waiting copy to be calmer.

**Architecture:** Two isolated page edits plus one static asset copy. No new components, no data fetching, no API changes. Home page uses `next/image` with `fill` inside a fixed-height container + a gradient overlay `div`. Pending-setup is a copy-only change. Tests follow the existing `readFileSync` pattern in `src/app/page.test.ts`.

**Tech Stack:** Next.js 16 App Router, Tailwind CSS, `next/image`, Vitest

---

## File Map

| File                                 | Action | What changes                                       |
| ------------------------------------ | ------ | -------------------------------------------------- |
| `public/images/app-preview.png`      | Create | Static asset — coverage calendar screenshot        |
| `src/app/page.tsx`                   | Modify | Add approval note + preview image block below CTAs |
| `src/app/page.test.ts`               | Modify | Add test for approval note text                    |
| `src/app/pending-setup/page.tsx`     | Modify | Update body copy only                              |
| `src/app/pending-setup/page.test.ts` | Create | Test for new pending-setup copy                    |

---

## Task 1: Add the app preview static asset

**Files:**

- Create: `public/images/app-preview.png`

- [ ] **Step 1: Create the images directory and copy the screenshot**

```bash
mkdir -p public/images
cp artifacts/screen-capture/latest/11-manager-coverage-week.png public/images/app-preview.png
```

- [ ] **Step 2: Verify the file exists and is not empty**

```bash
ls -lh public/images/app-preview.png
```

Expected: file listed with size > 0 bytes.

- [ ] **Step 3: Commit**

```bash
git add public/images/app-preview.png
git commit -m "feat: add app preview static asset for home page"
```

---

## Task 2: Update pending-setup copy (TDD)

**Files:**

- Modify: `src/app/pending-setup/page.tsx`
- Create: `src/app/pending-setup/page.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/pending-setup/page.test.ts`:

```ts
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const src = fs.readFileSync(path.join(process.cwd(), 'src/app/pending-setup/page.tsx'), 'utf8')

describe('pending-setup page copy', () => {
  it('uses the calm sit-tight waiting copy', () => {
    expect(src).toContain('No action needed on your end.')
    expect(src).toContain('Sit tight while your manager reviews your account')
  })

  it('keeps the h1 unchanged', () => {
    expect(src).toContain('Your account is waiting for approval')
  })

  it('keeps the access_requested success callout', () => {
    expect(src).toContain('Access request received.')
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
npx vitest run src/app/pending-setup/page.test.ts
```

Expected: FAIL on `uses the calm sit-tight waiting copy`.

- [ ] **Step 3: Update the body copy in pending-setup/page.tsx**

In `src/app/pending-setup/page.tsx`, find this `<p>` tag (line ~33):

```tsx
<p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-foreground/80">
  Thanks for signing up. You'll be able to use the app once your account is approved.
</p>
```

Replace with:

```tsx
<p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-foreground/80">
  No action needed on your end. Sit tight while your manager reviews your account — you'll be able
  to log in once you're approved.
</p>
```

Everything else in the file stays the same.

- [ ] **Step 4: Run the tests and confirm they pass**

```bash
npx vitest run src/app/pending-setup/page.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/pending-setup/page.tsx src/app/pending-setup/page.test.ts
git commit -m "feat: update pending-setup waiting copy to calm sit-tight message"
```

---

## Task 3: Home page — approval note + faded preview (TDD)

**Files:**

- Modify: `src/app/page.tsx`
- Modify: `src/app/page.test.ts`

- [ ] **Step 1: Add failing test for the approval note**

Open `src/app/page.test.ts` and add a new `it` block inside the existing `describe`:

```ts
it('shows an approval note for new staff', () => {
  expect(pageSource).toContain(
    'Your manager will need to approve your account before your first sign-in.'
  )
})
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
npx vitest run src/app/page.test.ts
```

Expected: FAIL on `shows an approval note for new staff`.

- [ ] **Step 3: Update src/app/page.tsx**

Add `Image` to the import at the top:

```tsx
import Image from 'next/image'
import Link from 'next/link'
import { CalendarDays } from 'lucide-react'

import { Button } from '@/components/ui/button'
```

Replace the `<section>` block (currently ends after the two `<Button>` elements) with:

```tsx
<section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-14 lg:py-20">
  <div className="max-w-2xl space-y-4">
    <h1 className="font-heading text-4xl font-semibold tracking-[-0.03em] text-foreground sm:text-5xl">
      Scheduling, availability, and coverage in one place
    </h1>
    <p className="max-w-xl text-base text-foreground/80">
      A simple way for therapists and managers to stay aligned on staffing.
    </p>
  </div>
  <div className="flex flex-wrap items-center gap-3">
    <Button asChild className="min-w-[140px]">
      <Link href="/login">Sign in</Link>
    </Button>
    <Button asChild variant="outline" className="min-w-[140px]">
      <Link href="/signup">Create account</Link>
    </Button>
  </div>
  <p className="text-sm text-muted-foreground">
    Your manager will need to approve your account before your first sign-in.
  </p>
  <div className="relative h-[420px] w-full overflow-hidden rounded-xl border border-border/50">
    <Image
      src="/images/app-preview.png"
      alt="Teamwise schedule view"
      fill
      className="object-cover object-top"
      priority
    />
    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-b from-transparent to-[var(--background)]" />
  </div>
</section>
```

- [ ] **Step 4: Run the tests and confirm they pass**

```bash
npx vitest run src/app/page.test.ts
```

Expected: all tests pass (3 existing + 1 new).

- [ ] **Step 5: Run the full test suite**

```bash
npx vitest run
```

Expected: all 453 tests pass.

- [ ] **Step 6: Run tsc and lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/page.tsx src/app/page.test.ts
git commit -m "feat: add approval note and faded app preview to home page"
```

---

## Task 4: Final verification

- [ ] **Step 1: Run build**

```bash
npm run build
```

Expected: clean build, all routes render as `ƒ` (dynamic) or `○` (static). The "Supabase lookup failed" log during build is expected and safe to ignore.

- [ ] **Step 2: Spot-check in browser (optional)**

> **Note (Windows env):** Chrome MCP returns "Permission denied" on localhost in this environment. Skip this step or verify visually using `artifacts/screen-capture/latest/` screenshots after running the capture script.

If in a working browser environment, start dev server and open `http://localhost:3000`:

- Approval note appears below the two CTA buttons
- Coverage calendar screenshot is visible, fading into the page background
- No layout shift or overflow

```bash
npm run dev
```

- [ ] **Step 3: Commit any final fixes if needed, then push**

```bash
git push
```
