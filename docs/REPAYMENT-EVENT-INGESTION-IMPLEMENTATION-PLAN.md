# Repayment Event Ingestion - Implementation Plan

**Created:** 2026-08-05  
**Status:** Draft - Pending Review  
**Priority:** HIGH (MVP Phase 1.5)

---

## 📋 Overview

### Objective
Implement real-time repayment event ingestion from lender systems, enabling:
- Real-time payment status updates
- Continuous delinquency/risk scoring
- Immediate alert generation
- Live dashboard updates

### Current State
- ✅ Basic `lender-bridge/webhook` endpoint exists
- ✅ `lender_webhook_events` audit table exists
- ✅ Idempotency via `event_id` implemented
- ❌ No repayment-specific event types
- ❌ No event fan-out / queue
- ❌ No continuous risk scoring trigger
- ❌ No repayment schedule tracking

---

## 🏗️ Implementation Phases

### Phase 1: Data Model Enhancement
**Files:** `supabase/migrations/20260805000000_financing_and_reporting.sql` (update)

#### 1.1 Add `repayment_events` Table
```sql
CREATE TABLE IF NOT EXISTS public.repayment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID REFERENCES public.financing_applications(id) ON DELETE CASCADE,
    lender_code VARCHAR(50) NOT NULL,
    event_id VARCHAR(200), -- lender's idempotency key
    
    -- Event classification
    event_type VARCHAR(50) NOT NULL, -- see Event Types below
    event_subtype VARCHAR(100), -- e.g., "PARTIAL", "FULL", "EARLY"
    
    -- Payment details
    amount DECIMAL(15,2),
    currency VARCHAR(3) DEFAULT 'SGD',
    payment_reference VARCHAR(200), -- lender's payment reference
    
    -- Schedule context
    emi_number INTEGER, -- which EMI this relates to
    scheduled_date DATE,
    
    -- Risk context
    days_overdue INTEGER DEFAULT 0,
    delinquency_level VARCHAR(20), -- NONE, MILD, MODERATE, SEVERE
    
    -- Metadata
    raw_payload JSONB NOT NULL DEFAULT '{}',
    source VARCHAR(50) DEFAULT 'LENDER_WEBHOOK',
    processed BOOLEAN NOT NULL DEFAULT false,
    processing_error TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_repayment_events_application ON public.repayment_events(application_id);
CREATE INDEX IF NOT EXISTS idx_repayment_events_type ON public.repayment_events(event_type);
CREATE INDEX IF NOT EXISTS idx_repayment_events_received ON public.repayment_events(received_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_repayment_events_dedupe 
    ON public.repayment_events(lender_code, event_id) WHERE event_id IS NOT NULL;
```

#### 1.2 Add `repayment_schedule` Table
```sql
CREATE TABLE IF NOT EXISTS public.repayment_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID REFERENCES public.financing_applications(id) ON DELETE CASCADE,
    emi_number INTEGER NOT NULL,
    due_date DATE NOT NULL,
    principal_amount DECIMAL(15,2) NOT NULL,
    interest_amount DECIMAL(15,2) NOT NULL,
    total_amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'SGD',
    
    -- Payment tracking
    paid_amount DECIMAL(15,2) DEFAULT 0,
    paid_at TIMESTAMPTZ,
    payment_reference VARCHAR(200),
    
    -- Status
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, PAID, PARTIAL, OVERDUE, DEFAULTED
    
    -- Risk tracking
    days_overdue INTEGER DEFAULT 0,
    penalty_accrued DECIMAL(15,2) DEFAULT 0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(application_id, emi_number)
);

CREATE INDEX IF NOT EXISTS idx_repayment_schedule_application ON public.repayment_schedule(application_id);
CREATE INDEX IF NOT EXISTS idx_repayment_schedule_status ON public.repayment_schedule(status);
CREATE INDEX IF NOT EXISTS idx_repayment_schedule_due ON public.repayment_schedule(due_date);
```

#### 1.3 Add `application_risk_scores` Table
```sql
CREATE TABLE IF NOT EXISTS public.application_risk_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID REFERENCES public.financing_applications(id) ON DELETE CASCADE,
    
    -- Risk components
    payment_timing_score DECIMAL(5,2) DEFAULT 100.00, -- 0-100, higher is better
    delinquency_score DECIMAL(5,2) DEFAULT 0.00, -- 0-100, higher is worse
    affordability_score DECIMAL(5,2) DEFAULT 100.00, -- 0-100, higher is better
    
    -- Composite score
    overall_risk_score DECIMAL(5,2) DEFAULT 0.00, -- 0-100, higher = riskier
    risk_level VARCHAR(20) DEFAULT 'LOW', -- LOW, MEDIUM, HIGH, CRITICAL
    
    -- Factors that contributed to score
    risk_factors JSONB DEFAULT '[]',
    triggering_events JSONB DEFAULT '[]',
    
    -- Metadata
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    computation_method VARCHAR(50) DEFAULT 'RULE_BASED', -- RULE_BASED, ML_MODEL, HYBRID
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_risk_scores_application ON public.application_risk_scores(application_id);
CREATE INDEX IF NOT EXISTS idx_risk_scores_level ON public.application_risk_scores(risk_level);
CREATE INDEX IF NOT EXISTS idx_risk_scores_computed ON public.application_risk_scores(computed_at DESC);
```

#### 1.4 Add RLS Policies
```sql
-- RLS for repayment_events
ALTER TABLE public.repayment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS repayment_events_hq_only ON public.repayment_events;
CREATE POLICY repayment_events_hq_only ON public.repayment_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('HQ_ADMIN', 'REGIONAL_MANAGER')
        )
    );

-- RLS for repayment_schedule
ALTER TABLE public.repayment_schedule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS repayment_schedule_access ON public.repayment_schedule;
CREATE POLICY repayment_schedule_access ON public.repayment_schedule
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            JOIN public.financing_applications fa ON up.id = fa.franchisee_id
            WHERE up.id = auth.uid() 
              AND fa.id = repayment_schedule.application_id
        )
        OR EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('HQ_ADMIN', 'REGIONAL_MANAGER')
        )
    );

-- RLS for application_risk_scores
ALTER TABLE public.application_risk_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS risk_scores_hq_only ON public.application_risk_scores;
CREATE POLICY risk_scores_hq_only ON public.application_risk_scores
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('HQ_ADMIN', 'REGIONAL_MANAGER')
        )
    );
```

---

### Phase 2: Enhanced Webhook Handler
**File:** `supabase/functions/lender-bridge/index.ts` (update)

#### 2.1 Event Type Constants
```typescript
// Repayment Event Types
const REPAYMENT_EVENT_TYPES = {
  // Application lifecycle
  APPLICATION_SUBMITTED: 'APPLICATION_SUBMITTED',
  APPLICATION_APPROVED: 'APPLICATION_APPROVED',
  APPLICATION_DECLINED: 'APPLICATION_DECLINED',
  DISBURSEMENT_COMPLETED: 'DISBURSEMENT_COMPLETED',
  
  // Payment events
  EMI_DUE: 'EMI_DUE',
  EMI_PAID: 'EMI_PAID',
  EMI_OVERDUE: 'EMI_OVERDUE',
  PARTIAL_PAYMENT: 'PARTIAL_PAYMENT',
  
  // Risk events
  DELINQUENCY_STARTED: 'DELINQUENCY_STARTED',
  DELINQUENCY_RESOLVED: 'DELINQUENCY_RESOLVED',
  DEFAULT_NOTICE: 'DEFAULT_NOTICE',
  
  // Completion
  FULL_REPAYMENT: 'FULL_REPAYMENT',
  EARLY_REPAYMENT: 'EARLY_REPAYMENT',
  STATUS_CHANGE: 'STATUS_CHANGE',
} as const;

type RepaymentEventType = typeof REPAYMENT_EVENT_TYPES[keyof typeof REPAYMENT_EVENT_TYPES];

// Delinquency levels
const DELINQUENCY_LEVELS = {
  NONE: 'NONE',        // 0 days overdue
  MILD: 'MILD',         // 1-7 days overdue
  MODERATE: 'MODERATE', // 8-30 days overdue
  SEVERE: 'SEVERE',     // 31-60 days overdue
  CRITICAL: 'CRITICAL'  // 60+ days overdue
};
```

#### 2.2 Enhanced `handleRepaymentWebhook` Function
```typescript
async function handleRepaymentWebhook(req: Request, supabase: any) {
  const payload = await req.json();
  const lenderCode = payload.lender_code || 'GENERIC';
  const eventId = payload.event_id || null;
  const eventType = payload.event_type || 'STATUS_CHANGE';
  
  // 1. Idempotency check
  if (eventId) {
    const { data: existing } = await supabase
      .from('repayment_events')
      .select('id')
      .eq('lender_code', lenderCode)
      .eq('event_id', eventId)
      .maybeSingle();
    if (existing) {
      return { status: 200, body: { success: true, deduped: true } };
    }
  }
  
  // 2. Find application
  const applicationRef = payload.application_id || payload.lender_reference_id;
  let application = null;
  if (applicationRef) {
    const { data } = await supabase
      .from('financing_applications')
      .select('*')
      .or(`id.eq.${applicationRef},lender_reference_id.eq.${applicationRef}`)
      .maybeSingle();
    application = data;
  }
  
  // 3. Store raw repayment event
  const { data: eventRow, error: eventError } = await supabase
    .from('repayment_events')
    .insert({
      application_id: application?.id ?? null,
      lender_code: lenderCode,
      event_id: eventId,
      event_type: eventType,
      event_subtype: payload.event_subtype || null,
      amount: payload.amount || null,
      currency: payload.currency || 'SGD',
      payment_reference: payload.payment_reference || null,
      emi_number: payload.emi_number || null,
      scheduled_date: payload.scheduled_date || null,
      days_overdue: payload.days_overdue || 0,
      delinquency_level: payload.delinquency_level || 'NONE',
      raw_payload: payload,
      source: 'LENDER_WEBHOOK',
      processed: false,
    })
    .select()
    .single();
  
  if (eventError) throw eventError;
  
  // 4. Process event if application found
  if (application) {
    await processRepaymentEvent(supabase, application, payload, eventType);
  }
  
  // 5. Mark as processed
  await supabase
    .from('repayment_events')
    .update({ processed: true })
    .eq('id', eventRow.id);
  
  return { 
    status: 200, 
    body: { 
      success: true, 
      event_id: eventRow.id,
      application_id: application?.id,
      matched: !!application 
    } 
  };
}
```

#### 2.3 Event Processing Logic
```typescript
async function processRepaymentEvent(
  supabase: any, 
  application: any, 
  payload: any, 
  eventType: string
) {
  const updates: Record<string, any> = { last_lender_response: payload };
  
  // Update application status based on event type
  switch (eventType) {
    case 'DISBURSEMENT_COMPLETED':
      updates.status = 'REPAYING';
      updates.disbursed_at = payload.disbursed_at || new Date().toISOString();
      updates.disbursed_amount = payload.disbursed_amount || application.approved_amount;
      break;
      
    case 'EMI_PAID':
    case 'PARTIAL_PAYMENT':
      updates.status = 'REPAYING';
      // Update repayment schedule
      await updateRepaymentSchedule(supabase, application.id, payload);
      break;
      
    case 'EMI_OVERDUE':
      updates.status = 'REPAYING'; // Still repaying but delinquent
      await handleDelinquency(supabase, application, payload);
      break;
      
    case 'FULL_REPAYMENT':
    case 'EARLY_REPAYMENT':
      updates.status = 'CLOSED';
      updates.closed_at = new Date().toISOString();
      break;
      
    case 'STATUS_CHANGE':
      if (payload.status) updates.status = payload.status;
      break;
  }
  
  // Apply updates
  await supabase
    .from('financing_applications')
    .update(updates)
    .eq('id', application.id);
  
  // Trigger downstream actions
  await triggerDownstreamActions(supabase, application, eventType, payload);
}
```

#### 2.4 Downstream Actions (Fan-out)
```typescript
async function triggerDownstreamActions(
  supabase: any,
  application: any,
  eventType: string,
  payload: any
) {
  const actions: Promise<any>[] = [];
  
  // 1. Recalculate risk score
  actions.push(
    supabase.functions.invoke('repayment-risk-scorer', {
      body: { application_id: application.id }
    }).catch(e => console.error('Risk scorer error:', e))
  );
  
  // 2. Create alert for risk events
  if (['EMI_OVERDUE', 'DELINQUENCY_STARTED', 'DEFAULT_NOTICE'].includes(eventType)) {
    actions.push(
      supabase.functions.invoke('repayment-alert-generator', {
        body: {
          application_id: application.id,
          franchisee_id: application.franchisee_id,
          event_type: eventType,
          severity: getSeverity(eventType, payload),
          message: getAlertMessage(eventType, payload),
        }
      }).catch(e => console.error('Alert generator error:', e))
    );
  }
  
  // 3. Notify via existing notification system
  actions.push(
    supabase.functions.invoke('notification-send', {
      body: {
        user_id: application.franchisee_id,
        title: `Payment Update: ${eventType}`,
        message: getNotificationMessage(eventType, payload),
        channel: 'ALL',
        priority: getPriority(eventType),
      }
    }).catch(e => console.error('Notification error:', e))
  );
  
  // Execute all actions in parallel
  await Promise.allSettled(actions);
}
```

---

### Phase 3: Risk Scoring Service
**New File:** `supabase/functions/repayment-risk-scorer/index.ts`

#### 3.1 Risk Score Calculation
```typescript
interface RiskScoreInput {
  application_id: string;
  // Events in last 30 days
  recent_events: RepaymentEvent[];
  // Payment history
  payment_history: PaymentRecord[];
  // Current schedule status
  schedule_status: ScheduleStatus[];
}

async function calculateRiskScore(input: RiskScoreInput): Promise<RiskScoreResult> {
  const { recent_events, payment_history, schedule_status } = input;
  
  // 1. Payment Timing Score (0-100, higher is better)
  const onTimePayments = payment_history.filter(p => p.days_overdue <= 0).length;
  const totalPayments = payment_history.length;
  const paymentTimingScore = totalPayments > 0 
    ? (onTimePayments / totalPayments) * 100 
    : 100;
  
  // 2. Delinquency Score (0-100, higher is worse)
  const overdueEvents = recent_events.filter(e => 
    ['EMI_OVERDUE', 'DELINQUENCY_STARTED', 'DEFAULT_NOTICE'].includes(e.event_type)
  );
  const maxDaysOverdue = Math.max(0, ...overdueEvents.map(e => e.days_overdue || 0));
  let delinquencyScore = 0;
  if (maxDaysOverdue > 60) delinquencyScore = 100;
  else if (maxDaysOverdue > 30) delinquencyScore = 75;
  else if (maxDaysOverdue > 7) delinquencyScore = 50;
  else if (maxDaysOverdue > 0) delinquencyScore = 25;
  
  // 3. Affordability Score (simplified - based on payment patterns)
  const recentMissed = recent_events.filter(e => e.event_type === 'EMI_OVERDUE').length;
  const affordabilityScore = Math.max(0, 100 - (recentMissed * 20));
  
  // 4. Overall Risk Score (weighted)
  const overallRiskScore = Math.round(
    (delinquencyScore * 0.5) + 
    ((100 - paymentTimingScore) * 0.3) + 
    ((100 - affordabilityScore) * 0.2)
  );
  
  // 5. Risk Level
  let riskLevel = 'LOW';
  if (overallRiskScore >= 80) riskLevel = 'CRITICAL';
  else if (overallRiskScore >= 60) riskLevel = 'HIGH';
  else if (overallRiskScore >= 30) riskLevel = 'MEDIUM';
  
  // 6. Risk Factors (for explainability)
  const riskFactors = [];
  if (delinquencyScore > 50) riskFactors.push('High delinquency days');
  if (paymentTimingScore < 80) riskFactors.push('Late payment pattern');
  if (affordabilityScore < 60) riskFactors.push('Payment difficulty detected');
  
  return {
    payment_timing_score: Math.round(paymentTimingScore * 100) / 100,
    delinquency_score: Math.round(delinquencyScore * 100) / 100,
    affordability_score: Math.round(affordabilityScore * 100) / 100,
    overall_risk_score: Math.round(overallRiskScore * 100) / 100,
    risk_level: riskLevel,
    risk_factors: riskFactors,
    triggering_events: recent_events.slice(-5).map(e => e.event_type),
  };
}
```

#### 3.2 Alert Trigger Logic
```typescript
function shouldTriggerAlert(
  previousRiskLevel: string,
  newRiskLevel: string,
  eventType: string
): boolean {
  // Escalation alerts
  const levelOrder = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const prevIndex = levelOrder.indexOf(previousRiskLevel);
  const newIndex = levelOrder.indexOf(newRiskLevel);
  
  if (newIndex > prevIndex) return true; // Risk escalated
  if (newRiskLevel === 'CRITICAL') return true; // Critical level
  if (['DEFAULT_NOTICE', 'DELINQUENCY_STARTED'].includes(eventType)) return true;
  
  return false;
}

function getSeverity(eventType: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  switch (eventType) {
    case 'DEFAULT_NOTICE': return 'CRITICAL';
    case 'DELINQUENCY_STARTED': return 'HIGH';
    case 'EMI_OVERDUE': return 'MEDIUM';
    default: return 'LOW';
  }
}
```

---

### Phase 4: Alert Generator Service
**New File:** `supabase/functions/repayment-alert-generator/index.ts`

```typescript
interface AlertInput {
  application_id: string;
  franchisee_id: string;
  event_type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
}

async function generateAlert(input: AlertInput): Promise<void> {
  const { application_id, franchisee_id, event_type, severity, message } = input;
  
  // 1. Get outlet info
  const { data: application } = await supabase
    .from('financing_applications')
    .select('outlet_id, franchisee_id, requested_amount')
    .eq('id', application_id)
    .single();
  
  // 2. Create alert record
  const alertType = event_type === 'DEFAULT_NOTICE' ? 'CRITICAL' : 
                    event_type === 'DELINQUENCY_STARTED' ? 'WARNING' : 'INFO';
  
  const { error: alertError } = await supabase
    .from('alerts')
    .insert({
      alert_type: 'REPAYMENT_RISK',
      severity: severity,
      title: `Repayment Issue: ${event_type}`,
      message: message,
      entity_type: 'FINANCING_APPLICATION',
      entity_id: application_id,
      outlet_id: application?.outlet_id,
      region_id: null, // Will be filled by trigger
      metadata: {
        event_type,
        franchisee_id,
        requested_amount: application?.requested_amount,
      },
      status: 'OPEN',
    });
  
  if (alertError) {
    console.error('Failed to create alert:', alertError);
  }
  
  // 3. Create case for critical issues
  if (severity === 'CRITICAL') {
    await supabase.from('cases').insert({
      case_type: 'REPAYMENT_DEFAULT',
      priority: 'HIGH',
      title: `Payment Default: ${event_type}`,
      description: message,
      entity_type: 'FINANCING_APPLICATION',
      entity_id: application_id,
      outlet_id: application?.outlet_id,
      assigned_to: null, // Will be assigned by HQ
    });
  }
}
```

---

### Phase 5: Frontend Updates
**Files:** `src/components/Financing.tsx` (update)

#### 5.1 Add Repayment Tab
```tsx
const Financing = () => {
  const [activeTab, setActiveTab] = useState<'applications' | 'repayments' | 'reports'>('applications');
  
  return (
    <div className="p-6">
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tab value="applications">Applications</Tab>
        <Tab value="repayments">Repayments</Tab>
        <Tab value="reports">Reports</Tab>
      </Tabs>
      
      {activeTab === 'repayments' && <RepaymentDashboard />}
    </div>
  );
};
```

#### 5.2 Repayment Dashboard Component
```tsx
const RepaymentDashboard = () => {
  const [repayments, setRepayments] = useState([]);
  const [riskScores, setRiskScores] = useState({});
  
  // Subscribe to real-time updates
  useEffect(() => {
    const channel = supabase
      .channel('repayment-updates')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'repayment_events' 
      }, handleRepaymentUpdate)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'application_risk_scores'
      }, handleRiskScoreUpdate)
      .subscribe();
      
    return () => channel.unsubscribe();
  }, []);
  
  return (
    <div className="space-y-6">
      <RiskOverview riskScores={riskScores} />
      <RepaymentScheduleTable repayments={repayments} />
      <RecentEventsFeed />
    </div>
  );
};
```

---

## 📊 Expected Flow After Implementation

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          LENDER SYSTEM                                   │
│    Emits: EMI_PAID, EMI_OVERDUE, DELINQUENCY_STARTED, etc.             │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ POST /functions/v1/lender-bridge/webhook
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    lender-bridge (Edge Function)                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ 1. Validate x-lender-webhook-secret                             │    │
│  │ 2. Idempotency check (event_id)                                  │    │
│  │ 3. Store → repayment_events                                     │    │
│  │ 4. Update financing_applications status                         │    │
│  │ 5. Update repayment_schedule                                    │    │
│  │ 6. Trigger downstream actions (fan-out)                        │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
    ┌───────────────────────────┐  ┌─────────────────────────────┐
    │  repayment-risk-scorer    │  │  repayment-alert-generator  │
    │                           │  │                             │
    │ - Calculate risk scores   │  │ - Create alerts             │
    │ - Store to risk_scores    │  │ - Create cases (critical)   │
    │ - Compare with previous   │  │ - Trigger notifications     │
    └───────────────────────────┘  └─────────────────────────────┘
                    │                         │
                    └────────────┬────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     SUPABASE REALTIME                                    │
│              postgres_changes → Frontend Subscriptions                    │
└────────────────────────────────┬────────────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                         │
│   • Dashboard updates in real-time                                       │
│   • Risk scores visible per application                                  │
│   • Alerts appear immediately                                            │
│   • Repayment schedule auto-updated                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🧪 Testing Plan

### Unit Tests
1. `handleRepaymentWebhook` - idempotency, event type routing
2. `calculateRiskScore` - score calculation accuracy
3. `shouldTriggerAlert` - alert escalation logic

### Integration Tests
1. Webhook → repayment_events storage
2. repayment_events → risk score calculation
3. Risk escalation → alert generation
4. End-to-end: webhook → dashboard update

### Manual Testing
1. Simulate `EMI_PAID` event via curl
2. Verify `repayment_events` record created
3. Verify `application_risk_scores` updated
4. Verify alert created for `EMI_OVERDUE`
5. Verify frontend receives realtime update

---

## 🚀 Rollout Checklist

### Pre-deployment
- [ ] Run new migration on staging
- [ ] Verify all indexes created
- [ ] Test webhook endpoint with sample payloads
- [ ] Verify RLS policies work correctly
- [ ] Test realtime subscriptions

### Deployment
- [ ] Deploy updated `lender-bridge` function
- [ ] Deploy new `repayment-risk-scorer` function
- [ ] Deploy new `repayment-alert-generator` function
- [ ] Update frontend with repayment dashboard

### Post-deployment
- [ ] Monitor `repayment_events` table for new records
- [ ] Verify risk scores are being calculated
- [ ] Check alert creation for test events
- [ ] Monitor error logs for 24 hours

---

## 📝 Sample Webhook Payloads

### EMI Paid Event
```json
{
  "event_id": "evt_123456",
  "lender_code": "GENERIC",
  "application_id": "uuid-here",
  "event_type": "EMI_PAID",
  "amount": 5000.00,
  "currency": "SGD",
  "emi_number": 3,
  "payment_reference": "PAY-789",
  "paid_at": "2026-08-05T10:30:00Z"
}
```

### EMI Overdue Event
```json
{
  "event_id": "evt_123457",
  "lender_code": "GENERIC",
  "application_id": "uuid-here",
  "event_type": "EMI_OVERDUE",
  "emi_number": 4,
  "scheduled_date": "2026-08-01",
  "days_overdue": 5,
  "delinquency_level": "MILD"
}
```

### Delinquency Started Event
```json
{
  "event_id": "evt_123458",
  "lender_code": "GENERIC",
  "application_id": "uuid-here",
  "event_type": "DELINQUENCY_STARTED",
  "emi_number": 4,
  "days_overdue": 10,
  "delinquency_level": "MODERATE",
  "message": "EMI overdue by 10 days. Delinquency status activated."
}
```

---

## 📄 File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/20260805000000_financing_and_reporting.sql` | Update | Add repayment_events, repayment_schedule, application_risk_scores tables + RLS |
| `supabase/functions/lender-bridge/index.ts` | Update | Enhanced webhook handler with repayment event types + fan-out |
| `supabase/functions/repayment-risk-scorer/index.ts` | **New** | Risk score calculation service |
| `supabase/functions/repayment-alert-generator/index.ts` | **New** | Alert generation for repayment events |
| `src/components/Financing.tsx` | Update | Add repayment dashboard with realtime updates |

---

**Author:** Claude
**Last Updated:** 2026-08-05
**Status:** Pending Review
