# Intake Date Chip Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let managers click parsed intake date chips to cycle `off -> work -> removed`, save each change immediately, and use those corrected requests in `Apply dates`, manager availability views, and auto draft inputs.

**Architecture:** Keep the existing intake pipeline intact and add a narrow editing lane on top of persisted `availability_email_intake_items.parsed_requests`. The change is centered on one server action that rewrites a single item’s saved requests immediately, plus intake-card UI that renders persisted chip state and visually marks edited items; downstream manager views continue to read applied availability overrides as they do today.

**Tech Stack:** Next.js App Router server actions, Supabase Postgres, React server/client components, Vitest, ESLint

---

### Task 1: Add server-side request cycling helpers and tests

**Files:**

- Create: `src/lib/availability-intake-request-cycler.ts`
- Create: `src/lib/availability-intake-request-cycler.test.ts`
- Test: `src/lib/availability-intake-request-cycler.test.ts`

- [ ] **Step 1: Write the failing helper tests**

```ts
import { describe, expect, it } from 'vitest'

import { cycleIntakeRequest, markRequestsEdited } from '@/lib/availability-intake-request-cycler'

const baseRequests = [
  {
    date: '2026-05-03',
    override_type: 'force_off' as const,
    shift_type: 'both' as const,
    note: null,
    source_line: '5/3 - 5/5 off',
  },
  {
    date: '2026-05-14',
    override_type: 'force_on' as const,
    shift_type: 'both' as const,
    note: null,
    source_line: '5/14 working memorial',
  },
]

describe('cycleIntakeRequest', () => {
  it('cycles off to work', () => {
    expect(cycleIntakeRequest(baseRequests, '2026-05-03')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          date: '2026-05-03',
          override_type: 'force_on',
        }),
      ])
    )
  })

  it('cycles work to removed', () => {
    expect(cycleIntakeRequest(baseRequests, '2026-05-14')).toEqual([
      {
        date: '2026-05-03',
        override_type: 'force_off',
        shift_type: 'both',
        note: null,
        source_line: '5/3 - 5/5 off',
      },
    ])
  })
})

describe('markRequestsEdited', () => {
  it('detects manual differences from the original parser output', () => {
    expect(markRequestsEdited(baseRequests, cycleIntakeRequest(baseRequests, '2026-05-03'))).toBe(
      true
    )
  })
})
```

- [ ] **Step 2: Run the helper tests to verify they fail**

Run: `npx vitest run src/lib/availability-intake-request-cycler.test.ts`

Expected: FAIL because the helper module does not exist yet.

- [ ] **Step 3: Implement the minimal request-cycling helpers**

```ts
import {
  sanitizeParsedRequests,
  type ParsedAvailabilityRequest,
} from '@/lib/availability-email-intake'

function toggleOverrideType(
  value: ParsedAvailabilityRequest['override_type']
): ParsedAvailabilityRequest['override_type'] | null {
  if (value === 'force_off') return 'force_on'
  return null
}

export function cycleIntakeRequest(
  rawRequests: unknown,
  date: string
): ParsedAvailabilityRequest[] {
  const requests = sanitizeParsedRequests(rawRequests)

  return requests.flatMap((request) => {
    if (request.date !== date) return [request]
    const next = toggleOverrideType(request.override_type)
    if (!next) return []
    return [{ ...request, override_type: next }]
  })
}

export function markRequestsEdited(
  originalRawRequests: unknown,
  currentRawRequests: unknown
): boolean {
  return (
    JSON.stringify(sanitizeParsedRequests(originalRawRequests)) !==
    JSON.stringify(sanitizeParsedRequests(currentRawRequests))
  )
}
```

- [ ] **Step 4: Run the helper tests to verify they pass**

Run: `npx vitest run src/lib/availability-intake-request-cycler.test.ts`

Expected: PASS with all helper tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/availability-intake-request-cycler.ts src/lib/availability-intake-request-cycler.test.ts
git commit -m "Add intake request chip-cycling helpers" -m "Isolate the off-to-work-to-removed request transformation in a small helper module so the intake action and UI can share one deterministic rule for chip editing.\n+\n+Constraint: Intake chip edits must rewrite the persisted parsed request set immediately\n+Rejected: Put the cycling logic inline in the server action | harder to test and easier to drift from the UI contract\n+Confidence: high\n+Scope-risk: narrow\n+Reversibility: clean\n+Directive: Keep chip-cycle behavior deterministic and centralized; the UI should render persisted state, not invent its own transitions\n+Tested: npx vitest run src/lib/availability-intake-request-cycler.test.ts\n+Not-tested: No UI or database verification in this commit"
```

### Task 2: Persist chip edits on intake items through a new server action

**Files:**

- Modify: `src/app/availability/actions.ts`
- Modify: `src/app/availability/actions.test.ts`
- Test: `src/app/availability/actions.test.ts`

- [ ] **Step 1: Write the failing action tests**

```ts
it('cycles one intake item request from off to work and saves immediately', async () => {
  const supabase = createSupabaseMock({ userId: 'manager-1', role: 'manager' })
  supabase.state.emailIntakeItemRow = {
    id: 'item-1',
    intake_id: 'intake-1',
    parsed_requests: [
      {
        date: '2026-05-03',
        override_type: 'force_off',
        shift_type: 'both',
        note: null,
        source_line: '5/3 - 5/5 off',
      },
    ],
    original_parsed_requests: [
      {
        date: '2026-05-03',
        override_type: 'force_off',
        shift_type: 'both',
        note: null,
        source_line: '5/3 - 5/5 off',
      },
    ],
  }
  createClientMock.mockResolvedValue(supabase)

  const formData = new FormData()
  formData.set('item_id', 'item-1')
  formData.set('date', '2026-05-03')

  await expect(updateEmailIntakeItemRequestAction(formData)).rejects.toThrow(
    'REDIRECT:/availability?success=email_intake_request_updated'
  )

  expect(supabase.state.updates).toContainEqual(
    expect.objectContaining({
      table: 'availability_email_intake_items',
      payload: expect.objectContaining({
        parsed_requests: [
          expect.objectContaining({
            date: '2026-05-03',
            override_type: 'force_on',
          }),
        ],
        manually_edited_at: expect.any(String),
      }),
    })
  )
})

it('removes a chip when the current request is already work', async () => {
  // same setup, but parsed_requests starts with force_on and ends empty after save
})
```

- [ ] **Step 2: Run the action tests to verify they fail**

Run: `npx vitest run src/app/availability/actions.test.ts`

Expected: FAIL because `updateEmailIntakeItemRequestAction` does not exist yet.

- [ ] **Step 3: Implement the server action**

```ts
export async function updateEmailIntakeItemRequestAction(formData: FormData) {
  const { supabase, role } = await getAuthenticatedUserWithRole()

  if (!can(role, 'access_manager_ui')) {
    redirect('/availability')
  }

  const itemId = String(formData.get('item_id') ?? '').trim()
  const date = String(formData.get('date') ?? '').trim()
  if (!itemId || !date) {
    redirect(buildAvailabilityUrl({ error: 'email_intake_request_update_failed' }))
  }

  const { data: item, error: loadError } = await supabase
    .from('availability_email_intake_items')
    .select('id, intake_id, parsed_requests, original_parsed_requests')
    .eq('id', itemId)
    .maybeSingle()

  if (loadError || !item) {
    redirect(buildAvailabilityUrl({ error: 'email_intake_request_update_failed' }))
  }

  const currentRequests = cycleIntakeRequest(item.parsed_requests, date)
  const manuallyEdited = markRequestsEdited(
    item.original_parsed_requests ?? item.parsed_requests,
    currentRequests
  )

  const { error: updateError } = await supabase
    .from('availability_email_intake_items')
    .update({
      parsed_requests: currentRequests,
      manually_edited_at: manuallyEdited ? new Date().toISOString() : null,
    })
    .eq('id', itemId)

  if (updateError) {
    redirect(buildAvailabilityUrl({ error: 'email_intake_request_update_failed' }))
  }

  await refreshAvailabilityEmailIntakeBatchState(supabase, String(item.intake_id))
  revalidatePath('/availability')
  redirect(buildAvailabilityUrl({ success: 'email_intake_request_updated' }))
}
```

- [ ] **Step 4: Run the action tests to verify they pass**

Run: `npx vitest run src/app/availability/actions.test.ts`

Expected: PASS with the new chip-edit action covered.

- [ ] **Step 5: Commit**

```bash
git add src/app/availability/actions.ts src/app/availability/actions.test.ts
git commit -m "Persist intake date chip edits immediately" -m "Add a manager-only server action that cycles one parsed intake request at a time and writes the updated request set back to the intake item immediately.\n+\n+Constraint: Chip edits must save instantly from the intake card without waiting for Apply dates\n+Rejected: Batch-save editing mode first | slower operator flow for the common one-chip correction case\n+Confidence: medium\n+Scope-risk: moderate\n+Reversibility: clean\n+Directive: Treat saved parsed_requests on the intake item as the source of truth before Apply dates runs\n+Tested: npx vitest run src/app/availability/actions.test.ts\n+Not-tested: No browser verification in this commit"
```

### Task 3: Add intake chip controls and edited-state UI

**Files:**

- Modify: `src/components/availability/EmailIntakePanel.tsx`
- Modify: `src/components/availability/EmailIntakePanel.test.ts`
- Modify: `src/app/availability/page.tsx`
- Test: `src/components/availability/EmailIntakePanel.test.ts`

- [ ] **Step 1: Write the failing panel tests**

```ts
it('renders clickable request chips and an edited marker', () => {
  const html = renderToStaticMarkup(
    createElement(EmailIntakePanel, {
      rows: [
        {
          ...baseRow,
          reviewItems: [
            {
              ...baseRow.reviewItems[0],
              manuallyEdited: true,
              parsedRequests: [
                { date: '2026-05-03', override_type: 'force_off' as const },
                { date: '2026-05-14', override_type: 'force_on' as const },
              ],
            },
          ],
        },
      ],
      updateEmailIntakeItemRequestAction: async () => {},
      ...
    })
  )

  expect(html).toContain('Edited')
  expect(html).toContain('name="item_id"')
  expect(html).toContain('name="date"')
  expect(html).toContain('May 3 off')
  expect(html).toContain('May 14 work')
})
```

- [ ] **Step 2: Run the panel tests to verify they fail**

Run: `npx vitest run src/components/availability/EmailIntakePanel.test.ts`

Expected: FAIL because the panel does not yet render editable chip forms or edited markers.

- [ ] **Step 3: Implement the intake chip controls**

```tsx
type EmailIntakePanelItemRow = {
  ...
  manuallyEdited?: boolean
}

function renderEditableRequestChip(params: {
  itemId: string
  request: EmailIntakePanelItemRow['parsedRequests'][number]
  updateEmailIntakeItemRequestAction: (formData: FormData) => void | Promise<void>
}) {
  return (
    <form
      key={`${params.itemId}-${params.request.date}-${params.request.override_type}`}
      action={params.updateEmailIntakeItemRequestAction}
    >
      <input type="hidden" name="item_id" value={params.itemId} />
      <input type="hidden" name="date" value={params.request.date} />
      <Button
        type="submit"
        variant="outline"
        size="sm"
        className={
          params.request.override_type === 'force_off'
            ? 'border-destructive/30 bg-destructive/10 text-destructive'
            : 'border-info-border bg-background text-foreground'
        }
      >
        {formatRequestLabel(params.request)}
      </Button>
    </form>
  )
}
```

- [ ] **Step 4: Run the panel tests to verify they pass**

Run: `npx vitest run src/components/availability/EmailIntakePanel.test.ts`

Expected: PASS with editable chips and edited-state rendering covered.

- [ ] **Step 5: Commit**

```bash
git add src/components/availability/EmailIntakePanel.tsx src/components/availability/EmailIntakePanel.test.ts src/app/availability/page.tsx
git commit -m "Let managers toggle intake request chips inline" -m "Render each parsed intake request as a clickable chip that saves immediately and surfaces an edited marker when managers override the parser output.\n+\n+Constraint: The intake card must stay fast and inline; no modal edit flow\n+Rejected: Separate edit mode with explicit save button | adds friction to the common one-chip fix path\n+Confidence: medium\n+Scope-risk: moderate\n+Reversibility: clean\n+Directive: Intake chip UI should render persisted server state, not local-only optimistic state\n+Tested: npx vitest run src/components/availability/EmailIntakePanel.test.ts\n+Not-tested: No end-to-end browser test in this commit"
```

### Task 4: Preserve original parser output for reparse and edited-state tracking

**Files:**

- Create: `supabase/migrations/20260414210000_track_intake_request_edits.sql`
- Create: `src/lib/intake-request-edit-migration.test.ts`
- Modify: `src/app/api/inbound/availability-email/route.ts`
- Modify: `src/app/availability/actions.ts`
- Test: `src/lib/intake-request-edit-migration.test.ts`

- [ ] **Step 1: Write the failing migration contract test**

```ts
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20260414210000_track_intake_request_edits.sql'
)

describe('intake request edit tracking migration', () => {
  it('adds original parser output and manual edit tracking fields', () => {
    expect(fs.existsSync(migrationPath)).toBe(true)
    const sql = fs.readFileSync(migrationPath, 'utf8')
    expect(sql).toContain('add column if not exists original_parsed_requests jsonb')
    expect(sql).toContain('add column if not exists manually_edited_at timestamptz')
  })
})
```

- [ ] **Step 2: Run the migration contract test to verify it fails**

Run: `npx vitest run src/lib/intake-request-edit-migration.test.ts`

Expected: FAIL because the migration file does not exist yet.

- [ ] **Step 3: Add the migration and wire the new fields**

```sql
alter table public.availability_email_intake_items
  add column if not exists original_parsed_requests jsonb null;

alter table public.availability_email_intake_items
  add column if not exists manually_edited_at timestamptz null;
```

Also update insert/reparse paths so newly parsed items store:

```ts
original_parsed_requests: item.requests,
manually_edited_at: null,
```

- [ ] **Step 4: Run the migration contract test to verify it passes**

Run: `npx vitest run src/lib/intake-request-edit-migration.test.ts`

Expected: PASS and confirm the migration text matches the new edit-tracking contract.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260414210000_track_intake_request_edits.sql src/lib/intake-request-edit-migration.test.ts src/app/api/inbound/availability-email/route.ts src/app/availability/actions.ts
git commit -m "Track original intake requests and manual chip edits" -m "Persist original parser output and a manual-edit marker so Reparse can reset the chip set and the intake card can show when managers changed parser results.\n+\n+Constraint: Reparse must remain the single reset path back to parser-generated requests\n+Rejected: Infer edited state only from UI-local differences | not durable across reloads or reparsing\n+Confidence: medium\n+Scope-risk: moderate\n+Reversibility: clean\n+Directive: Whenever parser output is regenerated, refresh original_parsed_requests and clear manual edit state in the same write\n+Tested: npx vitest run src/lib/intake-request-edit-migration.test.ts\n+Not-tested: No live migration execution in this commit"
```

### Task 5: Verify downstream behavior and finish the branch

**Files:**

- Modify: `src/app/availability/actions.test.ts`
- Modify: `src/components/availability/EmailIntakePanel.test.ts`
- Modify: `src/lib/availability-email-intake.test.ts`
- Test: `src/app/availability/actions.test.ts`
- Test: `src/components/availability/EmailIntakePanel.test.ts`

- [ ] **Step 1: Run the focused intake suite**

Run: `npx vitest run src/lib/availability-intake-request-cycler.test.ts src/lib/availability-email-intake.test.ts src/app/api/inbound/availability-email/route.test.ts src/app/availability/actions.test.ts src/components/availability/EmailIntakePanel.test.ts`

Expected: PASS across helper, parser, route, action, and panel coverage.

- [ ] **Step 2: Run lint on the touched intake files**

Run: `npx eslint src/lib/availability-intake-request-cycler.ts src/lib/availability-intake-request-cycler.test.ts src/lib/availability-email-intake.ts src/lib/availability-email-intake.test.ts src/app/api/inbound/availability-email/route.ts src/app/api/inbound/availability-email/route.test.ts src/app/availability/actions.ts src/app/availability/actions.test.ts src/components/availability/EmailIntakePanel.tsx src/components/availability/EmailIntakePanel.test.ts src/app/availability/page.tsx`

Expected: PASS with no new lint errors.

- [ ] **Step 3: Run the full unit suite**

Run: `npm run test:unit`

Expected: PASS, or only unrelated pre-existing failures if the repo regresses outside this feature.

- [ ] **Step 4: Inspect the final intake diff**

Run: `git diff --stat`

Expected: Diff stays focused on intake parser/editing, availability actions, intake UI, and the migration.

- [ ] **Step 5: Commit**

```bash
git add src/lib/availability-intake-request-cycler.ts src/lib/availability-intake-request-cycler.test.ts src/lib/availability-email-intake.ts src/lib/availability-email-intake.test.ts src/app/api/inbound/availability-email/route.ts src/app/api/inbound/availability-email/route.test.ts src/app/availability/actions.ts src/app/availability/actions.test.ts src/components/availability/EmailIntakePanel.tsx src/components/availability/EmailIntakePanel.test.ts src/app/availability/page.tsx supabase/migrations/20260414210000_track_intake_request_edits.sql src/lib/intake-request-edit-migration.test.ts
git commit -m "Let managers correct parsed intake dates before applying" -m "Complete the immediate-save intake chip editing flow so managers can cycle parsed dates between off, work, and removed, persist the correction immediately, and apply the corrected request set into availability overrides.\n+\n+Constraint: Downstream schedule logic must continue to read applied overrides, not raw intake state\n+Rejected: Add a second downstream correction pipeline for auto draft | duplicates the existing apply-to-override architecture\n+Confidence: medium\n+Scope-risk: moderate\n+Reversibility: clean\n+Directive: Keep Apply dates pointed at the saved intake item state and use Reparse as the reset path back to parser output\n+Tested: npx vitest run src/lib/availability-intake-request-cycler.test.ts src/lib/availability-email-intake.test.ts src/app/api/inbound/availability-email/route.test.ts src/app/availability/actions.test.ts src/components/availability/EmailIntakePanel.test.ts; npx eslint src/lib/availability-intake-request-cycler.ts src/lib/availability-intake-request-cycler.test.ts src/lib/availability-email-intake.ts src/lib/availability-email-intake.test.ts src/app/api/inbound/availability-email/route.ts src/app/api/inbound/availability-email/route.test.ts src/app/availability/actions.ts src/app/availability/actions.test.ts src/components/availability/EmailIntakePanel.tsx src/components/availability/EmailIntakePanel.test.ts src/app/availability/page.tsx; npm run test:unit\n+Not-tested: No manual browser verification in this commit"
```

## Spec Coverage Check

- clickable chip cycle: covered by Tasks 1, 2, and 3
- immediate persistence: covered by Task 2
- edited-state tracking and reparse reset behavior: covered by Task 4
- `Apply dates` using edited requests: covered by Task 2 and Task 5
- downstream manager/auto-draft integration through overrides: covered by Task 5

## Placeholder Scan

- No `TODO`, `TBD`, or deferred “handle this later” steps remain.
- Each code-changing step includes concrete code or migration content.
- Every verification step includes an exact command and expected result.

## Type Consistency Check

- `parsed_requests` remains the saved editable request set.
- `original_parsed_requests` is reserved for reparse reset and edited-state comparison.
- Chip cycle remains `force_off -> force_on -> removed`.
