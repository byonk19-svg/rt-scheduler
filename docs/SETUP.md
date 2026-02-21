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

For optional authenticated e2e test:
- `E2E_USER_EMAIL`
- `E2E_USER_PASSWORD`

## Demo Seed Data
Run:
```bash
npm run seed:demo
```

This script is idempotent and creates demo cycles, shifts, availability requests, and one shift board post.

## E2E Tests
Run Playwright tests:
```bash
npm run test:e2e
```
