# Bulk Availability Reminder Action

**Date:** 2026-05-06
**Status:** Approved
**Feature area:** `/availability` — manager response roster

---

## Problem

Managers have no way to nudge therapists who haven't submitted their availability for the active cycle. The only option today is contacting them individually outside the app. This is called out as the top operational gap in CLAUDE.md.

---

## Goals

- Let a manager send a one-click bulk reminder email to all non-submitting therapists for the selected cycle.
- No new database tables or migrations required.
- Respect each therapist's `notification_email_enabled` preference.

## Non-goals

- Per-recipient selection (always targets all non-submitters).
- In-app notification bell entries (email only).
- Delivery tracking / retry infrastructure (fire-and-forget is sufficient for a nudge).
- Custom deadline text in the email.

---

## Data Flow

```
Manager clicks "Send reminders (N)"
  → AlertDialog: "Email N therapists who haven't submitted?"
  → Confirm
  → sendAvailabilityRemindersAction(cycleId, cycleDateRange)
      1. requireManagerUser()                          — auth gate
      2. fetch active therapist/lead profiles          — Supabase
      3. fetch therapist_availability_submissions      — for this cycle
      4. diff → non-submitters list
      5. filter notification_email_enabled = false     — skip silently, count as skipped
      6. call Resend once per eligible recipient
      7. return { sent, skipped, failed }
  → FeedbackToast with result counts
```

---

## Server Action

**File:** `src/app/(app)/availability/actions.ts` (existing file)

**Signature:**

```typescript
export async function sendAvailabilityRemindersAction(
  cycleId: string,
  cycleDateRange: string // e.g. "Apr 28 – May 25" — display only, passed from client
): Promise<{ sent: number; skipped: number; failed: number }>
```

**Steps:**

1. `requireManagerUser()` — throws if not manager
2. Query `profiles` where `role IN ('therapist', 'lead') AND is_active = true`
3. Query `therapist_availability_submissions` where `schedule_cycle_id = cycleId`
4. Diff to produce non-submitters
5. Filter out `notification_email_enabled = false` → count as `skipped`
6. For each remaining recipient, call Resend; on per-recipient failure increment `failed`, continue
7. Return `{ sent, skipped, failed }`

**Email:**

- From: `PUBLISH_EMAIL_FROM` env var
- Subject: `"Action needed: submit your availability for [cycleDateRange]"`
- Body: brief nudge paragraph + CTA link to `${NEXT_PUBLIC_APP_URL}/availability`

**Error cases:**
| Scenario | Behavior |
|---|---|
| `RESEND_API_KEY` missing | Return early, surface "Email not configured" to UI |
| Resend call fails for one recipient | Log, continue, count as `failed` |
| No non-submitters (race condition) | Return `{ sent: 0, skipped: 0, failed: 0 }` |
| Not authenticated / not manager | `requireManagerUser()` throws |

---

## UI

**Trigger button** — `src/components/availability/AvailabilityStatusSummary.tsx`

Rendered inline with the filter tabs, only when `missingAvailabilityRows.length > 0`:

```
[ All (12) ]  [ Missing (7) ]  [ Submitted (5) ]    [Send reminders (7) →]
```

**Confirmation dialog** — shadcn `AlertDialog`:

```
Send availability reminders?
7 therapists haven't submitted yet. They'll receive an email
with a link to submit their availability.

                        [ Cancel ]  [ Send reminders ]
```

Button shows a loading spinner while the action is in-flight and is disabled to prevent double-submit.

**Result toast** — `FeedbackToast`:

- `"Reminders sent to 6 therapists (1 skipped — email disabled)"`
- `"No reminders sent — all missing therapists have email notifications disabled"`
- `"Failed to send reminders — check email configuration"` (config error)
- `"N reminders sent, M failed"` (partial failure)

---

## Files Touched

| File                                                        | Change                                                    |
| ----------------------------------------------------------- | --------------------------------------------------------- |
| `src/app/(app)/availability/actions.ts`                     | Add `sendAvailabilityRemindersAction`                     |
| `src/components/availability/AvailabilityStatusSummary.tsx` | Add button + AlertDialog + toast wiring                   |
| `src/lib/availability-reminders.ts`                         | New file — pure email-send helper (testable in isolation) |

The email logic lives in `src/lib/availability-reminders.ts` so it can be unit-tested without a server action context.

---

## Testing

**Unit tests** — `src/lib/availability-reminders.test.ts`:

- Happy path: 7 non-submitters, 7 emails sent, returns `{ sent: 7, skipped: 0, failed: 0 }`
- All submitted (race): returns `{ sent: 0, skipped: 0, failed: 0 }`
- `notification_email_enabled = false` filtering: skipped count increments, no Resend call
- Missing `RESEND_API_KEY`: returns error indicator without calling Resend
- Partial Resend failure: continues, returns correct `failed` count

No new E2E spec required — existing availability auth coverage is sufficient.

---

## Out of Scope

- Scheduling reminders (e.g. auto-send 3 days before deadline)
- Reminder history / audit log
- Per-therapist deselection in the confirmation dialog
- In-app notification bell entries
