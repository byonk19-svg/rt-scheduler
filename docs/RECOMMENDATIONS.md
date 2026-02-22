# App Improvement Recommendations (Simple + Practical)

This is a prioritized list.
Start at the top and do one item at a time.

## Priority 1 — Must do now (stability)

### 1) Add a DB trigger to create profile rows automatically
**Why:** Dashboard depends on `profiles`. New users should always get a row.

- Use the SQL in `docs/NEXT_STEPS.md` section 2.
- After adding trigger, create a test account and confirm profile row appears.

### 2) Confirm RLS policies for every table
**Why:** Most auth/data bugs come from missing/incorrect policies.

- Start with `profiles` read-own + update-own.
- Add manager policies (`manager` can read all where needed).
- Keep policies in a migration SQL file so you can version-control them.

### 3) Add environment validation on startup
**Why:** Beginners get confusing errors when env vars are missing.

- Keep middleware fallback (already done).
- Also show a clear warning on home page when env vars are missing.

## Priority 2 — UX wins (easy to use)

### 4) Improve empty states on dashboard cards
**Why:** Users should know exactly what to do next.

- Add action buttons:
  - “View Schedule”
  - “Submit Availability”
  - “Open Shift Board”
- If feature not built yet, link to “Coming soon” placeholders.

### 5) Add form-level validation messages
**Why:** Better than raw Supabase error text for new users.

- Signup:
  - password min length
  - full name required
- Login:
  - invalid email format message

### 6) Add success messages after auth actions
**Why:** Reassures users that actions worked.

- Example: “Account created. Redirecting…”

## Priority 3 — Functionality roadmap (next features)

### 7) Build availability request flow (Step 4)
- Therapist: submit blackout date + reason
- Therapist: see own request list
- Manager: view all requests

### 8) Build schedule cycle and shifts (Step 5)
- Manager: create 6-week cycle
- Manager: assign shifts
- Therapist: view published schedule only

### 9) Build shift board (Step 6)
- Therapist: post swap/pickup request
- Manager: approve/deny

## Priority 4 — Developer productivity

### 10) Add migrations folder for SQL
**Why:** reproducible setup for every environment.

- Create `supabase/migrations/`.
- Save trigger/policies schema there.

### 11) Add simple end-to-end auth test
**Why:** catches regressions quickly.

- Test flow:
  - signup
  - login
  - dashboard loads name

### 12) Add seed script for demo data
**Why:** makes UI testing easy without manual entry.

- Seed one manager + two therapists + one cycle + a few shifts.

---

## Suggested next sprint (small and realistic)

1. Finish profile trigger + RLS verification
2. Build availability request submit form
3. Build “my availability requests” list
4. Add manager view for all availability requests

If you only have 2-3 hours, do #1 first. It removes most current auth friction.
