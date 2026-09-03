#!/bin/bash
SERVICE_KEY=$(grep "SUPABASE_SERVICE_ROLE_KEY" ../.env.local | cut -d= -f2 | tr -d '"')

echo "=============================================="
echo "1️⃣ Today's Transactions"
echo "=============================================="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/sales_transactions?date=eq.2026-09-03&select=id,outlet_id,amount,currency_code&limit=10" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -m json.tool

echo ""
echo "=============================================="
echo "2️⃣ Active Alerts"
echo "=============================================="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/alerts?status=eq.ACTIVE&select=id,severity,type,outlet_id,created_at,description&order=created_at.desc&limit=10" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -m json.tool

echo ""
echo "=============================================="
echo "3️⃣ Agent Run History"
echo "=============================================="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/agent_runs?select=id,agent_name,status,created_at&order=created_at.desc&limit=10" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -m json.tool

echo ""
echo "=============================================="
echo "4️⃣ AI Insights"
echo "=============================================="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/ai_insights?select=id,type,content,created_at&order=created_at.desc&limit=5" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -m json.tool
