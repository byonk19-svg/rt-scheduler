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

## RLS Rules (plain English)

- **profiles** — You can only see and edit your own profile. Managers can see everyone.
- **schedule_cycles** — Everyone can see published cycles. Only managers can create/edit.
- **shifts** — Everyone can see shifts in published cycles. Only managers can create/edit/delete.
- **availability_requests** — You can only see and manage your own. Managers can see all.
- **shift_posts** — Everyone can see all posts. You can only create/delete your own. Managers can approve/deny.