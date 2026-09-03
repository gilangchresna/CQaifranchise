#!/bin/bash
# Check inventory at SG Changi outlet (outlet with low stock)

SERVICE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d= -f2 | tr -d '"')

echo "=== Checking Alert #3104 Details ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/alerts?id=3104" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -m json.tool

echo ""
echo "=== Finding SG Changi Outlet ID ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/outlets?name=ilike.*Changi*" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -m json.tool

echo ""
echo "=== Checking Inventory with Low Stock (current_stock < min_stock) ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/inventory?select=id,outlet_id,name,sku,current_stock,min_stock,max_stock&current_stock=lt.25&order=current_stock.asc&limit=20" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -m json.tool
