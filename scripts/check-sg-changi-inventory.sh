#!/bin/bash
# Check inventory at SG Changi (outlet_id = 202)

SERVICE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d= -f2 | tr -d '"')

echo "=== SG Changi Outlet ID: 202 ==="

echo ""
echo "=== Checking Inventory at SG Changi (outlet_id = 202) ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/inventory?outlet_id=eq.202&order=current_stock.asc&limit=30" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -m json.tool

echo ""
echo "=== Items Below 25 units at SG Changi ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/inventory?outlet_id=eq.202&current_stock=lt.25&order=current_stock.asc" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -m json.tool
