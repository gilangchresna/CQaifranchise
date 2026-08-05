# POS Simulator Documentation

## Overview

The POS Simulator generates fake Point-of-Sale (POS) data and sends it to
CyberQuote's webhook endpoint. This allows for demo and testing without
requiring a real POS system.

## Purpose

| Use Case        | Description                                       |
| --------------- | ------------------------------------------------- |
| **Demo**        | Show CyberQuote working with "live" data          |
| **Testing**     | Test webhook ingestion and ML pipeline            |
| **Development** | Verify system behavior without POS infrastructure |
| **Training**    | Train users on CyberQuote workflow                |

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                    POS SIMULATOR                                │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│  │ Random      │───►│ Generate     │───►│ POST to      │     │
│  │ Outlet Pick │    │ Sale Data    │    │ Webhook      │     │
│  └──────────────┘    └──────────────┘    └──────────────┘     │
│                                                   │             │
│  ┌──────────────┐    ┌──────────────┐           │             │
│  │ Stats &      │◄───│ HMAC         │◄──────────┘             │
│  │ Logging      │    │ Signature    │                         │
│  └──────────────┘    └──────────────┘                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  CyberQuote (ingestion-webhook)                                 │
│                                                                 │
│  1. Validate HMAC signature                                     │
│  2. Check idempotency (prevent duplicates)                      │
│  3. Insert into sales_transactions table                        │
│  4. Return success response                                     │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Navigate to Project

```bash
cd ~/Cyberquote/CyberquoteWeb/unified-ai-CQ
```

### 2. Run Simulator

```bash
node scripts/pos-simulator.js
```

### 3. Expected Output

```
╔══════════════════════════════════════════════════════════════╗
║                  🚀 CYBERQUOTE POS SIMULATOR 🚀               ║
╠══════════════════════════════════════════════════════════════╣
║  Generates fake POS sales data and sends to CyberQuote       ║
║  webhook endpoint for demo purposes                          ║
╚══════════════════════════════════════════════════════════════╝

📋 Configuration:
   Webhook URL: https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/ingestion-webhook
   Interval: 3000ms (20.0 sales/min)
   Outlets: 24 outlets
   HMAC Auth: ✅ Enabled
─────────────────────────────────────────────────────────────────
📡 Starting simulation...

  [15:30:00] ✅ Sale #0001 | Outlet 37 | 2 items | Rp 95,000 | QRIS | 2p/3t
  [15:30:03] ✅ Sale #0002 | Outlet 39 | 3 items | Rp 135,000 | CASH | 1p/5t
  [15:30:06] ✅ Sale #0003 | Outlet 38 | 1 items | Rp 45,000 | EWALLET | 3p/2t
  ...
```

### 4. Stop Simulator

Press `Ctrl+C` to stop.

---

## Command Options

### Basic Usage

```bash
# Default settings (3 second interval, 24 outlets)
node scripts/pos-simulator.js

# Custom interval (1 second = 60 sales/min)
node scripts/pos-simulator.js --interval=1000

# Custom number of outlets (10 outlets)
node scripts/pos-simulator.js --outlets=10

# Fast simulation (500ms interval)
node scripts/pos-simulator.js --interval=500
```

### Environment Variables

```bash
# Custom webhook URL
export CYBERQUOTE_WEBHOOK="https://your-project.supabase.co/functions/v1/ingestion-webhook"
node scripts/pos-simulator.js

# Custom HMAC secret
export POS_HMAC_SECRET="your_secret_here"
node scripts/pos-simulator.js
```

---

## Data Format

### Generated Sale Payload

```json
{
  "outlet_id": 37,
  "transaction_id": "TXN_1690000000000_abc123",
  "amount": 104500,
  "items": [
    {
      "sku": "SKU_KOPI_O",
      "name": "Kopi Oey",
      "quantity": 2,
      "unit_price": 35000,
      "subtotal": 70000
    },
    {
      "sku": "SKU_ROTI_B",
      "name": "Roti Bakar",
      "quantity": 1,
      "unit_price": 25000,
      "subtotal": 25000
    }
  ],
  "timestamp": "2026-07-22T15:30:00.000Z"
}
```

### Outlet Coverage

The simulator covers 24 outlets across Indonesia:

| Outlet ID | Name                  | Region         |
| --------- | --------------------- | -------------- |
| 37-39     | Kopi Oey - Jakarta    | Jakarta        |
| 40        | Kopi Oey - Bandung    | West Java      |
| 41        | Kopi Oey - Yogyakarta | Yogyakarta     |
| 42        | Kopi Oey - Semarang   | Central Java   |
| 43        | Kopi Oey - Medan      | North Sumatra  |
| 44        | Kopi Oey - Makassar   | South Sulawesi |
| 45        | Kopi Oey - Bali       | Bali           |
| 46        | Kopi Oey - Malang     | East Java      |
| 47-60     | Kopi Oey - Various    | Other regions  |

---

## Security

### HMAC-SHA256 Authentication

The simulator signs all requests with HMAC-SHA256:

```
Header: X-Signature-256: sha256=<hex_digest>
```

The signature is computed over the raw JSON payload using the shared secret.

### Default Secret

```
whsec_default_dev_secret_change_in_production
```

**⚠️ Important:** Change this in production!

```bash
# Set your own secret
export POS_HMAC_SECRET="your_secure_random_secret_here"
```

---

## Demo Sequence

### 1. Start Simulator (Terminal 1)

```bash
cd ~/Cyberquote/CyberquoteWeb/unified-ai-CQ
node scripts/pos-simulator.js
```

### 2. Open CyberQuote Dashboard (Browser)

```
http://localhost:3001
```

### 3. Watch Live Data

- Sales appearing in real-time
- Revenue updating
- ML scoring running

### 4. Trigger ML Alerts

Wait 5-10 minutes for ML to:

1. Calculate anomaly scores
2. Detect stockout risks
3. Generate alerts

### 5. Handle Alerts

```
Dashboard → Alerts → Select Alert → Create Case → Resolve
```

### 6. Stop Simulator

`Ctrl+C` when done.

---

## Troubleshooting

### "Missing signature header" Error

**Cause:** HMAC secret mismatch

**Fix:** Ensure `POS_HMAC_SECRET` matches server's `WEBHOOK_HMAC_SECRET`

```bash
# Check server secret
supabase secrets list | grep WEBHOOK

# Run with matching secret
export POS_HMAC_SECRET="whsec_default_dev_secret_change_in_production"
node scripts/pos-simulator.js
```

### "Invalid webhook signature" Error

**Cause:** HMAC computation mismatch

**Fix:**

1. Verify secret is identical on both sides
2. Check signature header format (`sha256=` prefix)

### No Data Appearing in Dashboard

**Cause:** Webhook URL incorrect

**Fix:** Verify URL in config matches your Supabase project

```bash
# Check current webhook URL
grep "webhookUrl" scripts/pos-simulator.js

# Verify project is correct
supabase projects list
```

### "Connection refused" Error

**Cause:** Network or project issue

**Fix:**

1. Check Supabase project is running
2. Verify project ID is correct
3. Check if functions are deployed

---

## Advanced: Integration with Real POS

### For Moka POS

```javascript
// Moka webhook format adapter
function mokaToCyberQuoteFormat(mokaPayload) {
  return {
    outlet_id: parseInt(mokaPayload.outlet_id),
    transaction_id: mokaPayload.order_id,
    amount: mokaPayload.total_amount,
    items: mokaPayload.items.map((item) => ({
      sku: item.item_code,
      name: item.item_name,
      quantity: item.qty,
      unit_price: item.unit_price,
      subtotal: item.subtotal,
    })),
    timestamp: mokaPayload.created_at,
  };
}
```

### For Poster POS

```javascript
// Poster webhook format adapter
function posterToCyberQuoteFormat(posterPayload) {
  return {
    outlet_id: parseInt(posterPayload.restaurant_id),
    transaction_id: posterPayload.order_id,
    amount: posterPayload.total_sum,
    items: posterPayload.items.map((item) => ({
      sku: item.product_id,
      name: item.name,
      quantity: item.quantity,
      unit_price: item.price,
      subtotal: item.price * item.quantity,
    })),
    timestamp: posterPayload.created,
  };
}
```

---

## File Structure

```
unified-ai-CQ/
├── scripts/
│   └── pos-simulator.js      # Main simulator script
├── docs/
│   └── pos-simulator.md       # This documentation
```

---

## License

Internal use - CyberQuote project
