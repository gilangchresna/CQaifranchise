# Agent Orchestration - Implementation Plan

**Project:** CyberQuote AI Platform  
**Date:** July 29, 2026  
**Status:** Planning  

---

## Executive Summary

Agent Orchestration currently has **UI + Mock Data**. The goal is to build a **real multi-agent system** that automatically monitors outlets, detects anomalies, triages alerts, and coordinates responses.

**Target:** Replace mock dashboard with live agent metrics and automated workflows.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     AGENT ORCHESTRATION LAYER                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐               │
│   │ Athena   │    │ Monitor  │    │ Analyst  │               │
│   │ (AI Chat)│    │(Anomaly) │    │(Stockout)│               │
│   └────┬─────┘    └────┬─────┘    └────┬─────┘               │
│        │               │               │                       │
│        └───────────────┼───────────────┘                       │
│                        │                                       │
│                 ┌──────▼──────┐                                 │
│                 │ Coordinator │ ← BRAIN OF THE SYSTEM          │
│                 │ (Router)    │                                 │
│                 └──────┬──────┘                                 │
│                        │                                       │
│          ┌─────────────┼─────────────┐                         │
│          │             │             │                          │
│    ┌─────▼─────┐ ┌─────▼─────┐ ┌────▼────┐                    │
│    │  Triage   │ │ Executor  │ │ Alerts  │                    │
│    │ (Routing) │ │ (Actions) │ │ (Notify)│                    │
│    └───────────┘ └───────────┘ └─────────┘                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Agent Definitions

### 1. Athena (AI Chat Agent)
| Attribute | Value |
|-----------|-------|
| **Role** | Primary AI assistant for franchisee queries |
| **Inputs** | User chat, Knowledge Base, Franchise data |
| **Outputs** | AI responses, Recommendations, Actions |
| **Tech** | Claude API via Edge Function |
| **Status** | ✅ Working |

### 2. Monitor Agent
| Attribute | Value |
|-----------|-------|
| **Role** | Real-time anomaly detection in sales data |
| **Inputs** | `sales_transactions` table, Outlet features |
| **Outputs** | Anomaly scores, Alerts |
| **Tech** | ML anomaly detection (Isolation Forest) |
| **Status** | ✅ Working (ml-anomaly-v2) |

### 3. Analyst Agent
| Attribute | Value |
|-----------|-------|
| **Role** | Stockout prediction + peer benchmarking |
| **Inputs** | `inventory` table, Sales trends, Outlet metrics |
| **Outputs** | Stockout risk scores, Peer comparisons |
| **Tech** | ML predictions + Supabase queries |
| **Status** | ✅ Working (ml-stockout-v2) |

### 4. Triage Agent
| Attribute | Value |
|-----------|-------|
| **Role** | Route incoming alerts to correct handler |
| **Inputs** | Alerts, Cases, User roles |
| **Outputs** | Prioritized queue, Routing decisions |
| **Tech** | Rule-based + AI classification |
| **Status** | ✅ Working (athena-case-triage) |

### 5. Executor Agent
| Attribute | Value |
|-----------|-------|
| **Role** | Execute actions based on decisions |
| **Inputs** | Decisions from Coordinator |
| **Outputs** | Notifications, Case updates, Webhooks |
| **Tech** | Edge Functions + Supabase writes |
| **Status** | ✅ Working (notification-send, case-create) |

### 6. Coordinator Agent (MISSING)
| Attribute | Value |
|-----------|-------|
| **Role** | Orchestrate all agents, route tasks |
| **Inputs** | All agent outputs, System state |
| **Outputs** | Task assignments, Priorities, Decisions |
| **Tech** | NEW - needs to be built |
| **Status** | ❌ Missing - needs implementation |

---

## Database Schema

### Table: agent_tasks
```sql
CREATE TABLE agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR(50) NOT NULL,           -- 'athena', 'monitor', 'analyst', etc.
  task_type VARCHAR(100) NOT NULL,        -- 'anomaly_check', 'stockout_predict', etc.
  status VARCHAR(20) DEFAULT 'pending',    -- 'pending', 'running', 'completed', 'failed'
  priority INTEGER DEFAULT 5,              -- 1-10, 1 = highest
  input_data JSONB,                        -- Task parameters
  output_data JSONB,                       -- Task result
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: agent_metrics
```sql
CREATE TABLE agent_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR(50) NOT NULL,
  metric_type VARCHAR(50) NOT NULL,        -- 'tasks_completed', 'avg_duration', 'errors'
  metric_value NUMERIC NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: agent_logs
```sql
CREATE TABLE agent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR(50) NOT NULL,
  task_id UUID REFERENCES agent_tasks(id),
  log_level VARCHAR(20) NOT NULL,         -- 'info', 'warn', 'error'
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Implementation Phases

### Phase 1: Database Foundation (Week 1)

**Goal:** Create tables and basic tracking

| Task | Description | Time | Files |
|------|-------------|------|-------|
| 1.1 | Create `agent_tasks` table | 30 min | Migration |
| 1.2 | Create `agent_metrics` table | 30 min | Migration |
| 1.3 | Create `agent_logs` table | 30 min | Migration |
| 1.4 | Add RLS policies for agents | 30 min | Migration |
| 1.5 | Create seed data for initial metrics | 30 min | Function |

**Deliverables:**
- 3 new tables
- RLS policies
- Basic seed data

---

### Phase 2: Agent Task Router (Week 2)

**Goal:** Build Coordinator that routes tasks to agents

| Task | Description | Time | Files |
|------|-------------|------|-------|
| 2.1 | Create `agent-router` Edge Function | 4 hrs | `supabase/functions/agent-router/index.ts` |
| 2.2 | Implement task creation API | 2 hrs | Function endpoints |
| 2.3 | Implement task status tracking | 2 hrs | Functions + DB |

**Coordinator Logic:**
```typescript
// agent-router logic
async function routeTask(task: TaskRequest) {
  // 1. Create task record
  const taskId = await createTask(task);
  
  // 2. Route based on type
  switch(task.type) {
    case 'anomaly_check':
      return await monitorAgent.run(task);
    case 'stockout_predict':
      return await analystAgent.run(task);
    case 'alert_triage':
      return await triageAgent.run(task);
    case 'user_query':
      return await athenaAgent.run(task);
    default:
      throw new Error(`Unknown task type: ${task.type}`);
  }
  
  // 3. Update task status
  await completeTask(taskId, result);
}
```

---

### Phase 3: Cron Job Triggers (Week 3)

**Goal:** Automate agent execution on schedule

| Task | Description | Time | Files |
|------|-------------|------|-------|
| 3.1 | Setup Supabase Cron for Monitor | 1 hr | pg_cron |
| 3.2 | Setup Supabase Cron for Analyst | 1 hr | pg_cron |
| 3.3 | Setup Supabase Cron for Triage | 1 hr | pg_cron |
| 3.4 | Create cron wrapper Edge Functions | 3 hrs | `supabase/functions/cron-*` |

**Cron Schedule:**
```sql
-- Monitor Agent: Every 5 minutes
SELECT cron.schedule(
  'monitor-check', 
  '*/5 * * * *', 
  'SELECT net.http_post(url:''https://.../functions/v1/agent-router'', body:=''{"task":"anomaly_check"}'');'
);

-- Analyst Agent: Every 15 minutes
SELECT cron.schedule(
  'analyst-check', 
  '*/15 * * * *', 
  'SELECT net.http_post(url:''https://.../functions/v1/agent-router'', body:=''{"task":"stockout_predict"}'');'
);

-- Triage Agent: Every minute (for new alerts)
SELECT cron.schedule(
  'triage-check', 
  '* * * * *', 
  'SELECT net.http_post(url:''https://.../functions/v1/agent-router'', body:=''{"task":"alert_triage"}'');'
);
```

---

### Phase 4: Dashboard Integration (Week 4)

**Goal:** Show real agent data in UI

| Task | Description | Time | Files |
|------|-------------|------|-------|
| 4.1 | Update `agent-orchestration` function | 2 hrs | Returns real data |
| 4.2 | Update `Agents.tsx` to call API | 1 hr | React component |
| 4.3 | Add real-time status updates | 1 hr | Supabase Realtime |

**Dashboard Data Flow:**
```typescript
// Agents.tsx - fetch real data
async function fetchAgentMetrics() {
  // Get task counts per agent
  const { data: taskCounts } = await supabase
    .from('agent_tasks')
    .select('agent_id, status')
    .gte('created_at', 'now() - interval 24 hours');
  
  // Get avg duration per agent
  const { data: avgDuration } = await supabase
    .from('agent_metrics')
    .select('agent_id, metric_value')
    .eq('metric_type', 'avg_duration');
  
  // Combine and return
  return { taskCounts, avgDuration };
}
```

---

## Integration Points

### With Dashboard
```
Dashboard ← reads → agent_metrics
                  ← reads → agent_tasks (recent)
```

### With Alerts
```
Alerts Table ← triggers → Triage Agent
                      ← creates → agent_tasks
                      ← updates → alerts (status)
```

### With Athena Chat
```
Athena Chat ← queries → Knowledge Base
          ← queries → agent_tasks (status)
          ← returns → Real-time agent status
```

### With Inventory
```
Inventory ← read by → Analyst Agent
          ← update → agent_tasks (stockout risk)
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/functions/v1/agent-router` | POST | Route task to agent |
| `/functions/v1/agent-status` | GET | Get all agent statuses |
| `/functions/v1/agent-tasks` | GET | Get task queue |
| `/functions/v1/agent-metrics` | GET | Get agent metrics |
| `/rest/v1/agent_tasks` | CRUD | Task management |
| `/rest/v1/agent_metrics` | CRUD | Metrics storage |
| `/rest/v1/agent_logs` | CRUD | Log storage |

---

## Edge Functions Detail

### 1. agent-router
```typescript
// Main orchestrator
Deno.serve(async (req) => {
  const { task_type, params } = await req.json();
  
  // Log incoming task
  await logAgentEvent('coordinator', 'info', `Routing task: ${task_type}`);
  
  // Route to appropriate agent
  const result = await routeToAgent(task_type, params);
  
  // Log completion
  await logAgentEvent('coordinator', 'info', `Task completed: ${task_type}`);
  
  return Response.json(result);
});
```

### 2. agent-status
```typescript
// Returns current status of all agents
Deno.serve(async (req) => {
  const { data: tasks } = await supabase
    .from('agent_tasks')
    .select('agent_id, status, created_at')
    .gte('created_at', 'now() - interval 1 hour');
  
  const agents = ['athena', 'monitor', 'analyst', 'triage', 'coordinator', 'executor'];
  
  const status = agents.map(agent => ({
    agent_id: agent,
    status: getAgentStatus(agent, tasks), // online/busy/error
    tasks_pending: countTasks(tasks, agent, 'pending'),
    tasks_completed: countTasks(tasks, agent, 'completed'),
    last_activity: getLastActivity(tasks, agent)
  }));
  
  return Response.json({ agents: status });
});
```

---

## Testing Plan

### Unit Tests
| Test | Description | Tool |
|------|-------------|------|
| Task routing | Verify correct agent called | Jest |
| Status calculation | Verify correct status computed | Jest |
| Error handling | Verify graceful failures | Jest |

### Integration Tests
| Test | Description | Tool |
|------|-------------|------|
| Full flow | Alert → Triage → Executor | Postman |
| Cron execution | Verify scheduled runs | Logs |
| Dashboard sync | Verify real-time updates | Browser |

### Load Tests
| Test | Description | Tool |
|------|-------------|------|
| Concurrent tasks | 100 simultaneous tasks | k6 |
| Cron stress | 5-minute cron under load | Logs |

---

## Rollout Plan

### Week 1: Database + Mock UI
```
Day 1-2: Create tables + RLS
Day 3-4: Seed initial data
Day 5: Test dashboard with mock UI + real data
```

### Week 2: Agent Router
```
Day 1-2: Build router function
Day 3-4: Connect to existing agents
Day 5: End-to-end test
```

### Week 3: Automation
```
Day 1-2: Setup cron jobs
Day 3-4: Connect to alerts table
Day 5: Monitor and tune
```

### Week 4: Dashboard + Launch
```
Day 1-2: Update UI with real data
Day 3-4: Real-time updates via Supabase
Day 5: Soft launch to internal users
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Agent uptime | > 99% | `agent_logs` uptime records |
| Task success rate | > 95% | `agent_tasks` completed/total |
| Avg response time | < 5s | `agent_metrics` avg_duration |
| Alerts processed | 100% | Alerts with triage decision |
| Dashboard refresh | < 1s | Real-time subscription |

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Cron timeout | Medium | Batch processing, increase timeout |
| API rate limits | High | Queue system, retry logic |
| Cost overruns | Medium | Monitor Claude API usage |
| Data inconsistencies | Low | Transaction wrapping, validation |

---

## Budget Estimate

| Resource | Quantity | Est. Cost/mo |
|----------|----------|--------------|
| Supabase Pro | 1 | $25 |
| Claude API | 10K calls | $20 |
| Edge Function invocations | 50K | $10 |
| **Total MVP** | | **$55/mo** |

---

## Next Steps

1. **Approve this plan** - Get stakeholder sign-off
2. **Week 1 start** - Create database tables
3. **Daily standups** - Track progress
4. **Weekly demos** - Show working features

---

**Document Status:** Draft  
**Owner:** CyberQuote Team  
**Review Date:** August 5, 2026
