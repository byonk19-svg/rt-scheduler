# Handwritten PDF Zone Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve scanned handwritten PDF intake by extracting and OCRing template-aware page zones instead of relying on whole-page OCR alone.

**Architecture:** Keep the current inbound webhook and page-per-employee item model, but change the PDF fallback to build multiple OCR candidates from fixed page zones and preprocessing variants. Merge the strongest zone text into one page transcript and feed that transcript into the existing employee/date parser and auto-apply flow.

**Tech Stack:** Next.js App Router, OpenAI Responses API, `pdf-to-img`, `@napi-rs/canvas`, Vitest.

---

## File Structure and Ownership

- Modify: `src/lib/pdf-render-pages.ts`
  - Add template-aware zone extraction and OCR image variant generation.
- Modify: `src/lib/openai-ocr.ts`
  - Score OCR candidates, merge zone text into per-page transcript, and use it in the PDF fallback path.
- Modify: `src/lib/openai-ocr.test.ts`
  - Add unit coverage for zone variants and later-variant selection.
- Modify: `src/app/api/inbound/availability-email/route.test.ts`
  - Add route-level regression proving scanned PDF fallback still auto-applies when a stronger variant succeeds.

---

### Task 1: Define page zones and preprocessing variants

**Files:**

- Modify: `src/lib/pdf-render-pages.ts`

- [ ] **Step 1: Add a small set of template-aware page zones**

Define normalized page zones for the stable form template:

```ts
type PageZone = {
  label: 'employee_name' | 'request_top' | 'request_mid' | 'request_bottom'
  x: number
  y: number
  width: number
  height: number
}

const HANDWRITTEN_FORM_ZONES: PageZone[] = [
  { label: 'employee_name', x: 0.08, y: 0.08, width: 0.84, height: 0.12 },
  { label: 'request_top', x: 0.08, y: 0.22, width: 0.84, height: 0.18 },
  { label: 'request_mid', x: 0.08, y: 0.4, width: 0.84, height: 0.18 },
  { label: 'request_bottom', x: 0.08, y: 0.58, width: 0.84, height: 0.18 },
]
```

- [ ] **Step 2: Add a crop helper and multiple OCR variants**

Create cropped zone canvases and generate multiple variants:

```ts
type OcrImageVariant = {
  zoneLabel: string
  label: string
  contentType: 'image/png'
  base64: string
}
```

Variants should include:

- original
- grayscale/high-contrast
- threshold
- threshold inverted
- rotated `90`
- rotated `270`

- [ ] **Step 3: Run focused lint/test check**

Run: `npx eslint src/lib/pdf-render-pages.ts`

Expected: PASS

---

### Task 2: Use zone OCR instead of whole-page OCR fallback

**Files:**

- Modify: `src/lib/openai-ocr.ts`

- [ ] **Step 1: Add OCR candidate scoring**

Add a small scoring helper that prefers candidates with:

- employee-name-like text
- date-like text
- request keywords
- more usable characters

- [ ] **Step 2: Merge best zone text into one page transcript**

Replace the current whole-page fallback path with:

```ts
for each rendered PDF page:
  build zone variants
  OCR each variant
  keep best text per zone
  merge zones in stable order
```

Merged page transcript example:

```text
Employee Name: ...

Request Area:
...
```

- [ ] **Step 3: Keep failure reasons explicit**

If no zone yields useful text, preserve a per-page reason like:

```ts
;`All pages failed OCR (${pageErrors.join('; ')})`
```

- [ ] **Step 4: Run the OCR test file**

Run: `npm run test:unit -- src/lib/openai-ocr.test.ts`

Expected: PASS

---

### Task 3: Lock the behavior with tests

**Files:**

- Modify: `src/lib/openai-ocr.test.ts`
- Modify: `src/app/api/inbound/availability-email/route.test.ts`

- [ ] **Step 1: Add failing OCR unit coverage**

Cover:

- later variant succeeds after earlier variants return `NO_TEXT`
- merged zone text becomes a page transcript

- [ ] **Step 2: Add failing route coverage**

Cover:

- scanned PDF fallback still auto-applies when a later zone variant becomes readable

- [ ] **Step 3: Run focused verification**

Run:

- `npm run test:unit -- src/lib/openai-ocr.test.ts`
- `npm run test:unit -- src/app/api/inbound/availability-email/route.test.ts`
- `npm run test:unit -- src/app/availability/actions.test.ts`
- `npx eslint src/lib/openai-ocr.ts src/lib/pdf-render-pages.ts src/app/api/inbound/availability-email/route.test.ts`

Expected: PASS

---

## Self-Review

- Spec coverage: one page per employee, fixed template zones, preprocessing variants, stronger page transcript recovery.
- Placeholder scan: no TODO/TBD placeholders remain.
- Type consistency: `OcrImageVariant`, zone labels, and page transcript flow are consistent between helper and tests.
