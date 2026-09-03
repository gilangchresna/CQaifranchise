#!/bin/bash
cd /Users/weskonek/WeskonekWeb/CQaiFrh/CQaifranchise
SERVICE_KEY=$(grep "SUPABASE_SERVICE_ROLE_KEY" .env.local | cut -d= -f2 | tr -d '"')

echo "=== Remaining NEW alerts ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/alerts?status=eq.NEW&select=id&limit=1" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -c "
import sys,json
data=json.load(sys.stdin)
print(f'NEW alerts: {len(data)}')
"

echo ""
echo "=== All alerts status summary ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/alerts?select=status" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -c "
import sys,json
from collections import Counter
data=json.load(sys.stdin)
c = Counter(d.get('status','N/A') for d in data)
print('Status:', dict(c))
"
