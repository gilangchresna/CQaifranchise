# pos-webhook

**Type:** Edge Function (Deno)
**Path:** `supabase/functions/pos-webhook/index.ts`
**Endpoint:** `POST /functions/v1/pos-webhook`

## Security

### Authentication
- **HMAC-SHA256** signature required in `x-pos-signature` header
- Secret configured as `POS_WEBHOOK_SECRET` in Supabase Edge Functions secrets

### L1 Replay Protection
- Rejects transactions with `date` older than **yesterday** (UTC)
- Allows today and yesterday only
- Returns `400 REPLAY_DETECTED` for stale dates

### CORS
- `Access-Control-Allow-Origin: https://cqaifranchise.vercel.app` (production only)

## Request

```json
{
  "transaction_id": "TXN-2026-001",
  "outlet_id": 164,
  "date": "2026-08-11",
  "amount": 45.50,
  "payment_method": "qrcode",
  "platform": "dine_in",
  "discount": 0,
  "tax": 0,
  "cost": 0,
  "platform_fee": 0
}
```

### Fields
| Field | Required | Type | Notes |
|-------|----------|------|-------|
| `transaction_id` | ✅ | string | Unique per transaction |
| `outlet_id` | ✅ | number | Must exist in `outlets` table |
| `date` | ✅ | string | `YYYY-MM-DD`, today or yesterday |
| `amount` | ✅ | number | Non-negative |
| `payment_method` | | string | cash/card/qrcode/ewallet/gofood/grabfood/shopeefood/dine_in |
| `platform` | | string | dine_in/gofood/grabfood/shopeefood/pos |
| `discount` | | number | Default 0 |
| `tax` | | number | Default 0 |
| `cost` | | number | Default 0 |
| `platform_fee` | | number | Default 0 |

## Financial Fields (auto-calculated)

| Field | Formula |
|-------|---------|
| `net_amount` | `amount - discount + tax` |
| `settlement_amount` | `net_amount - platform_fee` |
| `profit` | `net_amount - cost` |

## Response

```json
// 200 OK
{ "success": true, "message": "Transaction recorded", "data": { ... } }

// 400 Bad Request
{ "success": false, "code": "REPLAY_DETECTED", "error": "..." }
{ "success": false, "errors": ["..."] }

// 401 Unauthorized
{ "success": false, "error": "Unauthorized: Invalid or missing signature" }

// 409 Conflict
{ "success": false, "error": "Duplicate transaction_id" }
```

## Testing

```bash
# Sign request with HMAC-SHA256
BODY='{"transaction_id":"TEST-001","outlet_id":164,"date":"2026-08-11","amount":50}'
SECRET="your-pos-webhook-secret"
SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)

curl -X POST "https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/pos-webhook" \
  -H "Content-Type: application/json" \
  -H "x-pos-signature: $SIG" \
  -d "$BODY"
```
