#!/bin/bash
cd /Users/weskonek/WeskonekWeb/CQaiFrh/CQaifranchise
SERVICE_KEY=$(grep "SUPABASE_SERVICE_ROLE_KEY" .env.local | cut -d= -f2 | tr -d '"')

echo "=== Update all pending to completed ==="
curl -s -X PATCH "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/agent_tasks?status=eq.pending" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d '{"status": "completed"}'

echo ""
sleep 2
echo "=== Verify ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/agent_tasks?status=eq.pending&select=id&limit=1" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -m json.tool
