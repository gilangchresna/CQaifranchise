#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Get service role key
SERVICE_KEY=$(grep "SUPABASE_SERVICE_ROLE_KEY" ../.env.local 2>/dev/null | cut -d= -f2 | tr -d '"')

if [ -z "$SERVICE_KEY" ]; then
    echo "Error: Cannot find SUPABASE_SERVICE_ROLE_KEY"
    exit 1
fi

echo "📤 Uploading SG transactions (key: ${SERVICE_KEY:0:20}...)"

# Split into chunks
split -l 2000 sg_txns_60d.json sg_chunk_
CHUNKS=$(ls sg_chunk_* 2>/dev/null | wc -l | tr -d ' ')
echo "Split into $CHUNKS chunks"

i=1
for chunk in sg_chunk_*; do
    echo "Uploading chunk $i/$CHUNKS..."
    RESULT=$(curl -s -X POST "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/sales_transactions" \
      -H "apikey: ${SERVICE_KEY}" \
      -H "Authorization: Bearer ${SERVICE_KEY}" \
      -H "Content-Type: application/json" \
      -H "Prefer: resolution=merge-duplicates" \
      -d @"${chunk}" 2>&1)
    echo "  Result: ${RESULT:0:80}"
    i=$((i+1))
done

rm -f sg_chunk_*

echo ""
echo "✅ Done!"
curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/sales_transactions?select=id&limit=1" \
  -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}"
