#!/bin/bash
# Check 7-day transactions

SERVICE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d= -f2 | tr -d '"')

echo "============================================================"
echo "  LAST 7 DAYS TRANSACTIONS (Aug 28 - Sep 3)"
echo "============================================================"
echo ""

# Count transactions
echo "=== Transaction Count by Currency ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/sales_transactions?date=gte.2026-08-28&date=lte.2026-09-03&select=id,currency_code,amount" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Prefer: count=exact" 2>/dev/null | python3 -c "
import json,sys
data = json.load(sys.stdin)
if isinstance(data, list):
    print(f'Total: {len(data)} transactions')
    by_curr = {}
    for t in data:
        c = t.get('currency_code', 'SGD')
        if c not in by_curr:
            by_curr[c] = {'count': 0, 'total': 0}
        by_curr[c]['count'] += 1
        by_curr[c]['total'] += float(t.get('amount', 0))
    print()
    for c, d in sorted(by_curr.items()):
        print(f'{c}: {d[\"count\"]} txns, total {d[\"total\"]:,.2f}')
else:
    print(data)
"

echo ""
echo "=== Sample Big Transactions (amount > 1000) ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/sales_transactions?date=gte.2026-08-28&date=lte.2026-09-03&amount=gt.1000&select=id,outlet_id,currency_code,amount&limit=20" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -c "
import json,sys
data = json.load(sys.stdin)
if isinstance(data, list):
    print(f'Found {len(data)} transactions > 1000')
    for t in data[:10]:
        print(f'  Outlet {t[\"outlet_id\"]}: {t[\"currency_code\"]} {t[\"amount\"]:,.2f}')
else:
    print(data)
"

echo ""
echo "=== Outlets with most transactions ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/sales_transactions?date=gte.2026-08-28&date=lte.2026-09-03&select=outlet_id,amount,currency_code" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -c "
import json,sys
data = json.load(sys.stdin)
if isinstance(data, list):
    by_outlet = {}
    for t in data:
        oid = t.get('outlet_id')
        if oid not in by_outlet:
            by_outlet[oid] = {'count': 0, 'total': 0}
        by_outlet[oid]['count'] += 1
        by_outlet[oid]['total'] += float(t.get('amount', 0))
    sorted_outlets = sorted(by_outlet.items(), key=lambda x: x[1]['total'], reverse=True)
    for oid, d in sorted_outlets[:10]:
        print(f'Outlet {oid}: {d[\"count\"]} txns, total {d[\"total\"]:,.2f}')
else:
    print(data)
"
