#!/bin/bash
cd /Users/weskonek/WeskonekWeb/CQaiFrh/CQaifranchise
SERVICE_KEY=$(grep "SUPABASE_SERVICE_ROLE_KEY" .env.local | cut -d= -f2 | tr -d '"')

echo "=== Deleting ALL pending tasks ==="
curl -s -X DELETE "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/agent_tasks?status=eq.pending" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" -H "Prefer: return=minimal"

echo ""
echo "=== Verify ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/agent_tasks?select=status" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -c "
import sys,json
from collections import Counter
data=json.load(sys.stdin)
c = Counter(d['status'] for d in data)
print('Remaining status:', dict(c))
"
