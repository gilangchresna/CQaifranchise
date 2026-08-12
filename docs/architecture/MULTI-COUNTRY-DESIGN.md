# CQaiFranchise — Multi-Country Franchise Management System

## Vision

> Sistem monitoring franchise berbasis AI untuk Franchisor yang beroperasi di
> **multi-country** (Indonesia, Singapore, Malaysia, Thailand, Vietnam).
> Memberikan real-time visibility ke seluruh jaringan outlets, anomaly detection
> otomatis, dan case management untuk franchisee management.

**Target:** SaaS subscription untuk Franchisor (bukan franchisee). **Model:** HQ
→ Countries → Regions → Regional Managers → Franchisees → Outlets → Staff

---

## Business Context

### Franchise Business Model

```
FRANCHISOR (Pemilik Brand / HQ)
├── Set brand standards, SOP, menu
├── Monitoring seluruh outlets
├── Set fee, royalty, support
└── Collect data → AI insights

FRANCHISEE (Mitra)
├── Beli lisensi → buka outlets
├── Bisa punya 1..N outlets di 1..N regions
├── Responsible: daily ops, staffing, cash flow
└── Bayar royalty ke Franchisor
```

### Current State

- Single-country prototype (Indonesia only, IDR)
- Schema lama: `regions` (Indonesia provinces) tanpa `countries` table
- No real users (auth.users empty)
- sales_transactions: 37K rows tapi FK ke outlets kosong
- Multi-country redesign needed

---

## Multi-Country Hierarchy

```mermaid
graph TB
    subgraph HQ["🏢 HQ / FRANCHISOR"]
        HQ_ADMIN["HQ_ADMIN<br/>Global Access"]
    end

    subgraph COUNTRIES["🌍 COUNTRIES"]
        ID["🇮🇩 Indonesia<br/>IDR • WITA"]
        SG["🇸🇬 Singapore<br/>SGD • SGT"]
        MY["🇲🇾 Malaysia<br/>MYR • MYT"]
        TH["🇹🇭 Thailand<br/>THB • ICT"]
        VN["🇻🇳 Vietnam<br/>VND • ICT"]
    end

    subgraph ID_REGIONS["🇮🇩 Indonesia"]
        ID_JKT["Jakarta (JKT)"]
        ID_JBR["Jawa Barat (JBR)"]
        ID_JTG["Jawa Tengah (JTG)"]
        ID_JTM["Jawa Timur (JTM)"]
        ID_SUM["Sumatera (SUM)"]
    end

    subgraph SG_REGIONS["🇸🇬 Singapore"]
        SG_CENT["Central"]
        SG_NORTH["North"]
        SG_EAST["East"]
    end

    HQ_ADMIN --> COUNTRIES

    ID --> ID_REGIONS
    SG --> SG_REGIONS

    subgraph ID_RM["Regional Manager Indonesia"]
        RM_JKT["RM Jakarta"]
        RM_JBR["RM Jawa Barat"]
    end

    subgraph SG_RM["Regional Manager Singapore"]
        RM_SG["RM Singapore"]
    end

    ID_JKT --> RM_JKT
    ID_JBR --> RM_JBR
    SG_CENT --> RM_SG

    subgraph FRANCHISEES["Franchisees"]
        FA["Franchisee A<br/>(PT Maju Jaya)"]
        FB["Franchisee B<br/>(CV Sejahtera)"]
        FC["Franchisee C<br/>(Pte Ltd)"]
    end

    RM_JKT --> FA
    RM_JBR --> FB
    RM_SG --> FC

    subgraph OUTLETS["Outlets"]
        O_A1["A1 - Jakarta Pusat<br/>🇮🇩 IDR 25K"]
        O_A2["A2 - Bandung<br/>🇮🇩 IDR 25K"]
        O_B1["B1 - Surabaya<br/>🇮🇩 IDR 25K"]
        O_C1["C1 - Orchard<br/>🇸🇬 SGD 12"]
        O_C2["C2 - Jurong<br/>🇸🇬 SGD 12"]
    end

    FA --> O_A1
    FA --> O_A2
    FB --> O_B1
    FC --> O_C1
    FC --> O_C2

    O_A1 --> ST["👤 Staff<br/>Manager + Cashier + Cook"]
    O_C1 --> ST2["👤 Staff<br/>Manager + Cashier"]

    style HQ fill:#1a1a2e,color:#fff
    style COUNTRIES fill:#16213e,color:#fff
    style FRANCHISEES fill:#0f3460,color:#fff
    style OUTLETS fill:#533483,color:#fff
```

### Ownership & Reporting Lines

```
OWNERSHIP (business relationship):
  Franchisee owns Outlets
  HQ owns Country strategy

REPORTING (data access):
  HQ sees everything
  Regional Manager sees all outlets in their region (from all franchisees)
  Franchisee sees their own outlets only
  Staff sees their own outlet only
```

---

## Database Schema

### Entity Relationship

```mermaid
erDiagram
    COUNTRIES {
        int id PK
        string name
        string code UK "ID/SG/MY/TH/VN"
        string currency_code "IDR/SGD/MYR/THB/VND"
        string timezone "Asia/Jakarta etc"
        boolean is_active
        timestamp created_at
    }

    REGIONS {
        int id PK
        int country_id FK
        string name
        string code UK
        string description
        boolean is_active
        timestamp created_at
    }

    USER_PROFILES {
        uuid id PK "FK auth.users"
        int region_id FK "nullable — HQ users"
        int country_id FK "nullable — HQ users"
        string full_name
        string phone
        user_role role
        boolean is_active
        timestamp created_at
    }

    OUTLETS {
        int id PK
        int region_id FK
        uuid franchisee_id FK "user_profiles"
        string name
        string code UK
        string address
        string city
        string phone
        outlet_status status
        decimal daily_target "local currency"
        timestamp created_at
    }

    STAFF_ASSIGNMENTS {
        int id PK
        uuid user_id FK "user_profiles"
        int outlet_id FK
        staff_role role "MANAGER/CASHIER/COOK/DELIVERY"
        boolean is_active
        timestamp created_at
    }

    SALES_TRANSACTIONS {
        bigint id PK
        int outlet_id FK
        string transaction_id UK
        date date
        decimal amount_local "in outlet's local currency"
        string currency_code
        int transaction_count
        int hour
        int day_of_week
        decimal anomaly_score
        boolean is_anomaly
        jsonb metadata
        timestamp created_at
    }

    INVENTORY {
        int id PK
        int outlet_id FK
        string sku
        string product_name
        string category
        int current_stock
        int min_stock
        int max_stock
        string unit
        timestamp last_restock_at
        timestamp updated_at
    }

    ALERTS {
        int id PK
        int outlet_id FK
        alert_type type
        alert_severity severity
        alert_status status
        string title
        text description
        decimal score
        timestamp triggered_at
        timestamp acknowledged_at
        timestamp resolved_at
        timestamp created_at
    }

    CASES {
        int id PK
        int alert_id FK "nullable"
        uuid assigned_to_id FK "user_profiles"
        string title
        text description
        case_priority priority
        case_status status
        timestamp sla_deadline
        timestamp resolved_at
        timestamp created_at
        timestamp updated_at
    }

    NOTIFICATIONS {
        int id PK
        int alert_id FK
        uuid user_id FK
        notification_channel channel
        string recipient
        string subject
        text message
        notification_status status
        string external_id
        timestamp sent_at
        timestamp delivered_at
        text error_message
        timestamp created_at
    }

    EXCHANGE_RATES {
        int id PK
        string from_currency
        string to_currency
        decimal rate
        date effective_date
        timestamp created_at
    }

    ML_MODEL_VERSIONS {
        int id PK
        string model_name
        string version
        string model_type
        text description
        jsonb metrics
        boolean is_production
        timestamp trained_at
        timestamp deployed_at
        timestamp created_at
    }

    ML_PREDICTIONS {
        int id PK
        int outlet_id FK
        int model_version_id FK
        string prediction_type
        jsonb input_features
        decimal score
        jsonb output
        boolean is_anomaly
        date prediction_date
        timestamp created_at
    }

    COUNTRIES ||--o{ REGIONS : has
    REGIONS ||--o{ USER_PROFILES : has
    REGIONS ||--o{ OUTLETS : has
    USER_PROFILES ||--o{ OUTLETS : owns
    USER_PROFILES ||--o{ STAFF_ASSIGNMENTS : assigned
    OUTLETS ||--o{ STAFF_ASSIGNMENTS : has
    OUTLETS ||--o{ SALES_TRANSACTIONS : generates
    OUTLETS ||--o{ INVENTORY : has
    OUTLETS ||--o{ ALERTS : triggers
    OUTLETS ||--o{ ML_PREDICTIONS : predicted
    ALERTS ||--o{ CASES : creates
    ALERTS ||--o{ NOTIFICATIONS : triggers
    USER_PROFILES ||--o{ CASES : assigned_to
    USER_PROFILES ||--o{ NOTIFICATIONS : receives
    ML_MODEL_VERSIONS ||--o{ ML_PREDICTIONS : used_by
```

---

## Access Control Matrix

```mermaid
graph TB
    subgraph ACCESS_CONTROL["Access Control Matrix"]
        HQ["HQ_ADMIN<br/>Global"]
        RM["REGIONAL_MANAGER<br/>Per Region"]
        FO["FRANCHISEE_OWNER<br/>Self Only"]
        ST["FRANCHISEE_STAFF<br/>1 Outlet"]
    end

    subgraph PERMISSIONS["Permissions"]
        P1["✅ All Countries<br/>✅ All Regions<br/>✅ All Outlets<br/>✅ All Reports<br/>✅ User Management<br/>✅ System Settings"]
        P2["✅ Own Region only<br/>✅ All outlets in region<br/>✅ Regional Reports<br/>✅ See franchisee names"]
        P3["✅ Own Outlets only<br/>✅ Own Sales<br/>✅ Own Alerts<br/>✅ Own Inventory"]
        P4["✅ Own Outlet only<br/>✅ View Transactions<br/>✅ Update Stock"]
    end

    HQ --> P1
    RM --> P2
    FO --> P3
    ST --> P4

    style HQ fill:#e74c3c,color:#fff
    style RM fill:#e67e22,color:#fff
    style FO fill:#27ae60,color:#fff
    style ST fill:#3498db,color:#fff
```

---

## Data Flow

```mermaid
graph LR
    POS["POS Terminal<br/>📱 Cashier App"]
    WEBHOOK["Webhook → Edge Function"]
    INGEST["Ingestion Pipeline"]
    ML["ML Anomaly Detection"]
    DASH["Dashboard"]
    ALERT["Alert System"]
    CASES["Case Management"]
    NOTIFY["Notify Franchisee"]
    FRAN["Franchisee Owner"]

    POS -->|"Transaction JSON"| WEBHOOK
    WEBHOOK -->|"Validate + Transform"| INGEST
    INGEST -->|"sales_transactions"| ML
    ML -->|"anomaly_score, is_anomaly"| DASH
    ML -->|"score > threshold"| ALERT
    ALERT -->|"Create Alert"| CASES
    CASES -->|"Assign"| NOTIFY
    NOTIFY -->|"WhatsApp/Email/SMS"| FRAN
```

### Multi-Currency Processing

```mermaid
graph TB
    subgraph INGESTION["Ingestion (Local Currency)"]
        TX["Transaction<br/>Nasi Goreng = Rp 25,000"]
        LOCAL["amount_local<br/>25000"]
        CCY["currency_code<br/>IDR"]
    end

    subgraph REPORTING["HQ Reporting (Base Currency)"]
        FX["Exchange Rate<br/>1 SGD = 10,500 IDR"]
        CONV["Convert to SGD"]
        BASE["amount_base<br/>2.38 SGD"]
    end

    TX --> LOCAL
    LOCAL -->|"Daily rate"| CONV
    CONV --> BASE

    style FX fill:#f39c12,color:#fff
    style BASE fill:#9b59b6,color:#fff
```

---

## Country Configuration

| Country   | Code | Currency | Symbol | Timezone                | Payment Methods              |
| --------- | ---- | -------- | ------ | ----------------------- | ---------------------------- |
| Indonesia | ID   | IDR      | Rp     | Asia/Jakarta (WIB)      | QRIS, Cash, GoPay, OVO, Dana |
| Singapore | SG   | SGD      | S$     | Asia/Singapore (SGT)    | PayNow, Cash, GrabPay        |
| Malaysia  | MY   | MYR      | RM     | Asia/Kuala_Lumpur (MYT) | DuitNow, Cash, Touch'n Go    |
| Thailand  | TH   | THB      | ฿      | Asia/Bangkok (ICT)      | PromptPay, Cash              |
| Vietnam   | VN   | VND      | ₫      | Asia/Ho_Chi_Minh (ICT)  | MoMo, VNPay, Cash            |

---

## Key Design Decisions

### 1. Currency Strategy

**Decision:** Store all amounts in local currency. Convert to base currency
(SGD) only for HQ reporting.

**Rationale:**

- Franchisees operate in local currency → simplicity
- Avoid rounding errors in transaction data
- Exchange rates change daily → store in `exchange_rates` table
- HQ dashboard converts on-the-fly for comparison

**Trade-offs:**

- Real-time conversion needs FX API or daily rate updates
- Historical reports need point-in-time exchange rates

### 2. User Authentication

**Decision:** Use Supabase Auth for all users. HQ creates user → invite via
email.

**User flow:**

1. HQ Admin creates user via dashboard
2. Email invite → user sets password
3. `auth.users` created → `user_profiles` auto-created via trigger
4. HQ Admin assigns role, region, country

### 3. Staff Management

**Decision:** Staff assigned to outlets via `staff_assignments` junction table
(many-to-many via user_profiles).

**Rationale:**

- Staff can work at multiple outlets (e.g., floating staff)
- Role is per-outlet (cashier at Outlet A, cook at Outlet B)

### 4. Franchisee Multi-Region

**Decision:** A franchisee can own outlets across multiple regions and
countries.

**Schema:**

- `outlets.franchisee_id` → points to `user_profiles` (franchisee)
- `outlets.region_id` → geographic region
- No restriction on franchisee → region relationship

### 5. ML Pipeline Per Country

**Decision:** Train separate models per country (or per currency zone).

**Rationale:**

- Spending patterns differ by country/culture
- Singapore outlets: higher average transaction, different peak hours
- Indonesia: weekend vs weekday patterns differ by region

---

## Implementation Phases

### Phase 1: Schema Migration (Week 1-2)

- [ ] Add `countries` table
- [ ] Add `staff_assignments` table
- [ ] Add `exchange_rates` table
- [ ] Add `currency_code` to `outlets`
- [ ] Add `amount_local` + `currency_code` to `sales_transactions`
- [ ] Drop old `regions` seed data (Indonesia-only)
- [ ] Seed countries: ID, SG, MY
- [ ] Seed regions per country

### Phase 2: Auth & User Management (Week 2-3)

- [ ] Configure Supabase Auth
- [ ] Update `user_profiles` trigger (add country_id)
- [ ] Update RLS policies for multi-country
- [ ] Create HQ Admin dashboard
- [ ] Create user invitation flow

### Phase 3: Seed Data (Week 3-4)

- [ ] Seed regions (ID: 5, SG: 3, MY: 3)
- [ ] Seed franchisees per region
- [ ] Seed outlets per franchisee
- [ ] Fix `sales_transactions` FK → real outlet_ids
- [ ] Seed realistic POS data per country (with correct currency)

### Phase 4: Dashboard & Reporting (Week 4-6)

- [ ] Multi-country dashboard (country filter)
- [ ] Currency conversion on dashboard
- [ ] Region drill-down
- [ ] HQ consolidated report (SGD base)

### Phase 5: ML Pipeline (Week 6-8)

- [ ] Per-country anomaly detection
- [ ] Retrain models with multi-country data
- [ ] Accuracy tracking per country

---

## Issues to Fix (Immediate)

| Priority | Issue                                  | Fix                                |
| -------- | -------------------------------------- | ---------------------------------- |
| P0       | `regions` table empty                  | Seed Indonesia + Singapore first   |
| P0       | `outlets` table empty                  | Seed outlets linked to regions     |
| P0       | `sales_transactions` FK broken         | Re-seed with real outlet_ids       |
| P0       | `SUPABASE_SERVICE_ROLE_KEY` = anon key | Replace with real service role key |
| P1       | Amount mismatch (IDR vs USD)           | Fix POS backfill amount formula    |
| P1       | `user_profiles` has fake UUIDs         | Reset + use real auth.users        |
| P2       | No exchange_rates table                | Add + seed daily rates             |
| P2       | Staff assignments missing              | Add `staff_assignments` table      |

---

## Open Questions

1. **Country first?** Indonesia only (MVP) or start with 2 countries?
2. **Base currency?** SGD or keep flexible?
3. **HQ location?** Singapore or Indonesia?
4. **Payment gateway per country?** Integrate local payment APIs?
5. **Menu pricing?** Different price per country or same menu, different
   currency?

---

_Last updated: August 11, 2026_ _Author: ERP Team_
