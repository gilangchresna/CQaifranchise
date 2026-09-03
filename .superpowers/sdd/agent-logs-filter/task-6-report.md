# Task 6: Add CSV Export Function and Button to Agent Logs

## Status: ✅ COMPLETE

## Changes Made

### 1. Added `Download` icon import (line 6)
- **File**: `src/components/Agents.tsx`
- **Change**: Added `Download` to the lucide-react import list alongside `Eye, EyeOff`

### 2. Added `exportLogsToCSV` function (after `formatDuration`, around line 532)
- **File**: `src/components/Agents.tsx`
- **Behavior**:
  - Exports the currently filtered `filteredLogs` array
  - Columns: `Timestamp` (ISO 8601), `Agent` (agent_id or agent_name), `Level`, `Message` (with CSV-quote escaping)
  - Filename format: `agent-logs-YYYY-MM-DD.csv`
  - Uses standard Blob + URL.createObjectURL + programmatic `<a>` click pattern

### 3. Added Export CSV button in the filter bar (after Show Date toggle, around line 927)
- **File**: `src/components/Agents.tsx`
- **Placement**: Directly after the "Show Date / Hide Date" toggle button
- **Style**: Matches existing filter bar buttons — `text-xs`, border `border-slate-200`, `rounded-md`, `bg-white hover:bg-slate-50`, with `Download` icon and "Export CSV" label

## Files Modified
- `src/components/Agents.tsx` — 3 patches applied (import, function, button)
