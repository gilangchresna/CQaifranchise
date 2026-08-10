# Module: coordinator-pipeline (Edge Function)

L4 ML pipeline. Runs z-score anomaly detection + stockout prediction + alert generation. 178 lines. No auth (service role key).

## Responsibilities

- **STEP 1: Z-score anomaly detection** — for each outlet with ≥5 days of data, compute 30-day rolling mean/std, compare today vs baseline
- **STEP 2: Stockout risk** — inventory depletion rate vs restock cadence
- **STEP 3: Alert generation** — insert alerts if z-score ≥2.5 (CRITICAL) or ≥1.5 (WARNING)
- **FX conversion** — all amounts converted to SGD at query time

## Key Files

- [`supabase/functions/coordinator-pipeline/index.ts`](supabase/functions/coordinator-pipeline/index.ts) — main ML pipeline

## FX Conversion Rates (hardcoded)

```typescript
function sgd(currency) {
  if (currency === "SGD") return 1;
  if (currency === "IDR") return 1 / 12500;   // IDR → SGD
  if (currency === "THB") return 1 / 27.5;    // THB → SGD
  if (currency === "MYR") return 1 / 3.4;     // MYR → SGD
  return 1;
}
```

## Anomaly Logic

```typescript
// For each outlet, daily totals over 30 days:
mean = sum / count
variance = sum((val - mean)²) / count
std = sqrt(variance)
z = (todayAmount - mean) / std

if |z| >= 2.5 → CRITICAL → is_anomaly = true
if |z| >= 1.5 → WARNING
else → OK

// Percentile mapping
CRITICAL → 97th percentile
WARNING  → 75th percentile
OK       → 25th percentile
```

## Output

```typescript
{
  anomaly: { critical: N, warning: N, ok: N },
  stockout: { high_risk: N, medium: N, low: N },
  alerts_generated: N,
  today_total_sgd: number,
  outlets_analyzed: N
}
```

## Cron Setup

Runs via Supabase pg_cron. Triggered every 1 minute. No auth required (service role).
