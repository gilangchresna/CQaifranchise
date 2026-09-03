#!/bin/bash
SERVICE_KEY=$(grep "SUPABASE_SERVICE_ROLE_KEY" ../.env.local | cut -d= -f2 | tr -d '"')

echo "=============================================="
echo "1️⃣ AGENTS-LIST - List all agents"
echo "=============================================="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/agents-list" \
  -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -m json.tool

echo ""
echo "=============================================="
echo "2️⃣ AGENT-STATUS - Current agent status"
echo "=============================================="
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/agent-status" \
  -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -m json.tool

echo ""
echo "=============================================="
echo "3️⃣ ALERT-GENERATOR - Generate alerts for today"
echo "=============================================="
curl -s -X POST "https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/alert-generator" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"date": "2026-09-03"}' | python3 -m json.tool
