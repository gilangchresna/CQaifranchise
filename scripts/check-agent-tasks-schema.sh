#!/bin/bash
cd /Users/weskonek/WeskonekWeb/CQaiFrh/CQaifranchise
SERVICE_KEY=$(grep "SUPABASE_SERVICE_ROLE_KEY" .env.local | cut -d= -f2 | tr -d '"')

echo "=== agent_tasks table structure ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/agent_tasks?select=*&limit=3" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -m json.tool

echo ""
echo "=== All columns ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/agent_tasks?select=*&limit=1" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -c "
import sys,json
data=json.load(sys.stdin)
if data:
    print('Columns:', list(data[0].keys()))
"

echo ""
echo "=== Total records ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/agent_tasks?select=id" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -c "
import sys,json
data=json.load(sys.stdin)
print(f'Total: {len(data)} records')
"
