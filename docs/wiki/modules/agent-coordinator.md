# Module: agent-coordinator (Edge Function)

L5 task routing hub. 250 lines. Routes incoming tasks to appropriate agent edge functions based on `task_type`.

## Responsibilities

- Accept task dispatch requests
- Map `task_type` → agent ID
- Create task record in `agent_tasks` table
- Call target agent edge function via HTTP
- Log event to `agent_logs` via RPC
- Record metric to `agent_metrics`

## Task Type → Agent Mapping

| task_type | Agent | Edge Function |
|-----------|-------|--------------|
| `anomaly_check` | monitor | ml-anomaly-v2 |
| `stockout_predict` | analyst | ml-stockout-v2 |
| `alert_triage` | triage | athena-case-triage |
| `case_triage` | triage | athena-case-triage |
| `user_query` | athena | athena-chat |
| `notification_send` | executor | notification-send |
| `benchmark` | analyst | ml-stockout-v2 |
| `task_dispatch` | coordinator | handled internally |

## Task Lifecycle

```
pending → running → completed | failed
```

## Database Tables

- `agent_tasks` — task execution log (UUID PK, task_id UNIQUE)
- `agent_metrics` — performance metrics (has period_start/period_end, NOT period)
- `agent_logs` — event log (has log_level AND level columns)
- `agents` — registered agent registry (seeded 6 agents)
- `log_agent_event()` — RPC function
- `record_agent_metric()` — RPC function

## agent-orchestration (Separate)

[`supabase/functions/agent-orchestration/index.ts`](supabase/functions/agent-orchestration/index.ts) — status dashboard (read-only). Was ALL MOCK DATA. Fixed Aug 11 to read from real DB.
