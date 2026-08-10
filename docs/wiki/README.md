# CQaiFranchise — AI Franchise CyberQuote

AI-driven franchise monitoring platform for PT CyberQuote Indonesia. Provides real-time visibility into sales, inventory, and staffing anomalies across franchise outlets, with AI-generated explanations (Athena) and automated workflow (Alert → Case → Resolution).

Deployed at **cqaifranchise.vercel.app** (frontend) + **Supabase Edge Functions** (backend). AI powered by Claude via Bluepack (ai.bluepack.my.id).

## Key Concepts

- **L1–L7 Architecture** — 7-layer franchise monitoring blueprint from source systems to presentation
- **Athena AI** — conversational AI copilot (Claude via Bluepack) for natural-language explanations
- **Hermes Agent** — orchestration layer for alert triage, case routing, and SLA monitoring
- **Multi-tenant** — Supabase RLS enforces tenant isolation across franchise groups
- **Real-time** — live transaction feed + dashboard polling every 10s

## Entry Points

- [`src/App.tsx`](src/App.tsx) — React SPA entry point, role-based routing
- [`supabase/functions/pos-webhook/index.ts`](supabase/functions/pos-webhook/index.ts) — L2 webhook ingestion
- [`supabase/functions/coordinator-pipeline/index.ts`](supabase/functions/coordinator-pipeline/index.ts) — L4 ML pipeline (cron)
- [`supabase/functions/athena-chat/index.ts`](supabase/functions/athena-chat/index.ts) — L5/L7 Athena chat AI

## High-Level Architecture

See [architecture.md](architecture.md) for full 7-layer system diagram.

## Module Map

| Module | Purpose |
|--------|---------|
| [`Dashboard.tsx`](modules/dashboard.md) | Main KPI dashboard with charts, stat cards, live feed |
| [`FloatingChat.tsx`](modules/floating-chat.md) | Floating AI chat button + window |
| [`AlertsList.tsx`](modules/alerts-list.md) | Alert queue with accept/dismiss actions |
| [`LiveTransactionFeed.tsx`](modules/live-transaction-feed.md) | Real-time transaction scrolling feed |
| [`pos-webhook`](modules/pos-webhook.md) | L2 webhook receiver, HMAC validation, normalize |
| [`coordinator-pipeline`](modules/coordinator-pipeline.md) | L4 ML: z-score anomaly + stockout + alert gen |
| [`athena-chat`](modules/athena-chat.md) | L5/L7 Claude chat with KB context + FX currency |
| [`agent-coordinator`](modules/agent-coordinator.md) | L5 task router, routes tasks to agents |
| [`case-create`](modules/case-create.md) | L6 workflow: create case from alert |
| [`backend/`](modules/backend-python.md) | Python FastAPI alternative backend (not active) |

## Getting Started

See [getting-started.md](getting-started.md).
