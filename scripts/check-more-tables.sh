#!/bin/bash
cd /Users/weskonek/WeskonekWeb/CQaiFrh/CQaifranchise
SERVICE_KEY=$(grep "SUPABASE_SERVICE_ROLE_KEY" .env.local | cut -d= -f2 | tr -d '"')

echo "=== Check agent_tasks table ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/agent_tasks?select=id,status,created_at&limit=5" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -m json.tool

echo ""
echo "=== Check retry_queue ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/retry_queue?select=id,status,created_at&limit=5" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -m json.tool

echo ""
echo "=== Check dead_letter_queue ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/dead_letter_queue?select=id,created_at&limit=5" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -m json.tool

echo ""
echo "=== Check sla_escalation_runs ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/sla_escalation_runs?select=id,created_at&limit=5" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -m json.tool
