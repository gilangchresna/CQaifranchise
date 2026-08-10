# Module: AlertsList.tsx

Alert queue UI with accept/dismiss actions. 310 lines. Fetches from `alerts-list` edge function, renders as action cards.

## Responsibilities

- Fetch alerts from `alerts-list` edge function
- Filter by user role (HQ_ADMIN sees all, others scoped)
- "Accept" → creates case via `case-create` edge function
- "Dismiss" → marks alert as dismissed
- Severity-colored icons and priority badges

## Alert Data Model

```typescript
interface Alert {
  id: number
  type: 'ANOMALY' | 'STOCKOUT' | 'STAFF' | 'FINANCIAL' | 'SYSTEM'
  severity: 'P0_CRITICAL' | 'P1_HIGH' | 'P2_MEDIUM' | 'P3_LOW'
  status: 'NEW' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'RESOLVED' | 'DISMISSED'
  title: string
  description: string
  outlet: { name, code, region: { name, code } }
  created_at: string
}
```

## Related

- [`supabase/functions/alerts-list/index.ts`](supabase/functions/alerts-list/index.ts) — backend API
- [`supabase/functions/case-create/index.ts`](supabase/functions/case-create/index.ts) — L6 workflow: create case from alert

## Case Priority Mapping

```typescript
P0_CRITICAL → URGENT
P1_HIGH     → HIGH
P2_MEDIUM   → MEDIUM
P3_LOW      → LOW
```
