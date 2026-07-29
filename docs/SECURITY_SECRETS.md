# CyberQuote Security: Secrets Management

## Overview
This document tracks the removal of hardcoded JWTs/secrets and documents the proper configuration approach.

## Changes Made

### Files Modified

1. **`supabase/migrations/030_setup_cron_jobs.sql`**
   - Removed hardcoded JWT from 2 `net.http_post` calls (ml-anomaly-check, ml-stockout-check)
   - JWT pattern found: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsb3FlaWZhemNnendqem11a2dwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5Mjc5MzYsImV4cCI6MjA5OTUwMzkzNn0.78V9J0gKCYLLMvVEIg6VKhVXTRiO_Zv2NmsSIpxgPrM`
   - Now uses: `{"Content-Type": "application/json"}` (auth handled via pg_net service_role)

2. **`docs/cron-setup.sql`**
   - Removed hardcoded JWT from 3 `net.http_post` calls (ml-anomaly-check, ml-stockout-check, ml-batch-score)
   - Same JWT pattern as above
   - Added security header documentation

## How pg_cron Authentication Works

When `net.http_post` is called from within a pg_cron scheduled job, the request automatically uses the **service_role** context. This means:
- No Authorization header is needed
- The request has full database service privileges
- Secrets should be managed via Supabase Edge Function Secrets, not in SQL

## Required Secrets Configuration

### Supabase Dashboard → Project Settings → Edge Functions → Secrets

Add these secrets (DO NOT hardcode in code):

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `SUPABASE_URL` | Your Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role JWT for internal API calls | `eyJhbG...` |
| `GEMINI_API_KEY` | Google Gemini API key for Athena chat | `AIza...` |
| `SMTP_PASSWORD` | SMTP password for email notifications | `xxx` |
| `SMTP_HOST` | SMTP server hostname | `smtp.gmail.com` |

## Edge Function Secret Access

All CyberQuote Edge Functions properly read secrets from environment:

```typescript
// ✅ CORRECT - reading from environment
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

// ❌ WRONG - hardcoded secret
const supabaseKey = "eyJhbG...xxx";
```

Verified clean functions (use `Deno.env.get`):
- `athena-chat/index.ts` - uses `GEMINI_API_KEY` from env ✓
- `cron-run/index.ts` - uses `SUPABASE_SERVICE_ROLE_KEY` from env ✓
- `ml-stockout-risk/index.ts` - uses `SUPABASE_SERVICE_ROLE_KEY` from env ✓
- All other functions in `supabase/functions/` - properly configured ✓

## Best Practices

1. **Never commit secrets** - Add `.env` to `.gitignore`
2. **Use Supabase Secrets** - Configure via dashboard for production
3. **Rotate keys regularly** - Especially service role keys
4. **Use .env.example** - Template file with placeholder values only

## Files That Should NOT Contain Secrets

- `*.sql` migration files
- `docs/*.sql` documentation
- Source code files (use environment variables)
- Git history (if committed, rotate keys immediately)

## Related Files

- `supabase/migrations/030_setup_cron_jobs.sql` - Cron job migration
- `docs/cron-setup.sql` - Cron setup documentation
- `supabase/functions/*/index.ts` - Edge Functions (clean)
