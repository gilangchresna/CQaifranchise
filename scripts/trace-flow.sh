#!/bin/bash
SERVICE_KEY=$(grep "SUPABASE_SERVICE_ROLE_KEY" ../.env.local | cut -d= -f2 | tr -d '"')

echo "=============================================="
echo "1️⃣ POS WEBHOOK - How transactions enter"
echo "=============================================="
grep -A5 "export\|serve" supabase/functions/pos-webhook/index.ts | head -20

echo ""
echo "=============================================="
echo "2️⃣ Latest Sales Transactions (last 5)"
echo "=============================================="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/sales_transactions?select=id,outlet_id,amount,date,created_at&order=id.desc&limit=5" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -m json.tool

echo ""
echo "=============================================="
echo "3️⃣ Agent Tasks/Logs for Recent Transactions"
echo "=============================================="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/agent_logs?select=id,agent_name,action,created_at&order=created_at.desc&limit=10" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -m json.tool

echo ""
echo "=============================================="
echo "4️⃣ Coordinators pipeline - how it processes"
echo "=============================================="
grep -n "sales_transactions\|transaction\|analyze\|process" supabase/functions/coordinator-pipeline/index.ts 2>/dev/null | head -20 || echo "File not found"

echo ""
echo "=============================================="
echo "5️⃣ Alert Generator - what triggers alerts"
echo "=============================================="
grep -n "sales_transactions\|transaction\|threshold\|anomaly" supabase/functions/alert-generator/index.ts 2>/dev/null | head -20 || echo "File not found"
