# Session History

## Session 71 - 2026-04-15

- Removed the public signup roster-match check so `/signup` no longer leaks whether a full name exists in `employee_roster`.
- Successful signup now always redirects to `/login?status=requested`; matched users can still be auto-provisioned server-side by the signup trigger, but the public UI no longer exposes that distinction.
- Hardened `GET /auth/signout` with the same trusted-origin gate as `POST /auth/signout` to block cross-origin logout requests without breaking same-origin cleanup redirects.

## Session 69 - 2026-04-15

- Availability intake parser hardening:
  - reduced PTO employee-block emails now split on repeated `Employee Name:` headers
  - repeated blocks for the same employee merge back into one intake item
  - weekday recurrence phrases like `Off Tuesday + Wednesdays` expand across the active block when the cycle window is known
  - malformed OCR fragments stay in `needs_review` instead of creating guessed work dates

## Session 66 - 2026-04-14

- `/availability` moved to the current planner-first manager structure.
- The manager page now uses header summary chips, planner/intake tabs, and the 3-column planner workbench.
- The calendar-centered planner became the baseline direction for later polish.

## Session 67 - 2026-04-14

- Final polish pass on `/availability`:
  - retained the current header and 3-column planner workspace
  - compacted the lower half into one shared **Secondary workflow** surface
  - tabbed **Response roster** and **Request inbox**
  - denser roster rows with initials, compact status, request signal, and last activity
  - compact inbox empty state instead of a large blank table region
  - disabled planner save text changed to **`Select dates to save`**
- `/team` now uses dedicated workspace/filter/row/table components for denser team management and employee-roster administration.
- Availability intake utilities gained additional parser/edit coverage in `src/lib/availability-email-intake.ts`.
