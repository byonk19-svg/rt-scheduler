# Data Model

Focused view of the active schema used by scheduling, coverage, publish, and requests.

## Core Scheduling Tables

- `profiles`
  - User identity + staffing fields (`role`, `shift_type`, `employment_type`, `max_work_days_per_week`, `is_lead_eligible`, `on_fmla`, `is_active`, `site_id`).
  - `id` references `auth.users.id`.
- `schedule_cycles`
  - Scheduling windows (`label`, `start_date`, `end_date`, `published`).
- `shifts`
  - Assignment rows by cycle/date/shift/user.
  - Key fields: `status`, `role`, `assignment_status`, override metadata, `unfilled_reason`, `site_id`.
  - Unique constraints/indexes:
    - one shift per `(cycle_id, user_id, date)`
    - one lead per slot `(cycle_id, date, shift_type)` where `role = 'lead'`

## Availability and Pattern Tables

- `work_patterns`
  - One row per therapist (`therapist_id` PK).
  - Recurring rules: `works_dow`, `offs_dow`, `weekend_rotation`, `weekend_anchor_date`, `works_dow_mode`.
- `availability_overrides`
  - Cycle-scoped date overrides (`force_off` or `force_on`) by date + shift.
  - Tracks source (`therapist` or `manager`) and creator metadata.
  - Unique constraint on `(cycle_id, therapist_id, date, shift_type)`.

## Shift Board and Request Tables

- `shift_posts`
  - Swap/pickup posts linked to `shifts`.
  - Status lifecycle includes `pending`, `approved`, `denied`, `expired`.
  - Optional `claimed_by` and `swap_shift_id` for assignment transfer workflows.

## Publish and Notification Tables

- `publish_events`
  - Publish audit per cycle: counts (`recipient_count`, `queued_count`, `sent_count`, `failed_count`) and status.
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
- `publish_events (1) -> (many) notification_outbox`
- `shifts (1) -> (many) shift_posts`

## Legacy/Transitional Tables

- `availability_requests` and `availability_entries` exist historically.
- Current app paths use `availability_overrides` + `work_patterns` for scheduling eligibility.
