# Module: pos-webhook (Edge Function)

L2 webhook ingestion receiver. Validates HMAC, normalizes POS payload, inserts into `sales_transactions`. 258 lines.

## Responsibilities

- HMAC-SHA256 signature verification (or dev bypass)
- Outlet existence check (`outlets` table FK)
- Duplicate transaction rejection (UNIQUE on `transaction_id`)
- Extract `hour` and `day_of_week` from timestamp
- Compute financial fields: `net_amount`, `settlement_amount`, `profit`
- Insert into `sales_transactions`

## Key Files

- [`supabase/functions/pos-webhook/index.ts`](supabase/functions/pos-webhook/index.ts) — main edge function

## Validated Fields

| Field | Validation |
|-------|-----------|
| `transaction_id` | Required, string, UNIQUE |
| `outlet_id` | Required, positive integer, FK exists |
| `amount` | Required, non-negative number |
| `payment_method` | Must be in: cash, card, qrcode, ewallet, gofood, grabfood, shopeefood, dine_in |
| `platform` | Must be in: dine_in, gofood, grabfood, shopeefood, pos |

## HMAC Verification

```typescript
// Production: requires x-pos-signature header
// Dev: x-pos-dev-bypass: "dev-mode-2026" skips HMAC

const signature = req.headers.get('x-pos-signature');
const body = await req.text();
const expected = hmac.new(secret, body, sha256).hexdigest();
if (!hmac.compareTimingEqual(signature, expected)) return 401;
```

## INSERT payload

```typescript
{
  transaction_id, outlet_id, date,
  amount, discount, tax, cost,
  net_amount: amount - discount + tax,
  platform_fee, settlement_amount: net_amount - platform_fee,
  profit: net_amount - cost,
  hour: new Date(date).getHours(),
  day_of_week: new Date(date).getDay(),
  payment_method, platform, customer_id, staff_id,
  transaction_count, platform_order_id
}
```

## Known Issues

- `payment_method` field not in `sales_transactions` schema (PostgREST may reject)
- `discount`, `tax`, `cost`, `net_amount`, `settlement_amount` may not exist in table
- Currency not normalized — amount stored as-sent (assumes SGD in current DB)
