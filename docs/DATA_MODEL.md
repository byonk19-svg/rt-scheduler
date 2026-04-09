# Data Model

Focused view of the active schema used by scheduling, coverage, publish, and requests.

## Core Scheduling Tables

- `profiles`
  - User identity + staffing fields (`role`, `phone_number`, `shift_type`, `employment_type`, `max_work_days_per_week`, `is_lead_eligible`, `on_fmla`, `is_active`, `site_id`).
  - `role` is nullable for pending self-signup users awaiting manager approval.
  - `id` references `auth.users.id`.
- `schedule_cycles`
  - Scheduling windows (`label`, `start_date`, `end_date`, `published`, `archived_at`).
  - Optional `availability_due_at` (timestamptz): explicit therapist availability deadline; UI falls back to the **calendar day before** `start_date` when null. Therapist-facing deadline copy treats **past** as after this timestamp when set, or after **end of that local calendar day** for the inferred fallback (`src/lib/therapist-availability-submission.ts`).
  - `archived_at` hides non-live historical cycles from active scheduling surfaces without deleting related records.
- `shifts`
  - Assignment rows by cycle/date/shift/user.
  - Key fields: `status`, `role`, `assignment_status`, override metadata, `unfilled_reason`, `site_id`.
  - `status`/`assignment_status` are retained for compatibility and historical reads; active operational state is externalized (see below).
  - Unique constraints/indexes:
    - one shift per `(cycle_id, user_id, date)`
    - one lead per slot `(cycle_id, date, shift_type)` where `role = 'lead'`

## Operational Status Tables

- `shift_operational_entries`
  - One active operational code per shift row (`active = true` unique per `shift_id`).
  - Stores operational code (`on_call`, `call_in`, `cancelled`, `left_early`), note metadata, and actor metadata.
  - Used as the source of truth for active operational state in coverage/headcount logic.
- `shift_operational_entry_audit`
  - Append-only audit log for `add`/`replace`/`remove` operational transitions.

## Availability and Pattern Tables

- `work_patterns`
  - One row per therapist (`therapist_id` PK).
  - Recurring rules: `works_dow`, `offs_dow`, `weekend_rotation`, `weekend_anchor_date`, `works_dow_mode`.
- `availability_overrides`
  - Cycle-scoped date overrides (`force_off` or `force_on`) by date + shift.
  - Tracks source (`therapist` or `manager`) and creator metadata.
  - Unique constraint on `(cycle_id, therapist_id, date, shift_type)`.
  - Therapist UI semantics:
    - `force_off` = **Need Off**
    - `force_on` = **Request to Work**
    - no row = **Available** (neutral, scheduler can use or skip)
  - Therapist day-level notes are stored on the same `availability_overrides.note` field.
- `therapist_availability_submissions`
  - One row per therapist per cycle **after they officially submit** (workflow state).
  - Fields: `submitted_at` (first official submit), `last_edited_at` (any later change while still submitted, including grid saves or day deletes).
  - Day-level selections remain in `availability_overrides`; therapists can **save progress** (draft) without a row here until they **Submit availability**.
  - Manager/therapist “submitted” counts for a cycle should use this table — not “has any therapist override rows.”

## Shift Board and Request Tables

- `shift_posts`
  - Swap/pickup posts linked to `shifts`.
  - Status lifecycle includes `pending`, `approved`, `denied`, `expired`.
  - Optional `claimed_by` and `swap_shift_id` for assignment transfer workflows.

## Publish and Notification Tables

- `publish_events`
  - Publish audit per cycle: counts (`recipient_count`, `queued_count`, `sent_count`, `failed_count`) and status.
  - Deleting a publish event does not delete the underlying schedule cycle.
- `notification_outbox`
  - Async delivery queue for publish emails (`queued`/`sent`/`failed`, `attempt_count`, `last_error`).
- `notifications`
  - In-app notifications per user (`read_at` tracks read state).
- `audit_log`
  - Manager activity audit entries (`action`, `target_type`, `target_id`).
- `shift_status_changes`
  - Status change history from assignment-status updates.

## Relationships (High Value)

- `profiles (1) -> (many) shifts`
- `schedule_cycles (1) -> (many) shifts`
- `profiles (1) -> (1) work_patterns`
- `profiles (1) -> (many) availability_overrides`
- `schedule_cycles (1) -> (many) availability_overrides`
- `profiles (1) -> (many) therapist_availability_submissions`
- `schedule_cycles (1) -> (many) therapist_availability_submissions`
- `publish_events (1) -> (many) notification_outbox`
- `shifts (1) -> (many) shift_posts`

## Lifecycle Notes

- The cycle itself lives in `schedule_cycles`.
- Publish history lives in `publish_events`.
- If an old cycle should disappear from Coverage and Availability, archive the `schedule_cycles` row; deleting `publish_events` alone is not enough.
- Public signup lifecycle:
  - self-signup users are created as pending (`profiles.role = null`)
  - manager approval sets role (`therapist` or `lead`)
  - manager decline deletes the pending account

## Legacy/Transitional Tables

- `availability_requests` and `availability_entries` exist historically.
- Current app paths use `availability_overrides` + `work_patterns` for scheduling eligibility, and `therapist_availability_submissions` for official per-cycle therapist submit state.
