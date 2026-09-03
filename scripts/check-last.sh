#!/bin/bash
SERVICE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d= -f2 | tr -d '"')
echo "=== Last remaining transaction ==="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/sales_transactions?id=eq.316439" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -m json.tool
