# POS Simulator — Cara Pakai

Simulator mengirim fake POS transaction ke `pos-webhook` edge function (L1 ingestion).
Mendukung **dev bypass** (tanpa HMAC) dan **production mode** (HMAC real).

---

## Quick Start

### Normal simulation (happy path)

```bash
cd ~/WeskonekWeb/CQaiFrh/CQaifranchise

# One-shot test
python3 scripts/pos-simulator.py --dev --count 1 --outlet 1

# Continuous loop (tiap 5 detik)
python3 scripts/pos-simulator.py --dev --outlet 1

# Different platform
python3 scripts/pos-simulator.py --dev --outlet 2 --platform gofood
python3 scripts/pos-simulator.py --dev --outlet 3 --platform grabfood --interval 3
```

### Error test suite (negative tests)

```bash
# Run ALL 17 error test cases against pos-webhook
python3 scripts/pos-simulator.py --dev --test-errors

# Run specific error test
python3 scripts/pos-simulator.py --dev --test-error invalid_outlet
python3 scripts/pos-simulator.py --dev --test-error duplicate_txn
python3 scripts/pos-simulator.py --dev --test-error missing_amount

# List all available error tests
python3 scripts/pos-simulator.py --test-list
```

### Production mode (real HMAC)

```bash
export POS_WEBHOOK_SECRET="your_secret_here"
python3 scripts/pos-simulator.py --secret "$POS_WEBHOOK_SECRET" --outlet 1 --count 5
python3 scripts/pos-simulator.py --secret "$POS_WEBHOOK_SECRET" --test-errors
```

---

## Available Options

| Flag              | Default        | Description                                      |
|------------------|----------------|------------------------------------------------|
| `--dev`          | OFF            | Pakai dev bypass (tanpa HMAC)                   |
| `--secret`       | env var        | HMAC secret untuk production mode               |
| `--outlet`       | `1`            | Outlet ID                                       |
| `--platform`     | `dine_in`      | dine_in, gofood, grabfood, shopeefood, pos     |
| `--interval`     | `5`            | Detik antar transaksi (continuous mode)          |
| `--count`        | `0` (loop)     | Jumlah transaksi, 0 = loop forever              |
| `--dry-run`      | OFF            | Print payload tanpa kirim                       |
| `--test-errors`  | OFF            | Run all 17 error test cases                     |
| `--test-error`   | —              | Run one specific error test                     |
| `--test-list`    | OFF            | List all available error test names             |

---

## Error Test Suite — 17 Test Cases

```
duplicate_txn          409  same transaction_id sent twice
invalid_outlet         400  outlet_id=99999 (does not exist)
outlet_zero            400  outlet_id=0 (invalid)
outlet_negative        400  outlet_id=-1 (negative)
outlet_float           400  outlet_id=1.5 (float, not integer)
missing_txn_id         400  transaction_id omitted
missing_outlet_id      400  outlet_id omitted
missing_amount         400  amount omitted
missing_date           400  date omitted
amount_string          400  amount='abc' (wrong type)
amount_negative        400  amount=-100 (negative)
amount_zero            200  amount=0 (zero — allowed)
payment_invalid        400  payment_method='ovo' (not in allowlist)
platform_invalid       400  platform='delivery' (not in allowlist)
discount_negative      400  discount=-5000 (negative)
tax_negative           400  tax=-1000 (negative)
cost_negative          400  cost=-5000 (negative)
```

---

## Expected Results

### Happy path
```
[10:00:13] #0001 ✅ 200  txn=TXN-BE87C62C  OK=1  FAIL=0
[10:00:19] #0002 ✅ 200  txn=TXN-994F5641  OK=2  FAIL=0
```

### Error test
```
duplicate_txn: expected=409, got=409 ✅
invalid_outlet: expected=400, got=400 ✅
payment_invalid: expected=400, got=400 ✅

Total: 17 tests
Passed: 17 ✅
Failed: 0 ❌
```

---

## Verify Data

1. Buka [c-qaifranchise.vercel.app](https://c-qaifranchise.vercel.app)
2. Login → HQ role
3. Dashboard → cek revenue counters update
4. Network Directory → outlet details

Atau check langsung di database:
```bash
# via browser — Supabase Table Editor → sales_transactions
```

---

## Troubleshooting

### `❌ 401: UNAUTHORIZED_LEGACY_JWT`
Anon key expired. Script auto-read dari `.env.local` — pastikan `VITE_SUPABASE_ANON_KEY` masih valid.

### `❌ 401: Unauthorized: Invalid or missing signature`
Production mode — HMAC mismatch. Pakai `--dev` untuk bypass.

### `❌ 400: Invalid outlet_id`
Outlet ID tidak ada di tabel `outlets`. Gunakan ID yang valid.

### `❌ 500: Internal server error`
Cek Supabase dashboard → Functions → pos-webhook → Logs.

---

## Files

| File | Description |
|------|-------------|
| `scripts/pos-simulator.py` | Main simulator + error test suite |
| `docs/pos-simulator-usage.md` | Dokumentasi ini |
