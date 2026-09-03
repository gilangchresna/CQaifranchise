#!/bin/bash
cd /Users/weskonek/WeskonekWeb/CQaiFrh/CQaifranchise
SERVICE_KEY=$(grep "SUPABASE_SERVICE_ROLE_KEY" .env.local | cut -d= -f2 | tr -d '"')

echo "=== agent_tasks TODAY (Sep 3) ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/agent_tasks?created_at=gte.2026-09-03&select=*&order=created_at.desc&limit=10" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -m json.tool

echo ""
echo "=== Count by today ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/agent_tasks?created_at=gte.2026-09-03&select=id" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -c "
import sys,json
data=json.load(sys.stdin)
print(f'Total today: {len(data)} tasks')
"

echo ""
echo "=== Most recent tasks ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/agent_tasks?select=agent_id,task_type,status,created_at&order=created_at.desc&limit=5" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -m json.tool
