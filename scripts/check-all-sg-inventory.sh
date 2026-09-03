#!/bin/bash
# Check inventory for ALL SG Outlets

SERVICE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d= -f2 | tr -d '"')

# SG Outlets: 164, 165, 167, 168, 169, 170, 171, 200, 201, 202
SG_OUTLETS=(164 165 167 168 169 170 171 200 201 202)

echo "============================================================"
echo "  INVENTORY CHECK - ALL SG OUTLETS"
echo "============================================================"
echo ""

for outlet_id in "${SG_OUTLETS[@]}"; do
    echo "--------------------------------------------------------"
    echo "Outlet ID: $outlet_id"
    
    # Get outlet name
    outlet_name=$(curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/outlets?id=eq.$outlet_id&select=name" \
        -H "apikey: ${SERVICE_KEY}" \
        -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d[0]['name'] if d else 'Unknown')" 2>/dev/null)
    
    echo "Name: $outlet_name"
    
    # Total items
    total=$(curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/inventory?outlet_id=eq.$outlet_id&select=id" \
        -H "apikey: ${SERVICE_KEY}" \
        -H "Authorization: Bearer ${SERVICE_KEY}" \
        -H "Prefer: count=exact" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d))" 2>/dev/null)
    echo "Total Items: $total"
    
    # Items with 0 stock
    zero=$(curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/inventory?outlet_id=eq.$outlet_id&current_stock=eq.0&select=id" \
        -H "apikey: ${SERVICE_KEY}" \
        -H "Authorization: Bearer ${SERVICE_KEY}" \
        -H "Prefer: count=exact" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d))" 2>/dev/null)
    echo "Zero Stock: $zero"
    
    # Items below min
    below=$(curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/inventory?outlet_id=eq.$outlet_id&current_stock=lt.25&select=id" \
        -H "apikey: ${SERVICE_KEY}" \
        -H "Authorization: Bearer ${SERVICE_KEY}" \
        -H "Prefer: count=exact" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d))" 2>/dev/null)
    echo "Below Min (25): $below"
    
    # Status
    if [ "$zero" -eq "$total" ]; then
        echo "⚠️  STATUS: ALL ZERO - NEEDS RESTOCK!"
    elif [ "$zero" -gt 0 ]; then
        echo "⚠️  STATUS: PARTIAL ZERO STOCK"
    else
        echo "✅ STATUS: OK"
    fi
    
    echo ""
done

echo "============================================================"
echo "  SUMMARY"
echo "============================================================"
echo ""
echo "Outlets needing restock:"
for outlet_id in "${SG_OUTLETS[@]}"; do
    zero=$(curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/inventory?outlet_id=eq.$outlet_id&current_stock=eq.0&select=id" \
        -H "apikey: ${SERVICE_KEY}" \
        -H "Authorization: Bearer ${SERVICE_KEY}" \
        -H "Prefer: count=exact" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d))" 2>/dev/null)
    
    outlet_name=$(curl -s "https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/outlets?id=eq.$outlet_id&select=name" \
        -H "apikey: ${SERVICE_KEY}" \
        -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d[0]['name'] if d else 'Unknown')" 2>/dev/null)
    
    if [ "$zero" -gt 0 ]; then
        echo "  ID $outlet_id ($outlet_name): $zero items at 0 stock"
    fi
done
