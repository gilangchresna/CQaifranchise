# ml-stockout-risk Fix - Implementation Plan

**Date:** July 14, 2026  
**Status:** Ready for Implementation  
**Priority:** 🔴 HIGH (Blocks alert-generator for STOCKOUT type)

---

## Problem Summary

### Error
```
{
  "success": false,
  "reason": "Failed to get stockout risk from ML service"
}
```

### Root Cause
1. `ml-stockout-risk` queries `inventory` table → **Table doesn't exist**
2. Actual table is `inventory_items` (only 4 records)
3. `sales_transactions` may be empty → **No data to calculate risk**

---

## Diagnosis

| Check | Table | Expected | Actual | Status |
|-------|-------|----------|--------|--------|
| Table exists | `inventory` | Yes | **No** | ❌ |
| Table exists | `inventory_items` | Yes | Yes (4 rows) | ✅ |
| Sales data | `sales_transactions` | > 0 | **0** | ❌ |

### Code Issue (Line 187-188)
```typescript
// CURRENT (WRONG)
let inventoryQuery = supabase
  .from("inventory")  // ❌ Table doesn't exist
  .select("id, sku, product_name, current_stock, min_stock, max_stock")

// SHOULD BE
let inventoryQuery = supabase
  .from("inventory_items")  // ✅ Correct table
  .select("id, sku, product_name, current_stock, min_stock, max_stock")
```

---

## Implementation Steps

### Step 1: Fix Table Name
**File:** `supabase/functions/ml-stockout-risk/index.ts`

**Change Line ~188:**
```typescript
.from("inventory")  →  .from("inventory_items")
```

### Step 2: Update Column Mapping
**File:** `supabase/functions/ml-stockout-risk/index.ts`

Current code expects:
| Column | Current | Required |
|--------|---------|----------|
| `sku` | Yes | ✅ |
| `product_name` | Yes | ✅ |
| `current_stock` | Yes | ✅ |
| `min_stock` | Yes | ✅ |
| `max_stock` | Yes | ✅ |

Check `inventory_items` table has these columns. If not, update select statement.

### Step 3: Add Fallback Response
When no inventory data, return a safe default instead of error:

```typescript
if (!inventory || inventory.length === 0) {
  // Instead of returning error, return LOW risk
  return new Response(
    JSON.stringify({ 
      risk_score: 10,           // Low risk
      risk_level: "LOW",
      days_until_stockout: 30,
      current_stock: 0,
      avg_daily_usage: 0,
      recommended_order: 0,
      message: "No inventory data available. Assuming stable stock.",
      data_points: 0
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

### Step 4: Add Seed Data for inventory_items (Optional)
Add inventory data for testing:

```typescript
// In seed-data function, add:
inventory_items: [
  { outlet_id: 37, sku: "SKU001", product_name: "Mie Ayam", current_stock: 50, min_stock: 20, max_stock: 100 },
  { outlet_id: 37, sku: "SKU002", product_name: "Ayam Geprek", current_stock: 30, min_stock: 15, max_stock: 80 },
  // ... more items
]
```

### Step 5: Add Seed Data for sales_transactions (Optional)
Add sales history for accurate risk calculation:

```typescript
// In seed-data function, add sales_transactions with:
// - 30 days of history
// - outlet_id matches inventory items
// - amounts in realistic range
```

---

## Files to Modify

| File | Change | Risk |
|------|--------|------|
| `ml-stockout-risk/index.ts` | Change `inventory` → `inventory_items` | Low |
| `ml-stockout-risk/index.ts` | Add fallback response | Low |
| `seed-data/index.ts` | Add inventory_items seed | Medium |

---

## Testing Plan

### Before Fix
```bash
# Test should FAIL
curl -X POST "https://.../functions/v1/ml-stockout-risk" \
  -H "Authorization: Bearer <key>" \
  -d '{"outlet_id": 37, "sku": "SKU001"}'
```

### After Fix
```bash
# Test should SUCCEED
curl -X POST "https://.../functions/v1/ml-stockout-risk" \
  -H "Authorization: Bearer <key>" \
  -d '{"outlet_id": 37, "sku": "SKU001"}'

# Expected response:
{
  "risk_score": 25,
  "risk_level": "MEDIUM",
  "days_until_stockout": 5,
  "current_stock": 50,
  "avg_daily_usage": 10,
  "recommended_order": 34,
  "message": "Warning: Stock level running low..."
}
```

### Full Flow Test
```bash
# Test alert-generator with STOCKOUT type
curl -X POST "https://.../functions/v1/alert-generator" \
  -H "Authorization: Bearer <key>" \
  -d '{"outlet_id": 37, "trigger_type": "STOCKOUT"}'

# Should succeed after fix
{
  "success": true,
  "alert_id": 22,
  "alert_type": "STOCKOUT_RISK",
  "severity": "P2_MEDIUM",
  "score": 0.25
}
```

---

## Verification Checklist

- [ ] `ml-stockout-risk` returns valid JSON (not error)
- [ ] `risk_score` is between 0-100
- [ ] `risk_level` is LOW/MEDIUM/HIGH
- [ ] `alert-generator` with STOCKOUT type works
- [ ] Alert appears in `alerts-list`

---

## Related Issues

### Issue 2: sales_transactions Empty
**Impact:** `avg_daily_usage` calculation will be 0  
**Fix:** Add seed data or handle 0 usage gracefully

### Issue 3: inventory_items Only 4 Rows
**Impact:** Most outlets won't have inventory data  
**Fix:** Update seed-data to add inventory for all 24 outlets

---

## Estimated Effort

| Task | Time | Difficulty |
|------|------|------------|
| Fix table name | 5 min | Easy |
| Add fallback | 10 min | Easy |
| Add seed data | 30 min | Medium |
| Test full flow | 15 min | Easy |

**Total:** ~1 hour

---

## Rollback Plan

If issues occur:
```bash
# Redeploy original version
supabase functions deploy ml-stockout-risk
```

---

**Next Action:** Execute Step 1 (Fix Table Name)
