# Open Banking & Credit Bureau Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Open Banking (Plaid) and Credit Bureau (Experian) APIs into CQaiFranchise financing platform to enable real-time cash flow analysis and creditworthiness assessment for franchise loan applications.

**Architecture:** 
- Edge Functions layer for API integrations (Supabase Edge Functions)
- New database tables for storing bank connections, cash flow snapshots, and credit reports
- Frontend components for user consent flow and data visualization
- Secure token storage with encryption at rest

**Tech Stack:** 
- Supabase Edge Functions (Deno)
- Plaid API (Open Banking)
- Experian Credit Bureau API
- PostgreSQL (existing)
- React/TypeScript (existing frontend)

**Spec:** This plan implements the P1 requirements from `docs/FRANCHISE_FINANCING_CREDIT_ASSESSMENT_PLAN.md`

---

## Global Constraints

- **Supabase Project:** ploqeifazcgzwjzmukgp
- **Frontend:** CQaiFranchise React app
- **Edge Functions runtime:** Deno
- **API keys:** Stored in Supabase Secrets (not in code)
- **User consent:** Required before any data fetch
- **Data retention:** 24 months, then anonymize

---

## File Structure

```
supabase/
├── functions/
│   ├── open-banking-link/          # NEW: Plaid link token generation
│   │   └── index.ts
│   ├── open-banking-sync/          # NEW: Transaction sync
│   │   └── index.ts
│   ├── credit-bureau-fetch/        # NEW: Experian API
│   │   └── index.ts
│   └── cash-flow-analyzer/         # NEW: Affordability analysis
│       └── index.ts
└── migrations/
    └── 20260820000000_open_banking_credit_bureau.sql

src/
├── components/
│   ├── OpenBankingConnect.tsx       # NEW: Bank connection UI
│   ├── CashFlowDashboard.tsx       # NEW: Cash flow visualization
│   └── CreditReportCard.tsx        # NEW: Credit bureau display
└── pages/
    └── Financing.tsx               # MODIFY: Add new tabs

docs/
├── INTEGRATION_OPEN_BANKING.md     # NEW: API documentation
└── INTEGRATION_CREDIT_BUREAU.md   # NEW: API documentation
```

---

## Task List

### Task 1: Database Migration - Open Banking & Credit Bureau Tables

**Files:**
- Create: `supabase/migrations/20260820000000_open_banking_credit_bureau.sql`
- No tests required (DDL)

**Interfaces:**
- Produces: Tables: `bank_connections`, `cash_flow_snapshots`, `credit_reports`

```sql
-- [ ] Step 1: Create bank_connections table
CREATE TABLE public.bank_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL, -- 'plaid', 'teller', etc
  access_token_encrypted TEXT, -- Encrypted with pgcrypto
  account_ids JSONB DEFAULT '[]',
  institution_name VARCHAR(200),
  institution_id VARCHAR(50),
  last_synced_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, DISCONNECTED, ERROR
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- [ ] Step 2: Create cash_flow_snapshots table
CREATE TABLE public.cash_flow_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  bank_connection_id UUID REFERENCES public.bank_connections(id) ON DELETE SET NULL,
  snapshot_date DATE NOT NULL,
  account_name VARCHAR(200),
  total_balance DECIMAL(14,2),
  monthly_inflow DECIMAL(14,2),
  monthly_outflow DECIMAL(14,2),
  transaction_count INTEGER,
  data_source VARCHAR(20) DEFAULT 'open_banking', -- open_banking, manual
  raw_transactions JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- [ ] Step 3: Create credit_reports table
CREATE TABLE public.credit_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  bureau VARCHAR(20) NOT NULL, -- 'experian', 'equifax'
  report_date DATE NOT NULL,
  score INTEGER,
  score_band VARCHAR(20), -- EXCELLENT, GOOD, FAIR, POOR
  total_debt DECIMAL(14,2),
  credit_limit DECIMAL(14,2),
  utilization_pct DECIMAL(5,2),
  payment_30_days INTEGER DEFAULT 0,
  payment_60_days INTEGER DEFAULT 0,
  payment_90_days INTEGER DEFAULT 0,
  total_accounts INTEGER DEFAULT 0,
  total_trades INTEGER DEFAULT 0,
  raw_report JSONB, -- Full API response
  valid_until DATE,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- [ ] Step 4: Create indexes
CREATE INDEX idx_bank_connections_user ON public.bank_connections(user_id);
CREATE INDEX idx_bank_connections_status ON public.bank_connections(status);
CREATE INDEX idx_cash_flow_user ON public.cash_flow_snapshots(user_id);
CREATE INDEX idx_cash_flow_date ON public.cash_flow_snapshots(snapshot_date DESC);
CREATE INDEX idx_credit_reports_user ON public.credit_reports(user_id);
CREATE INDEX idx_credit_reports_date ON public.credit_reports(report_date DESC);

-- [ ] Step 5: Enable RLS
ALTER TABLE public.bank_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_flow_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_reports ENABLE ROW LEVEL SECURITY;

-- [ ] Step 6: Create RLS policies
CREATE POLICY bank_connections_owner ON public.bank_connections 
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY bank_connections_hq ON public.bank_connections 
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY cash_flow_owner ON public.cash_flow_snapshots 
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY cash_flow_hq ON public.cash_flow_snapshots 
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY credit_reports_owner ON public.credit_reports 
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY credit_reports_hq ON public.credit_reports 
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- [ ] Step 7: Create updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_bank_connections_updated_at
  BEFORE UPDATE ON public.bank_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- [ ] Step 8: Run migration in Supabase Dashboard
-- Copy SQL to: https://supabase.com/dashboard/project/ploqeifazcgzwjzmukgp/sql/new
```

---

### Task 2: Edge Function - open-banking-link

**Files:**
- Create: `supabase/functions/open-banking-link/index.ts`
- Modify: `supabase/functions/_shared/auth-helper.ts` (if needed)

**Interfaces:**
- Consumes: User JWT token
- Produces: `{ link_token: string, expiration: string }`

```typescript
// [ ] Step 1: Create edge function structure
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// [ ] Step 2: Define Plaid configuration
const PLAID_CLIENT_ID = Deno.env.get("PLAID_CLIENT_ID")!;
const PLAID_SECRET = Deno.env.get("PLAID_SECRET")!;
const PLAID_ENV = Deno.env.get("PLAID_ENV") || "sandbox";

const PLAID_PRODUCTS = ["transactions", "auth"];
const PLAID_COUNTRY_CODES = ["SG"]; // Singapore

// [ ] Step 3: Implement create_link_token handler
async function createLinkToken(userId: string, userEmail: string) {
  const response = await fetch(
    `https://${PLAID_ENV}.plaid.com/link/token/create`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "PLAID-CLIENT-ID": PLAID_CLIENT_ID,
        "PLAID-SECRET": PLAID_SECRET,
      },
      body: JSON.stringify({
        user: { client_user_id: userId },
        client_name: "CyberQuote Franchise",
        products: PLAID_PRODUCTS,
        country_codes: PLAID_COUNTRY_CODES,
        language: "en",
        webhook: `${Deno.env.get("SUPABASE_URL")}/functions/v1/open-banking-webhook`,
        redirect_uri: `${Deno.env.get("APP_URL")}/financing/callback`,
      }),
    }
  );
  
  if (!response.ok) {
    throw new Error(`Plaid error: ${response.statusText}`);
  }
  
  const data = await response.json();
  return {
    link_token: data.link_token,
    expiration: data.expiration,
  };
}

// [ ] Step 4: Implement exchange_public_token handler
async function exchangePublicToken(publicToken: string, userId: string) {
  const response = await fetch(
    `https://${PLAID_ENV}.plaid.com/item/public_token/exchange`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "PLAID-CLIENT-ID": PLAID_CLIENT_ID,
        "PLAID-SECRET": PLAID_SECRET,
      },
      body: JSON.stringify({ public_token: publicToken }),
    }
  );
  
  if (!response.ok) {
    throw new Error(`Plaid exchange error: ${response.statusText}`);
  }
  
  const data = await response.json();
  
  // Store encrypted access_token in database
  // Note: Should encrypt with pgcrypto before storing
  return {
    access_token: data.access_token,
    item_id: data.item_id,
  };
}

// [ ] Step 5: Implement main serve handler
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const auth = await verifyAuth(req);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.json();
  const { action } = body;

  try {
    if (action === "create_link_token") {
      const result = await createLinkToken(auth.userId, body.email || "");
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "exchange_token") {
      const { public_token } = body;
      const result = await exchangePublicToken(public_token, auth.userId);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

**Testing:**
```bash
# [ ] Step 6: Deploy edge function
cd /Users/weskonek/WeskonekWeb/CQaiFrh/CQaifranchise
supabase functions deploy open-banking-link

# [ ] Step 7: Test create_link_token
curl -X POST "https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/open-banking-link" \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"action": "create_link_token", "email": "alice@franchise.com"}'
```

---

### Task 3: Edge Function - open-banking-sync

**Files:**
- Create: `supabase/functions/open-banking-sync/index.ts`

**Interfaces:**
- Consumes: `access_token` from `bank_connections` table
- Produces: `{ accounts: Account[], transactions: Transaction[], last_synced: string }`

```typescript
// [ ] Step 1: Create sync function
// Fetches latest transactions and balance from Plaid

// [ ] Step 2: Implement get_accounts
async function getAccounts(accessToken: string) {
  const response = await fetch(
    `https://${PLAID_ENV}.plaid.com/accounts/balance/get`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "PLAID-CLIENT-ID": PLAID_CLIENT_ID,
        "PLAID-SECRET": PLAID_SECRET,
      },
      body: JSON.stringify({
        access_token: accessToken,
        options: { snapshot_dates: true },
      }),
    }
  );
  return response.json();
}

// [ ] Step 3: Implement get_transactions
async function getTransactions(accessToken: string, startDate: string, endDate: string) {
  const response = await fetch(
    `https://${PLAID_ENV}.plaid.com/transactions/get`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "PLAID-CLIENT-ID": PLAID_CLIENT_ID,
        "PLAID-SECRET": PLAID_SECRET,
      },
      body: JSON.stringify({
        access_token: accessToken,
        start_date: startDate,
        end_date: endDate,
        options: {
          count: 500,
          offset: 0,
        },
      }),
    }
  );
  return response.json();
}

// [ ] Step 4: Calculate cash flow metrics
function calculateCashFlowMetrics(transactions: any[]) {
  const inflow = transactions
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  
  const outflow = transactions
    .filter(t => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);
  
  return {
    monthly_inflow: Math.round(inflow * 100) / 100,
    monthly_outflow: Math.round(outflow * 100) / 100,
    net_cash_flow: Math.round((inflow - outflow) * 100) / 100,
    transaction_count: transactions.length,
  };
}

// [ ] Step 5: Deploy and test
# supabase functions deploy open-banking-sync
```

---

### Task 4: Edge Function - credit-bureau-fetch

**Files:**
- Create: `supabase/functions/credit-bureau-fetch/index.ts`

**Interfaces:**
- Consumes: User ID, NRIC/FIN number
- Produces: `{ score: number, score_band: string, total_debt: number, utilization: number }`

```typescript
// [ ] Step 1: Create credit bureau function
// Uses Experian Singapore API for credit reports

// [ ] Step 2: Implement fetch_credit_report
async function fetchCreditReport(userId: string, idNumber: string) {
  // Experian Singapore API endpoint
  const response = await fetch(
    "https://api.experian.sg/v1/credit-report",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": Deno.env.get("EXPERIAN_API_KEY")!,
      },
      body: JSON.stringify({
        applicant_id: userId,
        id_type: "NRIC",
        id_number: idNumber,
        purpose: "franchise_loan_assessment",
        consent: true,
      }),
    }
  );
  
  if (!response.ok) {
    throw new Error(`Experian API error: ${response.status}`);
  }
  
  return response.json();
}

// [ ] Step 3: Implement score normalization
function normalizeScore(rawScore: number, maxScore: number = 2000) {
  // Convert to 0-100 scale for consistency
  return Math.round((rawScore / maxScore) * 100);
}

// [ ] Step 4: Deploy and test
# supabase functions deploy credit-bureau-fetch
```

---

### Task 5: Edge Function - cash-flow-analyzer

**Files:**
- Create: `supabase/functions/cash-flow-analyzer/index.ts`

**Interfaces:**
- Consumes: User ID, existing debt from `debt_obligations` table
- Produces: `{ affordability_score: number, debt_service_ratio: number, recommendation: string }`

```typescript
// [ ] Step 1: Create cash flow analyzer function

// [ ] Step 2: Calculate debt service ratio
function calculateDSR(
  monthlyNetFlow: number,
  existingMonthlyDebt: number,
  proposedLoanPayment: number
) {
  const totalDebtService = existingMonthlyDebt + proposedLoanPayment;
  const dsr = (totalDebtService / monthlyNetFlow) * 100;
  return Math.round(dsr * 100) / 100;
}

// [ ] Step 3: Calculate affordability score
function calculateAffordabilityScore(dsr: number, cashFlowStability: number) {
  // DSR weight: 60%
  // Stability weight: 40%
  let dsrScore = 100;
  if (dsr > 50) dsrScore = 0;
  else if (dsr > 40) dsrScore = 40;
  else if (dsr > 30) dsrScore = 60;
  else if (dsr > 20) dsrScore = 80;
  
  return Math.round((dsrScore * 0.6) + (cashFlowStability * 0.4));
}

// [ ] Step 4: Generate recommendation
function generateRecommendation(
  affordabilityScore: number,
  creditScore: number,
  riskScore: number
) {
  const avgScore = (affordabilityScore + creditScore + (100 - riskScore)) / 3;
  
  if (avgScore >= 80) return "APPROVED";
  if (avgScore >= 60) return "CONDITIONAL_APPROVAL";
  if (avgScore >= 40) return "MANUAL_REVIEW";
  return "DECLINED";
}

// [ ] Step 5: Deploy and test
# supabase functions deploy cash-flow-analyzer
```

---

### Task 6: Frontend - OpenBankingConnect Component

**Files:**
- Create: `src/components/OpenBankingConnect.tsx`

**Interfaces:**
- Props: `{ onConnected: () => void }`
- Emits: Calls `open-banking-link` edge function

```tsx
// [ ] Step 1: Create bank connection UI component
// Features:
// - "Connect Bank Account" button (initiates Plaid Link)
// - List of connected accounts
// - "Disconnect" option per account
// - Sync status indicator

// [ ] Step 2: Implement Plaid Link integration
// Use @plaid/react-plaid-link package

import { usePlaidLink, PlaidLinkOptions, PlaidLinkOnSuccess } from "react-plaid-link";

// [ ] Step 3: Handle success callback
const onSuccess: PlaidLinkOnSuccess = (publicToken, metadata) => {
  // Exchange token and store connection
  fetch(`${API}/open-banking-link`, {
    method: "POST",
    body: JSON.stringify({
      action: "exchange_token",
      public_token: publicToken,
    }),
  });
};

// [ ] Step 4: Add to Financing.tsx
// Import and render OpenBankingConnect component
```

---

### Task 7: Frontend - CashFlowDashboard Component

**Files:**
- Create: `src/components/CashFlowDashboard.tsx`

**Interfaces:**
- Props: `{ userId: string }`
- Displays: Monthly inflow/outflow chart, balance trend, transaction list

```tsx
// [ ] Step 1: Create cash flow visualization
// Features:
// - Line chart: Balance over time
// - Bar chart: Monthly inflow vs outflow
// - Summary cards: Avg inflow, avg outflow, net cash flow
// - Recent transactions list

// [ ] Step 2: Fetch cash flow data
useEffect(() => {
  fetchCashFlowSnapshots(userId).then(setSnapshots);
}, [userId]);

// [ ] Step 3: Add to Financing.tsx tab
```

---

### Task 8: Frontend - CreditReportCard Component

**Files:**
- Create: `src/components/CreditReportCard.tsx`

**Interfaces:**
- Props: `{ userId: string }`
- Displays: Credit score gauge, debt summary, payment history

```tsx
// [ ] Step 1: Create credit report display
// Features:
// - Credit score gauge (0-2000)
// - Score band badge (EXCELLENT/GOOD/FAIR/POOR)
// - Total debt, credit limit, utilization
// - Late payment counts (30/60/90 days)
// - "Fetch New Report" button

// [ ] Step 2: Add to Financing.tsx tab
```

---

### Task 9: Integration - Financing.tsx Enhancement

**Files:**
- Modify: `src/components/Financing.tsx`

**Changes:**
```tsx
// [ ] Step 1: Add new tab "Cash Flow"
const [activeTab, setActiveTab] = useState<'applications' | 'repayments' | 'risk' | 'cashflow' | 'credit'>('applications');

// [ ] Step 2: Render new components
{activeTab === 'cashflow' && (
  <>
    <OpenBankingConnect onConnected={refreshAccounts} />
    <CashFlowDashboard userId={userId} />
  </>
)}

{activeTab === 'credit' && (
  <CreditReportCard userId={userId} />
)}
```

---

### Task 10: Documentation

**Files:**
- Create: `docs/INTEGRATION_OPEN_BANKING.md`
- Create: `docs/INTEGRATION_CREDIT_BUREAU.md`

**Content:**
```markdown
# [ ] Open Banking Integration Guide

## Prerequisites
- Plaid account (Sandbox for development)
- Supabase project with Edge Functions

## Setup Steps
1. Create Plaid account at plaid.com
2. Get API credentials
3. Add to Supabase secrets:
   - PLAID_CLIENT_ID
   - PLAID_SECRET
   - PLAID_ENV (sandbox/development/production)
4. Configure webhook URL
5. Test with sandbox credentials

## API Endpoints
- POST /functions/v1/open-banking-link
- POST /functions/v1/open-banking-sync
- POST /functions/v1/open-banking-webhook

## Testing
- Use Plaid Sandbox
- Test users: plaid_test, etc.
```

---

## Self-Review Checklist

1. **Spec coverage:** All P1 requirements from credit assessment plan covered?
   - [x] Open Banking integration
   - [x] Credit Bureau API
   - [x] Cash flow analysis
   - [x] Frontend components
   - [x] Database tables

2. **Placeholder scan:** Any "TBD" or incomplete sections?
   - [ ] Review all steps are complete

3. **Type consistency:** Function names match across tasks?
   - [ ] open-banking-link → create_link_token, exchange_token
   - [ ] open-banking-sync → get_accounts, get_transactions
   - [ ] credit-bureau-fetch → fetch_credit_report
   - [ ] cash-flow-analyzer → calculateDSR, calculateAffordabilityScore

---

## Execution Options

**Plan complete and saved to `docs/superpowers/plans/OPEN_BANKING_CREDIT_BUREAU_INTEGRATION.md`**

Two execution options:

**1. Subagent-Driven (recommended)**
I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution**
Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
