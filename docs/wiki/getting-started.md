# Getting Started

## Prerequisites

- Node.js 18+ (for frontend)
- Python 3.11+ (for simulator scripts)
- Supabase CLI (`brew install supabase/tap/supabase`)
- Git

## Installation

```bash
# Clone
git clone https://github.com/gilangchresna/CQaifranchise.git
cd CQaifranchise

# Install frontend deps
npm install

# Copy env
cp .env.local.example .env.local
# Edit .env.local with your Supabase project keys
```

## First Run

```bash
# Local frontend dev
npm run dev
# → http://localhost:3000

# POS simulator (L1 development data)
python3 scripts/pos-simulator-fixed.py --dev --count 10
```

## POS Simulator (L1 Proxy)

```bash
# Send 10 realistic transactions
python3 scripts/pos-simulator-fixed.py --dev --count 10

# Continuous (every 10s)
python3 scripts/pos-simulator-fixed.py --dev --interval 10

# Full business day simulation
python3 scripts/pos-simulator-fixed.py --dev --day 2026-08-10
```

## Supabase CLI

```bash
# Link to project
supabase link --project-ref ploqeifazcgzwjzmukgp

# Push migrations
supabase db push

# Run SQL locally
supabase db sql

# Edge function logs
supabase functions serve
```

## Edge Function Deployment

Vercel auto-deploys on git push to main. Manual:
```bash
cd supabase && supabase functions deploy <function-name>
```

## Configuration

| File | Purpose |
|------|---------|
| `.env.local` | Supabase keys, anon key |
| `supabase/config.toml` | Supabase local config |
| `scripts/pos-simulator-fixed.py` | L1 data source for dev |

## Where to Go Next

- Architecture: [architecture.md](architecture.md)
- Dashboard module: [modules/dashboard.md](modules/dashboard.md)
- Athena chat: [modules/athena-chat.md](modules/athena-chat.md)
- POS webhook: [modules/pos-webhook.md](modules/pos-webhook.md)
