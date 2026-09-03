# AI Agent Orchestration Dashboard — Comprehensive Audit Report

**Date:** September 3, 2026  
**Auditor:** Melvin (AI/ML Engineer)  
**Project:** CQaiFranchise — AI Agent Orchestration Dashboard  
**Supabase Project:** ploqeifazcgzwjzmukgp  
**Dashboard URL:** https://cqaifrc.cqit.sg

---

## 1. FILES INVOLVED

| File | Lines | Purpose |
|------|-------|---------|
| `src/components/Agents.tsx` | 1,246 | Main dashboard (all 3 tabs) |
| `src/lib/supabase.ts` | 31 | Supabase client + edge function helper |
| `src/components/Dashboard.tsx` | ~132-145 | Realtime subscription to `agent_tasks` |

---

## 2. ARCHITECTURE DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────┐
│  React Component: Agents.tsx                                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  State:                                                             │
│  ┌──────────────┐  ┌──────────┐  ┌────────┐  ┌─────────────────────┐│
│  │ agents[]    │  │ tasks[]  │  │ logs[] │  │ stats{...}         ││
│  │ Agent[]     │  │ AgentTask│  │AgentLog│  │ total_tasks_today   ││
│  └──────────────┘  └──────────┘  └────────┘  │ total_completed    ││
│                                                │ total_pending       ││
│                                                │ total_failed        ││
│  ┌──────────────────────────────┐             │ agentPendingCounts  ││
│  │ calculatedMetrics (useMemo)   │             └─────────────────────┘│
│  │ avg_uptime, coordinator_up   │                                  │
│  └──────────────────────────────┘                                  │
│                                                                     │
│  Tabs: ┌────────────┬─────────────┬─────────┐                       │
│        │ Overview   │ Task Pipeline│ Logs   │                       │
│        └────────────┴─────────────┴─────────┘                       │
│                                                                     │
│  Auto-refresh: setInterval(15000ms)                                │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  fetchAgentData()  ───┐                                             │
│                       │                                             │
│  fetchTasksAndLogs() ─┘                                             │
│         │                                                            │
│         ▼                                                            │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  SUPABASE QUERIES (7 queries total)                          │   │
│  │                                                              │   │
│  │  1. pendingData  → agent_tasks WHERE completed_at IS NULL   │   │
│  │  2. completedData → agent_tasks WHERE status='completed'    │   │
│  │                   AND completed_at >= today               │   │
│  │  3. totalToday   → COUNT agent_tasks created_at >= today  │   │
│  │  4. completedToday→ COUNT agent_tasks status='completed'   │   │
│  │                   AND completed_at >= today               │   │
│  │  5. pendingByAgent→ agent_tasks SELECT agent_id, input_data│   │
│  │                    WHERE completed_at IS NULL              │   │
│  │  6. logsQuery    → agent_logs WHERE created_at >= dateFilter│  │
│  │                   .eq(agent_id).or(log_level)             │   │
│  │  7. userOutlets  → outlets WHERE region_id = userRegionId  │   │
│  │                   OR user_outlets WHERE user_id = auth.user │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  SUPABASE TABLES                                            │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐              │   │
│  │  │ agent_tasks│  │ agent_logs │  │ outlets   │              │   │
│  │  │ id (UUID)  │  │ id         │  │ id        │              │   │
│  │  │ agent_id   │  │ agent_id   │  │ region_id │              │   │
│  │  │ status     │  │ log_level  │  └────────────┘              │   │
│  │  │ completed_at│  │ level      │                             │   │
│  │  │ created_at  │  │ message    │                             │   │
│  │  │ started_at  │  │ created_at │                             │   │
│  │  │ input_data  │  │ metadata   │                             │   │
│  │  └────────────┘  └────────────┘                             │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. ALL SUPABASE QUERIES

### 3.1 Tasks Queries

| # | Query | Purpose | Line |
|---|-------|---------|------|
| 1 | `supabase.from('agent_tasks').select('*').is('completed_at', null)` | Fetch ALL pending tasks | 232-236 |
| 2 | `supabase.from('agent_tasks').select('*').eq('status','completed').gte('completed_at', todayStr)` | Fetch completed today (limit 100) | 239-245 |
| 3 | `supabase.from('agent_tasks').select('*', {count:'exact', head:true}).gte('created_at', todayStr)` | Count total tasks today | 248-251 |
| 4 | `supabase.from('agent_tasks').select('*', {count:'exact', head:true}).eq('status','completed').gte('completed_at', todayStr)` | Count completed today | 253-257 |
| 5 | `supabase.from('agent_tasks').select('agent_id, input_data').is('completed_at', null)` | Per-agent pending counts | 260-263 |

### 3.2 Logs Query

| # | Query | Purpose | Line |
|---|-------|---------|------|
| 6 | `supabase.from('agent_logs').select('*').gte('created_at', dateFilter).order('created_at', {ascending:false}).limit(200)` | Fetch logs with date filter | 402-407 |

### 3.3 Outlet Filtering Query

| # | Query | Purpose | Line |
|---|-------|---------|------|
| 7 | `supabase.from('outlets').select('id').eq('region_id', userRegionId)` | Regional: get outlets in region | 179-181 |
| 8 | `supabase.from('user_outlets').select('outlet_id').eq('user_id', user.id)` | Franchisee: get user's outlets | 187-191 |

---

## 4. IDENTIFIED BUGS AND ISSUES

### 🔴 CRITICAL BUGS

#### BUG #1: Stats Total Inconsistency (Line 314-315)
```typescript
const totalTaskCount = (completedToday || 0) + totalPendingCount;
```
**Problem:** `totalPendingCount` is filtered by `userOutlets`, but `completedToday` is NOT filtered by `userOutlets`. For Regional/Franchisee roles, the total is wrong.

**Impact:** Dashboard shows incorrect total task counts for scoped users.

**Fix:** Filter `completedToday` by `userOutlets` OR show "all" counts with a disclaimer.

---

#### BUG #2: Agent Pending Counts Use Filtered `pendingByAgent` (Lines 266-275)
```typescript
const { data: pendingByAgent } = await supabase
  .from('agent_tasks')
  .select('agent_id, input_data')
  .is('completed_at', null);

// ... later ...
for (const task of (pendingByAgent || [])) {
  if (userOutlets.length > 0) {
    const taskOutletId = task.input_data?.outlet_id;
    if (!userOutlets.includes(Number(taskOutletId))) continue;  // ← Filtering HERE
  }
```

**Problem:** The `pendingByAgent` query returns ALL pending tasks from the DB, but the loop filters by `userOutlets`. This creates a mismatch between what's counted and what the user sees in the task list.

**Impact:** Per-agent pending counts don't match displayed pending tasks.

---

#### BUG #3: Agent Completed Counts Missing Outlet Filtering (Lines 278-282)
```typescript
const agentCompletedCounts: Record<string, number> = {};
for (const task of (completedData || [])) {
  // NO userOutlets filtering here!
  const agentId = task.agent_id;
  agentCompletedCounts[agentId] = (agentCompletedCounts[agentId] || 0) + 1;
}
```

**Problem:** `agentCompletedCounts` includes all completed tasks, not just those matching `userOutlets`.

**Impact:** Agent cards show inflated completed counts for scoped users.

---

### 🟡 MAJOR ISSUES

#### ISSUE #4: System Health is HARDCODED (Lines 765-769)
```typescript
<HealthBar label="API Response" value={98} />
<HealthBar label="Database" value={99} />
<HealthBar label="Edge Functions" value={100} />
<HealthBar label="AI Models" value={97} />
<HealthBar label="WebSocket" value={99} />
```

**Problem:** All health values are hardcoded — no actual system health check.

**Impact:** Users see fake health metrics with no real monitoring data.

---

#### ISSUE #5: `avg_response_time_ms` is Always 0 (Line 350)
```typescript
avg_response_time_ms: 0,
```

**Problem:** Agent cards always show 0ms response time because the value is hardcoded.

**Impact:** No real performance metrics visible.

---

#### ISSUE #6: `tasks_running` is Always 0 (Line 348)
```typescript
tasks_running: 0,
```

**Problem:** Running tasks count is hardcoded to 0. There's no query for `status='running'` tasks.

**Impact:** Agent cards never show running tasks, even if they exist.

---

#### ISSUE #7: `tasks_failed` is Always 0 (Lines 321, 349)
```typescript
total_failed: 0,  // Line 321
tasks_failed: 0,  // Line 349
```

**Problem:** Failed task count is hardcoded to 0. No query counts failed tasks.

**Impact:** Dashboard never shows failed tasks.

---

#### ISSUE #8: Logs Level Filter Uses Wrong Field (Line 416)
```typescript
if (filterLevel !== 'all') {
  logsQuery = logsQuery.or(`log_level.eq.${filterLevel},level.eq.${filterLevel}`);
}
```

**Problem:** Query uses `or()` with both `log_level` and `level` fields, but later the code reads `l.log_level` (line 431). The `agent_logs` table has both columns which is confusing.

**Impact:** Log filtering may not work correctly depending on which column the DB uses.

---

### 🟠 MODERATE ISSUES

#### ISSUE #9: `updateAgentsWithTaskCounts` is Dead Code (Lines 221-225)
```typescript
async function updateAgentsWithTaskCounts() {
  // Agents are now updated directly in fetchTasksAndLogs()
  // This function is kept for compatibility but does nothing
  // because setAgents is called inside fetchTasksAndLogs()
}
```

**Problem:** Empty function remains in codebase.

**Impact:** None (dead code), but clutters the file.

---

#### ISSUE #10: Double `agentNames` Declaration (Lines 326-328, 358-360)
```typescript
// First declaration at line 326
const agentNames: Record<string, string> = {
  athena: 'Athena', monitor: 'Monitor', analyst: 'Analyst',
  triage: 'Triage', coordinator: 'Coordinator', executor: 'Executor'
};

// Second declaration at line 358 (in the same function scope!)
const agentNames: Record<string, string> = {
  athena: 'Athena', monitor: 'Monitor', analyst: 'Analyst',
  triage: 'Triage', coordinator: 'Coordinator', executor: 'Executor'
};
```

**Problem:** Same constant declared twice in the same function.

**Impact:** First declaration is shadowed by the second. Minor code smell.

---

#### ISSUE #11: Task Search Box Does Nothing (Lines 783-787)
```typescript
<input
  type="text"
  placeholder="Search tasks..."
  className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
/>
```

**Problem:** The search input has no `onChange` handler and no state backing it.

**Impact:** Search box is non-functional.

---

#### ISSUE #12: Logs Custom Date Filter Not Applied to Query (Lines 1000-1016)
```typescript
{isCustomDate && (
  <input type="datetime-local" value={dateFrom ? dateFrom.slice(0, 16) : ''}
    onChange={(e) => setDateFrom(new Date(e.target.value).toISOString())}
  />
)}
```

**Problem:** Custom date range is set via state, but there's no query refetch when `dateFrom`/`dateTo` changes. The logs are only refetched when `fetchTasksAndLogs()` is called (every 15 seconds).

**Impact:** Custom date filter only takes effect on next auto-refresh, not immediately.

---

#### ISSUE #13: No Realtime Subscription for Logs (Dashboard.tsx has one for tasks)
```typescript
// Dashboard.tsx has:
const agentChannel = supabase
  .channel('agent-tasks')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_tasks' }, ...)
  .subscribe();

// BUT Agents.tsx has NO realtime subscription!
```

**Problem:** The main dashboard gets realtime updates for `agent_tasks`, but the Agents dashboard relies only on 15-second polling.

**Impact:** Stale data for up to 15 seconds.

---

#### ISSUE #14: Component Remount Key is Never Used (Line 112)
```typescript
const [componentKey, setComponentKey] = useState(0);
// ...
// setComponentKey is never called
```

**Problem:** Comment says "Force component to remount on navigation" but the key is never updated.

**Impact:** None currently, but the intended feature doesn't work.

---

### 🟢 MINOR ISSUES

#### ISSUE #15: `completedData` Limit of 100 (Line 245)
```typescript
.limit(100);
```

**Problem:** Only 100 completed tasks are fetched. For busy days, this may not capture all completed tasks.

**Impact:** Low (unlikely to hit 100 completed tasks per day for now).

---

#### ISSUE #16: Tasks Combined List Limited to 200 (Line 310)
```typescript
.slice(0, 200);
```

**Problem:** Combined pending + completed tasks limited to 200 total.

**Impact:** For very active systems, recent history may be truncated.

---

#### ISSUE #17: No Error State for Failed Queries
```typescript
// fetchAgentData catches errors but only logs to console
catch (err) {
  console.error('Error fetching agent data:', err);
  setLoading(false);
}
```

**Problem:** No user-facing error message when queries fail.

**Impact:** Silent failures confuse users.

---

## 5. RECOMMENDATIONS FOR FIXES

### Priority 1 (Critical)

| # | Fix | Approach |
|---|-----|----------|
| 1 | Fix `totalTaskCount` inconsistency | Ensure both `completedToday` and `totalPendingCount` use same filtering logic |
| 2 | Fix per-agent counts | Add proper outlet filtering to all agent count calculations |

### Priority 2 (Major)

| # | Fix | Approach |
|---|-----|----------|
| 3 | Add realtime subscription for Logs | Add Supabase channel subscription like Dashboard.tsx |
| 4 | Replace hardcoded health values | Create edge function or DB view for real health metrics |
| 5 | Add failed task count query | Query `agent_tasks` WHERE `status='failed'` |

### Priority 3 (Moderate)

| # | Fix | Approach |
|---|-----|----------|
| 6 | Implement task search | Add search state + filter function for tasks |
| 7 | Fix custom date filter | Trigger refetch when dateFrom/dateTo changes |
| 8 | Remove dead code | Delete `updateAgentsWithTaskCounts()` function |
| 9 | Consolidate `agentNames` | Move to top-level constant or import |

### Priority 4 (Nice-to-have)

| # | Fix | Approach |
|---|-----|----------|
| 10 | Add query error handling | Show user-friendly error messages |
| 11 | Increase limits if needed | Monitor and increase 100/200 limits as needed |
| 12 | Implement component key reset | Call `setComponentKey` on navigation |

---

## 6. CODE QUALITY ASSESSMENT

| Aspect | Score | Comments |
|--------|-------|----------|
| **Architecture** | 7/10 | Good separation of tabs, clear state management, but missing realtime |
| **Data Flow** | 5/10 | Multiple filtering issues, inconsistent data between queries |
| **Query Efficiency** | 6/10 | 7 queries is acceptable, but some redundancy (2 queries for counts) |
| **Code Organization** | 6/10 | Well-structured components, but dead code and duplicate declarations |
| **Error Handling** | 3/10 | No user-facing errors, silent failures only |
| **Type Safety** | 7/10 | Good TypeScript interfaces, but `any` used in some places |
| **Performance** | 7/10 | 15s polling is acceptable, but realtime would be better |
| **Maintainability** | 6/10 | Large file (1,246 lines), needs refactoring into smaller hooks |

### Overall Grade: **6/10** — Functional but needs fixes

---

## 7. DATA FLOW ANALYSIS

```
User Outlet Filtering:
┌─────────────────────────────────────────────────────────────────┐
│  Regional Role → outlets WHERE region_id = userRegionId        │
│  Franchisee → user_outlets WHERE user_id = auth.user          │
│  HQ → userOutlets = [] (sees all)                             │
└─────────────────────────────────────────────────────────────────┘

Stats Calculation Flow:
┌─────────────────────────────────────────────────────────────────┐
│  completedToday (COUNT) ──┐                                    │
│  totalPendingCount (from   │──► totalTaskCount ──► stats      │
│  filtered pendingByAgent)  │                                    │
└─────────────────────────────────────────────────────────────────┘

Agent Card Data Flow:
┌─────────────────────────────────────────────────────────────────┐
│  agentCompletedCounts ──► tasks_completed_today (WRONG!)        │
│  agentPendingCounts   ──► tasks_pending (WRONG!)               │
│  Hardcoded 0          ──► tasks_running, tasks_failed         │
│  Hardcoded 0          ──► avg_response_time_ms                 │
│  Hardcoded 100        ──► uptime_percent                       │
└─────────────────────────────────────────────────────────────────┘

Logs Flow:
┌─────────────────────────────────────────────────────────────────┐
│  dateFilter (dateFrom/dateTo) ──► gte('created_at')           │
│  filterAgent ──► .eq('agent_id')                              │
│  filterLevel ──► .or('log_level', 'level') ← BUGGY            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. SUMMARY

### What's Working ✅
- Three-tab dashboard structure (Overview, Task Pipeline, Logs)
- Basic stats display with counts
- Agent cards with visual status
- Pagination for tasks
- Log filtering by date, agent, level
- CSV export for logs
- Auto-refresh every 15 seconds

### What's Broken 🔴
- Stats totals don't match filtered view for Regional/Franchisee roles
- Per-agent counts don't match actual displayed tasks
- System health is entirely fake/hardcoded
- No failed task tracking
- No running task tracking
- No realtime updates for logs
- Task search box is non-functional

### Immediate Action Items
1. Fix `totalTaskCount` calculation (Critical)
2. Add failed task count query (Major)
3. Implement realtime subscription for Logs (Major)
4. Replace hardcoded health metrics with real data (Major)

---

**End of Audit Report**
