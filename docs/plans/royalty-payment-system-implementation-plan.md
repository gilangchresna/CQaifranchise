# Royalty & Franchise Fee Payment System - Implementation Plan

> **Document Version:** 1.0
> **Date:** August 25, 2026
> **Author:** AIFrCQ Team
> **Status:** For Chairman Review

---

## 1. Executive Summary

### 1.1 Current State vs Requirements

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CREDIT ASSESSMENT DOC REQUIREMENT:                                │
├─────────────────────────────────────────────────────────────────────────────┤
                                                                             │
│  "Royalty & franchise fee payment status"                           │
│  "Update mode: Real-time, event-triggered on payment/settlement" │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Gap Analysis

| Requirement | Current Status | Gap |
|------------|---------------|-----|
| Invoice Generation | ❌ None | Create monthly invoices |
| Payment Recording | ❌ Manual only | Bank webhook / manual entry |
| Status Tracking | ✅ Sample data exists | Needs real data |
| Event Triggers | ❌ None | Auto-update on events |
| Alert System | ❌ None | Alert when overdue |
| AI Agent Integration | ❌ None | Triage → Case |

---

## 2. System Architecture

### 2.1 Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ROYALTY PAYMENT SYSTEM - COMPLETE FLOW                           │
├─────────────────────────────────────────────────────────────────────────────┤
                                                                             │
│                                                                             │
│  ┌─────────────┐                                                      │
│  │ 1. MONTHLY │  Cron: 1st of each month                            │
│  │ INVOICE     │  → Generate invoice for each franchisee              │
│  │ GENERATION  │  → Set due_date = 15th of month                    │
│  └──────┬──────┘  → Status: PENDING                                  │
│          │                                                              │
│          ▼                                                              │
│  ┌─────────────┐                                                      │
│  │ 2. NOTIFY   │  Email/SMS to franchisee                            │
│  │ FRANCHISEE  │  → Invoice amount, due date                        │
│  └──────┬──────┘  → Payment instructions                             │
│          │                                                              │
│          ▼                                                              │
│  ┌─────────────┐                                                      │
│  │ 3. PAYMENT │  a) Bank Transfer (webhook)                         │
│  │ RECORDING   │  b) GIRO Auto-debit                                 │
│  └──────┬──────┘  c) Manual entry (backup)                          │
│          │                                                              │
│          ▼                                                              │
│  ┌─────────────┐                                                      │
│  │ 4. MATCH   │  Match payment → Invoice                             │
│  │ & RECONCILE│  → By reference number / amount / date               │
│  └──────┬──────┘  → Status: ON_TIME / LATE                          │
│          │                                                              │
│          ▼                                                              │
│  ┌─────────────┐                                                      │
│  │ 5. ALERT   │  If due_date passed:                                 │
│  │ IF OVERDUE │  → Day 1: Reminder to franchisee                    │
│  └──────┬──────┘  → Day 7: Alert to Regional Manager                │
│          │        → Day 30: Escalate to HQ Legal                     │
│          ▼                                                              │
│  ┌─────────────┐                                                      │
│  │ 6. AI      │  Monitor Agent → Detect late payment pattern          │
│  │ AGENT      │  Triage Agent → Route to appropriate case           │
│  │ INTEGRATION│  Executor Agent → Send notification                  │
│  └─────────────┘                                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Database Schema

```sql
-- Existing: royalty_payments (already exists)
CREATE TABLE IF NOT EXISTS public.royalty_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchisee_id UUID REFERENCES user_profiles(id),
  outlet_id INT REFERENCES outlets(id),
  invoice_number VARCHAR(50),
  payment_date DATE,
  due_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'SGD',
  status VARCHAR(20) DEFAULT 'PENDING',
  payment_method VARCHAR(50),
  reference_number VARCHAR(100),
  notes TEXT,
  period VARCHAR(7),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- NEW: royalty_invoices (for invoice generation)
CREATE TABLE IF NOT EXISTS public.royalty_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  franchisee_id UUID REFERENCES user_profiles(id),
  outlet_id INT REFERENCES outlets(id),
  period VARCHAR(7) NOT NULL,
  royalty_rate DECIMAL(5,4),
  sales_amount DECIMAL(12,2),
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'SGD',
  due_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING',
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- NEW: royalty_alerts (for overdue alerts)
CREATE TABLE IF NOT EXISTS public.royalty_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchisee_id UUID REFERENCES user_profiles(id),
  outlet_id INT REFERENCES outlets(id),
  royalty_payment_id UUID REFERENCES royalty_payments(id),
  alert_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) DEFAULT 'MEDIUM',
  days_past_due INT DEFAULT 0,
  message TEXT,
  status VARCHAR(20) DEFAULT 'NEW',
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_royalty_payments_franchisee ON royalty_payments(franchisee_id);
CREATE INDEX idx_royalty_payments_outlet ON royalty_payments(outlet_id);
CREATE INDEX idx_royalty_payments_status ON royalty_payments(status);
CREATE INDEX idx_royalty_payments_due_date ON royalty_payments(due_date);
CREATE INDEX idx_royalty_invoices_franchisee ON royalty_invoices(franchisee_id);
CREATE INDEX idx_royalty_invoices_period ON royalty_invoices(period);
CREATE INDEX idx_royalty_alerts_franchisee ON royalty_alerts(franchisee_id);
CREATE INDEX idx_royalty_alerts_status ON royalty_alerts(status);
```

---

## 3. Edge Functions Required

### 3.1 Functions to Build

| # | Function | Purpose | Trigger | Priority |
|---|----------|---------|---------|----------|
| 1 | `royalty-invoice-generator` | Generate monthly invoices | Cron (1st of month) | 🔴 HIGH |
| 2 | `royalty-payment-webhook` | Receive bank payment notifications | External webhook | 🔴 HIGH |
| 3 | `royalty-payment-recorder` | Record manual payment entry | User action | 🟡 MEDIUM |
| 4 | `royalty-overdue-checker` | Check and generate overdue alerts | Cron (daily) | 🔴 HIGH |
| 5 | `royalty-alert-to-case` | Create case from overdue alert | Cron (15 min) | 🔴 HIGH |
| 6 | `royalty-reconciliation` | Match payments to invoices | On payment received | 🟡 MEDIUM |

### 3.2 Function Specifications

#### 3.2.1 royalty-invoice-generator

```typescript
// Trigger: Cron - 1st of each month at 00:01
// Purpose: Generate invoices for all active franchisees

interface InvoiceGeneratorInput {
  period: string; // Format: "2026-09"
}

async function generateMonthlyInvoices(period: string) {
  // 1. Get all active franchisees with outlets
  const franchisees = await getActiveFranchisees();
  
  for (const franchisee of franchisees) {
    // 2. Calculate royalty amount (5% of monthly sales)
    const monthlySales = await getMonthlySales(franchisee.id, period);
    const royaltyAmount = monthlySales * 0.05;
    
    // 3. Get minimum fee (whichever is higher)
    const amount = Math.max(royaltyAmount, MINIMUM_FEE);
    
    // 4. Create invoice
    const invoice = await createInvoice({
      invoice_number: `INV-${period}-${franchisee.id.slice(0,8)}`,
      franchisee_id: franchisee.id,
      outlet_id: franchisee.primary_outlet_id,
      period: period,
      amount: amount,
      due_date: getDueDate(period), // 15th of month
      status: 'PENDING',
    });
    
    // 5. Create royalty_payment record
    await createRoyaltyPayment({
      franchisee_id: franchisee.id,
      outlet_id: franchisee.primary_outlet_id,
      invoice_number: invoice.invoice_number,
      amount: amount,
      due_date: invoice.due_date,
      status: 'PENDING',
      period: period,
    });
    
    // 6. Notify franchisee
    await notifyFranchisee(franchisee.id, invoice);
  }
  
  return { success: true, count: franchisees.length };
}
```

#### 3.2.2 royalty-payment-webhook

```typescript
// Trigger: External - Bank sends HTTP POST on payment received
// Purpose: Record payment from bank notification

interface PaymentWebhookInput {
  reference_number: string;
  amount: number;
  currency: string;
  payment_date: string;
  source_bank: string;
  destination_bank: string;
  additional_data?: Record<string, any>;
}

async function handlePaymentWebhook(input: PaymentWebhookInput) {
  // 1. Validate webhook signature
  if (!validateWebhookSignature(input)) {
    return { success: false, error: 'Invalid signature' };
  }
  
  // 2. Find matching invoice by reference number
  const invoice = await findInvoiceByReference(input.reference_number);
  if (!invoice) {
    // Try to match by amount + date
    const matches = await findInvoicesByAmountAndDate(input.amount, input.payment_date);
    if (matches.length === 1) {
      return await recordPayment(matches[0], input);
    }
    return { success: false, error: 'Invoice not found' };
  }
  
  // 3. Record payment
  return await recordPayment(invoice, input);
}

async function recordPayment(invoice: Invoice, input: PaymentWebhookInput) {
  // Calculate if on-time or late
  const paymentDate = new Date(input.payment_date);
  const dueDate = new Date(invoice.due_date);
  const status = paymentDate <= dueDate ? 'ON_TIME' : 'LATE';
  
  // Update invoice
  await updateInvoice(invoice.id, {
    status: 'PAID',
    paid_at: input.payment_date,
    payment_method: 'BANK_TRANSFER',
    reference_number: input.reference_number,
  });
  
  // Update royalty_payment
  await updateRoyaltyPayment(invoice.id, {
    payment_date: input.payment_date,
    status: status,
    payment_method: 'BANK_TRANSFER',
    reference_number: input.reference_number,
  });
  
  // Update days_past_due
  const daysPastDue = status === 'LATE' 
    ? Math.ceil((paymentDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  
  return { 
    success: true, 
    status: status,
    days_past_due: daysPastDue,
  };
}
```

#### 3.2.3 royalty-overdue-checker

```typescript
// Trigger: Cron - Daily at 09:00
// Purpose: Check for overdue payments and generate alerts

async function checkOverduePayments() {
  const today = new Date();
  
  // 1. Find all PENDING payments past due date
  const overduePayments = await getOverduePayments(today);
  
  for (const payment of overduePayments) {
    const daysPastDue = Math.ceil(
      (today.getTime() - new Date(payment.due_date).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    // 2. Check if alert already exists
    const existingAlert = await getAlertForPayment(payment.id);
    if (existingAlert) continue;
    
    // 3. Determine severity based on days past due
    const severity = getSeverity(daysPastDue);
    const alertType = getAlertType(daysPastDue);
    
    // 4. Create alert
    await createRoyaltyAlert({
      franchisee_id: payment.franchisee_id,
      outlet_id: payment.outlet_id,
      royalty_payment_id: payment.id,
      alert_type: alertType,
      severity: severity,
      days_past_due: daysPastDue,
      message: generateAlertMessage(payment, daysPastDue),
      status: 'NEW',
    });
    
    // 5. Notify appropriate parties
    await notifyOverdue(payment, daysPastDue);
  }
  
  return { success: true, alerts_created: overduePayments.length };
}

function getSeverity(daysPastDue: number): string {
  if (daysPastDue >= 30) return 'P0_CRITICAL';
  if (daysPastDue >= 7) return 'P1_HIGH';
  if (daysPastDue >= 1) return 'P2_MEDIUM';
  return 'P3_LOW';
}
```

#### 3.2.4 royalty-alert-to-case

```typescript
// Trigger: Cron - Every 15 minutes
// Purpose: Convert royalty alerts to cases

async function royaltyAlertToCase() {
  // 1. Get NEW royalty alerts
  const alerts = await getNewRoyaltyAlerts();
  
  for (const alert of alerts) {
    // 2. Create case
    const caseId = await createCase({
      title: `Royalty Payment Overdue: ${alert.days_past_due} days`,
      description: alert.message,
      priority: alert.severity,
      type: 'ROYALTY_OVERDUE',
      source_id: alert.id,
      franchisee_id: alert.franchisee_id,
      outlet_id: alert.outlet_id,
    });
    
    // 3. Update alert status
    await updateAlertStatus(alert.id, 'ASSIGNED', caseId);
    
    // 4. Log AI Agent activity
    await logAgentActivity('triage', 'warn', 'Royalty alert converted to case', {
      alert_id: alert.id,
      case_id: caseId,
      franchisee_id: alert.franchisee_id,
    });
  }
  
  return { success: true, cases_created: alerts.length };
}
```

---

## 4. Frontend Requirements

### 4.1 UI Components Needed

| # | Component | Location | Priority |
|---|-----------|----------|----------|
| 1 | Franchise Fees Tab (enhanced) | Financing.tsx | ✅ Done |
| 2 | Invoice List View | New page/modal | 🔴 HIGH |
| 3 | Payment Recording Form | New modal | 🔴 HIGH |
| 4 | Overdue Alert Badge | Existing | 🟡 MEDIUM |
| 5 | Royalty Dashboard | New page | 🟡 MEDIUM |

### 4.2 Franchise Fees Tab Enhancement

```tsx
// Current: Shows payment history only
// Enhanced: Show invoices + payments

interface EnhancedFranchiseFeesProps {
  activeRole: Role;
  userRegionId: number | null;
}

function EnhancedFranchiseFees({ activeRole, userRegionId }: EnhancedFranchiseFeesProps) {
  const [activeSubTab, setActiveSubTab] = useState<'invoices' | 'payments'>('invoices');
  
  // Data fetching
  const { invoices, payments, loading } = useRoyaltyData(userRegionId);
  
  return (
    <div>
      {/* Sub-tabs */}
      <Tabs>
        <Tab value="invoices">Invoices ({invoices.length})</Tab>
        <Tab value="payments">Payment History ({payments.length})</Tab>
      </Tabs>
      
      {/* Invoice Tab */}
      {activeSubTab === 'invoices' && (
        <InvoiceList 
          invoices={invoices}
          onRecordPayment={handleRecordPayment}
          onViewDetails={handleViewDetails}
        />
      )}
      
      {/* Payment History Tab */}
      {activeSubTab === 'payments' && (
        <PaymentHistory payments={payments} />
      )}
    </div>
  );
}

// Invoice List Component
function InvoiceList({ invoices, onRecordPayment, onViewDetails }) {
  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <SummaryCard label="Total Invoices" value={invoices.length} />
        <SummaryCard label="Pending" value={invoices.filter(i => i.status === 'PENDING').length} color="orange" />
        <SummaryCard label="Paid" value={invoices.filter(i => i.status === 'PAID').length} color="green" />
        <SummaryCard label="Overdue" value={invoices.filter(i => i.status === 'OVERDUE').length} color="red" />
      </div>
      
      {/* Invoice Table */}
      <Table>
        <TableHeader>
          <TableCell>Invoice #</TableCell>
          <TableCell>Period</TableCell>
          <TableCell>Amount</TableCell>
          <TableCell>Due Date</TableCell>
          <TableCell>Status</TableCell>
          <TableCell>Actions</TableCell>
        </TableHeader>
        <TableBody>
          {invoices.map(invoice => (
            <TableRow key={invoice.id}>
              <TableCell>{invoice.invoice_number}</TableCell>
              <TableCell>{invoice.period}</TableCell>
              <TableCell>S${invoice.amount.toLocaleString()}</TableCell>
              <TableCell>{formatDate(invoice.due_date)}</TableCell>
              <TableCell><StatusBadge status={invoice.status} /></TableCell>
              <TableCell>
                <Button size="sm" onClick={() => onRecordPayment(invoice)}>
                  Record Payment
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

### 4.3 Payment Recording Modal

```tsx
// Modal for recording manual payment

function RecordPaymentModal({ invoice, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    amount: invoice.amount,
    payment_method: 'BANK_TRANSFER',
    reference_number: '',
  });
  
  const handleSubmit = async () => {
    // Call edge function to record payment
    const result = await supabase.functions.invoke('royalty-payment-recorder', {
      body: {
        invoice_id: invoice.id,
        ...formData,
      }
    });
    
    if (result.success) {
      onSuccess(result.data);
      onClose();
    }
  };
  
  return (
    <Modal title="Record Payment">
      <div className="space-y-4">
        <FormField label="Invoice Number">
          <Input value={invoice.invoice_number} disabled />
        </FormField>
        
        <FormField label="Payment Date">
          <Input 
            type="date" 
            value={formData.payment_date}
            onChange={e => setFormData({...formData, payment_date: e.target.value})}
          />
        </FormField>
        
        <FormField label="Amount">
          <Input 
            type="number" 
            value={formData.amount}
            onChange={e => setFormData({...formData, amount: Number(e.target.value)})}
          />
        </FormField>
        
        <FormField label="Payment Method">
          <Select 
            value={formData.payment_method}
            onChange={e => setFormData({...formData, payment_method: e.target.value})}
          >
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="GIRO">GIRO</option>
            <option value="CASH">Cash</option>
            <option value="OTHER">Other</option>
          </Select>
        </FormField>
        
        <FormField label="Reference Number">
          <Input 
            value={formData.reference_number}
            onChange={e => setFormData({...formData, reference_number: e.target.value})}
            placeholder="e.g., TRF-20260815-001"
          />
        </FormField>
      </div>
      
      <div className="flex justify-end gap-2 mt-6">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit}>Record Payment</Button>
      </div>
    </Modal>
  );
}
```

---

## 5. Cron Job Schedule

### 5.1 New Cron Jobs Required

| # | Job Name | Schedule | Function | Purpose |
|---|----------|----------|----------|---------|
| 1 | `royalty-invoice-generator` | `0 0 1 * *` (1st of month) | Generate monthly invoices | Create invoices for all franchisees |
| 2 | `royalty-overdue-checker` | `0 9 * * *` (daily 9 AM) | Check overdue payments | Generate alerts for overdue |
| 3 | `royalty-alert-to-case` | `*/15 * * * *` (every 15 min) | Convert alerts to cases | AI workflow trigger |

### 5.2 Cron Job SQL

```sql
-- Insert new cron jobs
SELECT cron.schedule(
  'royalty-invoice-generator',
  '0 0 1 * *',
  $$
  SELECT net.http_post(
    url := '${EDGE_FUNCTIONS_URL}/royalty-invoice-generator',
    headers := '{"Authorization": "Bearer ${SERVICE_ROLE_KEY}"}'
  );
  $$
);

SELECT cron.schedule(
  'royalty-overdue-checker',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := '${EDGE_FUNCTIONS_URL}/royalty-overdue-checker',
    headers := '{"Authorization": "Bearer ${SERVICE_ROLE_KEY}"}'
  );
  $$
);

SELECT cron.schedule(
  'royalty-alert-to-case',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := '${EDGE_FUNCTIONS_URL}/royalty-alert-to-case',
    headers := '{"Authorization": "Bearer ${SERVICE_ROLE_KEY}"}'
  );
  $$
);
```

---

## 6. Integration Points

### 6.1 Bank Webhook Integration

```typescript
// Supabase Edge Function for bank webhook
// Endpoint: /functions/v1/royalty-payment-webhook

Deno.serve(async (req) => {
  // Verify webhook signature
  const signature = req.headers.get('x-webhook-signature');
  if (!verifySignature(signature, req.body)) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  const payment = await req.json();
  
  // Process payment
  const result = await handlePaymentWebhook(payment);
  
  return Response.json(result);
});
```

### 6.2 GIRO Integration

```typescript
// For Singapore GIRO (Same Day / Next Day)
// Integrate with banks via API or file transfer

interface GIROConfig {
  bank_code: string;
  corporate_id: string;
  collection_type: 'BILLS' | 'LOAN' | 'INSURANCE';
}

async function setupGIRO(franchisee: Franchisee, config: GIROConfig) {
  // 1. Generate GIRO authorization form
  const form = await generateGIROForm(franchisee, config);
  
  // 2. Send to franchisee for signing
  await sendGIROForm(franchisee.email, form);
  
  // 3. On return, submit to bank
  // (Manual process for MVP)
  
  return { success: true, form_id: form.id };
}
```

### 6.3 AI Agent Integration

```typescript
// Monitor Agent: Pattern detection
async function detectPaymentPattern(franchiseeId: string) {
  const payments = await getPaymentHistory(franchiseeId, { months: 6 });
  
  // Check for late payment pattern
  const lateCount = payments.filter(p => p.status === 'LATE').length;
  const totalCount = payments.length;
  const lateRatio = lateCount / totalCount;
  
  if (lateRatio > 0.3) {
    // Alert: Consistent late payment pattern
    await createAlert({
      type: 'ROYALTY_PAYMENT_PATTERN',
      severity: 'P2_MEDIUM',
      franchisee_id: franchiseeId,
      message: `Franchisee has late payment ratio of ${(lateRatio * 100).toFixed(0)}% over 6 months`,
    });
  }
  
  // Check for decreasing payment trend
  const trend = calculateTrend(payments.map(p => p.amount));
  if (trend.slope < -0.1) {
    await createAlert({
      type: 'ROYALTY_AMOUNT_DECREASING',
      severity: 'P3_LOW',
      franchisee_id: franchiseeId,
      message: `Royalty payments decreasing by ${Math.abs(trend.slope * 100).toFixed(0)}% monthly`,
    });
  }
}
```

---

## 7. Testing Plan

### 7.1 Unit Tests

```typescript
// Test: Invoice Generation
describe('Invoice Generation', () => {
  test('should calculate royalty at 5% of sales', async () => {
    const monthlySales = 100000; // S$100,000
    const expectedRoyalty = 5000; // 5%
    
    const result = await calculateRoyalty(monthlySales);
    expect(result).toBe(expectedRoyalty);
  });
  
  test('should use minimum fee if 5% is lower', async () => {
    const monthlySales = 20000; // S$20,000
    const fivePercent = 1000;
    const minimumFee = 2000;
    
    const result = calculateRoyalty(monthlySales, minimumFee);
    expect(result).toBe(minimumFee);
  });
});

// Test: Payment Matching
describe('Payment Matching', () => {
  test('should match by reference number', async () => {
    const invoice = { invoice_number: 'INV-2026-08-001', amount: 5000 };
    const payment = { reference_number: 'INV-2026-08-001', amount: 5000 };
    
    const match = await matchPaymentToInvoice(payment, [invoice]);
    expect(match).toBe(invoice);
  });
  
  test('should match by amount + date if reference not found', async () => {
    const invoice = { invoice_number: 'INV-2026-08-001', amount: 5000, due_date: '2026-08-15' };
    const payment = { amount: 5000, payment_date: '2026-08-14' }; // No reference
    
    const match = await matchPaymentToInvoice(payment, [invoice]);
    expect(match).toBe(invoice);
  });
});

// Test: Overdue Detection
describe('Overdue Detection', () => {
  test('should detect payment overdue by 1 day', () => {
    const dueDate = new Date('2026-08-15');
    const today = new Date('2026-08-16');
    
    const daysPastDue = calculateDaysPastDue(dueDate, today);
    expect(daysPastDue).toBe(1);
  });
  
  test('should return severity P2 for 3 days overdue', () => {
    const severity = getSeverity(3);
    expect(severity).toBe('P2_MEDIUM');
  });
  
  test('should return severity P0 for 30+ days overdue', () => {
    const severity = getSeverity(30);
    expect(severity).toBe('P0_CRITICAL');
  });
});
```

### 7.2 Integration Tests

```typescript
// Test: Full payment flow
describe('Payment Flow Integration', () => {
  test('should complete: invoice → payment → reconciliation → alert', async () => {
    // 1. Generate invoice
    const invoice = await generateInvoice({
      franchisee_id: 'test-franchisee',
      period: '2026-09',
      amount: 5000,
    });
    expect(invoice.status).toBe('PENDING');
    
    // 2. Record payment
    const payment = await recordPayment({
      invoice_id: invoice.id,
      payment_date: '2026-09-10',
      amount: 5000,
      reference_number: 'TRF-20260910-001',
    });
    expect(payment.status).toBe('ON_TIME');
    
    // 3. Verify reconciliation
    const reconciled = await getReconciledInvoice(invoice.id);
    expect(reconciled.status).toBe('PAID');
  });
});

// Test: Overdue flow
describe('Overdue Flow Integration', () => {
  test('should create alert when payment overdue', async () => {
    // 1. Create overdue invoice
    const invoice = await createOverdueInvoice({
      due_date: '2026-08-15',
    });
    
    // 2. Run overdue checker
    const result = await checkOverduePayments();
    
    // 3. Verify alert created
    const alert = await getLatestAlertForInvoice(invoice.id);
    expect(alert.status).toBe('NEW');
    expect(alert.days_past_due).toBeGreaterThan(0);
  });
  
  test('should escalate to case after alert', async () => {
    // 1. Create alert
    const alert = await createRoyaltyAlert({
      severity: 'P1_HIGH',
    });
    
    // 2. Run alert-to-case
    await royaltyAlertToCase();
    
    // 3. Verify case created
    const case_ = await getCaseForAlert(alert.id);
    expect(case_).not.toBeNull();
    expect(case_.priority).toBe('HIGH');
  });
});
```

---

## 8. Implementation Timeline

### Phase 1: MVP Core (1 week)

| Day | Task | Deliverable |
|-----|------|------------|
| 1 | Create database schema | royalty_invoices table |
| 2 | Build invoice generator | Edge function + cron |
| 3 | Build payment recorder | Edge function + UI modal |
| 4 | Build overdue checker | Edge function + cron |
| 5 | Integrate with workflow | Alert → Case |
| 6 | Testing | Unit + integration tests |
| 7 | Deploy | MVP ready |

### Phase 2: Bank Integration (1 week)

| Day | Task | Deliverable |
|-----|------|------------|
| 1 | Setup webhook endpoint | HTTPS endpoint |
| 2 | Build webhook handler | Signature verification |
| 3 | Build auto-matching | Payment → Invoice |
| 4 | Build GIRO setup flow | UI for authorization |
| 5 | Testing | Bank integration tests |
| 6 | Documentation | API docs |
| 7 | Deploy | Bank-ready |

### Phase 3: AI Enhancement (1 week)

| Day | Task | Deliverable |
|-----|------|------------|
| 1 | Pattern detection | Monitor Agent enhancement |
| 2 | Predictive analytics | ML model for payment prediction |
| 3 | Dashboard | Royalty analytics dashboard |
| 4 | Reporting | Monthly/quarterly reports |
| 5 | Alerts tuning | Adjust thresholds |
| 6 | Testing | Full regression |
| 7 | Deploy | Production-ready |

---

## 9. Success Metrics

### 9.1 Functional Metrics

| Metric | Target | Measurement |
|--------|--------|------------|
| Invoice generation success rate | 100% | Auto vs manual |
| Payment matching accuracy | >99% | Matched vs unmatched |
| Alert generation accuracy | >95% | Valid alerts vs noise |
| Case creation from alerts | 100% | All P0/P1 alerts |

### 9.2 Business Metrics

| Metric | Target | Measurement |
|--------|--------|------------|
| Days to reconcile payment | <1 day | Payment → Matched |
| Late payment detection time | <24 hours | Due → Alert |
| Collection rate | >95% | Paid / Issued |

---

## 10. Risk Assessment

### 10.1 Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Bank webhook not received | Medium | High | Manual entry backup |
| Payment reference mismatch | Medium | Medium | Fuzzy matching |
| GIRO setup complexity | High | Medium | Phased rollout |

### 10.2 Operational Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Franchisee refuses payment | Low | High | Legal escalation flow |
| Bank holiday delays | Medium | Low | Grace period |
| System downtime | Low | Medium | Retry queue |

---

## 11. Appendix

### A. Database ERD

```
┌─────────────────────┐     ┌─────────────────────┐
│   user_profiles     │     │      outlets        │
├─────────────────────┤     ├─────────────────────┤
│ id (PK)             │     │ id (PK)             │
│ email               │     │ name                 │
│ role                │     │ franchisee_id (FK)   │
│ region_id (FK)      │     │ region_id (FK)       │
└─────────┬───────────┘     └──────────┬──────────┘
          │                            │
          │ 1:N                       │ 1:N
          ▼                            ▼
┌─────────────────────┐     ┌─────────────────────┐
│ royalty_invoices    │     │ royalty_payments     │
├─────────────────────┤     ├─────────────────────┤
│ id (PK)             │     │ id (PK)             │
│ invoice_number      │     │ franchisee_id (FK)   │
│ franchisee_id (FK)  │◄────│ outlet_id (FK)      │
│ outlet_id (FK)      │     │ invoice_number (FK)   │
│ period              │     │ payment_date         │
│ amount              │     │ due_date             │
│ due_date            │     │ amount               │
│ status              │     │ status               │
└─────────┬───────────┘     └──────────┬──────────┘
          │                            │
          │ 1:1                       │ 1:N
          ▼                            ▼
┌─────────────────────┐     ┌─────────────────────┐
│    alerts           │     │     cases          │
├─────────────────────┤     ├─────────────────────┤
│ id (PK)             │     │ id (PK)             │
│ alert_type          │     │ title               │
│ severity            │     │ priority            │
│ source_id (royalty) │────►│ type (ROYALTY)      │
│ status              │     │ status              │
└─────────────────────┘     └─────────────────────┘
```

### B. API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/royalty/invoices` | List invoices |
| GET | `/royalty/invoices/:id` | Get invoice details |
| POST | `/royalty/payments` | Record payment |
| GET | `/royalty/payments` | List payments |
| POST | `/webhook/payment` | Bank webhook |
| GET | `/royalty/alerts` | List alerts |

### C. Glossary

| Term | Definition |
|------|------------|
| Royalty | Fee paid by franchisee to franchisor (usually % of sales) |
| GIRO | Singapore auto-debit system for recurring payments |
| Reconciliation | Matching payment to invoice |
| Days Past Due | Number of days payment is overdue |
| Collection Rate | Percentage of issued invoices that are paid |

---

## 12. Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| CTO | | | |
| Finance | | | |
| Development | | | |
| QA | | | |

---

**Document Status:** DRAFT - For Review
**Next Review:** After Chairman meeting
