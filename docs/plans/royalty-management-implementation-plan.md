# Royalty Management Module — Implementation Plan

> **Goal:** Add Royalty Management tab to Financing.tsx to view/manage royalty payment history

**Architecture:** Add 'royalty' tab to existing Financing.tsx tabs. Fetch from `royalty_payments` table, display payment history, track status (ON_TIME/LATE/MISSED), and show alerts for overdue payments.

**Tech Stack:** React + TypeScript + Supabase (existing)

---

## Current State

| Component | Status | Location |
|-----------|--------|----------|
| `royalty_payments` table | ✅ EXISTS | Database |
| `royalty_payments` data | ✅ 24 records | Database |
| Financing.tsx tabs | ⚠️ 5 tabs | Line 107 |
| Royalty Management UI | ❌ MISSING | Needs to build |

---

## Database Schema (Reference)

```sql
royalty_payments
├── id (UUID)
├── franchisee_id (UUID) → user_profiles
├── outlet_id (INT) → outlets
├── payment_date (DATE)
├── due_date (DATE)
├── amount (DECIMAL 12,2)
├── currency (VARCHAR 3) DEFAULT 'SGD'
├── status (VARCHAR) → PENDING, ON_TIME, LATE, MISSED, PARTIAL
├── days_past_due (INT) DEFAULT 0
├── payment_method (VARCHAR)
├── reference_number (VARCHAR)
├── period (VARCHAR) → '2026-08'
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)
```

---

## Tabs Structure

```
Financing.tsx Line 107:
const [activeTab, setActiveTab] = useState<'applications' | 'repayments' | 'risk' | 'documents' | 'cashflow'>('applications');

NEW:
const [activeTab, setActiveTab] = useState<'applications' | 'repayments' | 'risk' | 'documents' | 'cashflow' | 'royalty'>('applications');
```

---

## Tasks

### Task 1: Add Royalty Tab to Navigation

**Objective:** Add 'royalty' to activeTab type and tab navigation UI

**Files:**
- Modify: `src/components/Financing.tsx:107`

**Step 1: Add type to state**

```typescript
const [activeTab, setActiveTab] = useState<'applications' | 'repayments' | 'risk' | 'documents' | 'cashflow' | 'royalty'>('applications');
```

**Step 2: Add tab button in navigation (after cashflow tab)**

```tsx
{ id: 'royalty' as const, label: 'Royalty', icon: Crown },
```

**Step 3: Add Crown import from lucide-react**

```typescript
import { Crown } from 'lucide-react';
```

---

### Task 2: Create Royalty State and Fetch

**Objective:** Add state variables and fetch function for royalty payments

**Files:**
- Modify: `src/components/Financing.tsx:110-112`

**Step 1: Add state after repaymentSchedule**

```typescript
const [royaltyPayments, setRoyaltyPayments] = useState<RoyaltyPayment[]>([]);
```

**Step 2: Add RoyaltyPayment interface (after FinancingApplication interface)**

```typescript
interface RoyaltyPayment {
  id: string;
  franchisee_id: string;
  outlet_id: number;
  payment_date: string;
  due_date: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'ON_TIME' | 'LATE' | 'MISSED' | 'PARTIAL';
  days_past_due: number;
  payment_method: string | null;
  reference_number: string | null;
  period: string;
  created_at: string;
  updated_at: string;
}
```

**Step 3: Add fetch function (after fetchRepaymentSchedule)**

```typescript
async function fetchRoyaltyPayments() {
  if (!session?.access_token) return;
  
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/royalty_payments?select=*&order=period.desc,payment_date.desc`,
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
    }
  );
  
  if (response.ok) {
    const data = await response.json();
    setRoyaltyPayments(data || []);
  }
}
```

**Step 4: Add to useEffect (after fetchRepaymentSchedule call)**

```typescript
fetchRoyaltyPayments(),
```

---

### Task 3: Build Royalty Summary Cards

**Objective:** Display summary stats (Total Due, On Time %, Outstanding)

**Files:**
- Modify: `src/components/Financing.tsx` — Add before Royalty table

**Step 1: Calculate stats (after fetchRoyaltyPayments)**

```typescript
const royaltyStats = {
  totalDue: royaltyPayments.reduce((sum, p) => sum + (p.status === 'PENDING' ? p.amount : 0), 0),
  onTimeCount: royaltyPayments.filter(p => p.status === 'ON_TIME').length,
  totalCount: royaltyPayments.length,
  lateCount: royaltyPayments.filter(p => p.status === 'LATE' || p.status === 'MISSED').length,
};
```

**Step 2: Add summary cards UI (in Royalty tab content)**

```tsx
<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
  <div className="bg-white rounded-lg border p-4">
    <div className="text-sm text-gray-500">Total Payments</div>
    <div className="text-2xl font-bold">{royaltyStats.totalCount}</div>
  </div>
  <div className="bg-white rounded-lg border p-4">
    <div className="text-sm text-gray-500">On Time</div>
    <div className="text-2xl font-bold text-green-600">
      {royaltyStats.totalCount > 0 ? Math.round(royaltyStats.onTimeCount / royaltyStats.totalCount * 100) : 0}%
    </div>
  </div>
  <div className="bg-white rounded-lg border p-4">
    <div className="text-sm text-gray-500">Late / Missed</div>
    <div className="text-2xl font-bold text-red-600">{royaltyStats.lateCount}</div>
  </div>
  <div className="bg-white rounded-lg border p-4">
    <div className="text-sm text-gray-500">Pending Amount</div>
    <div className="text-2xl font-bold">
      S${royaltyStats.totalDue.toLocaleString()}
    </div>
  </div>
</div>
```

---

### Task 4: Build Royalty Payment Table

**Objective:** Display payment history in table with status badges

**Files:**
- Modify: `src/components/Financing.tsx` — Add table after summary cards

**Step 1: Add table UI (in Royalty tab)**

```tsx
{activeTab === 'royalty' && (
  <div className="space-y-4">
    {/* Summary Cards */}
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {/* ... from Task 3 ... */}
    </div>
    
    {/* Payment History Table */}
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="px-4 py-3 border-b bg-gray-50">
        <h3 className="font-semibold">Payment History</h3>
      </div>
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Period</th>
            <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Outlet</th>
            <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Due Date</th>
            <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Payment Date</th>
            <th className="px-4 py-2 text-right text-sm font-medium text-gray-500">Amount</th>
            <th className="px-4 py-2 text-center text-sm font-medium text-gray-500">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {royaltyPayments.map((payment) => (
            <tr key={payment.id} className="hover:bg-gray-50">
              <td className="px-4 py-2 text-sm">{payment.period}</td>
              <td className="px-4 py-2 text-sm">Outlet {payment.outlet_id}</td>
              <td className="px-4 py-2 text-sm">{new Date(payment.due_date).toLocaleDateString()}</td>
              <td className="px-4 py-2 text-sm">
                {payment.payment_date ? new Date(payment.payment_date).toLocaleDateString() : '-'}
              </td>
              <td className="px-4 py-2 text-sm text-right font-medium">
                S${Number(payment.amount).toLocaleString()}
              </td>
              <td className="px-4 py-2 text-center">
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                  payment.status === 'ON_TIME' ? 'bg-green-100 text-green-700' :
                  payment.status === 'LATE' ? 'bg-yellow-100 text-yellow-700' :
                  payment.status === 'MISSED' ? 'bg-red-100 text-red-700' :
                  payment.status === 'PENDING' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {payment.status}
                </span>
              </td>
            </tr>
          ))}
          {royaltyPayments.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                No royalty payment records found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
)}
```

---

### Task 5: Add Outlet Name Lookup

**Objective:** Show outlet name instead of just outlet_id

**Files:**
- Modify: `src/components/Financing.tsx`

**Step 1: Add outlets state and fetch**

```typescript
const [outlets, setOutlets] = useState<{[id: number]: string}>({});

// In useEffect, after fetchRoyaltyPayments:
const { data: outletsData } = await supabase
  .from('outlets')
  .select('id, name');
if (outletsData) {
  const outletsMap: {[id: number]: string} = {};
  outletsData.forEach(o => { outletsMap[o.id] = o.name; });
  setOutlets(outletsMap);
}
```

**Step 2: Update table cell**

```tsx
<td className="px-4 py-2 text-sm">{outlets[payment.outlet_id] || `Outlet ${payment.outlet_id}`}</td>
```

---

## Verification Steps

### Verify Tables Exist

```sql
SELECT COUNT(*) FROM royalty_payments;
-- Expected: 24 rows

SELECT COUNT(*) FROM outlets;
-- Expected: 34+ outlets
```

### Verify Frontend Renders

1. Navigate to: https://cqaifrc.cqit.sg
2. Login as: steve.gilang@gmail.com
3. Click: "Bridge Financing" in sidebar
4. Click: "Royalty" tab
5. Verify: Summary cards + table visible

### Expected Output

```
┌─────────────────────────────────────────────────────────────┐
│  Total Payments | On Time % | Late/Missed | Pending Amount │
│      24         |   75%     |     3      |    S$5,000    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Period  │ Outlet      │ Due Date │ Payment Date │ Amount │ Status │
│  2026-08 │ Marina Bay  │ Aug 14   │ Aug 24       │ S$5K   │ ON_TIME│
│  2026-08 │ Orchard     │ Aug 14   │ Aug 24       │ S$5K   │ ON_TIME│
│  2026-07 │ Marina Bay  │ Jul 15   │ Jul 25       │ S$5.5K │ ON_TIME│
│  2026-06 │ Marina Bay  │ Jun 15   │ Jun 17       │ S$6K   │ LATE   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Time Estimate

| Task | Effort |
|------|--------|
| Task 1: Add Tab | 5 min |
| Task 2: State & Fetch | 10 min |
| Task 3: Summary Cards | 10 min |
| Task 4: Table | 15 min |
| Task 5: Outlet Names | 5 min |
| **Total** | **~45 min** |

---

## Status Checklist

| # | Task | Status |
|---|------|--------|
| 1 | Add Royalty Tab | ⬜ |
| 2 | State & Fetch | ⬜ |
| 3 | Summary Cards | ⬜ |
| 4 | Payment Table | ⬜ |
| 5 | Outlet Names | ⬜ |

---

## Document Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-08-24 | Initial plan |
