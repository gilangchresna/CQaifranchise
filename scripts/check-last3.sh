#!/bin/bash
SERVICE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d= -f2 | tr -d '"')
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/sales_transactions?id=eq.307579" -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -m json.tool
