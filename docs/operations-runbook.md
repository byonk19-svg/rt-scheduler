# Teamwise — operations runbook (people & policy)

Use this for **go-live**: who gets access, how staff use the app, and what your organization must decide for privacy and employment records. Replace bracketed placeholders with your site URL and local names.

---

## 1. Manager accounts (how they are created in Teamwise)

**Public signup does not create managers.** Self-service sign-up creates accounts with **pending** access (`profiles.role` is null) until a manager approves them under **User Access Requests** — but that flow is for **therapists/leads**, not for creating the first manager.

### First manager (bootstrap)

Pick **one** of these patterns (your org’s IT / Supabase admin owns this):

1. **Supabase Dashboard (typical for production)**
   - Auth → create or invite the person’s email.
   - Ensure a matching row exists in `public.profiles` with **`role = 'manager'`**, **`is_active = true`**, correct `site_id` if you use multi-site.
   - The `handle_new_user` trigger may create a profile on first sign-up; if role is wrong, update `profiles` with the **service role** or a one-off SQL migration.

2. **Scripted bootstrap (dev / staging parity)**
   - Repo script: `npm run seed:users` with **`SEED_INCLUDE_MANAGER=true`** creates `manager@<SEED_USERS_DOMAIN>` (see `README.md` / `scripts/seed-users.mjs`).
   - **Do not** use default test passwords in production; rotate after first login.

3. **Additional managers**
   - Same as (1): only trusted admins should set `role = 'manager'` in the database or via your internal provisioning process. There is **no** self-serve “become a manager” in the product UI.

**Record for auditors:** \_Date **_ · First manager UID/email _** · Method used (dashboard / SQL / script) _\_\_._

---

## 2. Staff runbook (one page you can hand out)

**App URL:** `[https://www.teamwise.work]` (or your deployment)

| I need to…                       | Where to go                                        | Notes                                                                                            |
| -------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Sign in / create account         | **Sign in** or **Create account** on the home page | New accounts wait for manager approval before full access.                                       |
| Wait for approval                | **`/pending-setup`**                               | After signup you may land here until a manager activates you.                                    |
| See my shifts / coverage         | **`/coverage`** (nav may show as **Schedule**)     | Day vs night may follow your profile; URL can include `?shift=day` or `?shift=night`.            |
| Enter availability for the block | **`/availability`** (therapist)                    | Submit or update before the deadline your manager sets.                                          |
| See open shifts / post swap      | **`/shift-board`**                                 | Pickup and swap posts usually need **manager approval** — see **Approvals** on the manager side. |
| Update profile / phone           | **`/profile`**                                     |                                                                                                  |

**What “publish” means for staff**

- After the manager **publishes** a cycle, the schedule is considered **official** for that block. You may still see updates (e.g. operational status) if your department uses them; when in doubt, ask your manager whether to refresh or watch notifications.

**Who approves what**

| Request                                                | Who approves                                               |
| ------------------------------------------------------ | ---------------------------------------------------------- |
| New account (first sign-in)                            | Manager under **Requests → User Access Requests**          |
| Shift board pickup / swap (if your org uses this flow) | Manager under **`/approvals`** (or equivalent in your nav) |

**Support contact:** \_Name / role **_ · Email / phone _** · Hours _\_\_._

---

## 3. Manager quick reference (same doc, second audience)

| Task                           | Route                       |
| ------------------------------ | --------------------------- |
| Inbox / cycle overview         | **`/dashboard/manager`**    |
| Coverage planning & publish    | **`/coverage`**             |
| Availability planning & intake | **`/availability`**         |
| Team roster & constraints      | **`/team`**                 |
| Approve shift-board items      | **`/approvals`**            |
| Access requests (new signups)  | **`/requests/user-access`** |
| Publish history & email status | **`/publish`**              |

**Intake:** Email webhook + **manual intake** (paste / upload) on `/availability` — keep manual path documented for staff if email is delayed. Managers can now open each intake row to view the stored original email body and attachment OCR text, reparse the batch after OCR/parser changes, or delete old troubleshooting rows.

---

## 4. Privacy & employment (org decisions — fill in)

Teamwise stores **scheduling data**, **profile/contact** fields, and may process **availability request text and attachments** (including email-derived content). Your organization should record decisions for:

| Topic                     | Decision (fill in)                                                                                                                                        |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Data controller / DPA** | Who is responsible for this database (hospital vs vendor)?                                                                                                |
| **Retention**             | How long are `availability_email_intakes`, attachments, and audit logs kept?                                                                              |
| **Who may view intake**   | Only named roles (e.g. scheduling manager) vs broader access.                                                                                             |
| **Email content**         | Whether inbound body text is considered employment record vs operational message.                                                                         |
| **Offboarding**           | When someone leaves: deactivate profile, archive user, password reset policy.                                                                             |
| **Export / legal hold**   | Whether you need periodic exports from Supabase for HR/legal.                                                                                             |
| **AI / OCR**              | If `OPENAI_API_KEY` is enabled: what is sent to the provider, from which regions, and is patient/participant data ever included in pasted text or images? |

This section is **not legal advice**; run it past your compliance or HR contact.

---

## 5. Optional: first-week checklist

- [ ] First manager account exists and can sign in.
- [ ] At least one therapist test-approved end-to-end.
- [ ] One **6-week cycle** created; availability collected; **draft** generated or manual assign; **publish** completed; sample staff received email (if you use publish email).
- [ ] `RESEND_API_KEY` is **receiving-capable** if you rely on email intake.
- [ ] Staff runbook (section 2) distributed.
- [ ] Privacy table (section 4) signed off.

---

_Generated for the Teamwise codebase. Routes match `CLAUDE.md` / App Shell as of 2026-04._
