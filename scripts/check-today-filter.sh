#!/bin/bash
cd /Users/weskonek/WeskonekWeb/CQaiFrh/CQaifranchise
SERVICE_KEY=$(grep "SUPABASE_SERVICE_ROLE_KEY" .env.local | cut -d= -f2 | tr -d '"')

echo "=== TODAY filter (Sep 3, 2026) ==="
echo ""

# Get all TODAY transactions
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/sales_transactions?date=eq.2026-09-03&select=id,amount,currency_code,outlet_id,created_at&order=created_at.desc" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -c "
import sys,json
from collections import defaultdict
data=json.load(sys.stdin)

sgd = [d for d in data if d.get('currency_code')=='SGD']
idr = [d for d in data if d.get('currency_code')=='IDR']

sgd_total = sum(d['amount'] for d in sgd)
idr_total = sum(d['amount'] for d in idr)

print(f'Total TODAY transactions: {len(data)}')
print(f'  SGD: {len(sgd)} txns = S\${sgd_total:.2f}')
print(f'  IDR: {len(idr)} txns = Rp{idr_total:.2f}')
print()
print('Latest 5:')
for d in data[:5]:
    print(f\"  ID {d['id']}: {d['currency_code']} {d['amount']} @ {d['created_at'][:19]}\")
"

echo ""
echo "=== Compare: Dashboard showing 5,299 txns, S\$137,862 ==="
echo "This means dashboard query is NOT filtering by 'Today' correctly"
echo "Or there's another source of data"
