# POS Connector - Edge Function

**Phase:** 3.1  
**Purpose:** Unified interface for different POS systems (Aloha, SAP, Dynamics)

## Endpoint

```
POST /functions/v1/pos-connector
```

## Request Body

```json
{
  "system": "ALOHA" | "SAP_S4HANA" | "DYNAMICS" | "GENERIC",
  "action": "fetch_sales" | "fetch_inventory" | "test_connection",
  "outlet_id": 1,
  "credentials": {
    "host": "pos.example.com",
    "port": 5432,
    "api_key": "xxx",
    "api_secret": "xxx"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `system` | string | ✅ | POS system type |
| `action` | string | ✅ | Action to perform |
| `outlet_id` | number | ❌ | Outlet to fetch data for |
| `credentials` | object | ❌ | POS system credentials |

## Supported POS Systems

| System | Description | API Type |
|--------|-------------|----------|
| ALOHA | Aloha POS (IRISPY) | REST/Soap |
| SAP_S4HANA | SAP S/4HANA | OData |
| DYNAMICS | Microsoft Dynamics | REST |
| GENERIC | Generic/CSV import | Direct |

## Actions

### test_connection
Tests connectivity to POS system.

### fetch_sales
Fetches sales transactions and inserts into `sales_transactions` table.

### fetch_inventory
Fetches inventory items and inserts/updates `inventory` table.

## Response

```json
{
  "success": true,
  "system": "ALOHA",
  "action": "fetch_sales",
  "count": 5,
  "data": {
    "transactions": [...],
    "sync_result": {
      "inserted": 5,
      "errors": []
    }
  }
}
```

## Data Transformation

Each POS system has different field names. The connector transforms to standard format:

```typescript
// Standard transaction format
interface Transaction {
  transaction_id: string;
  outlet_id: number;
  date: string;         // ISO 8601
  amount: number;
  hour?: number;        // 0-23
  day_of_week?: number; // 0-6
  items?: Item[];
}

// Standard inventory format
interface InventoryItem {
  sku: string;
  name: string;
  current_stock: number;
  min_stock: number;
  max_stock: number;
}
```

## Dependencies

- `sales_transactions` table - For storing transactions
- `inventory` table - For storing inventory

## Acceptance Criteria

- [x] Connects to Aloha POS format
- [x] Connects to SAP S/4HANA format
- [x] Connects to Dynamics format
- [x] Transforms data to standard format
- [x] Inserts into database
- [x] Handles duplicates gracefully

## Usage Examples

### Test Connection
```bash
curl -X POST https://your-project.supabase.co/functions/v1/pos-connector \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "system": "ALOHA",
    "action": "test_connection"
  }'
```

### Fetch Sales
```bash
curl -X POST https://your-project.supabase.co/functions/v1/pos-connector \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "system": "SAP_S4HANA",
    "action": "fetch_sales",
    "outlet_id": 1,
    "credentials": {
      "api_key": "xxx",
      "api_secret": "xxx"
    }
  }'
```

### Fetch Inventory
```bash
curl -X POST https://your-project.supabase.co/functions/v1/pos-connector \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "system": "DYNAMICS",
    "action": "fetch_inventory",
    "outlet_id": 1
  }'
```

## Integration with Data Validator

Use data-validator before ingestion:

```bash
# First validate
curl -X POST https://your-project.supabase.co/functions/v1/data-validator \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type": "sales", "data": [...]}'

# Then import
curl -X POST https://your-project.supabase.co/functions/v1/pos-connector \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"system": "ALOHA", "action": "fetch_sales", "outlet_id": 1}'
```
