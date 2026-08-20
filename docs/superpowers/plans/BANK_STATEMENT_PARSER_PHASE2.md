# Bank Statement Parser - Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Parse actual bank statements from DBS, OCBC, UOB to extract transactions automatically.

**Architecture:**
- PDF text extraction using pdfplumber (Python) or browser-based extraction
- Bank-specific parsers for each bank format
- Auto-detection of bank type from statement content
- Manual confirmation step before import

---

## Supported Banks & Formats

### DBS Bank
```
Format: Date | Description | Amount | Balance
Example:
01/07/2026 | POS SALES MARINA BAY | +50000.00 | 125000.00
05/07/2026 | ROYALTY PAYMENT HQ | -5000.00 | 120000.00
```

### OCBC Bank
```
Format: Date | Description | Debit | Credit | Balance
Example:
01/07/2026 | POS SALES | 50000.00 | - | 125000.00
05/07/2026 | TRANSFER | - | 25000.00 | 150000.00
```

### UOB Bank
```
Format: Date | Transaction | Amount | Balance
Example:
01/07/2026 | POS SALES MARINA BAY | +50000 | 125000
05/07/2026 | ROYALTY PAYMENT | -5000 | 120000
```

---

## File Structure

```
src/components/
├── BankStatementUpload.tsx          # NEW: PDF upload for bank statements
└── Financing.tsx                    # MODIFY: Add PDF upload option

supabase/functions/
└── bank-statement-parse/            # NEW: Parse bank statements
    └── index.ts

public/
└── templates/
    └── sample_dbs_statement.pdf     # NEW: Sample statement for testing
```

---

## Task 1: Bank Statement Upload Component

**Files:**
- Create: `src/components/BankStatementUpload.tsx`

**Interfaces:**
- Produces: `BankStatementUpload` component
- Consumes: PDF file, userId
- Calls: `/functions/v1/bank-statement-parse`

- [ ] **Step 1: Create component**

```tsx
import React, { useState, useRef } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, X } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';

interface BankStatementUploadProps {
  userId: string;
  onUploadComplete?: (result: any) => void;
}

type UploadStatus = 'idle' | 'uploading' | 'parsing' | 'success' | 'error';

export function BankStatementUpload({ userId, onUploadComplete }: BankStatementUploadProps) {
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload a PDF file');
      return;
    }

    setStatus('parsing');
    setError(null);
    setSuccess(null);

    try {
      // Convert to base64
      const base64 = await fileToBase64(file);

      // Call parsing function
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bank-statement-parse`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            action: 'parse_statement',
            file_data: base64,
            file_name: file.name,
            user_id: userId,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Parsing failed');
      }

      setParsedData(result);
      setShowPreview(true);
      setStatus('idle');

    } catch (err: any) {
      setError(err.message || 'Parsing failed');
      setStatus('error');
    }
  };

  const handleConfirmImport = async () => {
    if (!parsedData) return;
    
    setStatus('uploading');
    setShowPreview(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bank-statement-parse`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            action: 'import_transactions',
            transactions: parsedData.transactions,
            bank_name: parsedData.bank_name,
            statement_period: parsedData.period,
            user_id: userId,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Import failed');
      }

      setSuccess(`Imported ${result.transactions_count} transactions from ${parsedData.bank_name}`);
      onUploadComplete?.(result);

    } catch (err: any) {
      setError(err.message || 'Import failed');
      setStatus('error');
    } finally {
      setStatus('idle');
    }
  };

  return (
    <div className="space-y-4">
      {/* Preview Modal */}
      {showPreview && parsedData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Preview: {parsedData.bank_name}</h3>
                <p className="text-sm text-slate-500">Period: {parsedData.period}</p>
              </div>
              <button onClick={() => setShowPreview(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-auto max-h-[60vh]">
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="text-xs text-green-600">Total Inflow</div>
                  <div className="text-lg font-semibold text-green-700">
                    SGD {parsedData.summary.total_inflow?.toLocaleString()}
                  </div>
                </div>
                <div className="bg-red-50 rounded-lg p-3">
                  <div className="text-xs text-red-600">Total Outflow</div>
                  <div className="text-lg font-semibold text-red-700">
                    SGD {parsedData.summary.total_outflow?.toLocaleString()}
                  </div>
                </div>
                <div className="bg-blue-50 rounded-lg p-3">
                  <div className="text-xs text-blue-600">Net</div>
                  <div className="text-lg font-semibold text-blue-700">
                    SGD {parsedData.summary.net?.toLocaleString()}
                  </div>
                </div>
                <div className="bg-purple-50 rounded-lg p-3">
                  <div className="text-xs text-purple-600">Transactions</div>
                  <div className="text-lg font-semibold text-purple-700">
                    {parsedData.transactions.length}
                  </div>
                </div>
              </div>
              
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 uppercase border-b">
                    <th className="px-2 py-2">Date</th>
                    <th className="px-2 py-2">Description</th>
                    <th className="px-2 py-2">Category</th>
                    <th className="px-2 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedData.transactions.slice(0, 20).map((tx: any, i: number) => (
                    <tr key={i} className="border-b">
                      <td className="px-2 py-2">{tx.date}</td>
                      <td className="px-2 py-2">{tx.description}</td>
                      <td className="px-2 py-2">
                        <span className="px-2 py-0.5 bg-slate-100 rounded text-xs">
                          {tx.category}
                        </span>
                      </td>
                      <td className={`px-2 py-2 text-right ${tx.is_inflow ? 'text-green-600' : 'text-red-600'}`}>
                        {tx.is_inflow ? '+' : '-'}SGD {tx.amount?.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedData.transactions.length > 20 && (
                <p className="text-sm text-slate-500 mt-2">
                  ... and {parsedData.transactions.length - 20} more transactions
                </p>
              )}
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmImport}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                Confirm Import ({parsedData.transactions.length} transactions)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          status !== 'idle' ? 'border-blue-300 bg-blue-50' : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handleFileSelect}
        />
        
        <FileText className="w-12 h-12 mx-auto text-slate-400 mb-4" />
        
        {status === 'parsing' ? (
          <>
            <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-3"></div>
            <p className="text-blue-600 font-medium">Parsing bank statement...</p>
            <p className="text-xs text-slate-500 mt-1">Detecting format and extracting transactions</p>
          </>
        ) : status === 'uploading' ? (
          <>
            <div className="animate-spin w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full mx-auto mb-3"></div>
            <p className="text-green-600 font-medium">Importing transactions...</p>
          </>
        ) : (
          <>
            <p className="text-slate-600 font-medium mb-2">
              Upload Bank Statement PDF
            </p>
            <p className="text-xs text-slate-500 mb-4">
              Supports DBS, OCBC, UOB statements
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              Select PDF
            </button>
          </>
        )}
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          <CheckCircle className="w-4 h-4" />
          <span>{success}</span>
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

---

## Task 2: Bank Statement Parse Edge Function

**Files:**
- Create: `supabase/functions/bank-statement-parse/index.ts`

**Interfaces:**
- Consumes: PDF base64, action
- Produces: Parsed transactions by bank format

- [ ] **Step 1: Create edge function with bank parsers**

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
  if (!auth.authorized) {
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

  if (action === 'parse_statement') {
    try {
      // Decode base64 to binary
      const base64Data = file_data.includes(',') ? file_data.split(',')[1] : file_data;
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Extract text from PDF (simplified - in production use proper PDF parser)
      const text = extractTextFromPDF(bytes);
      
      // Detect bank type
      const bankType = detectBank(text);
      
      // Parse based on bank type
      const parsed = parseBankStatement(text, bankType);
      
      return new Response(JSON.stringify({
        success: true,
        bank_name: bankType,
        period: parsed.period,
        summary: parsed.summary,
        transactions: parsed.transactions,
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

  if (action === 'import_transactions') {
    try {
      const { transactions, bank_name, statement_period, user_id } = body;
      
      // Create snapshot
      const { data: snapshot, error: snapshotError } = await supabase
        .from('cash_flow_snapshots')
        .insert({
          user_id: user_id || auth.userId,
          snapshot_date: new Date().toISOString().split('T')[0],
          source_type: 'PDF',
          source_file: file_name || `${bank_name} Statement`,
          monthly_inflow: transactions.filter((t: any) => t.is_inflow).reduce((s: number, t: any) => s + t.amount, 0),
          monthly_outflow: transactions.filter((t: any) => !t.is_inflow).reduce((s: number, t: any) => s + t.amount, 0),
          net_cash_flow: transactions.reduce((s: number, t: any) => s + (t.is_inflow ? t.amount : -t.amount), 0),
          transaction_count: transactions.length,
          data_quality: 'AUTO_VERIFIED',
          notes: `${bank_name} - ${statement_period}`,
        })
        .select()
        .single();

      if (snapshotError) throw snapshotError;

      // Insert transactions
      const records = transactions.map((t: any) => ({
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
        .insert(records);

      if (txError) throw txError;

      return new Response(JSON.stringify({
        success: true,
        snapshot_id: snapshot.id,
        transactions_count: transactions.length,
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

// Bank detection from statement content
function detectBank(text: string): string {
  const upperText = text.toUpperCase();
  
  if (upperText.includes('DBS') || upperText.includes('DIGITAL BANKING')) {
    return 'DBS';
  }
  if (upperText.includes('OCBC') || upperText.includes('OVERSEAS-CHINESE')) {
    return 'OCBC';
  }
  if (upperText.includes('UOB') || upperText.includes('UNITED OVERSEAS')) {
    return 'UOB';
  }
  if (upperText.includes('CITIBANK') || upperText.includes('CITI')) {
    return 'CITIBANK';
  }
  
  // Default to DBS if unknown
  return 'UNKNOWN';
}

// Parse bank statement based on detected bank type
function parseBankStatement(text: string, bankType: string): any {
  const lines = text.split('\n').filter(l => l.trim());
  const transactions: any[] = [];
  
  let totalInflow = 0;
  let totalOutflow = 0;
  let period = '';

  for (const line of lines) {
    // Try to extract transaction data based on bank format
    let tx = null;

    switch (bankType) {
      case 'DBS':
        tx = parseDBSLine(line);
        break;
      case 'OCBC':
        tx = parseOCBCLine(line);
        break;
      case 'UOB':
        tx = parseUOBLine(line);
        break;
      default:
        tx = parseGenericLine(line);
    }

    if (tx) {
      transactions.push(tx);
      if (tx.is_inflow) {
        totalInflow += tx.amount;
      } else {
        totalOutflow += tx.amount;
      }
    }

    // Try to extract period from header
    if (!period && line.match(/\d{2}[\/\-]\d{2}[\/\-]\d{4}/)) {
      const dates = line.match(/\d{2}[\/\-]\d{2}[\/\-]\d{4}/g);
      if (dates && dates.length >= 2) {
        period = `${dates[0]} - ${dates[dates.length - 1]}`;
      }
    }
  }

  return {
    period: period || 'Unknown',
    summary: {
      total_inflow: totalInflow,
      total_outflow: totalOutflow,
      net: totalInflow - totalOutflow,
    },
    transactions,
  };
}

// DBS Parser: "01/07/2026 | DESCRIPTION | +5000.00 | 125000.00"
function parseDBSLine(line: string): any | null {
  // Match: date | description | amount | balance
  const match = line.match(/(\d{2}[\/\-]\d{2}[\/\-]\d{2,4})\s*[|:]?\s*(.+?)\s*[|:]?\s*([+-]?[\d,]+\.?\d*)\s*[|:]?\s*[\d,]+\.?\d*/i);
  
  if (match) {
    const amount = parseFloat(match[3].replace(/,/g, ''));
    return {
      date: normalizeDate(match[1]),
      description: match[2].trim(),
      amount: Math.abs(amount),
      is_inflow: amount > 0,
      category: categorizeTransaction(match[2]),
      category_detail: match[2].trim().substring(0, 30),
    };
  }
  return null;
}

// OCBC Parser: "01/07/2026 | DESCRIPTION | 5000.00 | | balance"
function parseOCBCLine(line: string): any | null {
  const match = line.match(/(\d{2}[\/\-]\d{2}[\/\-]\d{2,4})\s*[|:]?\s*(.+?)\s*[|:]?\s*([\d,]+\.?\d*)?\s*[|:]?\s*([\d,]+\.?\d*)?/i);
  
  if (match) {
    const debit = match[3] ? parseFloat(match[3].replace(/,/g, '')) : 0;
    const credit = match[4] ? parseFloat(match[4].replace(/,/g, '')) : 0;
    const amount = credit > 0 ? credit : debit;
    const isInflow = credit > 0;
    
    if (amount > 0) {
      return {
        date: normalizeDate(match[1]),
        description: match[2].trim(),
        amount: Math.abs(amount),
        is_inflow: isInflow,
        category: categorizeTransaction(match[2]),
        category_detail: match[2].trim().substring(0, 30),
      };
    }
  }
  return null;
}

// UOB Parser: similar to DBS
function parseUOBLine(line: string): any | null {
  return parseDBSLine(line); // UOB format is similar
}

// Generic fallback parser
function parseGenericLine(line: string): any | null {
  const match = line.match(/(\d{2}[\/\-]\d{2}[\/\-]\d{2,4})\s+(.+?)\s+([+-]?[\d,]+\.?\d*)/i);
  
  if (match) {
    const amount = parseFloat(match[3].replace(/,/g, ''));
    return {
      date: normalizeDate(match[1]),
      description: match[2].trim(),
      amount: Math.abs(amount),
      is_inflow: amount > 0,
      category: categorizeTransaction(match[2]),
      category_detail: match[2].trim().substring(0, 30),
    };
  }
  return null;
}

// Normalize date to YYYY-MM-DD
function normalizeDate(dateStr: string): string {
  const parts = dateStr.split(/[\/\-]/);
  if (parts.length === 3) {
    let day = parts[0].padStart(2, '0');
    let month = parts[1].padStart(2, '0');
    let year = parts[2];
    if (year.length === 2) {
      year = parseInt(year) > 50 ? '19' + year : '20' + year;
    }
    return `${year}-${month}-${day}`;
  }
  return new Date().toISOString().split('T')[0];
}

// Categorize transaction based on description
function categorizeTransaction(description: string): string {
  const desc = description.toUpperCase();
  
  if (desc.includes('SALARY') || desc.includes('PAYROLL') || desc.includes('POS')) {
    return 'INCOME';
  }
  if (desc.includes('TRANSFER') || desc.includes('GIRO') || desc.includes('IBG')) {
    return 'TRANSFER';
  }
  if (desc.includes('ATM') || desc.includes('WITHDRAW')) {
    return 'EXPENSE';
  }
  
  return desc.includes('-') || desc.startsWith('+') ? 'INCOME' : 'EXPENSE';
}

// Extract text from PDF (simplified - returns raw bytes for client-side parsing)
// In production, use proper PDF parsing library
function extractTextFromPDF(bytes: Uint8Array): string {
  // This is a simplified version
  // For actual PDF parsing, use:
  // - Browser: PDF.js
  // - Deno: pdf-parse library
  // - Node: pdf-parse or pdf2text
  
  // For now, return placeholder - actual implementation needs PDF parser
  const decoder = new TextDecoder('utf-8', { fatal: false });
  return decoder.decode(bytes);
}
```

---

## Task 3: Update Financing Component

**Files:**
- Modify: `src/components/Financing.tsx`

- [ ] **Step 1: Add tab toggle between CSV and PDF upload**

Add toggle in Cash Flow tab:
- "CSV Template" (Phase 1)
- "Bank Statement PDF" (Phase 2)

- [ ] **Step 2: Deploy and test**

---

## Testing Checklist

- [ ] Upload DBS sample statement
- [ ] Upload OCBC sample statement
- [ ] Upload UOB sample statement
- [ ] Verify transactions extracted correctly
- [ ] Test import to cash flow
- [ ] View in dashboard

---

## Summary

| Task | Description | Effort |
|------|-------------|--------|
| 1 | Bank Statement Upload Component | 2 hours |
| 2 | Parse Edge Function | 4 hours |
| 3 | Integrate into Financing | 1 hour |
| **Total** | **Phase 2** | **7 hours** |
