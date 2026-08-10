# Module: POS Simulator (scripts/)

POS Simulator as L1 data source proxy. Fixed version: `pos-simulator-fixed.py`.

## Responsibilities

Generate realistic POS transactions for development/testing without live POS hardware.

## Scripts

| Script | Status | Purpose |
|--------|--------|---------|
| `pos-simulator-fixed.py` | ✅ ACTIVE | Fixed, realistic SGD amounts, outlet IDs 164-171 |
| `pos-simulator.py` | ❌ STOPPED | Old broken version (wrong outlet IDs, unrealistic amounts) |
| `pos-realistic.py` | 🔄 IDLE | Alternate realistic version |
| `pos-real.py` | 🔄 IDLE | Real POS webhook test |

## pos-simulator-fixed.py Usage

```bash
# One-shot test (5 transactions)
python3 scripts/pos-simulator-fixed.py --dev --count 5

# Continuous loop (every 10s)
python3 scripts/pos-simulator-fixed.py --dev --interval 10

# Specific outlet
python3 scripts/pos-simulator-fixed.py --dev --outlet 169 --interval 5

# Full business day simulation
python3 scripts/pos-simulator-fixed.py --dev --day 2026-08-10
```

## Key Configuration

- **Outlets**: IDs 164-171 (confirmed in DB)
- **Amounts**: SGD 8-23 per transaction (realistic F&B)
- **Menu**: Premium SGD S$12-17, Standard SGD S$7-9
- **Tax**: 9% GST (Singapore)
- **Format**: `{OUTLET_CODE}-{YYYYMMDD}-T{HHMMSS}-{RANDOM}` — idempotent

## Menu Items (SGD, Standard Tier)

| Item | Price |
|------|-------|
| Nasi Goreng | S$8.50 |
| Ayam Geprek | S$8.00 |
| Mie Goreng | S$7.50 |
| Soto Ayam | S$8.50 |
| Es Teh Manis | S$2.50 |
| Es Jeruk | S$3.00 |

## Launch Agent (Disabled)

Old simulator ran via `com.cyberquote.pos-simulator` launch agent — **killed Aug 11**. Do not re-enable as auto-start in production.
