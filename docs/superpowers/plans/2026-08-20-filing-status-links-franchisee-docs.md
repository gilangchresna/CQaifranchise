# Filing Status Links & Franchisee Documents - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add filing status links to franchisee/franchisor profiles + allow franchisee to upload own documents.

**Architecture:** Filing status links are URL fields stored in user_profiles. Franchisee can upload documents to supplement franchisor-uploaded docs. Both feed into the financing gate check.

**Tech Stack:** React + TypeScript + Tailwind + Supabase

**Spec:** Team analysis from Jarrod's requirements (Aug 20, 2026)

---

## Context

### Current State
| Component | Status |
|-----------|--------|
| regulatory_documents table | ✅ Created |
| check-required-docs edge function | ✅ Deployed |
| HQ Document Upload | ✅ Built |
| Financing Gate (block if docs missing) | ✅ Built |
| Filing Status Links | ❌ Not built |
| Franchisee Own Doc Upload | ❌ Not built |

### Requirements from Jarrod
1. **Filing Status Links**: Store links to official platforms (bizfile.gov.sg, ahu.go.id, oss.go.id, pajak.go.id)
2. **Franchisee Own Docs**: Franchisee can upload their own documents (LKPT, financial statements)
3. **Both Roles**: Links needed for both Franchisor AND Franchisee profiles

---

## Filing Status Links

### Filing Links by Country

| Country | Filing | Official Platform | URL Pattern |
|---------|--------|-------------------|-------------|
| **Singapore** | ACRA Annual Return | BizFile+ | https://bizfile.gov.sg |
| **Indonesia** | AHU Annual Report | AHU Online | https://ahu.go.id |
| **Indonesia** | LKPM | OSS | https://oss.go.id |
| **Indonesia** | SPT Tahunan | DJP | https://pajak.go.id |

---

## Tasks

### Task 1: Database Migration - Add Filing Links to user_profiles

**Files:**
- Create: `supabase/migrations/20260820_filing_links.sql`

**Interfaces:**
- Produces: `filing_links` JSONB column in `user_profiles` table

- [ ] **Step 1: Create migration**

```sql
-- Add filing_links JSONB column to user_profiles
-- Stores links to official regulatory filing platforms

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS filing_links JSONB DEFAULT '{
  "sg": {
    "acra_bizfile": null,
    "acra_xbrl": null
  },
  "id": {
    "ahu_annual": null,
    "oss_lkpm": null,
    "djp_spt": null
  }
}'::jsonb;

-- Add filing status enum column
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS filing_status VARCHAR(20) DEFAULT 'PENDING'
CHECK (filing_status IN ('FILED', 'PENDING', 'OVERDUE'));

-- Add last_verified_at timestamp
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS filing_links_verified_at TIMESTAMPTZ;

COMMENT ON COLUMN public.user_profiles.filing_links IS 'JSON object storing filing status URLs for each country regulatory platform';
```

- [ ] **Step 2: Run in Supabase Dashboard**

Go to: https://supabase.com/dashboard/project/ploqeifazcgzwjzmukgp/sql/new
Paste SQL, click Run.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260820_filing_links.sql
git commit -m "feat: add filing_links column to user_profiles"
```

---

### Task 2: Create FilingLinksEdit Component

**Files:**
- Create: `src/components/FilingLinksEdit.tsx`

**Interfaces:**
- Props: `userId`, `profileData`
- Produces: Form to edit filing links + display current status

- [ ] **Step 1: Create FilingLinksEdit.tsx**

```tsx
// src/components/FilingLinksEdit.tsx
import React, { useState } from 'react';
import { ExternalLink, Check, AlertCircle, Globe, Save } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';

interface FilingLinksEditProps {
  userId: string;
  initialData?: {
    filing_links?: any;
    filing_status?: string;
    filing_links_verified_at?: string;
  };
  onSave?: () => void;
}

interface FilingLink {
  acra_bizfile?: string;
  acra_xbrl?: string;
  ahu_annual?: string;
  oss_lkpm?: string;
  djp_spt?: string;
}

const FILING_PLATFORMS = {
  sg: [
    { key: 'acra_bizfile', label: 'ACRA BizFile+', url: 'https://bizfile.gov.sg', description: 'Singapore company annual return' },
    { key: 'acra_xbrl', label: 'ACRA XBRL', url: 'https://bizfile.gov.sg', description: 'XBRL financial statements' },
  ],
  id: [
    { key: 'ahu_annual', label: 'AHU Annual Report', url: 'https://ahu.go.id', description: 'Indonesia annual company report' },
    { key: 'oss_lkpm', label: 'BKPM OSS (LKPM)', url: 'https://oss.go.id', description: 'Investment realization report' },
    { key: 'djp_spt', label: 'DJP SPT Tahunan', url: 'https://pajak.go.id', description: 'Annual tax return' },
  ],
};

export function FilingLinksEdit({ userId, initialData, onSave }: FilingLinksEditProps) {
  const [links, setLinks] = useState<FilingLink>(initialData?.filing_links || {});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'sg' | 'id'>('sg');

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      // Determine filing status based on links
      const sgLinks = links.acra_bizfile || links.acra_xbrl;
      const idLinks = links.ahu_annual || links.oss_lkpm || links.djp_spt;
      const filingStatus = (sgLinks || idLinks) ? 'FILED' : 'PENDING';

      const { error } = await supabase
        .from('user_profiles')
        .update({
          filing_links: links,
          filing_status: filingStatus,
          filing_links_verified_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) throw error;

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onSave?.();

    } catch (err: any) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function updateLink(key: string, value: string) {
    setLinks(prev => ({ ...prev, [key]: value || null }));
  }

  // Check if any links are filled
  const hasAnyLink = Object.values(links).some(v => v && v.trim());

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Regulatory Filing Links
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Links to official government platforms for regulatory filings
            </p>
          </div>
          
          {/* Filing Status Badge */}
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            hasAnyLink 
              ? 'bg-green-100 text-green-700' 
              : 'bg-yellow-100 text-yellow-700'
          }`}>
            {hasAnyLink ? (
              <span className="flex items-center gap-1">
                <Check className="w-4 h-4" /> Filed
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <AlertCircle className="w-4 h-4" /> Pending
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Country Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('sg')}
          className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'sg'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          🇸🇬 Singapore
        </button>
        <button
          onClick={() => setActiveTab('id')}
          className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'id'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          🇮🇩 Indonesia
        </button>
      </div>

      {/* Filing Links Form */}
      <div className="p-6 space-y-4">
        {activeTab === 'sg' && FILING_PLATFORMS.sg.map(platform => (
          <div key={platform.key} className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">
                {platform.label}
              </label>
              <a
                href={platform.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                {platform.url} <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <input
              type="url"
              value={links[platform.key as keyof FilingLink] || ''}
              onChange={(e) => updateLink(platform.key, e.target.value)}
              placeholder={`https://bizfile.gov.sg/...`}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-400">{platform.description}</p>
          </div>
        ))}

        {activeTab === 'id' && FILING_PLATFORMS.id.map(platform => (
          <div key={platform.key} className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">
                {platform.label}
              </label>
              <a
                href={platform.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                {platform.url} <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <input
              type="url"
              value={links[platform.key as keyof FilingLink] || ''}
              onChange={(e) => updateLink(platform.key, e.target.value)}
              placeholder={`https://...`}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-400">{platform.description}</p>
          </div>
        ))}
      </div>

      {/* Save Button */}
      <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Last verified: {initialData?.filing_links_verified_at 
              ? new Date(initialData.filing_links_verified_at).toLocaleDateString() 
              : 'Never'}
          </p>
          
          <div className="flex items-center gap-2">
            {error && (
              <span className="text-sm text-red-600">{error}</span>
            )}
            {saved && (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <Check className="w-4 h-4" /> Saved!
              </span>
            )}
            
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Links
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/FilingLinksEdit.tsx
git commit -m "feat: add FilingLinksEdit component"
```

---

### Task 3: Integrate FilingLinksEdit into Profile Page

**Files:**
- Modify: `src/components/Profile.tsx` or wherever profile editing happens

**Interfaces:**
- Consumes: `FilingLinksEdit` component, `userId`
- Produces: Profile page with filing links section

- [ ] **Step 1: Add FilingLinksEdit to Profile**

Find the profile edit section and add:

```tsx
import { FilingLinksEdit } from './FilingLinksEdit';

// In the profile form, add after other sections:

<FilingLinksEdit 
  userId={userId}
  initialData={profileData}
  onSave={() => {
    // Refresh profile data
    fetchProfile();
  }}
/>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Profile.tsx
git commit -m "feat: integrate filing links into profile page"
```

---

### Task 4: Create Profile Page for Franchisee (Own Profile View)

**Files:**
- Modify: `src/components/Profile.tsx` to support both HQ and Franchisee views

**Interfaces:**
- Props: `isOwnProfile` boolean
- Shows filing links + own documents for franchisee

- [ ] **Step 1: Update Profile to show own filing links**

For franchisee, show filing links section but make it read-only if they shouldn't edit:

```tsx
// In Profile.tsx, add:
{/* Filing Links Section */}
{userProfile && (
  <FilingLinksEdit 
    userId={userProfile.id}
    initialData={userProfile}
    onSave={fetchProfile}
  />
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Profile.tsx
git commit -m "feat: add filing links to franchisee profile"
```

---

### Task 5: Franchisee Document Upload - Extend DocumentVault

**Files:**
- Modify: `src/components/DocumentVault.tsx`

**Interfaces:**
- Adds ability for franchisee to upload their own documents (LKPT, financial statements)
- Different from HQ upload (upload for franchisee) - this is upload own

- [ ] **Step 1: Update DocumentVault for franchisee own upload**

The current DocumentVault already has DocumentUpload for franchisee. Verify it works:

```tsx
// Current code already has this for non-HQ mode:
{!hqMode && (
  <div className="bg-white rounded-xl border border-slate-200 p-6">
    <DocumentUpload userId={userId} />
  </div>
)}
```

This should already allow franchisee to upload their own documents.

- [ ] **Step 2: Verify DocumentVault export**

Ensure DocumentVault is exported correctly for use in other components.

- [ ] **Step 3: Commit**

```bash
git add src/components/DocumentVault.tsx
git commit -m "feat: ensure franchisee can upload own documents"
```

---

### Task 6: Update Financing Tab to Use Profile Filing Links

**Files:**
- Modify: `src/components/Financing.tsx`

**Interfaces:**
- Check both regulatory_documents AND filing_links before allowing apply
- Update the check-required-docs call to also check filing_links

- [ ] **Step 1: Update financing gate to check filing links too**

Find the `checkRequiredDocuments` function and enhance it:

```tsx
// Check required documents AND filing links
async function checkRequiredDocuments(entityId: string, country: string) {
  setCheckDocsLoading(true);
  
  try {
    // 1. Check regulatory documents
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return true;

    const docsResponse = await fetch(
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

    const docsResult = await docsResponse.json();
    
    // 2. Check filing links from profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('filing_links, filing_status')
      .eq('id', entityId)
      .single();

    // Combine issues
    const issues: string[] = [];
    
    if (!docsResult.valid && docsResult.missing_docs?.length > 0) {
      issues.push(...docsResult.missing_docs.map((d: string) => `Doc: ${d}`));
    }
    
    if (!profile?.filing_links || profile.filing_status === 'PENDING') {
      issues.push('Filing: Links not verified');
    }

    if (issues.length > 0) {
      setMissingDocs(issues);
      setShowDocBlockModal(true);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error checking docs:', error);
    return true;
  } finally {
    setCheckDocsLoading(false);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Financing.tsx
git commit -m "feat: enhance financing gate to check filing links"
```

---

### Task 7: Integration Testing

**Files:**
- None (manual testing)

- [ ] **Step 1: Test HQ can set filing links**

1. Login as HQ (steve.gilang@gmail.com)
2. Go to Profile
3. Find "Regulatory Filing Links" section
4. Add ACRA BizFile+ link
5. Save
6. Verify: Status changes to "Filed"

- [ ] **Step 2: Test Franchisee can see filing links**

1. Login as Franchisee (alice.sg@franchise.com)
2. Go to Profile
3. Verify filing links section is visible
4. Verify franchisee can update their own links

- [ ] **Step 3: Test Franchisee can upload own documents**

1. Login as Franchisee
2. Go to Financing → Document Vault
3. Upload a document (LKPT, financial statement, etc.)
4. Verify document appears in list

- [ ] **Step 4: Test combined gate**

1. Without filing links → Blocked
2. With filing links → Allowed

- [ ] **Step 5: Commit test results**

```bash
git add docs/
git commit -m "docs: add filing status links test results"
```

---

## Summary

| Task | Description | Hours |
|------|-------------|-------|
| 1 | DB Migration (filing_links column) | 0.5 |
| 2 | FilingLinksEdit Component | 1 |
| 3 | Integrate into Profile | 0.5 |
| 4 | Franchisee Profile View | 0.5 |
| 5 | DocumentVault for Franchisee | 0.5 |
| 6 | Update Financing Gate | 1 |
| 7 | Testing | 1 |
| **Total** | | **5 hours** |

---

## Dependencies

- Task 1 must complete before Tasks 2-7
- Task 2 must complete before Task 3

---

## Verification Checklist

- [ ] `filing_links` JSONB column added to user_profiles
- [ ] FilingLinksEdit component created
- [ ] HQ can edit filing links in profile
- [ ] Franchisee can see filing links in profile
- [ ] Franchisee can upload own documents
- [ ] Financing gate checks both docs and filing links
- [ ] Git pushed to main
