# CyberQuote MVP - Technical Documentation

**Version:** 1.0  
**Date:** July 16, 2026  
**Status:** Complete

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [Edge Functions](#edge-functions)
5. [API Reference](#api-reference)
6. [Frontend Components](#frontend-components)
7. [Cron Jobs](#cron-jobs)
8. [Configuration](#configuration)

---

## System Overview

CyberQuote MVP is a real-time monitoring system for 30 franchise outlets in Indonesia. It provides:

- **ML-Powered Alerts**: Anomaly detection and stockout prediction
- **Case Management**: Workflow from alert to resolution
- **Multi-tenant**: Supports multiple regions and outlets

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                         │
│   Dashboard | Alerts | Outlets | Workflows | Agents | Settings  │
└─────────────────────────────────────────────────────────────────┘
                              ↓ REST API
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE (Backend-as-a-Service)              │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │ PostgreSQL   │  │ Edge Funcs   │  │ Auth + RLS             │ │
│  │ 16 tables    │  │ 34 functions │  │ Row-Level Security     │ │
│  └──────────────┘  └──────────────┘  └───────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    ML PIPELINE (Deno)                            │
│   ml-anomaly-score | ml-stockout-risk | alert-generator         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Core Tables

| Table | Records | Description |
|-------|---------|-------------|
| `regions` | 9 | Geographic regions (Jakarta, Bandung, Surabaya, etc.) |
| `outlets` | 24 | Franchise outlets with sales_summary |
| `alerts` | 26 | Generated alerts (anomaly, stockout) |
| `cases` | 12 | Case workflow management |
| `sales_transactions` | 720 | 30 days of sales data |
| `inventory` | 105 | Product inventory (5 products × 21 outlets) |
| `staff` | 104 | Workforce/staff members |
| `ai_agents` | 7 | AI agent configurations |
| `ml_model_versions` | 4 | ML model registry |
| `integrations` | 4 | External system integrations |

### Table Schemas

#### regions
```sql
CREATE TABLE regions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(10) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### outlets
```sql
CREATE TABLE outlets (
  id SERIAL PRIMARY KEY,
  region_id INTEGER REFERENCES regions(id),
  name VARCHAR(200) NOT NULL,
  code VARCHAR(20) UNIQUE,
  status VARCHAR(20) DEFAULT 'ACTIVE',
  sales_summary JSONB DEFAULT '{}',
  alerts_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### alerts
```sql
CREATE TABLE alerts (
  id SERIAL PRIMARY KEY,
  outlet_id INTEGER REFERENCES outlets(id),
  type VARCHAR(50), -- SALES_ANOMALY, STOCKOUT_RISK
  severity VARCHAR(20), -- P0_CRITICAL, P1_HIGH, P2_MEDIUM, P3_LOW
  status VARCHAR(20) DEFAULT 'NEW',
  title VARCHAR(200),
  description TEXT,
  score DECIMAL(5,3),
  triggered_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Edge Functions

### List (34 Functions)

| Function | Method | Purpose |
|----------|--------|---------|
| `alerts-list` | GET | List alerts with filters |
| `franchises-list` | GET | List outlets with sales summary |
| `regions-list` | GET | List regions with outlet counts |
| `agents-list` | GET | List AI agents |
| `staff-list` | GET | List staff/workforce |
| `ml-models-list` | GET | List ML models |
| `users-list` | GET | List users |
| `case-create` | POST | Create case from alert |
| `case-update` | POST | Update case status |
| `case-assigner` | POST | Assign case to user |
| `notification-send` | POST | Send notification (email/whatsapp) |
| `ml-anomaly-score` | POST | Calculate anomaly score |
| `ml-stockout-risk` | POST | Predict stockout risk |
| `ml-batch-score` | POST | Batch ML scoring |
| `ml-scheduler` | POST | Orchestrate ML jobs |
| `alert-generator` | POST | Generate alert |
| `alert-update` | POST | Update alert status |
| `cron-run` | POST | Run scheduled tasks |
| `seed-sales` | POST | Seed sales data |
| `seed-inventory` | POST | Seed inventory data |
| `seed-integrations` | POST | Seed integrations |

---

## API Reference

### Authentication
All requests require:
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

### Endpoints

#### GET /functions/v1/alerts-list
```json
Response:
{
  "data": [
    {
      "id": 1,
      "type": "SALES_ANOMALY",
      "severity": "P1_HIGH",
      "status": "NEW",
      "title": "Sales Pattern Anomaly",
      "score": 0.85,
      "outlet": { "id": 22, "name": "Jakarta Pusat" },
      "region": { "id": 1, "name": "Jakarta" }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total_count": 26
  }
}
```

#### POST /functions/v1/ml-anomaly-score
```json
Request:
{ "outlet_id": 37, "current_sales": 12000000 }

Response:
{
  "is_anomaly": false,
  "score": 1.19,
  "threshold": 2.5,
  "percentile": 23,
  "message": "Normal sales pattern"
}
```

#### POST /functions/v1/ml-stockout-risk
```json
Request:
{ "outlet_id": 37 }

Response:
[
  {
    "outlet_id": 37,
    "product_name": "Mie Ayam Original",
    "risk_level": "LOW",
    "risk_score": 0,
    "days_until_stockout": 55,
    "current_stock": 55,
    "avg_daily_usage": 1
  }
]
```

---

## Frontend Components

| Component | Status | Data Source |
|----------|--------|-------------|
| Dashboard | ✅ Working | alerts-list, franchises-list |
| AlertsList | ✅ Working | alerts-list, case-create |
| Outlets | ✅ Working | franchises-list, regions-list |
| Workflows | ✅ Working | case-create, case-update |
| Agents | ✅ Working | agents-list |
| Workforce | ✅ Working | staff-list |
| Models | ✅ Working | ml-models-list |
| Integrations | ✅ Working | integrations table |
| Settings | ✅ Working | settings-get |
| AccessManagement | ✅ Working | users-list |
| AICopilot | ⚠️ Partial | athena-chat (simulated) |

---

## Cron Jobs

### Schedule
```sql
-- ML Anomaly Check: Every 15 minutes
SELECT cron.schedule('ml-anomaly-check', '*/15 * * * *', ...);

-- Stockout Risk Check: Every hour
SELECT cron.schedule('ml-stockout-check', '0 * * * *', ...);

-- ML Batch Score: Every 6 hours
SELECT cron.schedule('ml-batch-score', '0 */6 * * *', ...);

-- Alert Cleanup: Daily at midnight
SELECT cron.schedule('alert-cleanup', '0 0 * * *', ...);
```

### Orchestrator
`cron-run` function runs all ML jobs in sequence:
1. ml-anomaly-score
2. ml-stockout-risk
3. alert-generator

---

## Configuration

### Environment Variables
```
VITE_SUPABASE_URL=https://ploqeifazcgzwjzmukgp.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Required API Keys (Optional)
- `TWILIO_ACCOUNT_SID` - WhatsApp notifications
- `TWILIO_AUTH_TOKEN` - WhatsApp notifications
- `TWILIO_WHATSAPP_FROM` - WhatsApp sender
- `SENDGRID_API_KEY` - Email notifications

---

## Status Summary

### ✅ Complete
- Database with 10 tables and 1000+ records
- 34 Edge Functions deployed
- ML Pipeline (anomaly + stockout)
- E2E workflow (Alert → Case → Resolution)
- Frontend integration (11 components)
- Cron job orchestration

### ⚠️ Pending
- pg_cron setup (requires Supabase Pro)
- Twilio/SendGrid configuration
- Production deployment

---

**Last Updated:** July 16, 2026
