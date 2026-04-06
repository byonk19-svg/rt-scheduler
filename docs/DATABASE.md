# Database Schema

## Tables

### profiles

Extends Supabase auth. One row per user.

- id (uuid) — matches auth.users id
- full_name (text)
- email (text)
- role (text) — 'manager' or 'therapist'
- shift_type (text) — 'day' or 'night'
- created_at (timestamp)

### schedule_cycles

A 6-week scheduling period.

- id (uuid)
- label (text) — e.g. "Feb 8 – Mar 21"
- start_date (date)
- end_date (date)
- published (boolean) — false = draft, true = visible to all
- archived_at (timestamp, nullable) — non-live cycles can be archived so they stop appearing in active scheduling views
- created_at (timestamp)

### shifts

One row per person per working day.

- id (uuid)
- cycle_id (uuid) → schedule_cycles
- user_id (uuid) → profiles
- date (date)
- shift_type (text) — 'day' or 'night'
- status (text) — 'scheduled', 'on_call', 'sick', 'called_off'
- created_at (timestamp)

### availability_requests

Blackout dates submitted by therapists.

- id (uuid)
- user_id (uuid) → profiles
- cycle_id (uuid) → schedule_cycles
- date (date)
- reason (text, optional)
- created_at (timestamp)

### shift_posts

Swap or pickup requests on the board.

- id (uuid)
- shift_id (uuid) → shifts
- posted_by (uuid) → profiles
- message (text)
- type (text) — 'swap' or 'pickup'
- status (text) — 'pending', 'approved', 'denied'
- claimed_by (uuid, nullable) → profiles — therapist volunteering to take the shift
- swap_shift_id (uuid, nullable) → shifts — for swaps, the shift the claimer is offering
- created_at (timestamp)

### publish_events

Publish delivery history for a cycle.

- id (uuid)
- cycle_id (uuid) → schedule_cycles
- published_at (timestamp)
- published_by (uuid) → profiles
- status (text)
- recipient_count / queued_count / sent_count / failed_count (integers)
- error_message (text, nullable)

Deleting a publish-history row removes the delivery log only. It does not delete or hide the cycle itself.

## RLS Rules (plain English)

- **profiles** — You can only see and edit your own profile. Managers can see everyone.
- **schedule_cycles** — Everyone can see published cycles. Only managers can create/edit.
- **shifts** — Everyone can see shifts in published cycles. Only managers can create/edit/delete.
- **availability_requests** — You can only see and manage your own. Managers can see all.
- **shift_posts** — Everyone can see all posts. You can only create/delete your own. Managers can approve/deny.

## Cycle Visibility Notes

- Coverage and availability surfaces now exclude `schedule_cycles` where `archived_at` is set.
- Archive old non-live cycles when you want them gone from active views.
- Deleting publish history is not sufficient because cycle labels in Coverage come from `schedule_cycles`, not `publish_events`.
