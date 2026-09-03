#!/bin/bash
cd /Users/weskonek/WeskonekWeb/CQaiFrh/CQaifranchise
SERVICE_KEY=$(grep "SUPABASE_SERVICE_ROLE_KEY" .env.local | cut -d= -f2 | tr -d '"')

echo "=== Agent Logs by Date ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/agent_logs?select=created_at&order=created_at.desc&limit=20" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -c "
import sys,json
from datetime import datetime
data=json.load(sys.stdin)
for d in data[:10]:
    dt = d['created_at'][:19]
    print(f'  {dt}')
"

echo ""
echo "=== Count by date ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/agent_logs?select=created_at" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -c "
import sys,json
from collections import Counter
data=json.load(sys.stdin)
dates = [d['created_at'][:10] for d in data]
c = Counter(dates)
for date, count in sorted(c.items(), reverse=True)[:10]:
    print(f'  {date}: {count}')
"
