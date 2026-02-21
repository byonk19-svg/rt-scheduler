# Setup Guide

## Prerequisites
- Node.js v18+
- Git
- Supabase account (free)
- Vercel account (free, for deploy)

## Local Development

1. Clone the repo and install dependencies:
```bash
   git clone <your-repo-url>
   cd rt-scheduler
   npm install
```

2. Copy the env example and fill in your Supabase credentials:
```bash
   cp .env.example .env.local
```

3. Run the dev server:
```bash
   npm run dev
```

4. Open http://localhost:3000

## Environment Variables
See `.env.example` for required variables.
Get values from: Supabase Dashboard → Settings → API