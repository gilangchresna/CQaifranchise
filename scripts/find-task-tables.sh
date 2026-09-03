#!/bin/bash
cd /Users/weskonek/WeskonekWeb/CQaiFrh/CQaifranchise
SERVICE_KEY=$(grep "SUPABASE_SERVICE_ROLE_KEY" .env.local | cut -d= -f2 | tr -d '"')

echo "=== All tables with task/task related data ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/?limit=100" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -c "
import sys,json
data=json.load(sys.stdin)
# Get table names from definitions
defs = data.get('definitions', {})
tables = [k for k in defs.keys() if k not in ['null','boolean','string','number','integer','array','object']]
print('Tables:', tables[:20])
"

echo ""
echo "=== Check task_queue table ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/task_queue?select=id,status,created_at&limit=5" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -m json.tool

echo ""
echo "=== Check tasks table ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/tasks?select=id,status,created_at&limit=5" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -m json.tool

echo ""
echo "=== Check agent_queue table ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/agent_queue?select=id,status,created_at&limit=5" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -m json.tool
