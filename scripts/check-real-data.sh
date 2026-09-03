#!/bin/bash
cd /Users/weskonek/WeskonekWeb/CQaiFrh/CQaifranchise
SERVICE_KEY=$(grep "SUPABASE_SERVICE_ROLE_KEY" .env.local | cut -d= -f2 | tr -d '"')

echo "=== ACTUAL DATA (using RPC count) ==="
echo ""

# Count total via count header
echo "Total transactions:"
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/sales_transactions?select=id" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Prefer: count=exact" 2>&1 | head -c 200

echo ""
echo ""
echo "Today Sep 3:"
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/sales_transactions?date=gte.2026-09-03&select=amount,currency_code" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -c "
import sys,json
from collections import defaultdict
data=json.load(sys.stdin)
sgd = sum(d['amount'] for d in data if d.get('currency_code')=='SGD')
idr = sum(d['amount'] for d in data if d.get('currency_code')=='IDR')
print(f'SGD total: S\${sgd:.2f}')
print(f'IDR total: Rp{idr:.2f}')
print(f'Count: {len(data)}')
"

echo ""
echo "=== Latest transactions ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/sales_transactions?select=id,date,amount,currency_code&order=id.desc&limit=5" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -m json.tool
