#!/bin/bash
cd /Users/weskonek/WeskonekWeb/CQaiFrh/CQaifranchise
SERVICE_KEY=$(grep "SUPABASE_SERVICE_ROLE_KEY" .env.local | cut -d= -f2 | tr -d '"')

echo "=== Current Alerts ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/alerts?select=id,severity,type,status,created_at&order=created_at.desc&limit=20" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -m json.tool

echo ""
echo "=== Count by status ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/alerts?select=status" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -c "
import sys,json
from collections import Counter
data=json.load(sys.stdin)
c = Counter(d.get('status','N/A') for d in data)
print('Status:', dict(c))
"
