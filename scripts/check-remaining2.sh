#!/bin/bash
# Check remaining transactions

SERVICE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d= -f2 | tr -d '"')

echo "=== Remaining transactions ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/sales_transactions?select=id,date&order=date.desc&limit=100" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -c "
import json,sys
from collections import Counter
data = json.load(sys.stdin)
if isinstance(data, list):
    dates = Counter([t.get('date','')[:10] for t in data])
    print(f'Total in query: {len(data)}')
    for d, c in sorted(dates.items(), reverse=True):
        print(f'  {d}: {c}')
else:
    print(data)
"
