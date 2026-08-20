# Cash Flow System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a hybrid cash flow system that handles different bank statement formats via Excel template (Phase 1) and AI/OCR parsing (Phase 2).

**Architecture:** 
- Phase 1: Excel template upload with structured data import
- Phase 2: AI-powered OCR parsing for automatic extraction from PDF bank statements
- Both phases use existing `documents` table for storage and `cash_flow_snapshots` for parsed data

**Tech Stack:** 
- React + TypeScript (frontend)
- Supabase Edge Functions (backend)
- Python PDF parsing (Phase 2: marker-pdf or pdfplumber)
- Existing storage bucket: `franchise-documents`

**Spec:** This plan implements the hybrid approach discussed with user - Excel template first, AI parsing later.

---

## File Structure

```
src/components/
├── CashFlowUpload.tsx          # NEW: Excel template upload component
├── CashFlowUploadLegacy.tsx    # NEW: PDF upload for Phase 2
├── CashFlowDashboard.tsx       # NEW: Display cash flow data
└── Financing.tsx               # MODIFY: Add Cash Flow tab

supabase/functions/
├── cashflow-import/            # NEW: Parse Excel and import to DB
├── cashflow-parse-pdf/        # NEW: Phase 2 - PDF OCR parsing
└── lender-bridge/             # MODIFY: Add cashflow action

supabase/migrations/
└── 20260820000000_cashflow_tables.sql  # NEW: cash_flow_snapshots table

docs/
└── templates/
    └── cash_flow_template.xlsx  # NEW: Excel template for manual entry
```

---

## Task 1: Database Migration - Cash Flow Tables

**Files:**
- Create: `supabase/migrations/20260820000000_cashflow_tables.sql`

**Interfaces:**
- Produces: `cash_flow_snapshots` table
- Produces: `cash_flow_transactions` table

- [ ] **Step 1: Create migration file**

```sql
-- ============================================================
-- Cash Flow System Tables
-- Date: 2026-08-20
-- Purpose: Store cash flow data from Excel/PDF uploads
-- ============================================================

-- Cash flow snapshots (monthly summaries)
CREATE TABLE IF NOT EXISTS public.cash_flow_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  source_type VARCHAR(20) NOT NULL, -- 'EXCEL', 'PDF', 'OPEN_BANKING'
  source_file TEXT, -- Original filename if uploaded
  total_balance DECIMAL(14,2),
  monthly_inflow DECIMAL(14,2),
  monthly_outflow DECIMAL(14,2),
  net_cash_flow DECIMAL(14,2),
  transaction_count INTEGER,
  data_quality VARCHAR(20) DEFAULT 'MANUAL', -- 'MANUAL', 'AUTO_VERIFIED', 'AUTO_PENDING'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cash flow transactions (detailed)
CREATE TABLE IF NOT EXISTS public.cash_flow_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID REFERENCES public.cash_flow_snapshots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL,
  description TEXT,
  amount DECIMAL(14,2) NOT NULL,
  category VARCHAR(50), -- 'INCOME', 'EXPENSE', 'TRANSFER'
  category_detail VARCHAR(100), -- 'SALARY', 'RENT', 'UTILITIES', 'INVENTORY', etc
  is_inflow BOOLEAN NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cashflow_snapshots_user ON public.cash_flow_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_cashflow_snapshots_date ON public.cash_flow_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_cashflow_transactions_snapshot ON public.cash_flow_transactions(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_cashflow_transactions_user ON public.cash_flow_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_cashflow_transactions_date ON public.cash_flow_transactions(transaction_date);

-- RLS
ALTER TABLE public.cash_flow_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_flow_transactions ENABLE ROW LEVEL SECURITY;

-- Users can read own data
CREATE POLICY "Users read own cashflow snapshots"
  ON public.cash_flow_snapshots FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own cashflow snapshots"
  ON public.cash_flow_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users read own cashflow transactions"
  ON public.cash_flow_transactions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own cashflow transactions"
  ON public.cash_flow_transactions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- HQ_ADMIN can read all
CREATE POLICY "Admin read all cashflow snapshots"
  ON public.cash_flow_snapshots FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'HQ_ADMIN'
    )
  );

CREATE POLICY "Admin read all cashflow transactions"
  ON public.cash_flow_transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'HQ_ADMIN'
    )
  );

-- Verify
SELECT 'cash_flow_snapshots' as table_name, COUNT(*) as count FROM public.cash_flow_snapshots
UNION ALL
SELECT 'cash_flow_transactions', COUNT(*) FROM public.cash_flow_transactions;
```

- [ ] **Step 2: Run edge function to apply migration**
  - Use existing pattern from `fix-storage-bucket` function
  - Create `apply-cashflow-tables` edge function

- [ ] **Step 3: Verify tables created**
  - Check via REST API or SQL

- [ ] **Step 4: Commit**
```bash
git add supabase/migrations/20260820000000_cashflow_tables.sql
git commit -m "feat: add cash flow snapshots and transactions tables"
```

---

## Task 2: Excel Template & Download Component

**Files:**
- Create: `docs/templates/cash_flow_template.xlsx`
- Create: `src/components/CashFlowTemplateDownload.tsx`

**Interfaces:**
- Produces: `CashFlowTemplateDownload` component
- Consumes: Download link to static Excel file

- [ ] **Step 1: Create Excel template structure**

The Excel template columns:
| Column | Field | Description |
|--------|-------|-------------|
| A | Date | Transaction date (DD/MM/YYYY) |
| B | Description | Transaction description |
| C | Amount | Amount (positive = inflow, negative = outflow) |
| D | Category | INCOME/EXPENSE/TRANSFER |
| E | Category Detail | SALARY/RENT/UTILITIES/INVENTORY/SALES/OTHER |

- [ ] **Step 2: Create download component**

```tsx
import React from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';

interface CashFlowTemplateDownloadProps {
  className?: string;
}

export function CashFlowTemplateDownload({ className = '' }: CashFlowTemplateDownloadProps) {
  const handleDownload = () => {
    // Link to static Excel template
    window.open('/templates/cash_flow_template.xlsx', '_blank');
  };

  return (
    <button
      onClick={handleDownload}
      className={`flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors ${className}`}
    >
      <FileSpreadsheet className="w-4 h-4" />
      Download Excel Template
    </button>
  );
}
```

- [ ] **Step 3: Copy template to public folder**
```bash
cp docs/templates/cash_flow_template.xlsx public/templates/
```

- [ ] **Step 4: Commit**
```bash
git add src/components/CashFlowTemplateDownload.tsx public/templates/
git commit -m "feat: add cash flow Excel template download"
```

---

## Task 3: Cash Flow Upload Component

**Files:**
- Create: `src/components/CashFlowUpload.tsx`

**Interfaces:**
- Produces: `CashFlowUpload` component
- Consumes: `userId` prop, `/functions/v1/cashflow-import` endpoint
- Produces: Uploaded transactions to cash_flow_transactions

- [ ] **Step 1: Create upload component**

```tsx
import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle } from 'lucide-react';

interface CashFlowUploadProps {
  userId: string;
  onUploadComplete?: (snapshotId: string) => void;
}

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

export function CashFlowUpload({ userId, onUploadComplete }: CashFlowUploadProps) {
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setError('Please upload an Excel file (.xlsx or .xls)');
      return;
    }

    setStatus('uploading');
    setError(null);
    setSuccess(null);

    try {
      // Convert to base64
      const base64 = await fileToBase64(file);

      // Call edge function
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cashflow-import`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            action: 'import_excel',
            file_data: base64,
            file_name: file.name,
            user_id: userId,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Import failed');
      }

      setSuccess(`Imported ${result.transactions_count} transactions for ${result.snapshot_date}`);
      setPreviewData(result.transactions || []);
      onUploadComplete?.(result.snapshot_id);

    } catch (err: any) {
      setError(err.message || 'Upload failed');
      setStatus('error');
    } finally {
      setStatus('idle');
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      <div
        className="border-2 border-dashed rounded-lg p-6 text-center transition-colors border-slate-300 hover:border-slate-400"
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleFileSelect}
        />
        
        {status === 'uploading' ? (
          <div className="animate-spin w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full mx-auto mb-2"></div>
        ) : (
          <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
        )}
        
        <p className="text-sm text-slate-600">
          {status === 'uploading' ? 'Processing...' : 'Click to upload Excel file'}
        </p>
        <p className="text-xs text-slate-400 mt-1">.xlsx or .xls (max 10MB)</p>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Success */}
      {success && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          <CheckCircle className="w-4 h-4" />
          {success}
        </div>
      )}
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
```

- [ ] **Step 2: Commit**
```bash
git add src/components/CashFlowUpload.tsx
git commit -m "feat: add cash flow Excel upload component"
```

---

## Task 4: Cash Flow Import Edge Function

**Files:**
- Create: `supabase/functions/cashflow-import/index.ts`

**Interfaces:**
- Consumes: Excel file base64, user_id
- Produces: Parsed transactions, snapshot_id
- Produces: Database records in cash_flow_snapshots and cash_flow_transactions

- [ ] **Step 1: Create edge function**

```typescript
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const auth = await verifyAuth(req);
  if (!auth.authorized || !auth.userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.json();
  const { action, file_data, file_name, user_id } = body;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  if (action === "import_excel") {
    try {
      // Decode base64 to binary
      const binaryString = atob(file_data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Parse Excel (basic - for production use xlsx library)
      // This is a simplified version - full implementation uses xlsx library
      const transactions = parseExcelSimple(bytes);

      // Calculate totals
      const monthly_inflow = transactions
        .filter(t => t.is_inflow)
        .reduce((sum, t) => sum + t.amount, 0);
      
      const monthly_outflow = transactions
        .filter(t => !t.is_inflow)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

      // Create snapshot
      const { data: snapshot, error: snapshotError } = await supabase
        .from('cash_flow_snapshots')
        .insert({
          user_id: user_id || auth.userId,
          snapshot_date: new Date().toISOString().split('T')[0],
          source_type: 'EXCEL',
          source_file: file_name,
          total_balance: monthly_inflow - monthly_outflow,
          monthly_inflow: monthly_inflow,
          monthly_outflow: monthly_outflow,
          net_cash_flow: monthly_inflow - monthly_outflow,
          transaction_count: transactions.length,
          data_quality: 'MANUAL',
        })
        .select()
        .single();

      if (snapshotError) throw snapshotError;

      // Insert transactions
      const transactionRecords = transactions.map(t => ({
        snapshot_id: snapshot.id,
        user_id: user_id || auth.userId,
        transaction_date: t.date,
        description: t.description,
        amount: t.amount,
        category: t.category,
        category_detail: t.category_detail,
        is_inflow: t.is_inflow,
      }));

      const { error: txError } = await supabase
        .from('cash_flow_transactions')
        .insert(transactionRecords);

      if (txError) throw txError;

      return new Response(JSON.stringify({
        success: true,
        snapshot_id: snapshot.id,
        snapshot_date: snapshot.snapshot_date,
        transactions_count: transactions.length,
        transactions: transactionRecords.slice(0, 5), // Preview
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } catch (error: any) {
      return new Response(JSON.stringify({
        success: false,
        error: error.message,
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ error: "Unknown action" }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

// Simple CSV/Excel parser (for production, use proper xlsx library)
function parseExcelSimple(bytes: Uint8Array): any[] {
  // Simplified parser - in production use xlsx npm package
  // This expects binary Excel data
  // For MVP, accept CSV format
  const text = new TextDecoder().decode(bytes);
  const lines = text.split('\n').filter(l => l.trim());
  
  const transactions = [];
  for (let i = 1; i < lines.length; i++) { // Skip header
    const cols = lines[i].split(',');
    if (cols.length >= 4) {
      const amount = parseFloat(cols[2]);
      transactions.push({
        date: cols[0],
        description: cols[1],
        amount: Math.abs(amount),
        category: cols[3] || 'OTHER',
        category_detail: cols[4] || 'OTHER',
        is_inflow: amount > 0,
      });
    }
  }
  return transactions;
}
```

- [ ] **Step 2: Deploy edge function**

- [ ] **Step 3: Commit**
```bash
git add supabase/functions/cashflow-import/
git commit -m "feat: add cashflow-import edge function"
```

---

## Task 5: Cash Flow Dashboard Component

**Files:**
- Create: `src/components/CashFlowDashboard.tsx`

**Interfaces:**
- Produces: `CashFlowDashboard` component
- Consumes: cash_flow_snapshots and cash_flow_transactions data
- Produces: Charts and tables for cash flow visualization

- [ ] **Step 1: Create dashboard component**

```tsx
import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Wallet, Calendar } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';

interface CashFlowDashboardProps {
  userId: string;
}

interface Snapshot {
  id: string;
  snapshot_date: string;
  monthly_inflow: number;
  monthly_outflow: number;
  net_cash_flow: number;
  transaction_count: number;
  source_type: string;
}

export function CashFlowDashboard({ userId }: CashFlowDashboardProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCashFlow();
  }, [userId]);

  async function fetchCashFlow() {
    setLoading(true);
    const { data } = await supabase
      .from('cash_flow_snapshots')
      .select('*')
      .eq('user_id', userId)
      .order('snapshot_date', { ascending: false })
      .limit(12);
    
    setSnapshots(data || []);
    setLoading(false);
  }

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid sm:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <TrendingUp className="w-4 h-4 text-green-600" />
            Monthly Inflow
          </div>
          <div className="text-2xl font-semibold text-slate-900 mt-2">
            SGD {snapshots[0]?.monthly_inflow?.toLocaleString() || 0}
          </div>
        </div>
        
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <TrendingDown className="w-4 h-4 text-red-600" />
            Monthly Outflow
          </div>
          <div className="text-2xl font-semibold text-slate-900 mt-2">
            SGD {snapshots[0]?.monthly_outflow?.toLocaleString() || 0}
          </div>
        </div>
        
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Wallet className="w-4 h-4 text-blue-600" />
            Net Cash Flow
          </div>
          <div className="text-2xl font-semibold mt-2 text-green-600">
            SGD {snapshots[0]?.net_cash_flow?.toLocaleString() || 0}
          </div>
        </div>
        
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Calendar className="w-4 h-4 text-purple-600" />
            Transactions
          </div>
          <div className="text-2xl font-semibold text-slate-900 mt-2">
            {snapshots[0]?.transaction_count || 0}
          </div>
        </div>
      </div>

      {/* Monthly History */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h3 className="font-semibold">Cash Flow History</h3>
        </div>
        {snapshots.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            No cash flow data yet. Upload your Excel template to get started.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase">
                <th className="px-6 py-3">Month</th>
                <th className="px-6 py-3">Inflow</th>
                <th className="px-6 py-3">Outflow</th>
                <th className="px-6 py-3">Net</th>
                <th className="px-6 py-3">Source</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map(s => (
                <tr key={s.id} className="border-t">
                  <td className="px-6 py-4">{s.snapshot_date}</td>
                  <td className="px-6 py-4 text-green-600">
                    SGD {s.monthly_inflow?.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-red-600">
                    SGD {s.monthly_outflow?.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 font-semibold">
                    SGD {s.net_cash_flow?.toLocaleString()}
                  </td>
                  <td className="px-6 py-4">{s.source_type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**
```bash
git add src/components/CashFlowDashboard.tsx
git commit -m "feat: add cash flow dashboard component"
```

---

## Task 6: Integrate Cash Flow Tab into Financing

**Files:**
- Modify: `src/components/Financing.tsx`

**Interfaces:**
- Consumes: `CashFlowUpload`, `CashFlowDashboard`, `CashFlowTemplateDownload` components
- Produces: New "Cash Flow" tab in Financing

- [ ] **Step 1: Add imports**

```tsx
import { CashFlowUpload } from './CashFlowUpload';
import { CashFlowDashboard } from './CashFlowDashboard';
import { CashFlowTemplateDownload } from './CashFlowTemplateDownload';
```

- [ ] **Step 2: Add new tab type**

```tsx
type TabType = 'applications' | 'repayments' | 'risk' | 'documents' | 'cashflow';
```

- [ ] **Step 3: Add tab definition**

```tsx
const tabs = [
  // ... existing tabs ...
  { id: 'cashflow' as const, label: 'Cash Flow', icon: Wallet },
];
```

- [ ] **Step 4: Add tab content**

```tsx
{activeTab === 'cashflow' && (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-lg font-semibold">Bank Cash Flow</h3>
        <p className="text-sm text-slate-500">
          Track your income and expenses from bank statements.
        </p>
      </div>
      <CashFlowTemplateDownload />
    </div>
    
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-xl border p-6">
        <h4 className="font-medium mb-4">Upload Cash Flow Data</h4>
        <CashFlowUpload userId={userId} />
      </div>
      
      <div>
        <CashFlowDashboard userId={userId} />
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 5: Add userId state (or get from session)**

- [ ] **Step 6: Deploy and test**

- [ ] **Step 7: Commit**
```bash
git add src/components/Financing.tsx
git commit -m "feat: integrate cash flow tab into Financing"
```

---

## Task 7: Phase 2 - PDF OCR Parsing (Future)

**Files:**
- Create: `supabase/functions/cashflow-parse-pdf/index.ts`
- Create: `src/components/CashFlowUploadLegacy.tsx`

**This is Phase 2 - implement after Phase 1 is stable**

```typescript
// Phase 2: PDF OCR parsing
// Uses marker-pdf or pdfplumber for extraction
// Handles different bank formats: DBS, OCBC, UOB, etc.

// Parsing rules per bank:
// DBS: Date | Description | Amount | Balance
// OCBC: Date | Description | Debit | Credit | Balance
// UOB: Date | Transaction | Amount | Balance

interface BankParser {
  bank_name: string;
  date_pattern: RegExp;
  amount_pattern: RegExp;
  parse_line(line: string): ParsedTransaction;
}
```

---

## Summary

| Task | Description | Effort | Status |
|------|-------------|--------|--------|
| 1 | Database tables | 1 hour | Pending |
| 2 | Excel template | 1 hour | Pending |
| 3 | Upload component | 2 hours | Pending |
| 4 | Import edge function | 2 hours | Pending |
| 5 | Dashboard component | 2 hours | Pending |
| 6 | Integrate into Financing | 1 hour | Pending |
| **Total** | **Phase 1 MVP** | **9 hours** | |

**Phase 2 (AI/OCR):** ~2 weeks (separate plan)

---

## Testing Checklist

- [ ] Login as Alice
- [ ] Go to Financing → Cash Flow tab
- [ ] Download Excel template
- [ ] Fill template with sample data
- [ ] Upload template
- [ ] Verify transactions imported
- [ ] View dashboard with data
- [ ] Test error handling (wrong format)
