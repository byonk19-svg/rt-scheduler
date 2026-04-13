# Batch Email Availability Intake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the current availability email intake so one inbound email can ingest body text plus multiple attachments, auto-apply high-confidence items, and route only unclear items into a manager review queue.

**Architecture:** Keep `availability_email_intakes` as the batch-level record and add an item-level child model that represents one body or attachment source at a time. Reuse the current OCR and date parsing foundations, add employee-name-first matching plus confidence reasons, and update `/availability` so managers see batch summaries and item-level review actions instead of one merged intake row per email.

**Tech Stack:** Next.js App Router, Supabase Postgres/Auth/RLS, server actions, OpenAI OCR via Responses API, Tailwind/shadcn UI, Vitest.

---

## File Map

### Schema and data access

- Create: `supabase/migrations/20260413150000_add_availability_email_intake_items.sql`
  - add the child item table plus batch summary columns and RLS
- Modify: `supabase/migrations/20260410143000_add_availability_email_intakes.sql`
  - inspect only for naming consistency; do not edit the old migration

### Parsing and matching

- Modify: `src/lib/availability-email-intake.ts`
  - split parsing into batch/item helpers, add employee extraction and confidence reasons
- Modify: `src/lib/availability-email-intake.test.ts`
  - cover item-level parsing, form-name matching, and confidence routing
- Modify: `src/lib/openai-ocr.ts`
  - add reusable helpers for OCR/text extraction decisions if needed
- Create: `src/lib/availability-email-item-matcher.ts`
  - map extracted employee names to active profiles/roster candidates
- Create: `src/lib/availability-email-item-matcher.test.ts`

### Inbound processing and manager actions

- Modify: `src/app/api/inbound/availability-email/route.ts`
  - emit one batch and many items, then auto-apply only safe items
- Modify: `src/app/availability/actions.ts`
  - create/update/apply review items instead of whole-email rows
- Create: `src/app/api/inbound/availability-email/route.test.ts`
  - verify mixed batches, partial success, and review routing

### Availability page and manager queue UI

- Modify: `src/app/availability/page.tsx`
  - load batch rows, child items, and batch summary counts
- Modify: `src/components/availability/EmailIntakePanel.tsx`
  - render auto-applied vs needs-review sections and item-level actions
- Modify: `src/components/availability/EmailIntakePanel.test.ts`
  - assert review queue behavior, not just one-row apply behavior

### Supporting references

- Inspect: `src/lib/employee-directory.ts`
  - reuse `buildManagerOverrideInput`
- Inspect: `src/lib/manager-workflow.ts`
  - confirm no conflicting inbox assumptions
- Modify: `README.md`
  - document the new intake behavior and constraints if user-facing setup changes

---

## Task 1: Add the item-level intake schema

**Files:**

- Create: `supabase/migrations/20260413150000_add_availability_email_intake_items.sql`
- Inspect: `supabase/migrations/20260410143000_add_availability_email_intakes.sql`

- [ ] **Step 1: Write the migration with additive schema changes**

Add batch summary columns and the new child table:

```sql
alter table public.availability_email_intakes
  add column if not exists batch_status text not null default 'needs_review',
  add column if not exists item_count integer not null default 0,
  add column if not exists auto_applied_count integer not null default 0,
  add column if not exists needs_review_count integer not null default 0,
  add column if not exists failed_count integer not null default 0;

create table if not exists public.availability_email_intake_items (
  id uuid primary key default gen_random_uuid(),
  intake_id uuid not null references public.availability_email_intakes (id) on delete cascade,
  source_type text not null check (source_type in ('body', 'attachment')),
  source_label text not null,
  attachment_id uuid null references public.availability_email_attachments (id) on delete set null,
  raw_text text null,
  ocr_status text not null default 'not_run' check (ocr_status in ('not_run', 'completed', 'failed', 'skipped')),
  ocr_model text null,
  ocr_error text null,
  parse_status text not null default 'needs_review' check (parse_status in ('parsed', 'auto_applied', 'needs_review', 'failed')),
  confidence_level text not null default 'low' check (confidence_level in ('high', 'medium', 'low')),
  confidence_reasons jsonb not null default '[]'::jsonb,
  extracted_employee_name text null,
  employee_match_candidates jsonb not null default '[]'::jsonb,
  matched_therapist_id uuid null references public.profiles (id) on delete set null,
  matched_cycle_id uuid null references public.schedule_cycles (id) on delete set null,
  parsed_requests jsonb not null default '[]'::jsonb,
  unresolved_lines jsonb not null default '[]'::jsonb,
  auto_applied_at timestamptz null,
  auto_applied_by uuid null references public.profiles (id) on delete set null,
  apply_error text null,
  reviewed_at timestamptz null,
  reviewed_by uuid null references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

- [ ] **Step 2: Add indexes, grants, and RLS matching the existing intake tables**

Extend the migration with item table access rules:

```sql
create index if not exists availability_email_intake_items_intake_idx
  on public.availability_email_intake_items (intake_id, created_at desc);

create index if not exists availability_email_intake_items_status_idx
  on public.availability_email_intake_items (parse_status, created_at desc);

alter table public.availability_email_intake_items enable row level security;

grant select, update on public.availability_email_intake_items to authenticated;
grant all on public.availability_email_intake_items to service_role;

create policy "Managers and leads can read all availability email intake items"
on public.availability_email_intake_items
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('manager', 'lead')
  )
);

create policy "Managers can modify availability email intake items"
on public.availability_email_intake_items
for all
using (public.is_manager())
with check (public.is_manager());
```

- [ ] **Step 3: Add an updated-at trigger for the new child table**

Use the same pattern as the batch table:

```sql
create or replace function public.touch_availability_email_intake_items_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger availability_email_intake_items_touch_updated_at
before update on public.availability_email_intake_items
for each row execute function public.touch_availability_email_intake_items_updated_at();
```

- [ ] **Step 4: Run the migration locally**

Run: `supabase db reset`

Expected: migration applies cleanly and the new table exists in the reset schema

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260413150000_add_availability_email_intake_items.sql
git commit -m "Support item-level availability email intake batching" -m "Add an additive child table for intake items and batch summary counters so one inbound email can produce many independently reviewed or auto-applied sources.\n\nConstraint: Existing availability email intake rows must remain readable during rollout\nRejected: Replace the current intake table entirely | unnecessary migration risk\nConfidence: high\nScope-risk: moderate\nDirective: Keep batch-level compatibility until page queries and actions have moved to item-level reads\nTested: supabase db reset\nNot-tested: Application-layer usage of the new schema"
```

## Task 2: Add item parsing, employee extraction, and confidence helpers

**Files:**

- Modify: `src/lib/availability-email-intake.ts`
- Modify: `src/lib/availability-email-intake.test.ts`
- Create: `src/lib/availability-email-item-matcher.ts`
- Create: `src/lib/availability-email-item-matcher.test.ts`

- [ ] **Step 1: Write failing matcher tests**

Add tests for exact, normalized, and ambiguous employee-name matching:

```ts
it('returns one exact active match for the extracted employee name', () => {
  expect(
    matchAvailabilityEmailEmployee('Brianna Brown', [
      { id: 'p1', full_name: 'Brianna Brown', is_active: true },
      { id: 'p2', full_name: 'Bryan Brown', is_active: true },
    ])
  ).toEqual({
    extractedName: 'Brianna Brown',
    matchedTherapistId: 'p1',
    confidence: 'high',
    reasons: [],
    candidates: [{ id: 'p1', fullName: 'Brianna Brown' }],
  })
})
```

- [ ] **Step 2: Run the matcher tests to verify failure**

Run: `npm run test:unit -- src/lib/availability-email-item-matcher.test.ts`

Expected: FAIL because the matcher file does not exist yet

- [ ] **Step 3: Implement a focused employee matcher**

Create a helper with a narrow contract:

```ts
export type AvailabilityEmailEmployeeMatch = {
  extractedName: string | null
  matchedTherapistId: string | null
  confidence: 'high' | 'medium' | 'low'
  reasons: string[]
  candidates: Array<{ id: string; fullName: string }>
}

export function matchAvailabilityEmailEmployee(
  rawText: string,
  profiles: Array<{ id: string; full_name: string; is_active?: boolean | null }>
): AvailabilityEmailEmployeeMatch
```

Use normalized full-name matching first and return ambiguous candidates instead of guessing.

- [ ] **Step 4: Expand intake parser tests for item-level extraction**

Add failing coverage to `src/lib/availability-email-intake.test.ts` for:

- body text becoming one item
- two attachment texts becoming two items
- PTO-style text defaulting to `force_off`
- confidence reasons blocking auto-apply when the employee name is ambiguous

Add a focused expectation like:

```ts
it('marks an item needs_review when dates parse but the employee match is ambiguous', () => {
  expect(parsed.items[0]).toMatchObject({
    parseStatus: 'needs_review',
    confidenceLevel: 'medium',
    confidenceReasons: ['employee_match_ambiguous'],
  })
})
```

- [ ] **Step 5: Run the intake tests to verify failure**

Run: `npm run test:unit -- src/lib/availability-email-intake.test.ts`

Expected: FAIL because the parser still only returns one merged email-level result

- [ ] **Step 6: Refactor `availability-email-intake.ts` around item helpers**

Add types and helpers shaped like:

```ts
export type ParsedAvailabilityEmailItem = {
  sourceType: 'body' | 'attachment'
  sourceLabel: string
  extractedEmployeeName: string | null
  matchedTherapistId: string | null
  matchedCycleId: string | null
  parseStatus: 'parsed' | 'auto_applied' | 'needs_review' | 'failed'
  confidenceLevel: 'high' | 'medium' | 'low'
  confidenceReasons: string[]
  requests: ParsedAvailabilityRequest[]
  unresolvedLines: string[]
  rawText: string
}

export function parseAvailabilityEmailItem(...)
export function summarizeAvailabilityEmailBatch(items: ParsedAvailabilityEmailItem[])
```

Keep the existing date parsing logic where possible; do not duplicate token parsing in the matcher.

- [ ] **Step 7: Re-run both test files**

Run:

- `npm run test:unit -- src/lib/availability-email-item-matcher.test.ts`
- `npm run test:unit -- src/lib/availability-email-intake.test.ts`

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/lib/availability-email-intake.ts src/lib/availability-email-intake.test.ts src/lib/availability-email-item-matcher.ts src/lib/availability-email-item-matcher.test.ts
git commit -m "Add item-level parsing for availability email intake" -m "Split intake parsing into item-based helpers with employee-name-first matching and explicit confidence reasons so downstream auto-apply can operate safely per source.\n\nConstraint: Reuse the current date parsing rules instead of inventing a second parser\nRejected: Infer employee identity from sender email first | conflicts with form-first requirements\nConfidence: high\nScope-risk: moderate\nDirective: Preserve reason codes as stable strings because the manager queue UI will depend on them\nTested: npm run test:unit -- src/lib/availability-email-item-matcher.test.ts; npm run test:unit -- src/lib/availability-email-intake.test.ts\nNot-tested: OCR-driven real attachment text"
```

## Task 3: Refactor inbound processing to create batches and items

**Files:**

- Modify: `src/app/api/inbound/availability-email/route.ts`
- Create: `src/app/api/inbound/availability-email/route.test.ts`
- Modify: `src/lib/openai-ocr.ts`

- [ ] **Step 1: Write failing route tests for mixed-item batches**

Cover:

- one email body plus two attachments yields three intake items
- one high-confidence item auto-applies while one unclear item remains in review
- one failed OCR attachment does not block the rest of the batch

Example test shape:

```ts
it('auto-applies only high-confidence items from a mixed batch', async () => {
  const response = await POST(mockWebhookRequest)
  expect(response.status).toBe(200)
  expect(mockInsertItem).toHaveBeenCalledTimes(3)
  expect(mockUpsertAvailabilityOverrides).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: Run the route tests to verify failure**

Run: `npm run test:unit -- src/app/api/inbound/availability-email/route.test.ts`

Expected: FAIL because the route still inserts one merged intake row

- [ ] **Step 3: Add reusable source-expansion helpers inside the route or a tiny local helper**

Create one candidate per source:

```ts
const candidateSources = [
  normalizedBodyText
    ? { sourceType: 'body' as const, sourceLabel: 'Email body', rawText: normalizedBodyText }
    : null,
  ...processedAttachments.map((attachment) => ({
    sourceType: 'attachment' as const,
    sourceLabel: attachment.filename,
    attachmentId: attachment.id,
    rawText: attachment.ocr_text ?? '',
  })),
].filter(Boolean)
```

- [ ] **Step 4: Replace merged parsing with per-item parsing and batch summary writes**

Persist:

- one `availability_email_intakes` row
- many `availability_email_attachments` rows
- many `availability_email_intake_items` rows

Then auto-apply only items matching:

```ts
const autoApplicableItems = parsedItems.filter(
  (item) =>
    item.confidenceLevel === 'high' &&
    item.matchedTherapistId &&
    item.matchedCycleId &&
    item.requests.length > 0
)
```

Update the batch counters after item inserts and applies.

- [ ] **Step 5: Keep item-level failure isolation explicit**

Guard each item so a failure becomes a stored reviewable result:

```ts
try {
  // parse, match, and auto-apply when safe
} catch (error) {
  return {
    parseStatus: 'failed' as const,
    confidenceLevel: 'low' as const,
    confidenceReasons: ['item_processing_failed'],
    applyError: error instanceof Error ? error.message : 'Unknown item error',
  }
}
```

- [ ] **Step 6: Re-run the route tests**

Run: `npm run test:unit -- src/app/api/inbound/availability-email/route.test.ts`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/app/api/inbound/availability-email/route.ts src/app/api/inbound/availability-email/route.test.ts src/lib/openai-ocr.ts
git commit -m "Batch inbound availability email processing by item" -m "Refactor the inbound webhook to expand one email into body and attachment items, persist item-level parse results, and auto-apply only the safe subset.\n\nConstraint: A single bad form must not block the rest of the email batch\nRejected: Continue merging OCR and body text into one parse payload | loses source-level control and reviewability\nConfidence: high\nScope-risk: broad\nDirective: Keep item creation and auto-apply idempotent relative to provider email id because webhook retries are possible\nTested: npm run test:unit -- src/app/api/inbound/availability-email/route.test.ts\nNot-tested: Live Resend webhook delivery"
```

## Task 4: Move manager actions and page queries to item-level review

**Files:**

- Modify: `src/app/availability/actions.ts`
- Modify: `src/app/availability/page.tsx`

- [ ] **Step 1: Add failing action tests for item review and apply**

Create or extend tests around:

- manual item apply by item id
- updating a review item with therapist/cycle fixes
- leaving already auto-applied items untouched

Use an expectation like:

```ts
it('applies one reviewed intake item without mutating sibling items', async () => {
  await applyEmailAvailabilityImportAction(formDataWithItemId)
  expect(mockUpsertOverrides).toHaveBeenCalledWith(
    expect.arrayContaining([expect.objectContaining({ therapist_id: 'therapist-1' })]),
    expect.anything()
  )
})
```

- [ ] **Step 2: Run the action tests to verify failure**

Run: `npm run test:unit -- src/app/availability/actions.test.ts`

Expected: FAIL because actions still operate on the parent intake row

- [ ] **Step 3: Refactor action payloads from `intake_id` to `item_id` where appropriate**

Update action contracts:

```ts
const itemId = String(formData.get('item_id') ?? '').trim()

const { data: item } = await supabase
  .from('availability_email_intake_items')
  .select('id, intake_id, matched_therapist_id, matched_cycle_id, parsed_requests, parse_status')
  .eq('id', itemId)
  .maybeSingle()
```

Only batch-level manual creation should keep writing the parent intake first.

- [ ] **Step 4: Update the page query to load items and summary counts**

Change `/availability` reads from:

```ts
.from('availability_email_intakes')
.select('id, from_email, from_name, subject, received_at, parse_status, parse_summary, ...')
```

to a parent-plus-child load that maps:

- batch summaries
- auto-applied items
- needs-review items

Use `availability_email_intake_items` as the source of manager actions and row rendering.

- [ ] **Step 5: Re-run the action tests**

Run: `npm run test:unit -- src/app/availability/actions.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/availability/actions.ts src/app/availability/page.tsx src/app/availability/actions.test.ts
git commit -m "Switch availability intake review actions to item-level flows" -m "Update manager actions and page queries so review and apply operations target individual intake items instead of whole-email rows.\n\nConstraint: Manual intake creation should remain manager-only and preserve current entry points\nRejected: Duplicate old email-level actions next to new item-level actions | unnecessary surface area\nConfidence: medium\nScope-risk: moderate\nDirective: Do not let one item apply mutate batch or sibling item state beyond recomputing counters\nTested: npm run test:unit -- src/app/availability/actions.test.ts\nNot-tested: Full manager UI interaction"
```

## Task 5: Rebuild the Email Intake panel around batch summaries and review items

**Files:**

- Modify: `src/components/availability/EmailIntakePanel.tsx`
- Modify: `src/components/availability/EmailIntakePanel.test.ts`
- Modify: `README.md`

- [ ] **Step 1: Write failing component tests for the new queue layout**

Cover:

- batch summary counts render
- `Needs review` and `Auto-applied recently` sections render separately
- apply button appears per review item, not just per batch
- confidence reasons render as badges or helper text

Example:

```ts
it('renders separate review items under one email batch', () => {
  expect(html).toContain('Needs review')
  expect(html).toContain('Email body')
  expect(html).toContain('form-1.jpg')
  expect(html).toContain('employee_match_ambiguous')
})
```

- [ ] **Step 2: Run the component tests to verify failure**

Run: `npm run test:unit -- src/components/availability/EmailIntakePanel.test.ts`

Expected: FAIL because the component still expects one merged row shape

- [ ] **Step 3: Update the panel props and rendering model**

Evolve the props from one flat row to a batch-and-items shape:

```ts
export type EmailIntakePanelBatch = {
  id: string
  fromEmail: string
  fromName: string | null
  subject: string | null
  receivedAt: string
  itemCount: number
  autoAppliedCount: number
  needsReviewCount: number
  failedCount: number
  reviewItems: EmailIntakePanelItem[]
  autoAppliedItems: EmailIntakePanelItem[]
}
```

Render item-level forms with hidden `item_id` inputs for update/apply actions.

- [ ] **Step 4: Re-run the component tests**

Run: `npm run test:unit -- src/components/availability/EmailIntakePanel.test.ts`

Expected: PASS

- [ ] **Step 5: Document the new workflow in the README**

Add a short section under availability or operations:

```md
### Availability Email Intake

- one email can contain body text plus multiple form attachments
- clear items auto-apply to availability
- unclear items appear in the manager review queue on `/availability`
```

- [ ] **Step 6: Run the focused test suite for all touched units**

Run:

- `npm run test:unit -- src/lib/availability-email-item-matcher.test.ts`
- `npm run test:unit -- src/lib/availability-email-intake.test.ts`
- `npm run test:unit -- src/app/api/inbound/availability-email/route.test.ts`
- `npm run test:unit -- src/app/availability/actions.test.ts`
- `npm run test:unit -- src/components/availability/EmailIntakePanel.test.ts`

Expected: PASS on all listed files

- [ ] **Step 7: Run broader repo checks**

Run:

- `npm run lint`
- `npm run test:unit`

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/components/availability/EmailIntakePanel.tsx src/components/availability/EmailIntakePanel.test.ts README.md
git commit -m "Present batch availability intake as an exception-oriented queue" -m "Rework the manager email intake panel so batches summarize auto-applied results and only unresolved items require manual review.\n\nConstraint: Keep the existing manual intake creation entry point in the same workspace\nRejected: Separate the review queue into a new route first | adds navigation overhead without product value\nConfidence: medium\nScope-risk: moderate\nDirective: Keep review-item copy tied to stable confidence reason codes from the parser layer\nTested: npm run test:unit -- src/components/availability/EmailIntakePanel.test.ts; npm run lint; npm run test:unit\nNot-tested: Browser-level interaction or live OCR uploads"
```

---

## Self-Review

### Spec coverage

- Batch plus item model: covered in Tasks 1, 3, 4, and 5
- Employee-on-form matching: covered in Task 2
- Body plus attachment ingestion: covered in Tasks 2 and 3
- Auto-apply high-confidence items: covered in Tasks 2, 3, and 4
- Review queue for unclear items: covered in Tasks 4 and 5
- Item-level failure isolation: covered in Task 3
- Audit/traceability via stored source metadata: covered in Tasks 1 and 3

### Placeholder scan

- No `TODO`, `TBD`, or `implement later` placeholders remain
- Every task names concrete files, commands, and output expectations

### Type consistency

- Plan uses `availability_email_intake_items` consistently for child records
- Status vocabulary stays aligned: `parsed`, `auto_applied`, `needs_review`, `failed`
- Confidence vocabulary stays aligned: `high`, `medium`, `low`

---

Plan complete and saved to `docs/superpowers/plans/2026-04-13-batch-email-availability-intake.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
