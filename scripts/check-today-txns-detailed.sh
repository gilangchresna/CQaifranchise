#!/bin/bash
# Check today's transactions

SERVICE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d= -f2 | tr -d '"')

echo "============================================================"
echo "  TODAY'S TRANSACTIONS (2026-09-03)"
echo "============================================================"
echo ""

echo "=== Summary by Currency ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/rpc/summary_by_currency" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" 2>/dev/null | python3 -m json.tool || echo "RPC not found"

echo ""
echo "=== Count by Currency ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/sales_transactions?date=gte.2026-09-03T00:00:00&select=currency_code,amount&limit=1000" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Prefer: count=exact" | python3 -c "
import json,sys
data = json.load(sys.stdin)
if isinstance(data, list):
    by_currency = {}
    for t in data:
        c = t.get('currency_code', 'SGD')
        if c not in by_currency:
            by_currency[c] = {'count': 0, 'total': 0, 'amounts': []}
        by_currency[c]['count'] += 1
        by_currency[c]['total'] += float(t.get('amount', 0))
        by_currency[c]['amounts'].append(float(t.get('amount', 0)))
    
    print(f'Total transactions: {len(data)}')
    print()
    for c, d in sorted(by_currency.items()):
        amounts = d['amounts']
        print(f'{c}:')
        print(f'  Count: {d[\"count\"]}')
        print(f'  Total: {d[\"total\"]:,.2f}')
        print(f'  Avg: {d[\"total\"]/d[\"count\"]:,.2f}')
        print(f'  Min: {min(amounts):,.2f}')
        print(f'  Max: {max(amounts):,.2f}')
        print()
else:
    print(data)
"

echo ""
echo "=== Sample Transactions (10) ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/sales_transactions?date=gte.2026-09-03T00:00:00&select=id,outlet_id,currency_code,amount,created_at&order=created_at.desc&limit=10" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -m json.tool

echo ""
echo "=== Outliers (amount > 1000) ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/sales_transactions?date=gte.2026-09-03T00:00:00&amount=gt.1000&select=id,outlet_id,currency_code,amount&limit=20" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -c "
import json,sys
data = json.load(sys.stdin)
if isinstance(data, list):
    print(f'Found {len(data)} transactions with amount > 1000')
    for t in data[:10]:
        print(f'  Outlet {t[\"outlet_id\"]}: {t[\"currency_code\"]} {t[\"amount\"]:,.2f}')
else:
    print(data)
"
