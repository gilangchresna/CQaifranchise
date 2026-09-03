#!/bin/bash
# Check remaining transactions

SERVICE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d= -f2 | tr -d '"')

echo "=== Checking remaining transactions ==="
echo ""

# Total count
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/sales_transactions?select=id&limit=1000" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Prefer: count=exact" | python3 -c "
import json,sys
data = json.load(sys.stdin)
if isinstance(data, list):
    print(f'Remaining transactions: {len(data)}')
else:
    print(data)
"

echo ""
echo "=== Remaining by date ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/sales_transactions?select=id,date&order=date.desc&limit=100" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -c "
import json,sys
from collections import Counter
data = json.load(sys.stdin)
if isinstance(data, list):
    dates = Counter([t.get('date','')[:10] for t in data])
    print('By date:')
    for d, c in sorted(dates.items(), reverse=True):
        print(f'  {d}: {c} txns')
else:
    print(data)
"

echo ""
echo "=== DELETE all remaining (if needed) ==="
echo "Run this to delete everything:"
echo 'curl -X POST ".../delete-transactions" -d "{\"date_from\": \"2020-01-01\", \"dry_run\": false}"'
