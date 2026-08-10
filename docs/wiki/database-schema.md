# Database Schema

52 migrations. 37+ tables. Key schema:

## Entity-Relationship Diagram

```mermaid
erDiagram
    REGIONS ||--o{ OUTLETS : "has"
    REGIONS {
        int id PK
        string name
        string code UK
        timestamptz created_at
    }

    USER_PROFILES ||--o| REGIONS : "belongs to"
    USER_PROFILES ||--o{ OUTLETS : "owns"
    USER_PROFILES ||--o{ CASES : "assigned to"
    USER_PROFILES {
        uuid id PK FK auth.users
        int region_id FK
        string role "HQ_ADMIN|REGIONAL_MANAGER|FRANCHISEE_OWNER|FRANCHISEE_STAFF"
        string full_name
        bool is_active
        timestamptz created_at
    }

    OUTLETS }o--|| REGIONS : "in"
    OUTLETS ||--o{ SALES_TRANSACTIONS : "generates"
    OUTLETS ||--o{ INVENTORY : "holds"
    OUTLETS ||--o{ ALERTS : "triggers"
    OUTLETS {
        int id PK
        int region_id FK
        uuid franchisee_id FK
        string name
        string code UK
        outlet_status status
        decimal daily_target
        timestamptz created_at
    }

    SALES_TRANSACTIONS {
        bigint id PK
        int outlet_id FK
        string transaction_id UK
        date date
        decimal amount
        int transaction_count
        int hour
        int day_of_week
        decimal anomaly_score
        bool is_anomaly
        jsonb metadata
        timestamptz created_at
    }

    INVENTORY }o--|| OUTLETS : "at"
    INVENTORY {
        int id PK
        int outlet_id FK
        string sku
        string product_name
        string category
        int current_stock
        int min_stock
        int max_stock
        timestamptz updated_at
    }

    OUTLETS ||--o{ ALERTS : "triggers"
    ALERTS ||--o| CASES : "escalates to"
    ALERTS ||--o{ NOTIFICATIONS : "triggers"
    ALERTS ||--o| AI_EXPLANATIONS : "explains"
    ALERTS {
        int id PK
        int outlet_id FK
        alert_type type
        alert_severity severity
        alert_status status
        string title
        text description
        decimal score
        timestamptz triggered_at
        timestamptz acknowledged_at
        timestamptz resolved_at
    }

    CASES }o--|| USER_PROFILES : "assigned to"
    CASES {
        int id PK
        int alert_id FK
        uuid assigned_to_id FK
        string title
        case_priority priority
        case_status status
        timestamptz sla_deadline
        timestamptz resolved_at
    }

    NOTIFICATIONS }o--|| USER_PROFILES : "to"
    NOTIFICATIONS {
        int id PK
        int alert_id FK
        uuid user_id FK
        notification_channel channel
        notification_status status
        string recipient
        text message
        timestamptz sent_at
    }

    AI_EXPLANATIONS }o--|| USER_PROFILES : "for user"
    AI_EXPLANATIONS {
        int id PK
        int alert_id FK
        uuid user_id FK
        text question
        text answer
        string model_used
        int tokens_used
        timestamptz created_at
    }
```

## ENUM Types

| Enum | Values |
|------|--------|
| `user_role` | `HQ_ADMIN`, `REGIONAL_MANAGER`, `FRANCHISEE_OWNER`, `FRANCHISEE_STAFF` |
| `outlet_status` | `ACTIVE`, `INACTIVE`, `SUSPENDED` |
| `alert_type` | `SALES_ANOMALY`, `STOCKOUT_RISK`, `ATTENDANCE_ISSUE`, `COMPLAINT`, `SYSTEM` |
| `alert_severity` | `P0_CRITICAL`, `P1_HIGH`, `P2_MEDIUM`, `P3_LOW` |
| `alert_status` | `NEW`, `ACKNOWLEDGED`, `IN_PROGRESS`, `RESOLVED`, `CLOSED` |
| `case_priority` | `URGENT`, `HIGH`, `MEDIUM`, `LOW` |
| `case_status` | `NEW`, `IN_PROGRESS`, `PENDING_INFO`, `RESOLVED`, `CLOSED` |
| `notification_channel` | `WHATSAPP`, `EMAIL`, `PUSH`, `ALL` |
| `notification_status` | `PENDING`, `SENT`, `DELIVERED`, `FAILED` |

## Core Tables

### `regions`

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| name | VARCHAR(100) | e.g. "Singapore", "Jakarta" |
| code | VARCHAR(20) UK | e.g. "SG", "JKT" |
| currency_code | — | Added later — SGD/IDR/THB/MYR |

**Indexes**: `idx_regions_code`

### `user_profiles`

Extends Supabase `auth.users`. FK to `auth.users(id)`.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK FK auth.users | |
| region_id | INTEGER FK regions | |
| role | user_role | Default: FRANCHISEE_OWNER |
| full_name | VARCHAR(200) | |
| phone | VARCHAR(20) | |
| is_active | BOOLEAN | Default: true |

**Indexes**: `idx_user_profiles_region`, `idx_user_profiles_role`

### `outlets`

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | IDs 164-171 in current DB |
| region_id | INTEGER FK regions | |
| franchisee_id | UUID FK user_profiles | |
| name | VARCHAR(200) | |
| code | VARCHAR(20) UK | e.g. "MT-WDL-001", "NL-AMK-001" |
| status | outlet_status | Default: ACTIVE |
| daily_target | DECIMAL(15,2) | Revenue target |
| address, city, phone | various | |

**Indexes**: `idx_outlets_region`, `idx_outlets_franchisee`, `idx_outlets_code`, `idx_outlets_status`

### `sales_transactions`

**Primary fact table.** 8 outlets (164-171) × daily transactions.

| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL PK | |
| outlet_id | INTEGER FK outlets | |
| transaction_id | VARCHAR(100) UK | Idempotency key |
| date | DATE | Partition key |
| amount | DECIMAL(15,2) | In local currency (SGD assumed) |
| transaction_count | INTEGER | Default: 1 |
| hour | INTEGER | 0-23 |
| day_of_week | INTEGER | 0-6 (Sun-Sat) |
| anomaly_score | DECIMAL(5,4) | Z-score |
| is_anomaly | BOOLEAN | Default: false |
| metadata | JSONB | payment_method, tax, discount, etc. |

**Indexes**: `(outlet_id, date)`, `transaction_id`, `date`, `(is_anomaly)` partial

### `alerts`

Generated by `coordinator-pipeline` (L4 ML).

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| outlet_id | INTEGER FK outlets | |
| type | alert_type | SALES_ANOMALY, STOCKOUT_RISK, etc. |
| severity | alert_severity | P0_CRITICAL → P3_LOW |
| status | alert_status | NEW → CLOSED |
| title | VARCHAR(200) | |
| description | TEXT | |
| score | DECIMAL(5,4) | Z-score or confidence |
| triggered_at | TIMESTAMPTZ | When alert fired |

**Indexes**: `outlet_id`, `status`, `severity`, `type`, `triggered_at DESC`

### `cases`

L6 workflow. Created from alerts.

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| alert_id | INTEGER FK alerts | Nullable |
| assigned_to_id | UUID FK user_profiles | Case owner |
| title, description | VARCHAR/TEXT | |
| priority | case_priority | URGENT/HIGH/MEDIUM/LOW |
| status | case_status | NEW → CLOSED |
| sla_deadline | TIMESTAMPTZ | Auto-set on creation |
| resolved_at | TIMESTAMPTZ | |

**Indexes**: `alert_id`, `assigned_to_id`, `status`, `priority`, `sla_deadline` partial

## ML/Analytics Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `outlet_features` | Feature store for ML | revenue_7d_avg, anomaly_z, stockout_risk |
| `ml_anomaly_scores` | Per-outlet anomaly scores | z_score, percentile, status |
| `ml_stockout_risks` | Stockout predictions | risk_score, days_until_stockout |
| `outlet_classifications` | Outlet type/size/tier | outlet_type, location_type, size_category |
| `peer_metrics` | Peer benchmarking | revenue, staff_productivity, peer_avg_revenue |
| `ml_model_versions` | Model registry | model_name, version, metrics, is_production |
| `anomaly_labels` | ML ground truth | outlet_id, date, label (buy/sell/hold) |

## Knowledge Base Tables

| Table | Purpose |
|-------|---------|
| `knowledge_embeddings` | pg_vector embeddings |
| `knowledge_sops` | Standard Operating Procedures |
| `knowledge_manuals` | Outlet manuals |
| `knowledge_incidents` | Incident reports |
| `knowledge_policies` | Franchise policies |

## Agent System Tables (Aug 11)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `agents` | 6 registered agents | id, name, role, status, capabilities |
| `agent_tasks` | Task execution log (UUID PK) | task_id, agent_id, status, input_data, output_data |
| `agent_metrics` | Performance metrics | metric_type, metric_value, period (daily/hourly) |
| `agent_logs` | Event log | level (log_level), message, task_id |

## Workflow Tables

| Table | Purpose |
|-------|---------|
| `notifications` | Outbound notifications (WhatsApp/Email) |
| `notification_logs` | Notification delivery log |
| `ai_audit_log` | Athena chat audit trail |
| `approval_requests` | Multi-level approvals |
| `approval_rules` | Approval routing rules |
| `approval_history` | Approval audit trail |
| `sla_escalation_runs` | Cron tracking for SLA timers |
| `sla_breach_events` | SLA breach records |
| `alert_thresholds` | Configurable alert thresholds |
| `threshold_violations` | Threshold breach log |

## Financing Tables

| Table | Purpose |
|-------|---------|
| `financing_applications` | Loan applications |
| `lender_webhook_events` | Lender webhook events |
| `lender_webhook_events` | Lender webhook events |

## Key Foreign Key Relationships

```
auth.users ─────────────────────────┐
  └─ user_profiles(id) ─────────────┐
       ├─ outlets(franchisee_id)     │
       ├─ cases(assigned_to_id)      │
       ├─ notifications(user_id)    │
       └─ ai_explanations(user_id)   │
                                    │
regions(id) ─────────────────────────┼── outlets(region_id)
  └─ outlets ──────────────────────┼── sales_transactions(outlet_id)
       ├─ alerts(outlet_id) ───────┼── cases(alert_id)
       │                            └─ notifications(alert_id)
       ├─ inventory(outlet_id)       └─ ai_explanations(alert_id)
       ├─ ml_anomaly_scores(outlet_id)
       └─ ml_stockout_risks(outlet_id)
```

## RLS Strategy

All tables have `ALTER TABLE ENABLE ROW LEVEL SECURITY`. Policies use:

```sql
-- User sees only their outlets
auth.uid() = user_profiles.id
  AND outlet_id IN (
    SELECT outlet_id FROM user_outlets WHERE user_id = auth.uid()
  )

-- Service role bypasses all RLS
auth.role() = 'service_role'
```

## Missing Columns (Known Issues)

| Table | Missing | Expected |
|-------|---------|-----------|
| `sales_transactions` | `payment_method`, `tax`, `cost`, `discount`, `platform_fee` | Added by pos-webhook but may not exist in schema |
| `regions` | `currency_code` | Added in later migration |
| `alerts` | `metadata` JSONB | May not exist in all DBs |

Run in Supabase SQL Editor to check:
```sql
SELECT column_name FROM information_schema.columns WHERE table_name = 'sales_transactions';
```
