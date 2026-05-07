# Bulk Availability Reminder Action — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Send reminders" button to the manager `/availability` response roster that emails all non-submitting therapists for the selected cycle.

**Architecture:** A pure email helper (`src/lib/availability-reminders.ts`) handles Resend calls and is tested in isolation. A new server action in the existing `actions.ts` handles auth, DB queries, and calls the helper. The `AvailabilityStatusSummary` client component gains an `onSendReminders` callback prop and renders the AlertDialog + toast. `ManagerSchedulingInputs` wires the callback.

**Tech Stack:** Next.js App Router server actions, Supabase (server client), Resend REST API, shadcn AlertDialog, existing `FeedbackToast` component.

---

## File Map

| File                                                            | Status     | Responsibility                                                                      |
| --------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------- |
| `src/lib/availability-reminders.ts`                             | **Create** | Pure function: given recipients + config, sends emails sequentially, returns counts |
| `src/lib/availability-reminders.test.ts`                        | **Create** | Unit tests for the helper — mocks Resend fetch                                      |
| `src/app/(app)/availability/actions.ts`                         | **Modify** | Add `sendAvailabilityRemindersAction` (auth, DB queries, calls helper)              |
| `src/components/availability/AvailabilityStatusSummary.tsx`     | **Modify** | Add `cycleId` + `onSendReminders` props, button, AlertDialog, toast state           |
| `src/components/availability/AvailabilityStatusSummary.test.ts` | **Modify** | Add test for button render with new props                                           |
| `src/components/availability/ManagerSchedulingInputs.tsx`       | **Modify** | Wire `selectedCycleId` + action callback into `AvailabilityStatusSummary`           |

---

## Task 1: Pure email helper + unit tests

**Files:**

- Create: `src/lib/availability-reminders.ts`
- Create: `src/lib/availability-reminders.test.ts`

### Step 1.1 — Write the failing tests

Create `src/lib/availability-reminders.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { sendAvailabilityReminderEmails } from './availability-reminders'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const baseConfig = {
  resendApiKey: 'test-key',
  fromEmail: 'Teamwise <noreply@mail.teamwise.work>',
  resendApiUrl: 'https://api.resend.com/emails',
}

const baseInput = {
  cycleDateRange: 'Apr 28 – May 25',
  availabilityUrl: 'https://www.teamwise.work/availability',
  emailConfig: baseConfig,
}

function makeRecipient(overrides?: Partial<{ id: string; email: string; name: string | null }>) {
  return {
    therapistId: overrides?.id ?? 'therapist-1',
    email: overrides?.email ?? 'therapist@test.com',
    name: overrides?.name ?? 'Jane Doe',
  }
}

beforeEach(() => {
  mockFetch.mockReset()
  mockFetch.mockResolvedValue({ ok: true, status: 200 })
})

describe('sendAvailabilityReminderEmails', () => {
  it('sends one email per recipient and returns correct counts', async () => {
    const recipients = [makeRecipient({ id: '1' }), makeRecipient({ id: '2', email: 'b@test.com' })]
    const result = await sendAvailabilityReminderEmails({ ...baseInput, recipients })

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(result).toEqual({ sent: 2, failed: 0 })
  })

  it('returns { sent: 0, failed: 0 } when recipients list is empty', async () => {
    const result = await sendAvailabilityReminderEmails({ ...baseInput, recipients: [] })
    expect(mockFetch).not.toHaveBeenCalled()
    expect(result).toEqual({ sent: 0, failed: 0 })
  })

  it('counts a failed Resend call and continues to remaining recipients', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 422 })
      .mockResolvedValueOnce({ ok: true, status: 200 })
    const recipients = [makeRecipient({ id: '1' }), makeRecipient({ id: '2', email: 'b@test.com' })]
    const result = await sendAvailabilityReminderEmails({ ...baseInput, recipients })

    expect(result).toEqual({ sent: 1, failed: 1 })
  })

  it('includes the cycle date range in the email subject', async () => {
    await sendAvailabilityReminderEmails({ ...baseInput, recipients: [makeRecipient()] })
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string)
    expect(body.subject).toContain('Apr 28 – May 25')
  })

  it('includes the availability URL in the email body', async () => {
    await sendAvailabilityReminderEmails({ ...baseInput, recipients: [makeRecipient()] })
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string)
    expect(body.html).toContain('https://www.teamwise.work/availability')
    expect(body.text).toContain('https://www.teamwise.work/availability')
  })

  it('uses the recipient name in the greeting when available', async () => {
    await sendAvailabilityReminderEmails({
      ...baseInput,
      recipients: [makeRecipient({ name: 'Jane Doe' })],
    })
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string)
    expect(body.html).toContain('Jane Doe')
  })

  it('falls back to a generic greeting when name is null', async () => {
    await sendAvailabilityReminderEmails({
      ...baseInput,
      recipients: [makeRecipient({ name: null })],
    })
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string)
    expect(body.html).toContain('Hi there')
  })

  it('sends emails sequentially (not in parallel)', async () => {
    const callOrder: number[] = []
    let resolveFirst!: () => void
    mockFetch
      .mockImplementationOnce(
        () =>
          new Promise<{ ok: boolean; status: number }>((resolve) => {
            resolveFirst = () => {
              callOrder.push(1)
              resolve({ ok: true, status: 200 })
            }
          })
      )
      .mockImplementationOnce(() => {
        callOrder.push(2)
        return Promise.resolve({ ok: true, status: 200 })
      })

    const promise = sendAvailabilityReminderEmails({
      ...baseInput,
      recipients: [makeRecipient({ id: '1' }), makeRecipient({ id: '2', email: 'b@test.com' })],
    })

    // Second call should not have fired yet — first is still pending
    expect(mockFetch).toHaveBeenCalledTimes(1)
    resolveFirst()
    await promise
    expect(callOrder).toEqual([1, 2])
  })
})
```

- [ ] **Step 1.2 — Run tests to verify they fail**

```bash
npx vitest run src/lib/availability-reminders.test.ts
```

Expected: fails with "Cannot find module './availability-reminders'"

- [ ] **Step 1.3 — Implement the helper**

Create `src/lib/availability-reminders.ts`:

```typescript
export type ReminderRecipient = {
  therapistId: string
  email: string
  name: string | null
}

type EmailConfig = {
  resendApiKey: string
  fromEmail: string
  resendApiUrl: string
}

type SendInput = {
  recipients: ReminderRecipient[]
  cycleDateRange: string
  availabilityUrl: string
  emailConfig: EmailConfig
}

type SendResult = {
  sent: number
  failed: number
}

function buildReminderEmailPayload(params: {
  recipient: ReminderRecipient
  cycleDateRange: string
  availabilityUrl: string
  fromEmail: string
}) {
  const greeting = params.recipient.name ? `Hi ${params.recipient.name},` : 'Hi there,'
  const subject = `Action needed: submit your availability for ${params.cycleDateRange}`
  const text = [
    greeting,
    '',
    `Please submit your availability for the upcoming cycle (${params.cycleDateRange}).`,
    '',
    `Submit here: ${params.availabilityUrl}`,
    '',
    '- Teamwise',
  ].join('\n')
  const html = `<p>${greeting}</p><p>Please submit your availability for the upcoming cycle (${params.cycleDateRange}).</p><p><a href="${params.availabilityUrl}">Submit your availability</a></p><p>- Teamwise</p>`

  return {
    from: params.fromEmail,
    to: params.recipient.email,
    subject,
    text,
    html,
  }
}

export async function sendAvailabilityReminderEmails(input: SendInput): Promise<SendResult> {
  const { recipients, cycleDateRange, availabilityUrl, emailConfig } = input

  let sent = 0
  let failed = 0

  for (const recipient of recipients) {
    const payload = buildReminderEmailPayload({
      recipient,
      cycleDateRange,
      availabilityUrl,
      fromEmail: emailConfig.fromEmail,
    })

    try {
      const response = await fetch(emailConfig.resendApiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${emailConfig.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        sent++
      } else {
        console.error(
          `[availability-reminders] Resend failed for ${recipient.email}: HTTP ${response.status}`
        )
        failed++
      }
    } catch (error) {
      console.error(`[availability-reminders] Resend threw for ${recipient.email}:`, error)
      failed++
    }
  }

  return { sent, failed }
}
```

- [ ] **Step 1.4 — Run tests to verify they pass**

```bash
npx vitest run src/lib/availability-reminders.test.ts
```

Expected: all tests pass.

- [ ] **Step 1.5 — Commit**

```bash
git add src/lib/availability-reminders.ts src/lib/availability-reminders.test.ts
git commit -m "feat: add availability reminder email helper with unit tests"
```

---

## Task 2: Server action

**Files:**

- Modify: `src/app/(app)/availability/actions.ts`

### Step 2.1 — Locate the auth helper used in this file

At the top of `actions.ts`, find the import for `getAuthenticatedUserWithRole` — that's how all actions in this file get the user and role. The auth check pattern throughout is:

```typescript
const { supabase, user, role } = await getAuthenticatedUserWithRole()
if (!can(role, 'access_manager_ui')) {
  redirect('/availability')
}
```

For `sendAvailabilityRemindersAction` we return an error object instead of redirecting, because the caller is a client component (not a form submit).

### Step 2.2 — Add the action to `actions.ts`

At the **end** of `src/app/(app)/availability/actions.ts`, add:

```typescript
export async function sendAvailabilityRemindersAction(
  cycleId: string
): Promise<{ sent: number; skipped: number; failed: number; error?: string }> {
  const { supabase, role } = await getAuthenticatedUserWithRole()

  if (!can(role, 'access_manager_ui')) {
    return { sent: 0, skipped: 0, failed: 0, error: 'unauthorized' }
  }

  const emailConfig = getPublishEmailConfig()
  if (!emailConfig.configured || !emailConfig.resendApiKey || !emailConfig.fromEmail) {
    return { sent: 0, skipped: 0, failed: 0, error: 'email_not_configured' }
  }

  // Validate cycle and derive date range server-side
  const { data: cycle } = await supabase
    .from('schedule_cycles')
    .select('start_date, end_date')
    .eq('id', cycleId)
    .maybeSingle()

  if (!cycle) {
    return { sent: 0, skipped: 0, failed: 0, error: 'cycle_not_found' }
  }

  const cycleDateRange = formatHumanCycleRange(cycle.start_date, cycle.end_date)

  // Fetch active, non-FMLA therapist/lead profiles with email
  const { data: profileRows, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, email, notification_email_enabled, on_fmla')
    .in('role', ['therapist', 'lead'])
    .eq('is_active', true)
    .eq('on_fmla', false)

  if (profileError) {
    console.error('[sendAvailabilityRemindersAction] profile fetch failed:', profileError)
    return { sent: 0, skipped: 0, failed: 0, error: 'db_error' }
  }

  // Fetch who has already submitted for this cycle
  const { data: submissionRows } = await supabase
    .from('therapist_availability_submissions')
    .select('therapist_id')
    .eq('schedule_cycle_id', cycleId)

  const submittedIds = new Set((submissionRows ?? []).map((row) => row.therapist_id))

  // Build recipient list: non-submitters with valid email and opted-in
  const recipients: import('@/lib/availability-reminders').ReminderRecipient[] = []
  let skipped = 0

  for (const profile of profileRows ?? []) {
    if (submittedIds.has(profile.id)) continue // already submitted — not a reminder target

    if (!profile.email || profile.notification_email_enabled === false) {
      skipped++
      continue
    }

    recipients.push({
      therapistId: profile.id,
      email: profile.email,
      name: profile.full_name ?? null,
    })
  }

  if (recipients.length === 0) {
    return { sent: 0, skipped, failed: 0 }
  }

  const availabilityUrl = `${emailConfig.appBaseUrl.replace(/\/$/, '')}/availability`

  const { sent, failed } = await sendAvailabilityReminderEmails({
    recipients,
    cycleDateRange,
    availabilityUrl,
    emailConfig: {
      resendApiKey: emailConfig.resendApiKey,
      fromEmail: emailConfig.fromEmail,
      resendApiUrl: emailConfig.resendApiUrl,
    },
  })

  return { sent, skipped, failed }
}
```

Also add these imports near the top of `actions.ts` (with the other lib imports):

```typescript
import { formatHumanCycleRange } from '@/lib/calendar-utils'
import { getPublishEmailConfig } from '@/lib/publish-events'
import {
  sendAvailabilityReminderEmails,
  type ReminderRecipient,
} from '@/lib/availability-reminders'
```

- [ ] **Step 2.3 — Typecheck**

```bash
npx tsc --noEmit
```

Fix any type errors before continuing.

- [ ] **Step 2.4 — Commit**

```bash
git add src/app/\(app\)/availability/actions.ts
git commit -m "feat: add sendAvailabilityRemindersAction server action"
```

---

## Task 3: UI — button, AlertDialog, and toast in AvailabilityStatusSummary

**Files:**

- Modify: `src/components/availability/AvailabilityStatusSummary.tsx`

### Step 3.1 — Add shadcn AlertDialog imports

At the top of `AvailabilityStatusSummary.tsx`, add:

```typescript
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { FeedbackToast } from '@/components/feedback-toast'
```

### Step 3.2 — Extend the props type

In `AvailabilityStatusSummaryProps`, add two new optional props:

```typescript
type AvailabilityStatusSummaryProps = {
  // ... existing props ...
  cycleId?: string
  onSendReminders?: () => Promise<{ sent: number; skipped: number; failed: number; error?: string }>
}
```

### Step 3.3 — Add state inside the component

Inside `AvailabilityStatusSummary`, below the existing `useState` calls, add:

```typescript
const [isSending, setIsSending] = useState(false)
const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null)
```

### Step 3.4 — Add the handler

Below the state declarations, add:

```typescript
async function handleSendReminders() {
  if (!onSendReminders) return
  setIsSending(true)
  setToast(null)
  try {
    const result = await onSendReminders()
    if (result.error === 'email_not_configured') {
      setToast({
        message: 'Failed to send reminders — check email configuration',
        variant: 'error',
      })
    } else if (result.error) {
      setToast({ message: 'Failed to send reminders', variant: 'error' })
    } else if (result.sent === 0 && result.skipped === 0 && result.failed === 0) {
      setToast({ message: 'Everyone has already submitted', variant: 'success' })
    } else if (result.sent === 0 && result.skipped > 0) {
      setToast({
        message: 'No reminders sent — all missing therapists have email notifications disabled',
        variant: 'error',
      })
    } else {
      const parts: string[] = [
        `Reminders sent to ${result.sent} therapist${result.sent === 1 ? '' : 's'}`,
      ]
      if (result.skipped > 0) parts.push(`${result.skipped} skipped — email disabled`)
      if (result.failed > 0) parts.push(`${result.failed} failed`)
      setToast({ message: parts.join(' · '), variant: result.failed > 0 ? 'error' : 'success' })
    }
  } finally {
    setIsSending(false)
  }
}
```

### Step 3.5 — Add the button and AlertDialog to the filter bar

**Important:** Use `missingRows.length` (the prop, unfiltered by search/shift) for the button guard — NOT `missingCount` (which reflects current view filters). `missingRows.length` represents all non-submitters in the cycle. If you used `missingCount`, the button would disappear when the manager applies a search filter even though non-submitters still exist.

In the JSX, inside the `<div className="flex flex-wrap gap-6 border-b ...">` (the filter tab bar), add the button **after** the existing `.map(...)` filter buttons, still inside that div:

```tsx
{
  onSendReminders && missingRows.length > 0 ? (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          disabled={isSending}
          className="ml-auto inline-flex min-h-9 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          data-testid="send-reminders-trigger"
        >
          {isSending ? (
            <span aria-live="polite">Sending…</span>
          ) : (
            <>Send reminders ({missingCount})</>
          )}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Send availability reminders?</AlertDialogTitle>
          <AlertDialogDescription>
            {missingCount} therapist{missingCount === 1 ? '' : 's'}{' '}
            {missingCount === 1 ? "hasn't" : "haven't"} submitted yet. They'll receive an email with
            a link to submit their availability.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleSendReminders}>Send reminders</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ) : null
}
```

### Step 3.6 — Render the toast

At the bottom of the returned JSX, inside the `<section>` but after the main content, add:

```tsx
{
  toast ? <FeedbackToast message={toast.message} variant={toast.variant} /> : null
}
```

### Step 3.7 — Add tests for the new props to AvailabilityStatusSummary.test.ts

Append these two test cases inside the `describe('AvailabilityStatusSummary', ...)` block in `src/components/availability/AvailabilityStatusSummary.test.ts`:

```typescript
it('renders the send-reminders button when onSendReminders prop is provided and there are missing rows', () => {
  const html = renderToStaticMarkup(
    createElement(AvailabilityStatusSummary, {
      submittedRows: [],
      missingRows: [
        {
          therapistId: 'missing-1',
          therapistName: 'Layne P.',
          overridesCount: 0,
          lastUpdatedAt: null,
          shiftType: 'day',
          employmentType: 'full_time',
        },
      ],
      cycleId: 'cycle-abc',
      onSendReminders: async () => ({ sent: 1, skipped: 0, failed: 0 }),
    })
  )

  expect(html).toContain('data-testid="send-reminders-trigger"')
  expect(html).toContain('Send reminders')
})

it('does not render the send-reminders button when missingRows is empty', () => {
  const html = renderToStaticMarkup(
    createElement(AvailabilityStatusSummary, {
      submittedRows: [
        {
          therapistId: 'submitted-1',
          therapistName: 'Adrienne S.',
          overridesCount: 1,
          lastUpdatedAt: '2026-03-15T12:00:00.000Z',
        },
      ],
      missingRows: [],
      cycleId: 'cycle-abc',
      onSendReminders: async () => ({ sent: 0, skipped: 0, failed: 0 }),
    })
  )

  expect(html).not.toContain('Send reminders')
})
```

Run the test file to verify:

```bash
npx vitest run src/components/availability/AvailabilityStatusSummary.test.ts
```

Expected: all tests pass including the two new ones.

### Step 3.8 — Typecheck

```bash
npx tsc --noEmit
```

Fix any errors.

- [ ] **Step 3.9 — Commit**

```bash
git add src/components/availability/AvailabilityStatusSummary.tsx src/components/availability/AvailabilityStatusSummary.test.ts
git commit -m "feat: add send-reminders button and dialog to AvailabilityStatusSummary"
```

---

## Task 4: Wire ManagerSchedulingInputs

**Files:**

- Modify: `src/components/availability/ManagerSchedulingInputs.tsx`

### Step 4.1 — Import the action

At the top of `ManagerSchedulingInputs.tsx`, add:

```typescript
import { sendAvailabilityRemindersAction } from '@/app/(app)/availability/actions'
```

### Step 4.2 — Pass props into AvailabilityStatusSummary

Find the `<AvailabilityStatusSummary` render (around line 464). It currently looks like:

```tsx
<AvailabilityStatusSummary
  submittedRows={filteredQueueRows.filter((row) => row.submitted)}
  missingRows={filteredQueueRows.filter((row) => !row.submitted)}
  initialFilter={initialRosterFilter}
  activeFilter={activeRosterFilter}
  selectedTherapistId={selectedTherapistId}
  onPickTherapist={applyTherapistSelection}
  onReviewTherapist={reviewTherapist}
  onFilterChange={setActiveRosterFilter}
  embedded
  activeShift={activeShift}
  searchTerm={therapistSearch}
/>
```

Add `cycleId` and `onSendReminders`:

```tsx
<AvailabilityStatusSummary
  submittedRows={filteredQueueRows.filter((row) => row.submitted)}
  missingRows={filteredQueueRows.filter((row) => !row.submitted)}
  initialFilter={initialRosterFilter}
  activeFilter={activeRosterFilter}
  selectedTherapistId={selectedTherapistId}
  onPickTherapist={applyTherapistSelection}
  onReviewTherapist={reviewTherapist}
  onFilterChange={setActiveRosterFilter}
  embedded
  activeShift={activeShift}
  searchTerm={therapistSearch}
  cycleId={selectedCycleId}
  onSendReminders={
    selectedCycleId ? () => sendAvailabilityRemindersAction(selectedCycleId) : undefined
  }
/>
```

### Step 4.3 — Typecheck

```bash
npx tsc --noEmit
```

- [ ] **Step 4.4 — Commit**

```bash
git add src/components/availability/ManagerSchedulingInputs.tsx
git commit -m "feat: wire send-reminders action into AvailabilityStatusSummary"
```

---

## Task 5: Quality gates

- [ ] **Step 5.1 — Lint**

```bash
npm run lint
```

Fix any lint errors.

- [ ] **Step 5.2 — Full unit test run**

```bash
npm run test:unit
```

Expected: all existing tests pass + new availability-reminders tests pass.

- [ ] **Step 5.3 — Targeted test run**

```bash
npx vitest run src/lib/availability-reminders.test.ts
```

- [ ] **Step 5.4 — Build**

```bash
npm run build
```

Expected: clean build, no TypeScript errors, all routes render as `ƒ` (dynamic).

- [ ] **Step 5.5 — Commit quality gate results (if any lint fixes)**

```bash
git add -A
git commit -m "fix: lint and type errors from bulk availability reminder feature"
```

---

## Verification Checklist

After all tasks complete:

- [ ] `npm run lint` — clean
- [ ] `npx tsc --noEmit` — clean
- [ ] `npm run test:unit` — all pass (1027+ tests)
- [ ] `npm run build` — clean
- [ ] `npx vitest run src/lib/availability-reminders.test.ts` — all 8 tests pass
- [ ] "Send reminders (N)" button appears in the roster filter bar only when there are missing therapists
- [ ] Clicking opens an AlertDialog with the correct count
- [ ] Cancelling closes the dialog without sending
- [ ] Confirming calls the action and shows a success toast
- [ ] Button is disabled while sending (no double-submit)
- [ ] If `RESEND_API_KEY` is missing, toast shows "check email configuration"
