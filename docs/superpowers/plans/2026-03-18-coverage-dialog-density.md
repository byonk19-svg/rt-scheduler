# Coverage Dialog Density Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `/coverage` shift editor dialog more compact using the approved even-compact density direction without changing behavior.

**Architecture:** Extract the dialog's spacing and sizing decisions into a small layout helper so the density change is testable in a Node Vitest environment. Then wire `ShiftEditorDialog` to use the helper's class tokens for the shell, header, rows, and controls.

**Tech Stack:** Next.js, React 19, TypeScript, Tailwind, Vitest

---

## Chunk 1: Testable layout contract

### Task 1: Add failing layout token test

**Files:**

- Create: `src/components/coverage/shift-editor-dialog-layout.test.ts`
- Create: `src/components/coverage/shift-editor-dialog-layout.ts`

- [ ] **Step 1: Write the failing test**

Write a test that expects balanced dialog sizing tokens:

- dialog width token includes a narrower desktop max width
- header token includes tighter padding and smaller title sizing
- row token includes smaller avatar and action sizes

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/components/coverage/shift-editor-dialog-layout.test.ts`
Expected: FAIL because the layout helper does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create a small exported layout object with the approved even-compact class strings.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/components/coverage/shift-editor-dialog-layout.test.ts`
Expected: PASS

## Chunk 2: Apply compact tokens to dialog

### Task 2: Update the shift editor dialog

**Files:**

- Modify: `src/components/coverage/ShiftEditorDialog.tsx`
- Create: `src/components/coverage/shift-editor-dialog-layout.ts`
- Test: `src/components/coverage/shift-editor-dialog-layout.test.ts`

- [ ] **Step 1: Replace hard-coded spacing classes with layout tokens**

Apply the helper tokens to:

- `DialogContent`
- header container and title
- therapist row shell, avatar, metadata, lead badge, and action button
- section spacing and alert blocks

- [ ] **Step 2: Keep existing behavior intact**

Do not change props, state, handlers, labels, or accessibility names.

- [ ] **Step 3: Run targeted test and build verification**

Run: `npm run test:unit -- src/components/coverage/shift-editor-dialog-layout.test.ts`
Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Review the UI manually**

Confirm the dialog now shows more rows per viewport and still feels comfortable to scan.
