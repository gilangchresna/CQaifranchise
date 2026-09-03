# Agent Logs Filter UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add date/time range filter, agent filter, and log level filter to the Agent Logs tab in the AI Agent Orchestration dashboard.

**Architecture:** Extend the existing `Agents.tsx` component with filter state variables and UI controls. Use Supabase REST API filtering (`gte`, `lte`, `eq`) to query `agent_logs` table server-side when possible, with client-side filtering as fallback.

**Tech Stack:** React (existing), Tailwind CSS (existing), Supabase JS client (existing), date-fns or native Date API.

**Spec:** This plan implements the filter enhancement requested for the Agent Logs tab.

---

## Global Constraints

- Follow existing component patterns in `Agents.tsx`
- Use existing `AgentLog` interface (line 46-54)
- Maintain backward compatibility (show all logs if no filter selected)
- Use consistent styling with existing filter controls (Tasks tab has `filterStatus`)

---

## File Structure

```
Modified:
- src/components/Agents.tsx  (998 lines) — Add filter state, UI controls, fetch logic updates
```

---

## Task 1: Add Filter State Variables

**Files:**
- Modify: `src/components/Agents.tsx:157-158` (add new state after existing filters)

**Interfaces:**
- Consumes: Existing React state hooks pattern
- Produces: New state variables: `filterAgent`, `filterDateRange`, `dateFrom`, `dateTo`

- [ ] **Step 1: Add state variables after line 158**

```typescript
const [filterAgent, setFilterAgent] = useState<string>('all');
const [filterDateRange, setFilterDateRange] = useState<string>('today');
const [dateFrom, setDateFrom] = useState<string>('');
const [dateTo, setDateTo] = useState<string>('');
const [isCustomDate, setIsCustomDate] = useState<boolean>(false);
```

- [ ] **Step 2: Add ref for Logs tab section**

Find the Logs tab section in the JSX (around line 600-700) and note the section structure for Step 2 reference.

---

## Task 2: Create Filter UI Component

**Files:**
- Modify: `src/components/Agents.tsx` — Add filter bar HTML after Logs tab header

**Interfaces:**
- Consumes: State variables from Task 1
- Produces: Filter controls rendered in UI

- [ ] **Step 1: Add filter bar JSX after Logs tab header (around line 700)**

Find this structure:
```jsx
<div className="flex items-center justify-between mb-4">
  <h3 className="text-sm font-medium text-slate-700">Logs</h3>
  {/* Add filter controls here */}
</div>
```

Replace with:
```jsx
{/* Filter Bar */}
<div className="bg-slate-50 rounded-lg p-3 mb-4 space-y-3">
  <div className="flex items-center justify-between flex-wrap gap-3">
    <h3 className="text-sm font-medium text-slate-700 flex items-center gap-2">
      <Filter className="w-4 h-4" />
      Filters
    </h3>
    <div className="flex items-center gap-2 flex-wrap">
      {/* Date Range Filter */}
      <select
        value={filterDateRange}
        onChange={(e) => {
          setFilterDateRange(e.target.value);
          setIsCustomDate(e.target.value === 'custom');
          if (e.target.value === 'today') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            setDateFrom(today.toISOString());
            setDateTo(new Date().toISOString());
          } else if (e.target.value === '7days') {
            const week = new Date();
            week.setDate(week.getDate() - 7);
            setDateFrom(week.toISOString());
            setDateTo(new Date().toISOString());
          } else if (e.target.value === '24hours') {
            const day = new Date();
            day.setHours(day.getHours() - 24);
            setDateFrom(day.toISOString());
            setDateTo(new Date().toISOString());
          }
        }}
        className="text-xs px-2 py-1.5 border border-slate-200 rounded-md bg-white"
      >
        <option value="today">Today</option>
        <option value="24hours">Last 24 Hours</option>
        <option value="7days">Last 7 Days</option>
        <option value="custom">Custom Range</option>
      </select>

      {/* Agent Filter */}
      <select
        value={filterAgent}
        onChange={(e) => setFilterAgent(e.target.value)}
        className="text-xs px-2 py-1.5 border border-slate-200 rounded-md bg-white"
      >
        <option value="all">All Agents</option>
        <option value="monitor">Monitor</option>
        <option value="analyst">Analyst</option>
        <option value="coordinator">Coordinator</option>
        <option value="triage">Triage</option>
        <option value="executor">Executor</option>
        <option value="athena">Athena</option>
      </select>

      {/* Level Filter */}
      <select
        value={filterLevel}
        onChange={(e) => setFilterLevel(e.target.value)}
        className="text-xs px-2 py-1.5 border border-slate-200 rounded-md bg-white"
      >
        <option value="all">All Levels</option>
        <option value="info">INFO</option>
        <option value="warn">WARN</option>
        <option value="error">ERROR</option>
        <option value="debug">DEBUG</option>
      </select>

      {/* Clear Filters */}
      {(filterAgent !== 'all' || filterLevel !== 'all' || filterDateRange !== 'today') && (
        <button
          onClick={() => {
            setFilterAgent('all');
            setFilterLevel('all');
            setFilterDateRange('today');
            setIsCustomDate(false);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            setDateFrom(today.toISOString());
            setDateTo(new Date().toISOString());
          }}
          className="text-xs px-2 py-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md"
        >
          Clear Filters
        </button>
      )}
    </div>
  </div>

  {/* Custom Date Range Inputs */}
  {isCustomDate && (
    <div className="flex items-center gap-2">
      <label className="text-xs text-slate-500">From:</label>
      <input
        type="datetime-local"
        value={dateFrom ? dateFrom.slice(0, 16) : ''}
        onChange={(e) => setDateFrom(new Date(e.target.value).toISOString())}
        className="text-xs px-2 py-1.5 border border-slate-200 rounded-md"
      />
      <label className="text-xs text-slate-500">To:</label>
      <input
        type="datetime-local"
        value={dateTo ? dateTo.slice(0, 16) : ''}
        onChange={(e) => setDateTo(new Date(e.target.value).toISOString())}
        className="text-xs px-2 py-1.5 border border-slate-200 rounded-md"
      />
    </div>
  )}

  {/* Active Filter Summary */}
  <div className="text-xs text-slate-500">
    Showing {filteredLogs.length} logs
    {filterAgent !== 'all' && ` from ${filterAgent}`}
    {filterLevel !== 'all' && ` with level ${filterLevel.toUpperCase()}`}
    {` from ${filterDateRange === 'today' ? 'today' : filterDateRange === '24hours' ? 'last 24h' : filterDateRange === '7days' ? 'last 7 days' : 'custom range'}`}
  </div>
</div>
```

- [ ] **Step 2: Test render** — Component should show filter bar above logs table.

---

## Task 3: Update Fetch Logic with Server-Side Filters

**Files:**
- Modify: `src/components/Agents.tsx:375-400` (fetchTasksAndLogs function)

**Interfaces:**
- Consumes: `filterDateRange`, `dateFrom`, `dateTo`, `filterAgent` state
- Produces: Updated Supabase query with filters applied

- [ ] **Step 1: Find the logs fetch section (around line 375)**

Locate this code:
```typescript
const { data: logsData } = await supabase
  .from('agent_logs')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(100);
```

- [ ] **Step 2: Replace with filtered query**

```typescript
// Build date filter
let dateFilter;
if (filterDateRange === 'today') {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dateFilter = today.toISOString();
} else if (filterDateRange === '24hours') {
  const day = new Date();
  day.setHours(day.getHours() - 24);
  dateFilter = day.toISOString();
} else if (filterDateRange === '7days') {
  const week = new Date();
  week.setDate(week.getDate() - 7);
  dateFilter = week.toISOString();
} else if (dateFrom) {
  dateFilter = dateFrom;
} else {
  // Default to last 24 hours
  const day = new Date();
  day.setHours(day.getHours() - 24);
  dateFilter = day.toISOString();
}

// Build query
let logsQuery = supabase
  .from('agent_logs')
  .select('*')
  .gte('created_at', dateFilter)
  .order('created_at', { ascending: false })
  .limit(200);

// Add agent filter if not 'all'
if (filterAgent !== 'all') {
  logsQuery = logsQuery.eq('agent_id', filterAgent);
}

// Add level filter if not 'all' (handle both log_level and level columns)
if (filterLevel !== 'all') {
  logsQuery = logsQuery.or(`log_level.eq.${filterLevel},level.eq.${filterLevel}`);
}

const { data: logsData } = await logsQuery;
```

- [ ] **Step 3: Initialize default date on mount**

Add to `fetchTasksAndLogs` or create a `useEffect` for initialization:

```typescript
useEffect(() => {
  // Initialize date filter on mount
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  setDateFrom(today.toISOString());
  setDateTo(new Date().toISOString());
}, []);
```

- [ ] **Step 4: Test** — Logs should filter by date/agent/level from server.

---

## Task 4: Update Client-Side Filter Logic

**Files:**
- Modify: `src/components/Agents.tsx:479-480` (filteredLogs logic)

**Interfaces:**
- Consumes: `filterDateRange`, `dateFrom`, `dateTo`, `filterAgent` state
- Produces: Updated `filteredLogs` array

- [ ] **Step 1: Replace line 479-480 with enhanced filter**

```typescript
const filteredLogs = logs.filter(l => {
  // Level filter
  if (filterLevel !== 'all' && l.level !== filterLevel) return false;

  // Agent filter
  if (filterAgent !== 'all' && l.agent_id !== filterAgent) return false;

  // Date filter (client-side backup)
  if (dateFrom) {
    const logDate = new Date(l.timestamp || l.created_at);
    if (logDate < new Date(dateFrom)) return false;
  }
  if (dateTo) {
    const logDate = new Date(l.timestamp || l.created_at);
    if (logDate > new Date(dateTo)) return false;
  }

  return true;
});
```

- [ ] **Step 2: Test** — Ensure client-side filtering matches server-side results.

---

## Task 5: Add "Show Full Date" Toggle

**Files:**
- Modify: `src/components/Agents.tsx` — Add date format toggle in logs table header

**Interfaces:**
- Consumes: Existing `formatTime` function
- Produces: New `formatDateTime` function and toggle state

- [ ] **Step 1: Add state for date format**

```typescript
const [showFullDate, setShowFullDate] = useState<boolean>(false);
```

- [ ] **Step 2: Add format function**

```typescript
const formatDateTime = (dateStr: string | null | undefined) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '-';
  if (showFullDate) {
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};
```

- [ ] **Step 3: Add toggle button in filter bar**

```typescript
<button
  onClick={() => setShowFullDate(!showFullDate)}
  className="text-xs px-2 py-1.5 border border-slate-200 rounded-md bg-white hover:bg-slate-50"
  title={showFullDate ? "Show time only" : "Show full date and time"}
>
  {showFullDate ? "Hide Date" : "Show Date"}
</button>
```

- [ ] **Step 4: Update logs table to use formatDateTime**

Find the log timestamp column in the table and replace `formatTime(log.timestamp)` with `formatDateTime(log.timestamp)`.

- [ ] **Step 5: Test** — Click toggle to show/hide full date.

---

## Task 6: Add Export to CSV

**Files:**
- Modify: `src/components/Agents.tsx` — Add export button and function

**Interfaces:**
- Consumes: `filteredLogs` array
- Produces: CSV file download

- [ ] **Step 1: Add export function**

```typescript
const exportLogsToCSV = () => {
  const headers = ['Timestamp', 'Agent', 'Level', 'Message'];
  const rows = filteredLogs.map(log => [
    new Date(log.timestamp || log.created_at).toISOString(),
    log.agent_id || log.agent_name,
    log.level,
    log.message.replace(/"/g, '""') // Escape quotes
  ]);

  const csv = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `agent-logs-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
```

- [ ] **Step 2: Add export button in filter bar**

```typescript
<button
  onClick={exportLogsToCSV}
  className="text-xs px-2 py-1.5 border border-slate-200 rounded-md bg-white hover:bg-slate-50 flex items-center gap-1"
>
  <Download className="w-3 h-3" />
  Export CSV
</button>
```

- [ ] **Step 3: Import Download icon** (if not already imported)

Check imports at top of file and add `Download` to the lucide-react import.

- [ ] **Step 4: Test** — Click Export CSV to download file.

---

## Task 7: Verify and Test

- [ ] **Step 1: Test date filter** — Select "Last 7 Days", verify logs change.

- [ ] **Step 2: Test agent filter** — Select "Monitor", verify only Monitor logs show.

- [ ] **Step 3: Test level filter** — Select "ERROR", verify only errors show.

- [ ] **Step 4: Test custom date range** — Select "Custom Range", pick dates.

- [ ] **Step 5: Test clear filters** — Click "Clear Filters", verify all logs show.

- [ ] **Step 6: Test export** — Click "Export CSV", verify file downloads.

- [ ] **Step 7: Test show/hide date** — Click toggle, verify format changes.

- [ ] **Step 8: Test mobile responsiveness** — Verify filters wrap correctly on small screens.

- [ ] **Step 9: Commit**

```bash
git add src/components/Agents.tsx
git commit -m "feat: add date/agent/level filters and CSV export to Agent Logs"
```

---

## Verification Checklist

- [ ] Date range filter works (Today, 24h, 7 days, Custom)
- [ ] Agent filter works (All, Monitor, Analyst, etc.)
- [ ] Level filter works (All, INFO, WARN, ERROR, DEBUG)
- [ ] Custom date range inputs appear when selected
- [ ] "Clear Filters" button resets all filters
- [ ] "Show Date" toggle shows full datetime
- [ ] "Export CSV" downloads filtered logs
- [ ] Active filter summary shows count and applied filters
- [ ] Filters persist during auto-refresh (30 seconds)
- [ ] No console errors

---

## Dependencies

- None (uses existing dependencies: React, lucide-react, @supabase/supabase-js)

## Estimated Effort

- Tasks 1-2: Filter UI (30 minutes)
- Tasks 3-4: Fetch logic (30 minutes)
- Task 5: Date toggle (15 minutes)
- Task 6: CSV export (20 minutes)
- Task 7: Testing (30 minutes)
- **Total: ~2 hours**

---

## Future Enhancements (Out of Scope)

- Search by message text
- Real-time log streaming via Supabase Realtime
- Log aggregation dashboard (logs per hour/day)
- Error rate charts
- Log retention settings
