# Data Validator - Edge Function

**Phase:** 3.3  
**Purpose:** Validates incoming POS/sales data before ingestion

## Endpoint

```
POST /functions/v1/data-validator
```

## Request Body

```json
{
  "type": "sales" | "inventory" | "outlet",
  "data": [...],
  "single": false
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | ✅ | Validation type |
| `data` | array/object | ✅ | Data to validate |
| `single` | boolean | ❌ | If true, data is single item not array |

## Validation Types

### sales
Validates sales transactions.

### inventory
Validates inventory items.

### outlet
Validates outlet exists.

## Sales Transaction Validation Rules

| Field | Rule |
|-------|------|
| `outlet_id` | Required, must be a number |
| `date` | Required, valid date format |
| `amount` | Required, non-negative number |
| `hour` | Optional, 0-23 |
| `day_of_week` | Optional, 0-6 |

**Warning Rules:**
- Date > 30 days old → warning
- Date in future → warning
- Amount = 0 → warning
- Amount > 100M → warning (possible typo)

## Inventory Item Validation Rules

| Field | Rule |
|-------|------|
| `sku` | Required, string |
| `current_stock` | Optional, number |
| `min_stock` | Optional, number |
| `max_stock` | Optional, number |

**Cross-field Rules:**
- `min_stock` ≤ `max_stock`
- `current_stock` ≥ 0

## Response

**Success:**
```json
{
  "valid": true,
  "errors": [],
  "warnings": [],
  "data": [
    { "outlet_id": 1, "date": "2026-07-14", "amount": 150000 }
  ]
}
```

**Failure:**
```json
{
  "valid": false,
  "errors": [
    {
      "field": "outlet_id",
      "message": "outlet_id is required and must be a number",
      "value": null,
      "row": 0
    }
  ],
  "warnings": [
    {
      "field": "amount",
      "message": "Transaction amount is zero",
      "value": 0,
      "row": 2
    }
  ]
}
```

## Logic Flow

```
1. Validate request structure
2. Determine validation type
3. For each item:
   a. Check required fields
   b. Validate data types
   c. Cross-field validation
   d. Generate warnings for suspicious data
4. Check for duplicates (sales transactions)
5. Return validation result
```

## Dependencies

- `outlets` table - For outlet existence check
- `sales_transactions` table - For duplicate checking

## Acceptance Criteria

- [x] Validates required fields
- [x] Validates data types
- [x] Cross-field validation
- [x] Duplicate detection
- [x] Generates helpful error messages
- [x] Includes row index in batch errors

## Usage Examples

### Validate Single Transaction
```bash
curl -X POST https://your-project.supabase.co/functions/v1/data-validator \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "sales",
    "data": {
      "outlet_id": 1,
      "date": "2026-07-14",
      "amount": 150000
    },
    "single": true
  }'
```

### Validate Multiple Transactions
```bash
curl -X POST https://your-project.supabase.co/functions/v1/data-validator \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "sales",
    "data": [
      { "outlet_id": 1, "date": "2026-07-14", "amount": 150000 },
      { "outlet_id": 1, "date": "2026-07-14", "amount": 200000 }
    ]
  }'
```

### Validate Inventory Items
```bash
curl -X POST https://your-project.supabase.co/functions/v1/data-validator \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "inventory",
    "data": [
      { "sku": "SKU-001", "name": "Product A", "current_stock": 100 },
      { "sku": "SKU-002", "name": "Product B", "current_stock": 50 }
    ]
  }'
```

### Validate Outlet Exists
```bash
curl -X POST https://your-project.supabase.co/functions/v1/data-validator \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "outlet",
    "data": 1
  }'
```

## Integration with POS Connector

Typical flow:

```bash
# 1. Validate data first
VALIDATION=$(curl -s -X POST https://your-project.supabase.co/functions/v1/data-validator \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type": "sales", "data": [...]}')

# 2. Check if valid
if echo "$VALIDATION" | jq -e '.valid == true' > /dev/null; then
  # 3. Import data
  curl -X POST https://your-project.supabase.co/functions/v1/pos-connector \
    -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
    -d '{"system": "ALOHA", "action": "fetch_sales"}'
else
  # 4. Show errors
  echo "$VALIDATION" | jq '.errors'
fi
```
