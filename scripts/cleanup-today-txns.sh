#!/bin/bash
# Delete today's bad transactions and check data

SUPABASE_URL="https://ploqeifazcgzwjzmukgp.supabase.co"
SERVICE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d= -f2 | tr -d '"')

echo "=== Checking today's data ==="
curl -s -X POST "${SUPABASE_URL}/functions/v1/query-tool" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT COUNT(*) as count, currency_code, SUM(amount) as total FROM sales_transactions WHERE date >= '\''2026-09-03'\'' GROUP BY currency_code;"}' | python3 -m json.tool

echo ""
echo "=== Deleting today's transactions (date >= 2026-09-03) ==="
curl -s -X POST "${SUPABASE_URL}/functions/v1/query-tool" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"sql": "DELETE FROM sales_transactions WHERE date >= '\''2026-09-03'\'' RETURNING COUNT(*) as deleted_count;"}' | python3 -m json.tool

echo ""
echo "=== Verifying deletion ==="
curl -s -X POST "${SUPABASE_URL}/functions/v1/query-tool" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT COUNT(*) as remaining FROM sales_transactions WHERE date >= '\''2026-09-03'\'';"}' | python3 -m json.tool
