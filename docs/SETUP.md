# Setup Guide

## Prerequisites

- Node.js v18+
- Git
- Supabase account
- Vercel account (optional for deploy)

## Local Development

1. Clone the repo and install dependencies:

```bash
git clone <your-repo-url>
cd rt-scheduler
npm install
```

2. Copy env example and fill credentials:

```bash
cp .env.example .env.local
```

3. Run dev server:

```bash
npm run dev
```

4. Open `http://localhost:3000`.

## Environment Variables

See `.env.example` for required values.

For app runtime:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

For demo seed script:

- `SUPABASE_SERVICE_ROLE_KEY`
- optional user seeding knobs:
  - `SEED_USERS_COUNT`
  - `SEED_USERS_DOMAIN`
  - `SEED_USERS_PREFIX`
  - `SEED_USERS_PASSWORD`
  - `SEED_INCLUDE_MANAGER`

For optional authenticated e2e test:

- `E2E_USER_EMAIL`
- `E2E_USER_PASSWORD`

For publish history + async email delivery:

- `NEXT_PUBLIC_APP_URL`
- `RESEND_API_KEY`
- `PUBLISH_EMAIL_FROM`
- optional `PUBLISH_WORKER_KEY` + `PUBLISH_WORKER_SIGNING_KEY` (signed key auth for cron/webhook caller)

Signed worker request headers for `POST /api/publish/process`:

- `x-publish-worker-key: <PUBLISH_WORKER_KEY>`
- `x-publish-worker-timestamp: <unix-seconds>`
- `x-publish-worker-signature: <hex-hmac-sha256>`

Signature payload:

```text
POST
/api/publish/process
<unix-seconds>
```

Validate publish rollout readiness:

```bash
npm run verify:publish
```

If email delivery is intentionally disabled and you only want in-app publishing:

```bash
npm run verify:publish -- --allow-no-email
```

## Inbound Availability Intake

The app supports two manager-side intake paths for availability requests:

- **Inbound email webhook:** Resend sends `email.received` events to `POST /api/inbound/availability-email`
- **Manual intake fallback:** manager creates an intake item directly from `/availability` by pasting request text and/or uploading a form image/PDF

Required env vars for webhook + OCR:

- `RESEND_API_KEY`
- `RESEND_WEBHOOK_SECRET`
- `OPENAI_API_KEY` (optional, required only for image OCR)
- `OPENAI_OCR_MODEL` (optional, defaults to `gpt-4.1-mini`)

Important Resend requirement:

- The Resend API key used by the app must have **receiving-capable permissions**. A key restricted to **Sending access** will fail on `/emails/receiving`, and the intake route will not be able to fetch inbound email content or attachments.

Operational note:

- If inbound email is configured but Resend still shows no received emails, managers can immediately test the workflow through the manual intake form on `/availability`.

## Demo Seed Data

Run:

```bash
npm run seed:demo
```

This script is idempotent and creates demo cycles, shifts, availability requests, and one shift board post.

## Seed Fake Employees

Run:

```bash
npm run seed:users
```

Default generated users:

- `employee01@teamwise.test` through `employee08@teamwise.test`
- password: `Teamwise123!`

Set `SEED_INCLUDE_MANAGER=true` to also create `manager@teamwise.test`.

## E2E Tests

Run Playwright tests:

```bash
npm run test:e2e
```
