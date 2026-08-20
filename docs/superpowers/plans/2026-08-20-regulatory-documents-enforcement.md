# Regulatory Documents Enforcement - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Franchisor uploads regulatory documents; franchisee cannot apply for financing without all required documents.

**Architecture:** HQ Admin (franchisor) uploads country-specific regulatory documents (ACRA, AHU, LKPM, SPT) linked to each franchisee. When franchisee applies for financing, system checks if all required docs exist. If missing, application is blocked with message directing to franchisor.

**Tech Stack:** React + TypeScript + Tailwind + Supabase (PostgreSQL + Edge Functions)

**Spec:** `docs/TEAM_ANALYSIS_REGULATORY_DOCUMENTS.md`

---

## Global Constraints

- Platform: CQaiFranchise (CyberQuote)
- Database: Supabase `ploqeifazcgzwjzmukgp`
- Staging: https://cqaifrc.cqit.sg
- Migration: Run manually in Supabase Dashboard (not via code)
- Roles: HQ_ADMIN (franchisor), REGIONAL_MANAGER, FRANCHISEE_OWNER, FRANCHISEE_STAFF

---

## Document Requirements by Country

| Country | Document Types |
|---------|----------------|
| Singapore (SGP) | `SGP_ACRA_ANNUAL`, `SGP_ACRA_XBRL` |
| Indonesia (IDN) | `IDN_AHU_ANNUAL`, `IDN_LKPM_Q1`, `IDN_LKPM_Q2`, `IDN_LKPM_Q3`, `IDN_LKPM_Q4`, `IDN_DJP_SPT` |

---

## File Structure

```
Modified Files:
- supabase/migrations/YYYYMMDD_regulatory_documents.sql  (new migration)
- src/components/Financing.tsx                          (add doc check on apply)
- src/components/DocumentVault.tsx                      (add HQ upload mode)
- src/components/HQDocumentUpload.tsx                   (new - HQ upload component)
- src/types.ts                                          (add document types)

Created Files:
- supabase/functions/check-required-docs/index.ts       (new edge function)
- docs/FINANCIAL_DOCUMENTS_TABLES.sql                    (already exists)
```

---

## Task Right-Sizing

Each task produces independently testable deliverable.

---

## Tasks

### Task 1: Database Migration - Regulatory Documents Table

**Files:**
- Create: `supabase/migrations/20260820_regulatory_documents.sql`
- Test: Run in Supabase Dashboard

**Interfaces:**
- Produces: `regulatory_documents` table with fields: id, entity_id, uploaded_by_id, country, document_type, file_path, file_name, fiscal_year, period, uploaded_at, verified, verified_by, verified_at

- [ ] **Step 1: Create migration file**

```sql
-- Migration: regulatory_documents table
-- Purpose: Store regulatory filings uploaded by HQ for each franchisee

CREATE TABLE IF NOT EXISTS public.regulatory_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  uploaded_by_id UUID NOT NULL REFERENCES public.auth.users(id),
  country VARCHAR(3) NOT NULL, -- 'SGP' or 'IDN'
  document_type VARCHAR(50) NOT NULL,
  -- Singapore: 'SGP_ACRA_ANNUAL', 'SGP_ACRA_XBRL'
  -- Indonesia: 'IDN_AHU_ANNUAL', 'IDN_LKPM_Q1', 'IDN_LKPM_Q2', 'IDN_LKPM_Q3', 'IDN_LKPM_Q4', 'IDN_DJP_SPT'
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  fiscal_year VARCHAR(10),
  period VARCHAR(10), -- 'Q1_2026', 'Q2_2026', etc.
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  verified BOOLEAN DEFAULT FALSE,
  verified_by UUID REFERENCES public.auth.users(id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX idx_regulatory_docs_entity ON regulatory_documents(entity_id);
CREATE INDEX idx_regulatory_docs_type ON regulatory_documents(document_type);

-- RLS Policies
ALTER TABLE regulatory_documents ENABLE ROW LEVEL SECURITY;

-- HQ can upload for any franchisee
CREATE POLICY "HQ can upload regulatory documents" ON regulatory_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND role = 'HQ_ADMIN'
    )
  );

-- HQ can view all regulatory documents
CREATE POLICY "HQ can view regulatory documents" ON regulatory_documents
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND role = 'HQ_ADMIN'
    )
  );

-- HQ can delete regulatory documents
CREATE POLICY "HQ can delete regulatory documents" ON regulatory_documents
  FOR DELETE TO authenticated
  USING (
    uploaded_by_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND role = 'HQ_ADMIN'
    )
  );

-- Franchisee can view their own documents
CREATE POLICY "Franchisee can view own regulatory documents" ON regulatory_documents
  FOR SELECT TO authenticated
  USING (entity_id = auth.uid());

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER regulatory_documents_updated_at
  BEFORE UPDATE ON regulatory_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

- [ ] **Step 2: Run migration in Supabase Dashboard**

Go to: https://supabase.com/dashboard/project/ploqeifazcgzwjzmukgp/sql/new
Paste SQL and click Run.

- [ ] **Step 3: Verify table created**

```sql
SELECT table_name FROM information_schema.tables WHERE table_name = 'regulatory_documents';
```

Expected: `regulatory_documents`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260820_regulatory_documents.sql
git commit -m "feat: add regulatory_documents table for filing enforcement"
```

---

### Task 2: Create Check Required Docs Edge Function

**Files:**
- Create: `supabase/functions/check-required-docs/index.ts`
- Modify: None

**Interfaces:**
- Consumes: `entity_id` (UUID), `country` (string)
- Produces: `{ valid: boolean, missing_docs: string[], required_docs: string[] }`

- [ ] **Step 1: Create edge function**

```typescript
// supabase/functions/check-required-docs/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Required documents by country
const REQUIRED_DOCS: Record<string, string[]> = {
  SGP: ["SGP_ACRA_ANNUAL", "SGP_ACRA_XBRL"],
  IDN: ["IDN_AHU_ANNUAL", "IDN_LKPM_Q1", "IDN_LKPM_Q2", "IDN_LKPM_Q3", "IDN_LKPM_Q4", "IDN_DJP_SPT"],
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const { entity_id, country } = await req.json();

    if (!entity_id || !country) {
      return new Response(JSON.stringify({ error: "entity_id and country required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get required docs for country
    const requiredDocs = REQUIRED_DOCS[country] || [];

    if (requiredDocs.length === 0) {
      return new Response(JSON.stringify({
        valid: false,
        error: `Unknown country: ${country}`,
        required_docs: [],
        missing_docs: [],
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check which docs exist for this entity
    const { data: existingDocs, error: fetchError } = await supabaseClient
      .from("regulatory_documents")
      .select("document_type")
      .eq("entity_id", entity_id)
      .in("document_type", requiredDocs);

    if (fetchError) {
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find missing docs
    const existingTypes = new Set((existingDocs || []).map((d: any) => d.document_type));
    const missingDocs = requiredDocs.filter(doc => !existingTypes.has(doc));

    const result = {
      valid: missingDocs.length === 0,
      entity_id,
      country,
      required_docs: requiredDocs,
      existing_docs: Array.from(existingTypes),
      missing_docs: missingDocs,
      checked_at: new Date().toISOString(),
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

- [ ] **Step 2: Deploy edge function**

```bash
supabase functions deploy check-required-docs
```

- [ ] **Step 3: Test edge function**

```bash
curl -X POST "https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/check-required-docs" \
  -H "Authorization: Bearer <anon_key>" \
  -H "Content-Type: application/json" \
  -d '{"entity_id": "<user_uuid>", "country": "SGP"}'
```

Expected: Returns `{ valid: false, missing_docs: [...] }` (no docs uploaded yet)

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/check-required-docs/
git commit -m "feat: add check-required-docs edge function"
```

---

### Task 3: HQ Document Upload Component

**Files:**
- Create: `src/components/HQDocumentUpload.tsx`
- Modify: `src/components/DocumentVault.tsx` (add HQ mode)

**Interfaces:**
- Consumes: `entityId` (franchisee UUID), `country`
- Produces: Upload form with doc type selector

- [ ] **Step 1: Create HQDocumentUpload component**

```tsx
// src/components/HQDocumentUpload.tsx
import React, { useState, useEffect } from 'react';
import { Upload, FileText, X, CheckCircle, AlertCircle, Trash2 } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';

interface HQDocumentUploadProps {
  franchiseeId: string;
  franchiseeName: string;
  country: string;
  onUploadComplete?: () => void;
}

interface UploadedDoc {
  id: string;
  document_type: string;
  file_name: string;
  uploaded_at: string;
}

const DOC_TYPES = {
  SGP: [
    { value: 'SGP_ACRA_ANNUAL', label: 'ACRA Annual Return', description: 'Annual return filed with ACRA' },
    { value: 'SGP_ACRA_XBRL', label: 'ACRA XBRL Financials', description: 'XBRL formatted financial statements' },
  ],
  IDN: [
    { value: 'IDN_AHU_ANNUAL', label: 'AHU Annual Report', description: 'Annual report filed with Ministry of Law' },
    { value: 'IDN_LKPM_Q1', label: 'LKPM Q1', description: 'Quarterly investment report - Q1' },
    { value: 'IDN_LKPM_Q2', label: 'LKPM Q2', description: 'Quarterly investment report - Q2' },
    { value: 'IDN_LKPM_Q3', label: 'LKPM Q3', description: 'Quarterly investment report - Q3' },
    { value: 'IDN_LKPM_Q4', label: 'LKPM Q4', description: 'Quarterly investment report - Q4' },
    { value: 'IDN_DJP_SPT', label: 'DJP SPT Tahunan', description: 'Annual tax return filed with DJP' },
  ],
};

export function HQDocumentUpload({ franchiseeId, franchiseeName, country, onUploadComplete }: HQDocumentUploadProps) {
  const { user } = useAuth();
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [selectedType, setSelectedType] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const docTypes = DOC_TYPES[country as keyof typeof DOC_TYPES] || [];

  useEffect(() => {
    fetchUploadedDocs();
  }, [franchiseeId, country]);

  async function fetchUploadedDocs() {
    const { data, error } = await supabase
      .from('regulatory_documents')
      .select('id, document_type, file_name, uploaded_at')
      .eq('entity_id', franchiseeId)
      .eq('country', country)
      .order('uploaded_at', { ascending: false });

    if (!error && data) {
      setUploadedDocs(data);
    }
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !selectedType || !user) return;

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      // Upload to storage
      const filePath = `${franchiseeId}/${country}/${selectedType}/${file.name}`;
      const { error: storageError } = await supabase.storage
        .from('franchise-documents')
        .upload(filePath, file, { upsert: true });

      if (storageError) throw storageError;

      // Save to database
      const { error: dbError } = await supabase
        .from('regulatory_documents')
        .insert({
          entity_id: franchiseeId,
          uploaded_by_id: user.id,
          country,
          document_type: selectedType,
          file_path: filePath,
          file_name: file.name,
          uploaded_at: new Date().toISOString(),
        });

      if (dbError) throw dbError;

      setSuccess(`${file.name} uploaded successfully`);
      setSelectedType('');
      fetchUploadedDocs();
      onUploadComplete?.();

    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(doc: UploadedDoc) {
    if (!confirm(`Delete ${doc.file_name}?`)) return;

    const { error } = await supabase
      .from('regulatory_documents')
      .delete()
      .eq('id', doc.id);

    if (!error) {
      setUploadedDocs(prev => prev.filter(d => d.id !== doc.id));
      setSuccess('Document deleted');
    }
  }

  // Check if doc type already uploaded
  function isUploaded(docType: string) {
    return uploadedDocs.some(d => d.document_type === docType);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900">
          Upload Regulatory Documents
        </h3>
        <p className="text-sm text-slate-500">
          For: <span className="font-medium">{franchiseeName}</span> ({country === 'SGP' ? 'Singapore' : 'Indonesia'})
        </p>
      </div>

      {/* Already Uploaded */}
      {uploadedDocs.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-medium text-green-800 mb-2">Uploaded Documents</h4>
          <div className="space-y-2">
            {uploadedDocs.map(doc => (
              <div key={doc.id} className="flex items-center justify-between bg-white rounded p-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm">{doc.file_name}</span>
                </div>
                <button
                  onClick={() => handleDelete(doc)}
                  className="p-1 text-red-500 hover:bg-red-100 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Missing Documents */}
      <div className="border border-slate-200 rounded-lg p-4">
        <h4 className="font-medium text-slate-700 mb-3">Upload Required Documents</h4>
        
        <div className="grid gap-3 mb-4">
          {docTypes.map(docType => (
            <div
              key={docType.value}
              className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                isUploaded(docType.value)
                  ? 'bg-green-50 border-green-200'
                  : selectedType === docType.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300'
              }`}
              onClick={() => !isUploaded(docType.value) && setSelectedType(docType.value)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{docType.label}</div>
                  <div className="text-sm text-slate-500">{docType.description}</div>
                </div>
                {isUploaded(docType.value) && (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Upload Button */}
        {selectedType && (
          <div className="mt-4">
            <label className="flex items-center justify-center gap-2 w-full p-4 border-2 border-dashed border-blue-300 rounded-lg cursor-pointer hover:bg-blue-50 transition-colors">
              <Upload className="w-5 h-5 text-blue-600" />
              <span className="font-medium text-blue-600">
                {uploading ? 'Uploading...' : 'Select File to Upload'}
              </span>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </label>
          </div>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          <CheckCircle className="w-5 h-5" />
          <span>{success}</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add HQ mode to DocumentVault**

Add this to DocumentVault.tsx to enable HQ to select franchisee and upload docs:

```tsx
// Add to imports
import { HQDocumentUpload } from './HQDocumentUpload';

// Add state for HQ mode
const [hqMode, setHqMode] = useState(false);
const [selectedFranchisee, setSelectedFranchisee] = useState<{id: string, name: string, country: string} | null>(null);
const [franchisees, setFranchisees] = useState<any[]>([]);

// Add useEffect to fetch franchisees when in HQ mode
useEffect(() => {
  if (hqMode && userId) {
    fetchFranchisees();
  }
}, [hqMode, userId]);

async function fetchFranchisees() {
  const { data } = await supabase
    .from('user_profiles')
    .select('id, full_name, country')
    .eq('role', 'FRANCHISEE_OWNER');
  setFranchisees(data || []);
}

// Add HQ toggle button (only for HQ role)
{activeRole === 'HQ' && (
  <div className="mb-4">
    <button
      onClick={() => setHqMode(!hqMode)}
      className={`px-4 py-2 rounded-lg text-sm font-medium ${
        hqMode ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
      }`}
    >
      {hqMode ? 'Switch to My Documents' : 'Upload for Franchisee'}
    </button>
  </div>
)}

// Add franchisee selector and HQDocumentUpload when in HQ mode
{hqMode && (
  <>
    <div className="mb-4">
      <label className="block text-sm font-medium mb-1">Select Franchisee</label>
      <select
        value={selectedFranchisee?.id || ''}
        onChange={(e) => {
          const f = franchisees.find(x => x.id === e.target.value);
          setSelectedFranchisee(f || null);
        }}
        className="w-full rounded-md border border-slate-200 px-3 py-2"
      >
        <option value="">-- Select Franchisee --</option>
        {franchisees.map(f => (
          <option key={f.id} value={f.id}>{f.full_name} ({f.country})</option>
        ))}
      </select>
    </div>
    
    {selectedFranchisee && (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <HQDocumentUpload
          franchiseeId={selectedFranchisee.id}
          franchiseeName={selectedFranchisee.full_name}
          country={selectedFranchisee.country}
        />
      </div>
    )}
  </>
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/HQDocumentUpload.tsx src/components/DocumentVault.tsx
git commit -m "feat: add HQ document upload component for regulatory docs"
```

---

### Task 4: Financing Gate - Block if Docs Missing

**Files:**
- Modify: `src/components/Financing.tsx`

**Interfaces:**
- Consumes: `userId`, `country` from profile
- Calls: `check-required-docs` edge function
- Blocks: Financing application if docs missing

- [ ] **Step 1: Add doc check state**

```tsx
// Add to Financing.tsx state
const [missingDocs, setMissingDocs] = useState<string[]>([]);
const [checkDocsLoading, setCheckDocsLoading] = useState(false);
const [showDocBlockModal, setShowDocBlockModal] = useState(false);
```

- [ ] **Step 2: Add check required docs function**

```tsx
// Add to Financing.tsx

async function checkRequiredDocuments(entityId: string, country: string) {
  setCheckDocsLoading(true);
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return false;

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-required-docs`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ entity_id: entityId, country }),
      }
    );

    const result = await response.json();
    
    if (!result.valid && result.missing_docs?.length > 0) {
      setMissingDocs(result.missing_docs);
      setShowDocBlockModal(true);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error checking docs:', error);
    return true; // Allow through on error
  } finally {
    setCheckDocsLoading(false);
  }
}
```

- [ ] **Step 3: Modify Apply button to check docs first**

Find the Apply button and add doc check:

```tsx
// Find: <button onClick={() => setShowApplyModal(true)}>
// Replace with:

<button
  onClick={async () => {
    // Check required docs first
    const userCountry = 'SGP'; // Get from user profile
    const hasDocs = await checkRequiredDocuments(userId, userCountry);
    if (hasDocs) {
      setShowApplyModal(true);
    }
  }}
  disabled={checkDocsLoading}
  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg shadow-sm"
>
  {checkDocsLoading ? 'Checking...' : 'Apply Now'}
</button>
```

- [ ] **Step 4: Add Block Modal**

Add this JSX before the PDPA Consent Dialog:

```tsx
{/* Doc Block Modal */}
{showDocBlockModal && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
          <h3 className="text-lg font-semibold">Documents Required</h3>
        </div>
        
        <p className="text-slate-600 mb-4">
          Your franchisor has not uploaded the required regulatory documents yet. 
          Financing application is blocked until all required documents are submitted.
        </p>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <h4 className="font-medium text-red-800 mb-2">Missing Documents:</h4>
          <ul className="space-y-1">
            {missingDocs.map(doc => (
              <li key={doc} className="text-sm text-red-700 flex items-center gap-2">
                <X className="w-4 h-4" />
                {doc.replace(/_/g, ' ')}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-sm text-slate-500 mb-4">
          Please contact your franchisor to upload these documents.
        </p>

        <button
          onClick={() => setShowDocBlockModal(false)}
          className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg"
        >
          Close
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/Financing.tsx
git commit -m "feat: block financing if required regulatory docs missing"
```

---

### Task 5: Integration Test

**Files:**
- None (manual testing)

- [ ] **Step 1: Test HQ can upload docs**

1. Login as HQ (steve.gilang@gmail.com)
2. Go to Financing → Document Vault
3. Click "Upload for Franchisee"
4. Select franchisee (alice.sg@franchise.com)
5. Upload ACRA Annual document
6. Verify: Document appears in list

- [ ] **Step 2: Test franchisee blocked without docs**

1. Login as Franchisee (alice.sg@franchise.com)
2. Go to Financing
3. Click "Apply Now"
4. Verify: Modal shows "Documents Required"
5. Verify: Shows list of missing docs
6. Verify: Cannot proceed to apply form

- [ ] **Step 3: Test franchisee can apply with docs**

1. Login as HQ
2. Upload ALL required docs for alice
3. Login as alice
4. Click "Apply Now"
5. Verify: Direct to application form

- [ ] **Step 4: Commit**

```bash
git add docs/
git commit -m "docs: add regulatory docs enforcement test results"
```

---

## Summary

| Task | Description | Hours |
|------|-------------|-------|
| 1 | DB Migration | 0.5 |
| 2 | Check Required Docs Edge Function | 1 |
| 3 | HQ Document Upload Component | 2 |
| 4 | Financing Gate Logic | 1.5 |
| 5 | Integration Test | 1 |
| **Total** | | **6 hours** |

---

## Dependencies

- Task 2 must complete before Task 4
- Task 1 must complete before all others

---

## Verification Checklist

- [ ] `regulatory_documents` table created
- [ ] Edge function deployed and tested
- [ ] HQ can upload docs for franchisee
- [ ] Franchisee sees block modal without docs
- [ ] Franchisee can apply with all docs
- [ ] Git pushed to main
