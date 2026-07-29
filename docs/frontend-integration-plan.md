# CyberQuote Frontend Integration - Implementation Plan

**Version:** 1.0  
**Date:** July 14, 2026  
**Status:** Draft  
**Based on:** Actual codebase analysis + existing documentation

---

## Executive Summary

Frontend integration connects React SPA components to Supabase Edge Functions. Based on analysis of 15 components and 23 edge functions.

---

## Current State Analysis

### Source of Analysis

| Source | Content |
|--------|---------|
| `src/components/*.tsx` | 15 React components |
| `supabase/functions/*` | 23 edge functions |
| `.qoder/repowiki/` | 139 documentation files |
| `src/lib/supabase.ts` | Supabase client config |

---

### Component Integration Status

| Component | Edge Functions Used | Current Status | Data Source |
|-----------|---------------------|----------------|-------------|
| Dashboard.tsx | alerts-list, franchises-list, regions-list | ✅ Integrated | Real API |
| AlertsList.tsx | alerts-list, case-create | ✅ Integrated | Real API |
| Outlets.tsx | franchises-list, regions-list | ✅ Integrated | Real API |
| Workflows.tsx | alerts-list, case-create | ✅ Integrated | Real API |
| Integrations.tsx | ingestion-webhook, pos-connector | ✅ Integrated | Real API |
| Agents.tsx | - | ❌ Mock | mock data |
| Workforce.tsx | - | ❌ Mock | mock data |
| Models.tsx | - | ❌ Mock | mock data |
| Settings.tsx | - | ❌ Mock | mock data |
| AccessManagement.tsx | - | ❌ Mock | mock data |
| AICopilot.tsx | - | ❌ Mock | simulated |

---

### Available Edge Functions by Category

| Category | Functions |
|----------|-----------|
| **Data** | franchises-list, regions-list, alerts-list |
| **ML** | ml-anomaly-score, ml-stockout-risk, ml-batch-score |
| **Cases** | case-create, case-update, case-assigner |
| **Ingestion** | ingestion-csv, ingestion-webhook, pos-connector |
| **Automation** | alert-generator, notification-trigger, sla-escalator |
| **Admin** | pilot-dashboard, seed-data, seed-sales, debug-db |

---

## Missing Edge Functions

Based on component analysis, the following edge functions are needed but don't exist:

| Function | Purpose | Component | Priority |
|----------|---------|-----------|----------|
| agents-list | List AI agents | Agents.tsx | HIGH |
| staff-list | List workforce/staff | Workforce.tsx | HIGH |
| ml-models-list | List ML models | Models.tsx | MEDIUM |
| user-preferences | User settings | Settings.tsx | MEDIUM |
| users-list | List users for access mgmt | AccessManagement.tsx | HIGH |
| chat-completion | AI chat API | AICopilot.tsx | LOW |

---

## Implementation Plan

### Phase 1: Critical Pages (High Priority)

#### 1.1 Agents.tsx Integration

**File:** `src/components/Agents.tsx`

**Current State:** Uses mock data

**Required Edge Function:** `agents-list`

**Function Spec:**
```typescript
// supabase/functions/agents-list/index.ts
POST /functions/v1/agents-list
Response: {
  agents: [{
    id: string,
    name: string,
    type: "ROUTING" | "ESCALATION" | "NOTIFICATION",
    status: "ACTIVE" | "PAUSED" | "ERROR",
    config: object,
    created_at: string
  }],
  total: number
}
```

**Tasks:**
1. Create `agents-list` edge function
2. Replace mock data with API call
3. Add loading/error states
4. Test full CRUD operations

**Effort:** 2 hours

---

#### 1.2 Workforce.tsx Integration

**File:** `src/components/Workforce.tsx`

**Current State:** Uses mock data

**Required Edge Function:** `staff-list`

**Function Spec:**
```typescript
// supabase/functions/staff-list/index.ts
POST /functions/v1/staff-list
Query: ?region_id=1&outlet_id=37
Response: {
  staff: [{
    id: string,
    name: string,
    role: "MANAGER" | "CASHIER" | "COOK" | "WAITER",
    outlet_id: number,
    status: "ACTIVE" | "OFF_DUTY",
    phone: string
  }],
  total: number
}
```

**Tasks:**
1. Create `staff-list` edge function
2. Add `staff` table to schema if needed
3. Replace mock data with API call
4. Test filtering by region/outlet

**Effort:** 2 hours

---

#### 1.3 AccessManagement.tsx Integration

**File:** `src/components/AccessManagement.tsx`

**Current State:** Uses mock data

**Required Edge Function:** `users-list`

**Function Spec:**
```typescript
// supabase/functions/users-list/index.ts
POST /functions/v1/users-list
Query: ?role=HQ_ADMIN&region_id=1
Response: {
  users: [{
    id: string,
    email: string,
    full_name: string,
    role: "HQ_ADMIN" | "REGIONAL_MANAGER" | "FRANCHISEE",
    region_id: number | null,
    outlet_id: number | null,
    is_active: boolean
  }],
  total: number
}
```

**Note:** Uses existing `user_profiles` table

**Tasks:**
1. Create `users-list` edge function using user_profiles table
2. Replace mock data with API call
3. Add role-based filtering
4. Test user CRUD

**Effort:** 2 hours

---

### Phase 2: Dashboard Pages (Medium Priority)

#### 2.1 Models.tsx Integration

**File:** `src/components/Models.tsx`

**Current State:** Uses mock data

**Required Edge Function:** `ml-models-list`

**Function Spec:**
```typescript
// supabase/functions/ml-models-list/index.ts
POST /functions/v1/ml-models-list
Response: {
  models: [{
    id: number,
    name: string,
    type: "ANOMALY" | "STOCKOUT" | "DEMAND",
    version: string,
    status: "PRODUCTION" | "STAGING" | "RETIRED",
    metrics: object,
    provider: string,
    config: object
  }],
  total: number
}
```

**Note:** Uses existing `ml_models` table

**Tasks:**
1. Create `ml-models-list` edge function
2. Replace mock data with API call
3. Add model metrics display
4. Test model status updates

**Effort:** 2 hours

---

#### 2.2 Settings.tsx Integration

**File:** `src/components/Settings.tsx`

**Current State:** Uses mock data

**Required Edge Functions:** `settings-get`, `settings-update`

**Function Spec:**
```typescript
// supabase/functions/settings-get/index.ts
POST /functions/v1/settings-get
Query: ?category=notifications
Response: {
  settings: {
    notifications: { email: true, slack: false, whatsapp: false },
    alerts: { auto_resolve_hours: 24, sla_p0_hours: 1 },
    ml: { anomaly_threshold: 0.7, stockout_days: 3 }
  }
}

// supabase/functions/settings-update/index.ts
POST /functions/v1/settings-update
Body: { category: "notifications", settings: {...} }
Response: { success: boolean }
```

**Tasks:**
1. Create `settings-get` edge function
2. Create `settings-update` edge function
3. Replace mock data with API calls
4. Test settings persistence

**Effort:** 3 hours

---

### Phase 3: AI & Chat (Lower Priority)

#### 3.1 AICopilot.tsx Integration

**File:** `src/components/AICopilot.tsx`

**Current State:** Simulated responses

**Required Edge Function:** `athena-chat`

**Function Spec:**
```typescript
// supabase/functions/athena-chat/index.ts
POST /functions/v1/athena-chat
Body: { message: string, context: object }
Response: { response: string, suggestions: string[] }
```

**Tasks:**
1. Verify `athena-chat` edge function (may already exist)
2. Connect AICopilot to real chat API
3. Add conversation history
4. Test with real queries

**Effort:** 2 hours

---

## Technical Details

### Supabase Client Setup

**File:** `src/lib/supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const EDGE_FUNCTIONS_URL = `${supabaseUrl}/functions/v1`
```

### Fetch Pattern

```typescript
// Pattern used in Dashboard.tsx
const response = await fetch(`${EDGE_FUNCTIONS_URL}/alerts-list`, {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`
  }
})
const data = await response.json()
```

### Error Handling

```typescript
try {
  const response = await fetch(...)
  if (!response.ok) throw new Error('API error')
  const data = await response.json()
} catch (error) {
  console.error('Fetch error:', error)
  setError(error.message)
}
```

---

## Database Schema Requirements

### New Tables Needed

```sql
-- Staff table
CREATE TABLE public.staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  role VARCHAR(50) NOT NULL,
  outlet_id INTEGER REFERENCES public.outlets(id),
  phone VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Settings table
CREATE TABLE public.settings (
  id SERIAL PRIMARY KEY,
  category VARCHAR(50) NOT NULL,
  key VARCHAR(100) NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category, key)
);

-- AI Agents table
CREATE TABLE public.ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  type VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'ACTIVE',
  config JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Testing Plan

### Unit Tests

| Component | Test Case | Expected |
|-----------|-----------|----------|
| agents-list | Returns agents array | Array with id, name, type |
| staff-list | Filter by region | Only staff in region |
| users-list | Filter by role | Only HQ_ADMIN users |

### Integration Tests

| Flow | Test Case | Expected |
|------|-----------|----------|
| Dashboard | Load dashboard | Shows real alerts, outlets |
| Alerts | Click resolve | Alert status changes |
| Workforce | Filter staff | Shows correct staff |

### E2E Tests

| User Story | Steps | Expected |
|------------|-------|----------|
| View dashboard | Login → Dashboard | Real data loads |
| Manage alerts | View → Resolve | Alert resolved |
| View staff | Navigate → Workforce | Staff list shows |

---

## Effort Estimate

| Phase | Tasks | Hours |
|-------|-------|-------|
| Phase 1 | Agents, Workforce, AccessManagement | 6h |
| Phase 2 | Models, Settings | 5h |
| Phase 3 | AICopilot | 2h |
| Testing | Unit, Integration, E2E | 4h |
| **Total** | | **17h** |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| New tables needed | Delay | Create minimal schema first |
| Auth token expiry | Data fails | Add token refresh logic |
| RLS policies | Access blocked | Test with anon key first |
| Edge function cold start | Slow load | Add loading states |

---

## Success Criteria

- [ ] All 11 components use real API data
- [ ] No mock data in production components
- [ ] All edge functions return correct data
- [ ] Loading/error states work properly
- [ ] RBAC enforced at edge layer
- [ ] Performance < 2s page load

---

## Appendix: Edge Function Reference

### Data Functions

| Function | Method | Auth | Purpose |
|----------|--------|------|---------|
| franchises-list | GET | Anon | List outlets |
| regions-list | GET | Anon | List regions |
| alerts-list | GET | Anon | List alerts |

### ML Functions

| Function | Method | Auth | Purpose |
|----------|--------|------|---------|
| ml-anomaly-score | POST | Svc | Score anomaly |
| ml-stockout-risk | POST | Svc | Risk prediction |

### Case Functions

| Function | Method | Auth | Purpose |
|----------|--------|------|---------|
| case-create | POST | Svc | Create case |
| case-update | POST | Svc | Update case |
| case-assigner | POST | Svc | Auto-assign |

---

**Document Created:** July 14, 2026  
**Author:** Hermes Agent  
**Based on:** Codebase analysis + repowiki documentation
