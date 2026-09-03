#!/bin/bash
cd /Users/weskonek/WeskonekWeb/CQaiFrh/CQaifranchise
SERVICE_KEY=$(grep "SUPABASE_SERVICE_ROLE_KEY" .env.local | cut -d= -f2 | tr -d '"')

echo "=== Remaining pending tasks ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/agent_tasks?status=eq.pending&select=id&limit=1" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -m json.tool

echo ""
echo "=== Total remaining tasks ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/agent_tasks?select=id" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -c "import sys,json; print(f'Total: {len(json.load(sys.stdin))}')"
