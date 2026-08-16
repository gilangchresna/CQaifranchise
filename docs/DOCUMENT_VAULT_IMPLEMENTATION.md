# Document Vault — Implementation Plan
**Date:** 2026-08-16
**Project:** CQaiFranchise (CyberQuote)
**Item:** URS Section 10 — Item 9
**Status:** Pending Implementation
**Effort:** ~5 hours

---

## Overview

Document Vault is a centralized file storage system for franchise loan documents. Supabase Storage infrastructure exists but no bucket, DB table, or upload UI.

**MVP Scope:** Loan application document attachments (KYC, financial statements, contracts)

---

## Pre-Requisite: Free Up Edge Function Slots

**Problem:** 100/100 edge functions deployed (Supabase free limit)

**Safe to Delete (19 functions — one-time use, data already seeded):**

| Function | Reason to Delete |
|---------|-----------------|
| seed-alerts | Data seeded |
| seed-all | Replaced by specific seeds |
| seed-all-region-sales | Redundant |
| seed-all-trans | Redundant |
| seed-all-transactions | Redundant |
| seed-data | Generic, replaced |
| seed-demo-complete | One-time demo |
| seed-embeddings | Data seeded |
| seed-historical-sales | Historical data done |
| seed-inventory | Data seeded |
| seed-ml-models | Data seeded |
| seed-notification-logs | Test data done |
| seed-outlet-features | Data seeded |
| seed-peer-metrics | Data seeded |
| seed-singapore | Redundant |
| seed-singapore-outlets | Redundant |
| seed-stockout-risk | Data seeded |
| seed-test-outlets | One-time test |
| seed-workflow-data | Data seeded |

**Keep (7 functions):** seed-sales, seed-regions-outlets, seed-franchises, seed-staff, seed-user-outlets, seed-regions-outlets-api, seed-regions-outlets-v2

**Delete command:**
```bash
cd cyberquote
supabase functions delete seed-alerts
supabase functions delete seed-all
# ... repeat for all 19
```

---

## Implementation Steps

### Step 1: Create Storage Bucket

**SQL (Supabase Dashboard → SQL Editor):**
```sql
-- Create franchise-documents bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'franchise-documents',
  'franchise-documents',
  false,
  52428800,  -- 50MB
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: allow authenticated uploads to own folder
CREATE POLICY "User upload to franchise-documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'franchise-documents'
  );

CREATE POLICY "User read own documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'franchise-documents'
  );

CREATE POLICY "Admin read all documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'franchise-documents'
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'HQ_ADMIN'
    )
  );
```

---

### Step 2: Create Documents Table

**SQL:**
```sql
-- Documents metadata table
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES public.financing_applications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL,  -- 'KYC_ID', 'BANK_STATEMENT', 'FRANCHISE_CONTRACT', 'FINANCIAL_REPORT', 'OTHER'
  title VARCHAR(255),
  file_name VARCHAR(255) NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type VARCHAR(100),
  file_size_bytes INTEGER,
  uploaded_by UUID REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_documents_application ON public.documents(application_id);
CREATE INDEX IF NOT EXISTS idx_documents_user ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON public.documents(document_type);

-- RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Users can read own documents
CREATE POLICY "Users read own documents"
  ON public.documents FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert own documents
CREATE POLICY "Users insert own documents"
  ON public.documents FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- HQ_ADMIN can read all
CREATE POLICY "Admin read all documents"
  ON public.documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'HQ_ADMIN'
    )
  );
```

---

### Step 3: Create Edge Function — document-upload

**File:** `supabase/functions/document-upload/index.ts`

```typescript
/// <reference lib="deno.ns" />

/**
 * Document Upload Edge Function
 * Handles file upload to Supabase Storage + metadata insert
 *
 * POST /functions/v1/document-upload
 * Content-Type: multipart/form-data
 *
 * Fields:
 *   - file: File binary
 *   - application_id: UUID (optional - link to financing application)
 *   - document_type: KYC_ID | BANK_STATEMENT | FRANCHISE_CONTRACT | FINANCIAL_REPORT | OTHER
 *   - title: string (optional)
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
];
const MAX_SIZE = 50 * 1024 * 1024; // 50MB
const DOC_TYPES = ["KYC_ID", "BANK_STATEMENT", "FRANCHISE_CONTRACT", "FINANCIAL_REPORT", "OTHER"];

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Auth
  const auth = await verifyAuth(req);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const applicationId = formData.get("application_id") as string | null;
    const documentType = formData.get("document_type") as string;
    const title = formData.get("title") as string | null;

    // Validate file
    if (!file || !(file instanceof File)) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (file.size > MAX_SIZE) {
      return new Response(JSON.stringify({ error: "File too large (max 50MB)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return new Response(JSON.stringify({ error: "File type not allowed (PDF, PNG, JPG only)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!documentType || !DOC_TYPES.includes(documentType)) {
      return new Response(JSON.stringify({ error: "Invalid document_type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate storage path
    const ext = file.name.split(".").pop() || "bin";
    const storagePath = `${auth.userId}/${documentType}/${crypto.randomUUID()}.${ext}`;

    // Upload to Storage
    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from("franchise-documents")
      .upload(storagePath, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    // Insert metadata
    const { data: doc, error: insertError } = await supabase
      .from("documents")
      .insert({
        application_id: applicationId || null,
        user_id: auth.userId,
        document_type: documentType,
        title: title || file.name,
        file_name: file.name,
        storage_path: storagePath,
        mime_type: file.type,
        file_size_bytes: file.size,
        uploaded_by: auth.userId,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return new Response(JSON.stringify({
      success: true,
      document: doc,
    }), {
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

---

### Step 4: Create Document Upload Component

**File:** `src/components/DocumentUpload.tsx`

```tsx
import React, { useState, useRef } from 'react';
import { Upload, File, X, Download, Trash2 } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';

interface Document {
  id: string;
  document_type: string;
  title: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  created_at: string;
  storage_path: string;
}

interface DocumentUploadProps {
  applicationId?: string;
  onUploadComplete?: (doc: Document) => void;
  readOnly?: boolean;
}

const DOC_TYPES = [
  { value: 'KYC_ID', label: 'KYC / Identity' },
  { value: 'BANK_STATEMENT', label: 'Bank Statement' },
  { value: 'FRANCHISE_CONTRACT', label: 'Franchise Contract' },
  { value: 'FINANCIAL_REPORT', label: 'Financial Report' },
  { value: 'OTHER', label: 'Other' },
];

export function DocumentUpload({ applicationId, onUploadComplete, readOnly = false }: DocumentUploadProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedType, setSelectedType] = useState('KYC_ID');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = async () => {
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('application_id', applicationId || null)
      .order('created_at', { ascending: false });
    setDocuments(data || []);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('document_type', selectedType);
      if (applicationId) formData.append('application_id', applicationId);

      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/document-upload`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: formData,
        }
      );

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      setDocuments(prev => [result.document, ...prev]);
      onUploadComplete?.(result.document);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  const handleDownload = async (doc: Document) => {
    const { data } = await supabase.storage
      .from('franchise-documents')
      .download(doc.storage_path);
    if (data) {
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (readOnly && documents.length === 0) {
    return <p className="text-sm text-slate-500">No documents attached.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      {!readOnly && (
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            dragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-slate-400'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
          />
          
          <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
          <p className="text-sm text-slate-600 mb-3">
            Drag & drop or <button onClick={() => fileInputRef.current?.click()} className="text-blue-600 hover:underline">browse</button>
          </p>
          
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="border border-slate-200 rounded px-3 py-1.5 text-sm"
          >
            {DOC_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          
          {uploading && <p className="text-sm text-blue-600 mt-2">Uploading...</p>}
          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        </div>
      )}

      {/* Document List */}
      {documents.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-700">Uploaded Documents</h4>
          {documents.map(doc => (
            <div key={doc.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <File className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-slate-700">{doc.title}</p>
                  <p className="text-xs text-slate-500">
                    {DOC_TYPES.find(t => t.value === doc.document_type)?.label} • {formatSize(doc.file_size_bytes)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownload(doc)}
                  className="p-1.5 hover:bg-slate-200 rounded transition-colors"
                  title="Download"
                >
                  <Download className="w-4 h-4 text-slate-600" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

### Step 5: Integrate into Financing.tsx

**Add to Financing.tsx:**

1. Import:
```tsx
import { DocumentUpload } from './DocumentUpload';
```

2. Add state:
```tsx
const [selectedApplication, setSelectedApplication] = useState<FinancingApplication | null>(null);
```

3. Add Documents section in application detail view:
```tsx
{selectedApplication && (
  <div className="mt-4 p-4 bg-slate-50 rounded-lg">
    <h4 className="text-sm font-medium mb-3">Supporting Documents</h4>
    <DocumentUpload applicationId={selectedApplication.id} />
  </div>
)}
```

---

## Testing Checklist

| # | Test | Expected Result |
|---|------|----------------|
| 1 | Upload PDF file | File stored, metadata inserted |
| 2 | Upload image (PNG/JPG) | Success |
| 3 | Upload > 50MB file | Error: "File too large" |
| 4 | Upload invalid type | Error: "File type not allowed" |
| 5 | Franchisee sees own docs | Yes |
| 6 | Franchisee sees other's docs | No (blocked by RLS) |
| 7 | HQ_ADMIN sees all docs | Yes |
| 8 | Download own doc | Signed URL generated, file downloads |
| 9 | Delete application | Cascades to documents |

---

## Files Summary

| Type | Path | Action |
|------|------|--------|
| Migration | `supabase/migrations/20260816000005_storage_bucket.sql` | Create bucket + RLS |
| Migration | `supabase/migrations/20260816000006_documents_table.sql` | Create table + RLS |
| Edge Function | `supabase/functions/document-upload/index.ts` | New |
| Frontend | `src/components/DocumentUpload.tsx` | New |
| Frontend | `src/components/Financing.tsx` | Modify |

---

## Next Steps

1. Delete 19 seed functions → free 19 slots
2. Deploy document-upload edge function
3. Run SQL migrations
4. Test upload flow
5. Update Jarrod report
