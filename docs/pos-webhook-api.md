# POS Webhook API Reference

**Edge Function:** `pos-webhook`
**Endpoint:** `POST /functions/v1/pos-webhook`

---

## Overview

The POS Webhook receives transaction data from Point of Sale systems, validates it, and stores it in the `sales_transactions` table.

## Authentication

```
Authorization: Bearer <anon_key>
Content-Type: application/json
```

## Payload Structure

### Phase 1: MVP Fields (Available Now)

```json
{
  "transaction_id": "TX-2024-07-25-001",
  "outlet_id": 157,
  "date": "2024-07-25",
  "amount": 25.00,
  "transaction_count": 3
}
```

### Phase 2: Payment & People Fields (After Migration)

```json
{
  "transaction_id": "TX-2024-07-25-002",
  "outlet_id": 157,
  "date": "2024-07-25",
  "amount": 50.00,
  "transaction_count": 3,
  "payment_method": "qrcode",
  "customer_id": "CUST-001",
  "staff_id": "STAFF-001",
  "discount": 5.00,
  "tax": 4.95,
  "cost": 20.00,
  "net_amount": 49.95
}
```

### Phase 3: Platform Fields (GoFood/GrabFood)

```json
{
  "transaction_id": "TX-2024-07-25-003",
  "outlet_id": 157,
  "date": "2024-07-25",
  "amount": 35.00,
  "payment_method": "gofood",
  "platform": "gofood",
  "platform_order_id": "GF-123456789",
  "platform_fee": 8.05,
  "settlement_amount": 26.95
}
```

---

## Field Reference

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `transaction_id` | string | Unique transaction identifier |
| `outlet_id` | integer | Outlet ID (FK to outlets) |
| `date` | string | Transaction date (ISO format: YYYY-MM-DD) |
| `amount` | number | Gross transaction amount |

### Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `transaction_count` | integer | 1 | Number of items in transaction |
| `payment_method` | string | "dine_in" | Payment method |
| `customer_id` | string | null | Customer ID for loyalty |
| `staff_id` | string | null | Staff/cashier ID |
| `discount` | number | 0 | Discount amount |
| `tax` | number | 0 | Tax amount (PPN) |
| `cost` | number | 0 | Cost of goods sold |
| `net_amount` | number | auto | Net amount after discount+tax |
| `platform` | string | "dine_in" | Platform source |
| `platform_order_id` | string | null | External order ID |
| `platform_fee` | number | 0 | Platform fee |
| `settlement_amount` | number | auto | What outlet receives |
| `metadata` | object | {} | Additional data |

### Payment Methods

- `cash` - Cash payment
- `card` - Credit/debit card
- `qrcode` - QR payment (QRIS)
- `ewallet` - E-wallet (GoPay, OVO, etc.)
- `gofood` - GoFood order
- `grabfood` - GrabFood order
- `shopeefood` - ShopeeFood order
- `dine_in` - Dine-in (default)

### Platforms

- `dine_in` - In-restaurant dining (default)
- `gofood` - GoFood delivery
- `grabfood` - GrabFood delivery
- `shopeefood` - ShopeeFood delivery
- `pos` - POS system direct

---

## Response Examples

### Success

```json
{
  "success": true,
  "message": "Transaction recorded",
  "data": {
    "id": 25922,
    "transaction_id": "TX-2024-07-25-001",
    "outlet_id": 157,
    "date": "2024-07-25",
    "amount": 25,
    "hour": 0,
    "day_of_week": 4
  }
}
```

### Validation Error

```json
{
  "success": false,
  "errors": [
    "transaction_id is required",
    "amount must be a non-negative number"
  ]
}
```

### Duplicate Transaction

```json
{
  "success": false,
  "error": "Duplicate transaction_id",
  "message": "Transaction TX-2024-07-25-001 already exists"
}
```

---

## Platform Fee Calculation

For GoFood/GrabFood/ShopeeFood:

```
settlement_amount = amount - platform_fee

Example:
- Customer paid: S$35.00
- Platform fee (23%): S$8.05
- Outlet receives: S$26.95
```

---

## Implementation Phases

| Phase | Fields | Status |
|-------|--------|--------|
| MVP | transaction_id, outlet_id, date, amount, transaction_count | ✅ Available |
| Phase 2 | + payment_method, customer_id, staff_id, discount, tax, cost, net_amount | 📋 After migration |
| Phase 3 | + platform, platform_order_id, platform_fee, settlement_amount | 📋 After migration |

---

## SQL to Add New Columns

Run this in Supabase SQL Editor:

```sql
-- Payment fields
ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'dine_in';
ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS customer_id VARCHAR(100);
ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS staff_id VARCHAR(100);
ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS discount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS tax DECIMAL(10,2) DEFAULT 0;
ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS cost DECIMAL(10,2) DEFAULT 0;
ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS net_amount DECIMAL(12,2);

-- Platform fields
ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS platform VARCHAR(50);
ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS platform_order_id VARCHAR(100);
ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(10,2) DEFAULT 0;
ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS settlement_amount DECIMAL(12,2);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sales_payment_method ON sales_transactions(payment_method);
CREATE INDEX IF NOT EXISTS idx_sales_staff_id ON sales_transactions(staff_id);
CREATE INDEX IF NOT EXISTS idx_sales_platform ON sales_transactions(platform);
```
