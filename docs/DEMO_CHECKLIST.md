# Demo Validation Checklist

## Purpose

Use this checklist before showing RT Scheduler to someone. It helps confirm the demo is ready enough to walk through, but it is not production certification.

## Prerequisites

- [ ] Node and npm are installed.
- [ ] Repository dependencies are installed.
- [ ] `.env.local` has been created from `.env.example`.
- [ ] A Supabase demo or test project is configured.
- [ ] Seeded demo data is available when the walkthrough needs realistic users, schedules, requests, or shift-board items.
- [ ] Resend, OpenAI, and webhook features are configured only if those workflows are part of the demo.

## Local Command Checks

Run these commands before the demo:

```bash
npm install
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npm audit --omit=dev
npm run build
```

## Local Production-Build Demo Flow

For final manual validation, use the production build behavior instead of relying only on `next dev`.

```bash
npm run start:prod:local
```

Then open:

```text
http://127.0.0.1:3001
```

Use `next dev` for iteration. Use the local production build for the final pre-demo browser pass.

## Manual Browser Walkthrough

- [ ] Public homepage loads.
- [ ] Login works.
- [ ] Manager dashboard loads.
- [ ] Team/roster page loads.
- [ ] Schedule grid loads.
- [ ] Cycle picker works.
- [ ] Day/night switching works.
- [ ] Assign/unassign works in a draft schedule block.
- [ ] Designate lead works for a lead-eligible therapist.
- [ ] Publish/preliminary flow is checked if configured.
- [ ] Therapist/staff dashboard loads.
- [ ] Therapist schedule view is read-only.
- [ ] Therapist availability page loads.
- [ ] Shift board loads.
- [ ] Requests page loads.
- [ ] Profile/theme page loads.
- [ ] No obvious browser console errors appear during the walkthrough.

## Optional Seeded E2E Validation

Run this when the Supabase/test environment is configured:

```bash
npm run test:e2e
```

Seeded E2E gives stronger confidence than reduced public/auth-only coverage because it can exercise database-backed workflows. Do not claim full workflow E2E confidence unless seeded E2E actually ran.

## Demo-Ready Definition

- [ ] CI is passing.
- [ ] Local production build succeeds.
- [ ] Basic manual walkthrough succeeds.
- [ ] Known limitations are understood.
- [ ] No real secrets or real staff data are exposed.
- [ ] Demo data is clearly separated from production or real data.

## Not Production-Ready Unless Verified

Do not treat a demo-ready app as production-ready until these areas are verified:

- [ ] Production deployment.
- [ ] Production secrets.
- [ ] Supabase project config and RLS.
- [ ] Backups/recovery.
- [ ] Cron jobs.
- [ ] Webhooks.
- [ ] Email sending.
- [ ] Seeded/full E2E.
- [ ] Real-user UAT/signoff.
