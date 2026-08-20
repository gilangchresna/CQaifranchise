# AIFrCQ Team Analysis: Settings & Store Preferences
## Team Analysis Document

**Date:** August 20, 2026
**Prepared by:** AIFrCQ Team
**Purpose:** Analyze optimal settings structure per role

---

## Current State

### Settings.tsx (Existing)
```
├── Notifications
│   ├── Email: ON/OFF
│   └── WhatsApp: ON/OFF
│
├── Thresholds & SLA
│   ├── Anomaly threshold: 15
│   ├── Stockout threshold: 70
│   ├── SLA Warning: 50
│   ├── SLA Escalation: 75
│   └── SLA Hours (P1/P2/P3)
│
├── AI & Security
│   ├── AI Mode: assist/auto
│   ├── Threshold: 80
│   ├── Caching: ON/OFF
│   ├── Allowlist: ON/OFF
│   ├── Injection Filter: ON/OFF
│   └── Audit Log: ON/OFF
```

**Issue:** One-size-fits-all settings. No role differentiation.

---

## Team Analysis

### 1. CTO (Jarrod) Perspective

**Role:** Owner, Decision Maker

**Key Concerns:**
| Concern | Implication for Settings |
|---------|------------------------|
| Lender adoption | Settings must be simple for lenders |
| Regulatory compliance | Audit trails important |
| Multi-tenant | Settings per franchisee/franchisor |
| Platform fees | Settings that drive revenue |

**Recommended Settings:**
```yaml
Platform Level:
├── Compliance Settings
│   ├── PDPA consent required: YES
│   ├── Data retention (months): 84
│   └── Audit logging: ENABLED
│
└── Platform Config
    ├── Max loan amount: 1,000,000
    ├── Platform fee (%): 1.5
    └── Currency: SGD
```

---

### 2. Fullstack (Stefanus) Perspective

**Role:** Technical Implementation

**Key Technical Considerations:**
| Consideration | Implementation |
|--------------|----------------|
| Storage | Settings in user_profiles or separate table? |
| Access Control | RLS policies per role |
| Default Values | Fallback if setting not set |
| Migration | Backward compatibility |

**Database Design:**
```sql
-- Option A: JSONB in user_profiles (simpler)
user_profiles.settings JSONB DEFAULT '{}'

-- Option B: Separate settings table (scalable)
CREATE TABLE user_settings (
  user_id UUID PRIMARY KEY,
  category VARCHAR(50),  -- 'notifications', 'risk', 'notifications'
  key VARCHAR(100),
  value JSONB,
  updated_at TIMESTAMPTZ
);

-- Option C: Role-based defaults (recommended)
CREATE TABLE role_defaults (
  role VARCHAR(50),
  category VARCHAR(50),
  settings JSONB,
  updated_at TIMESTAMPTZ
);
```

**Recommended:** Option C - Role-based defaults with user overrides.

---

### 3. Finance Analyst Perspective

**Role:** Risk Thresholds, Lender Requirements

**Key Financial Settings:**
| Category | Setting | Rationale |
|----------|---------|-----------|
| Risk Thresholds | Low Risk: 80-100 | Conservative |
| Risk Thresholds | Medium Risk: 60-79 | Standard |
| Risk Thresholds | High Risk: 40-59 | Review needed |
| Risk Thresholds | Critical: 0-39 | Decline |
| Loan Limits | Max amount per outlet | Based on revenue |
| Loan Limits | Max term (months) | 12-36 typical |
| Loan Limits | Interest rate floor | 5% p.a. minimum |

**Lender-Specific Settings:**
```yaml
Lender: [Bank ABC]
├── Risk Score Weights
│   ├── Payment History: 35%
│   ├── Cash Flow: 25%
│   ├── Leverage: 15%
│   ├── Compliance: 15%
│   └── Credit Bureau: 10%
│
├── Loan Parameters
│   ├── Max Amount: 500,000 SGD
│   ├── Max Term: 24 months
│   ├── Interest Rate: 8.5% - 12%
│   └── Processing Fee: 1%
│
└── Notification Preferences
    ├── New Application: EMAIL
    ├── Status Change: SMS + EMAIL
    └── Weekly Summary: EMAIL
```

---

### 4. QA/Ops Perspective

**Role:** Testing, Data Quality

**Quality Settings:**
| Category | Setting | Notes |
|----------|---------|-------|
| Validation | Required docs check | Block if missing |
| Validation | Data freshness (days) | Alert if stale |
| Notifications | SLA breach alerts | Critical |
| Notifications | System health | Daily digest |
| Testing | Sandbox mode | For dev/preview |

**Operational Settings:**
```yaml
Operations:
├── Data Quality
│   ├── Cash flow refresh: 30 days
│   ├── Alert if data stale: 7 days
│   └── Validation strict mode: ON
│
├── Notifications
│   ├── SLA breach: IMMEDIATE
│   ├── Daily summary: EMAIL
│   └── Error alerts: SMS
│
└── Testing
    ├── Sandbox mode: OFF (prod)
    └── Debug logging: OFF
```

---

## Recommended Settings Structure

### By User Level

```
SETTINGS HIERARCHY
─────────────────────

┌─────────────────────────────────────────────┐
│ PLATFORM LEVEL (CyberQuote Admin)           │
├─────────────────────────────────────────────┤
│ • Compliance settings                       │
│ • Platform fees                             │
│ • Max loan amounts                         │
│ • Supported countries                       │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│ FRANCHISOR LEVEL (HQ - steve.gilang)        │
├─────────────────────────────────────────────┤
│ • Risk score weights                        │
│ • Required documents                       │
│ • Notification preferences                  │
│ • Outlet defaults                          │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│ FRANCHISEE LEVEL (alice, outlets)          │
├─────────────────────────────────────────────┤
│ • Contact preferences                       │
│ • Notification toggles                      │
│ • Personal profile                         │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│ LENDER LEVEL (External banks/P2P)           │
├─────────────────────────────────────────────┤
│ • Risk thresholds                          │
│ • Loan parameters                          │
│ • Report preferences                       │
│ • API access                              │
└─────────────────────────────────────────────┘
```

---

## Proposed Settings Pages

### Page 1: Platform Admin (Future)
```
Settings > Platform
├── Compliance
│   ├── PDPA compliance: ENABLED
│   ├── Data retention: 84 months
│   └── Audit logging: ENABLED
├── Fees
│   ├── Platform fee: 1.5%
│   └── Minimum loan: 10,000 SGD
└── Countries
    ├── Singapore: ENABLED
    └── Indonesia: ENABLED
```

### Page 2: Franchisor Settings (NEW - Recommended)
```
Settings > Franchisor
├── Risk Weights
│   ├── Payment History: [35]%
│   ├── Cash Flow: [25]%
│   ├── Leverage: [15]%
│   └── Compliance: [25]%
├── Document Requirements
│   ├── Singapore
│   │   ├── ACRA Annual: REQUIRED
│   │   └── XBRL: REQUIRED
│   └── Indonesia
│       ├── AHU Annual: REQUIRED
│       ├── LKPM Q1-Q4: REQUIRED
│       └── SPT: REQUIRED
└── Notifications
    ├── New financing application: ON
    ├── Missing documents: ON
    └── Weekly summary: ON
```

### Page 3: Franchisee Settings (NEW - Recommended)
```
Settings > Profile
├── Notifications
│   ├── Application updates: EMAIL
│   ├── Document reminders: EMAIL + SMS
│   └── Approval/Rejection: EMAIL
├── Contact
│   ├── Email: alice@outlet.com
│   ├── Phone: +65 XXXX XXXX
│   └── Preferred: EMAIL
└── Preferences
    ├── Language: English
    └── Timezone: Asia/Singapore
```

### Page 4: Lender Settings (NEW - Recommended)
```
Settings > Lender
├── Risk Thresholds
│   ├── Approve: Score >= [80]
│   ├── Review: Score >= [60]
│   └── Decline: Score < [60]
├── Loan Parameters
│   ├── Max Amount: [500,000] SGD
│   ├── Max Term: [24] months
│   └── Interest Rate: [8.5]% - [12]%
├── Notifications
│   ├── New applications: ON
│   ├── Status changes: ON
│   └── Daily digest: ON
└── Reports
    ├── Format: [PDF]
    └── Include: [All data points]
```

---

## Implementation Recommendation

### Priority Matrix

| Settings | Priority | Effort | Impact |
|----------|----------|--------|--------|
| **Franchisor Risk Weights** | 🔴 P0 | 2 days | HIGH |
| **Franchisor Doc Requirements** | 🔴 P0 | 2 days | HIGH |
| **Lender Risk Thresholds** | 🔴 P0 | 2 days | HIGH |
| **Franchisee Notifications** | 🟡 P1 | 1 day | MEDIUM |
| **Platform Admin Settings** | 🟢 P2 | 1 week | LOW |
| **Lender Report Format** | 🟢 P2 | 2 days | MEDIUM |

### Recommended Implementation Order

1. **Franchisor Risk Weights** - Enable lenders to customize
2. **Franchisor Doc Requirements** - Complete regulatory flow
3. **Lender Risk Thresholds** - Complete lender onboarding
4. **Franchisee Notifications** - Improve UX
5. **Platform Admin** - Future when multiple franchisors

---

## Database Changes Needed

```sql
-- Add settings JSONB columns
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';

-- For lender-specific settings (new table)
CREATE TABLE lender_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lender_id UUID NOT NULL REFERENCES user_profiles(id),
  risk_thresholds JSONB DEFAULT '{"low": 80, "medium": 60, "high": 40}',
  loan_params JSONB DEFAULT '{"max_amount": 500000, "max_term": 24}',
  notification_prefs JSONB DEFAULT '{"email": true}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Franchisor-specific settings (new table)
CREATE TABLE franchisor_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchisor_id UUID NOT NULL REFERENCES user_profiles(id),
  risk_weights JSONB DEFAULT '{"payment": 35, "cashflow": 25, "leverage": 15, "compliance": 15, "creditbureau": 10}',
  doc_requirements JSONB DEFAULT '{"sg": ["ACRA", "XBRL"], "idn": ["AHU", "LKPM", "SPT"]}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Conclusions

### From CTO:
- Settings should be **role-based** and **hierarchical**
- **Lender customization** is critical for adoption
- **Compliance settings** must be auditable

### From Finance:
- **Risk thresholds** must be lender-configurable
- **Loan parameters** affect business directly
- **Notification preferences** for operational efficiency

### From Fullstack:
- **JSONB storage** is flexible and scalable
- **Role defaults** with user overrides pattern works best
- **Migration planning** needed for backward compatibility

### From QA/Ops:
- **Data freshness** settings prevent stale data issues
- **Validation strict mode** for quality control
- **Test settings** for sandbox/preview environments

---

## Final Recommendation

**Build settings in this order:**

1. **Franchisor Risk Weights** (2 days)
   - Risk weight sliders
   - Save to franchisor_settings table
   
2. **Franchisor Doc Requirements** (2 days)
   - Toggle required docs per country
   - Link to regulatory docs enforcement

3. **Lender Risk Thresholds** (2 days)
   - Score thresholds
   - Loan parameters
   - Notification preferences

4. **Franchisee Notifications** (1 day)
   - Contact preferences
   - Notification toggles

5. **Platform Admin** (Future)
   - Only when multiple franchisors on platform

---

**Document Ends**
*AIFrCQ Team Analysis*
