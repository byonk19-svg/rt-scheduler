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
  → sendAvailabilityRemindersAction(cycleId)
      1. requireManagerUser()
      2. validate cycleId exists in schedule_cycles (redirect/return on failure)
      3. derive cycleDateRange from the cycle row (server-side — not from client)
      4. fetch active, non-FMLA therapist/lead profiles (is_active=true, on_fmla=false)
      5. fetch therapist_availability_submissions for this cycle
      6. diff → non-submitters
      7. filter: skip null email OR notification_email_enabled !== false → count as skipped
      8. for...of loop: call Resend sequentially per eligible recipient
      9. return { sent, skipped, failed }
  → FeedbackToast with result counts
```

---

## Server Action

**File:** `src/app/(app)/availability/actions.ts` (existing file)

**Signature:**

```typescript
export async function sendAvailabilityRemindersAction(
  cycleId: string
): Promise<{ sent: number; skipped: number; failed: number; error?: string }>
```

`cycleDateRange` is **not** accepted from the client — it is derived server-side from the `schedule_cycles` row fetched during validation, matching the pattern in `publish-actions.ts`.

**Steps:**

1. `requireManagerUser()` — throws if not manager
2. Query `schedule_cycles` for `cycleId`; if not found, return `{ error: 'cycle_not_found' }`
3. Derive `cycleDateRange` from `cycle.start_date` / `cycle.end_date` (same `formatCycleDate` helper used elsewhere)
4. Query `profiles` where `role IN ('therapist', 'lead') AND is_active = true AND on_fmla = false`
5. Query `therapist_availability_submissions` where `schedule_cycle_id = cycleId`
6. Diff → non-submitters list
7. For each non-submitter: skip if `!profile.email || profile.notification_email_enabled === false` → count as `skipped`
8. `for...of` loop (sequential, not `Promise.all`) — call Resend per eligible recipient; on failure increment `failed`, continue
9. Return `{ sent, skipped, failed }`

**Email:**

- From: `PUBLISH_EMAIL_FROM` env var
- Subject: `"Action needed: submit your availability for [cycleDateRange]"`
- Body: brief nudge paragraph + CTA link to `${NEXT_PUBLIC_APP_URL}/availability`

**Error cases:**

| Scenario                            | Behavior                                                          |
| ----------------------------------- | ----------------------------------------------------------------- |
| `RESEND_API_KEY` missing            | Return `{ error: 'email_not_configured' }` without calling Resend |
| `cycleId` not found in DB           | Return `{ error: 'cycle_not_found' }`                             |
| Resend call fails for one recipient | Log, continue, count as `failed`                                  |
| No non-submitters (race condition)  | Return `{ sent: 0, skipped: 0, failed: 0 }`                       |
| FMLA or null-email recipients       | Count as `skipped`, no email sent                                 |
| Not authenticated / not manager     | `requireManagerUser()` throws                                     |

**`notification_email_enabled` semantics:** `null` means opted-in (same as every other email gate in the codebase — use `!== false`, not `=== true`).

---

## UI

**Component:** `src/components/availability/AvailabilityStatusSummary.tsx`

**New props required:**

```typescript
cycleId: string
onSendReminders: () => Promise<{ sent: number; skipped: number; failed: number; error?: string }>
```

`ManagerSchedulingInputs` owns `selectedCycleId` and is responsible for wiring the `onSendReminders` callback that calls `sendAvailabilityRemindersAction(selectedCycleId)`. `AvailabilityStatusSummary` calls `onSendReminders()` when the manager confirms.

**Trigger button** — inline with filter tabs, only when `missingAvailabilityRows.length > 0`:

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

Button shows a loading spinner while in-flight and is disabled to prevent double-submit.

**Result toast** — `FeedbackToast`:

- `"Reminders sent to 6 therapists (1 skipped — email disabled)"`
- `"No reminders sent — all missing therapists have email notifications disabled"`
- `"Failed to send reminders — check email configuration"` (config error)
- `"N reminders sent, M failed"` (partial Resend failure)
- `"Everyone has already submitted"` (race condition — sent: 0, skipped: 0, failed: 0)

---

## Files Touched

| File                                                        | Change                                                                |
| ----------------------------------------------------------- | --------------------------------------------------------------------- |
| `src/app/(app)/availability/actions.ts`                     | Add `sendAvailabilityRemindersAction`                                 |
| `src/components/availability/AvailabilityStatusSummary.tsx` | Add `cycleId` + `onSendReminders` props; button + AlertDialog + toast |
| `src/components/availability/ManagerSchedulingInputs.tsx`   | Wire `cycleId` + `onSendReminders` into `AvailabilityStatusSummary`   |
| `src/lib/availability-reminders.ts`                         | New file — pure email-send helper (testable in isolation)             |

The email logic lives in `src/lib/availability-reminders.ts` so it can be unit-tested without a server action context.

---

## Testing

**Unit tests** — `src/lib/availability-reminders.test.ts`:

- Happy path: N non-submitters, N emails sent, returns `{ sent: N, skipped: 0, failed: 0 }`
- All submitted (race): returns `{ sent: 0, skipped: 0, failed: 0 }`
- `notification_email_enabled = false`: skipped count increments, no Resend call
- `notification_email_enabled = null`: treated as opted-in, email is sent
- `profiles.email = null`: counted as `skipped`, no Resend call
- `on_fmla = true` therapist: excluded from recipient pool entirely
- Missing `RESEND_API_KEY`: returns `{ error: 'email_not_configured' }` without calling Resend
- Partial Resend failure (one recipient fails): continues, returns correct `failed` count
- Invalid `cycleId`: returns `{ error: 'cycle_not_found' }`

No new E2E spec required — existing availability auth coverage is sufficient.

---

## Implementation Notes

- **Date formatting:** `formatCycleDate` is private to `dashboard/manager/page.tsx` and not exported. Inline equivalent `toLocaleDateString` logic directly in `src/lib/availability-reminders.ts` — do not assume it can be imported.
- **Auth pattern:** `src/app/(app)/availability/actions.ts` uses `can(role, 'access_manager_ui')` rather than `requireManagerUser()`. Use the `can()` pattern to stay consistent with sibling actions in the same file.

---

## Out of Scope

- Scheduling reminders (e.g. auto-send 3 days before deadline)
- Reminder history / audit log
- Per-therapist deselection in the confirmation dialog
- In-app notification bell entries
