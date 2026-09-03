# Task 5 Report: Add formatDateTime Function

## Summary
Successfully added `formatDateTime` function and updated log timestamp display in `Agents.tsx`.

## Changes Made

### 1. Added `formatDateTime` function (after line 508, following `formatTime`)
- **File**: `src/components/Agents.tsx`
- **Location**: Lines 509-527 (new)
- **Behavior**: 
  - Returns `-` for null/undefined/invalid dates
  - When `showFullDate` is true: returns full date/time in `en-GB` format (e.g., "15 Jan 2024, 10:30:45")
  - When `showFullDate` is false: falls back to time-only format (same as `formatTime`)

### 2. Updated log timestamp display (line 934 → 951)
- **File**: `src/components/Agents.tsx`
- **Change**: `{formatTime(log.timestamp)}` → `{formatDateTime(log.timestamp)}`
- **Impact**: Log entries now display full date when `showFullDate` toggle is enabled

## Verification
Both patches applied successfully with no errors.

## Files Modified
- `/Users/weskonek/WeskonekWeb/CQaiFrh/CQaifranchise/src/components/Agents.tsx`
