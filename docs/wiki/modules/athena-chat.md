# Module: athena-chat (Edge Function)

L5/L7 Athena AI chat. 974 lines. POST endpoint — takes user message + history, queries real data, calls Claude via Bluepack, returns NL explanation.

## Responsibilities

- JWT authentication from Authorization header
- Build system prompt with role context, currency config, outlet permissions
- Query KB articles for RAG context
- Fetch real-time data (outlets, alerts, recent transactions) for grounding
- Call Claude via Bluepack proxy (ai.bluepack.my.id)
- Log to `ai_audit_log` table
- Return structured NL response

## Key Files

- [`supabase/functions/athena-chat/index.ts`](supabase/functions/athena-chat/index.ts) — main (974 lines)

## Currency Config (supports multi-currency)

| Region | Currency | Symbol | Locale |
|--------|----------|--------|--------|
| SG | SGD | S$ | en-SG |
| JKT/BDG/SBY | IDR | Rp | id-ID |
| BKK | THB | ฿ | th-TH |
| KUL | MYR | RM | en-MY |

## System Prompt Context

Athena receives role-based context:
- User role (HQ_ADMIN sees all, REGIONAL_MANAGER sees region, FRANCHISEE sees own outlets)
- Currency per region
- Active alerts count
- Top 3 at-risk outlets
- Recent transactions

## Request Shape

```typescript
POST {
  message: string,
  context?: { user_id?, role?, region_id?, outlet_id? },
  history?: Array<{ role: "user"|"assistant", content: string }>
}
```

## Bluepack Call

```typescript
const response = await fetch("https://ai.bluepack.my.id/v1/chat", {
  method: "POST",
  headers: { "Authorization": `Bearer ${BLUEPACK_KEY}` },
  body: JSON.stringify({ model: "CLAUDE_Sonnet", messages: [...systemMsg, ...history, { role: "user", content }] })
});
```

## Audit

All chat messages logged to `ai_audit_log` table: user_id, input, output, tokens, latency_ms.
