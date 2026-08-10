# ml-accuracy-tracker

**Type:** Edge Function (Deno)
**Path:** `supabase/functions/ml-accuracy-tracker/index.ts`
**Endpoint:** `GET /functions/v1/ml-accuracy-tracker?days=30`
**Auth:** None (internal)

## Purpose

Evaluates ML model performance by tracking:
- **TP** (True Positive): Alert was valid, case was worked
- **FP** (False Positive): Alert was noise
- **FN** (False Negative): Anomaly missed
- **TN** (True Negative): Normal correctly identified

## Metrics Computed

| Metric | Formula |
|--------|---------|
| Precision | `TP / (TP + FP)` |
| Recall | `TP / (TP + FN)` |
| F1 | `2 × Precision × Recall / (Precision + Recall)` |
| Accuracy | `(TP + TN) / Total` |

## Response

```json
{
  "model": "Sales Anomaly Detector",
  "period_days": 30,
  "sample_size": 47,
  "confusion_matrix": { "tp": 32, "fp": 8, "fn": 5, "tn": 2 },
  "metrics": {
    "precision": 0.800,
    "recall": 0.865,
    "f1": 0.831,
    "accuracy": 0.723
  }
}
```

## How to Populate Accuracy Data

When a case is resolved, call the tracker with the case outcome:

```bash
curl -X POST "https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/ml-accuracy-tracker" \
  -H "Content-Type: application/json" \
  -d '{"case_id": 1, "predicted_score": 0.78, "severity": "P1_HIGH"}'
```

This should be wired into the case resolution flow (CasesList → Mark Resolved → call tracker).
