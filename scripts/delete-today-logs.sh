#!/bin/bash
cd /Users/weskonek/WeskonekWeb/CQaiFrh/CQaifranchise
SERVICE_KEY=$(grep "SUPABASE_SERVICE_ROLE_KEY" .env.local | cut -d= -f2 | tr -d '"')

echo "=== Deleting today's agent logs (2026-09-03) ==="
curl -s -X DELETE "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/agent_logs?created_at=gte.2026-09-03" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" -H "Prefer: return=minimal"

echo ""
echo "=== Check remaining today ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/agent_logs?created_at=gte.2026-09-03&select=id&limit=5" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -m json.tool
