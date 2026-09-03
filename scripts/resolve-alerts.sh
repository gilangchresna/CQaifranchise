#!/bin/bash
cd /Users/weskonek/WeskonekWeb/CQaiFrh/CQaifranchise
SERVICE_KEY=$(grep "SUPABASE_SERVICE_ROLE_KEY" .env.local | cut -d= -f2 | tr -d '"')

echo "=== Resolving ALL NEW alerts to RESOLVED ==="
curl -s -X PATCH "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/alerts?status=eq.NEW" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d '{"status": "RESOLVED"}'

echo ""
sleep 2
echo "=== Verify ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/alerts?select=status" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -c "
import sys,json
from collections import Counter
data=json.load(sys.stdin)
c = Counter(d.get('status','N/A') for d in data)
print('Status counts:', dict(c))
"
