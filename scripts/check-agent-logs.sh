#!/bin/bash
cd /Users/weskonek/WeskonekWeb/CQaiFrh/CQaifranchise
SERVICE_KEY=$(grep "SUPABASE_SERVICE_ROLE_KEY" .env.local | cut -d= -f2 | tr -d '"')

echo "=== Check Agent Logs table structure ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/agent_logs?select=*&limit=3" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -m json.tool

echo ""
echo "=== Check task queue tables ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/?limit=5" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -c "import sys,json; d=json.load(sys.stdin); print('Tables:', list(d.keys())[:10])" 2>/dev/null || echo "No tables found"
