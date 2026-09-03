#!/bin/bash
SERVICE_KEY=$(grep "SUPABASE_SERVICE_ROLE_KEY" ../.env.local | cut -d= -f2 | tr -d '"')

echo "=============================================="
echo "1️⃣ Today Sep 3 - Transactions Summary"
echo "=============================================="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/sales_transactions?date=eq.2026-09-03&select=id,amount,currency_code,outlet_id" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -c "
import sys,json
data=json.load(sys.stdin)
total = sum(d['amount'] for d in data if d['currency_code']=='SGD')
count = len([d for d in data if d['currency_code']=='SGD'])
print(f'SGD: {count} txns, Total: S\${total:.2f}')
"

echo ""
echo "=============================================="
echo "2️⃣ Alerts - List all"
echo "=============================================="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/alerts?select=id,severity,type,outlet_id,status,created_at&order=created_at.desc&limit=10" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -m json.tool

echo ""
echo "=============================================="
echo "3️⃣ AI Agents table"
echo "=============================================="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/ai_agents?select=id,name,status,last_run&order=last_run.desc&limit=10" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -m json.tool

echo ""
echo "=============================================="
echo "4️⃣ Agent Logs"
echo "=============================================="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/agent_logs?select=id,agent_name,status,created_at&order=created_at.desc&limit=10" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -m json.tool
