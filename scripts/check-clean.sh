#!/bin/bash
cd /Users/weskonek/WeskonekWeb/CQaiFrh/CQaifranchise
SERVICE_KEY=$(grep "SUPABASE_SERVICE_ROLE_KEY" .env.local | cut -d= -f2 | tr -d '"')

echo "=== Summary of today's deletions ==="
echo ""
echo "1. sales_transactions today:"
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/sales_transactions?date=eq.2026-09-03&select=id&limit=1" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  Remaining: {len(d)}')"

echo ""
echo "2. agent_logs today:"
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/agent_logs?created_at=gte.2026-09-03&select=id&limit=1" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  Remaining: {len(d)}')"

echo ""
echo "3. alerts today:"
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/alerts?created_at=gte.2026-09-03&select=id&limit=1" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  Remaining: {len(d)}')"

echo ""
echo "=== Database still has (historical data) ==="
echo "Total transactions:"
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/sales_transactions?select=id" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -c "import sys,json; print(f'  {len(json.load(sys.stdin))}')"
