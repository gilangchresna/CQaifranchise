# CyberQuote ML Data Pipeline Design

**Document Type:** Technical Design Document  
**Role:** ML Engineer (Fajar)  
**Focus:** Sales Forecasting & Stockout Prediction  
**Date:** July 20, 2026  

---

## 1. Executive Summary

This document outlines the complete data pipeline architecture for CyberQuote's ML features, specifically targeting **sales anomaly detection** and **stockout prediction**. The pipeline handles data ingestion, feature engineering, quality monitoring, real-time/batch processing, and anomaly detection on incoming data streams.

### Key Components
- **Data Ingestion Layer** (POS Webhooks, CSV, ERP MCP)
- **Feature Engineering Pipeline** (real-time & batch features)
- **Data Quality Monitoring** (validation, drift detection)
- **ML Inference Engine** (anomaly detection, stockout prediction)
- **Alert Generation System** (automated alert creation)

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DATA INGESTION LAYER                                │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                 │
│  │  POS Webhooks  │  │   CSV Upload   │  │   ERP MCP      │                 │
│  │  (Near Real-T) │  │   (Batch)      │  │   (Sync)       │                 │
│  └───────┬────────┘  └───────┬────────┘  └───────┬────────┘                 │
│          │                    │                    │                         │
│          └─────────────────────┼────────────────────┘                         │
│                                ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    VALIDATION GATE (data-validator)                  │   │
│  │   • Schema validation   • Business rules   • Duplicate detection     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                │                                              │
└────────────────────────────────┼────────────────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      OPERATIONAL DATA STORE (ODS)                           │
│  PostgreSQL - Core Tables                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │sales_transactions│  │    inventory     │  │    ml_scores     │          │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │     outlets     │  │  ml_scheduler    │  │    alerts        │          │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘          │
└─────────────────────────────────────────────────────────────────────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                  ▼
┌─────────────────────────┐ ┌─────────────────────────┐ ┌─────────────────────────┐
│   FEATURE STORE (RT)   │ │   FEATURE STORE (Batch) │ │   QUALITY MONITORING    │
│   In-Memory/Cache      │ │   PostgreSQL Views      │ │   Prometheus + Alerts   │
│   • Rolling windows     │ │   • Daily aggregates    │ │   • Drift detection      │
│   • Latest N values    │ │   • Weekly trends       │ │   • Data freshness       │
└─────────────────────────┘ └─────────────────────────┘ └─────────────────────────┘
              │                  │                  │
              └──────────────────┼──────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ML INFERENCE LAYER                                 │
│  ┌────────────────────────┐    ┌────────────────────────┐                  │
│  │   ml-anomaly-score     │    │   ml-stockout-risk     │                  │
│  │   Z-score based         │    │   Days-until-stockout  │                  │
│  │   anomaly detection     │    │   Risk scoring         │                  │
│  └────────────────────────┘    └────────────────────────┘                  │
│  ┌────────────────────────┐    ┌────────────────────────┐                  │
│  │   ml-batch-score       │    │   ml-scheduler         │                  │
│  │   Nightly batch        │    │   Orchestrator         │                  │
│  │   processing           │    │   (Cron trigger)       │                  │
│  └────────────────────────┘    └────────────────────────┘                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ALERT & ACTION LAYER                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Alert Generation (alert-generator)                 │   │
│  │   • Severity classification (P0-P3)   • Duplicate prevention       │   │
│  │   • Auto-assignment              • Notification dispatch           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                │                                            │
│                                ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Case Management (case-create)                      │   │
│  │   • Workflow states: NEW → IN_PROGRESS → RESOLVED                    │   │
│  │   • SLA tracking            • Assignment routing                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Feature Engineering

### 3.1 Sales Features

#### Real-Time Features (In-Memory/Rolling Window)
```sql
-- Rolling hourly aggregate
rolling_hourly_sales = SUM(amount) WHERE hour = CURRENT_HOUR

-- Rolling daily aggregate  
rolling_daily_sales = SUM(amount) WHERE date >= TODAY - 7 days

-- Day-of-week historical pattern
dow_historical_avg = AVG(amount) WHERE day_of_week = CURRENT_DOW

-- Same-hour historical average
hour_historical_avg = AVG(amount) WHERE hour = CURRENT_HOUR
```

#### Batch Features (Daily/Weekly Aggregates)
```sql
-- Weekly trend (7-day rolling)
weekly_trend = (current_week_sales - prev_week_sales) / prev_week_sales

-- Month-to-date cumulative
mtd_sales = SUM(amount) WHERE date >= DATE_TRUNC('month', CURRENT_DATE)

-- Same-period-last-month
splm_sales = SUM(amount) WHERE date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
                  AND date < DATE_TRUNC('month', CURRENT_DATE)

-- Year-to-date
ytd_sales = SUM(amount) WHERE date >= DATE_TRUNC('year', CURRENT_DATE)
```

### 3.2 Inventory Features

#### Real-Time Features
```sql
-- Current stock level
current_stock = inventory.current_stock

-- Stock gap from minimum
stock_gap = current_stock - min_stock

-- Days since last restock
days_since_restock = CURRENT_DATE - last_restock_at
```

#### Batch Features (Consumption Rate)
```sql
-- Average daily usage (last 30 days)
avg_daily_usage = SUM(sales.amount) / 30

-- Stock turnover rate
turnover_rate = annual_sales / avg_inventory

-- Reorder point calculation
reorder_point = avg_daily_usage * lead_time_days + safety_stock

-- Days until stockout
days_until_stockout = current_stock / avg_daily_usage
```

### 3.3 Feature Store Schema

```sql
-- Real-time feature cache (Redis/In-Memory)
CREATE TABLE ml_features_realtime (
    outlet_id INT PRIMARY KEY,
    feature_name VARCHAR(100),
    value JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Batch feature aggregates
CREATE TABLE ml_features_batch (
    outlet_id INT,
    sku VARCHAR(50),
    feature_date DATE,
    features JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (outlet_id, sku, feature_date)
);
```

---

## 4. Real-Time vs Batch Processing

### 4.1 Processing Strategy Matrix

| Feature Type | Latency Requirement | Processing Mode | Update Frequency |
|-------------|---------------------|-----------------|------------------|
| Anomaly Score | < 5 seconds | Real-time | On each transaction |
| Stockout Risk | < 1 minute | Near-real-time | Every 15 minutes |
| Sales Forecast | Hours | Batch | Daily (nightly) |
| Trend Analysis | Hours | Batch | Weekly |
| Inventory Forecast | < 1 minute | Near-real-time | Every hour |

### 4.2 Real-Time Pipeline

```
POS Transaction → Webhook → Validation → Feature Extraction → ML Inference → Alert?
                                                              ↓
                                                    Store to sales_transactions
                                                              ↓
                                                    Update real-time features
```

**Components:**
- `ingestion-webhook`: Receives POS data with HMAC-SHA256 validation
- `data-validator`: Validates schema and business rules
- Real-time feature extraction (in-memory rolling windows)
- `ml-anomaly-score`: Z-score based anomaly detection

**Latency Target:** < 500ms end-to-end

### 4.3 Batch Pipeline

```
Nightly Cron (2 AM) → Fetch all outlets → Batch feature extraction
                                        ↓
                          Parallel processing (batch of 10)
                                        ↓
                          Calculate all ML scores
                                        ↓
                          Persist to ml_scores table
                                        ↓
                          Generate alerts for high-risk items
```

**Components:**
- `ml-scheduler`: Cron orchestrator (runs nightly at 2 AM)
- `ml-batch-score`: Processes all outlets in parallel batches
- Feature aggregation queries
- Alert generation

**Latency Target:** < 30 minutes for 100 outlets

### 4.4 Hybrid Processing

For sales forecasting, we combine both approaches:
1. **Real-time:** Immediate anomaly flagging on new data
2. **Batch:** Daily model scoring with historical comparison
3. **Streaming:** Hourly micro-batch updates for near-real-time dashboards

---

## 5. Data Quality Monitoring

### 5.1 Validation Layers

#### Layer 1: Schema Validation (`data-validator`)
```typescript
interface ValidationRules {
  // Sales Transactions
  sales: {
    required: ['outlet_id', 'date', 'amount'],
    types: {
      outlet_id: 'number',
      amount: 'number (>= 0)',
      hour: 'number (0-23)',
      day_of_week: 'number (0-6)'
    },
    constraints: {
      amount: { min: 0, max: 100000000 }, // 100M max
      date: { not_future: true, not_older_than_30_days: true }
    }
  },
  
  // Inventory
  inventory: {
    required: ['sku', 'outlet_id'],
    types: {
      current_stock: 'number (>= 0)',
      min_stock: 'number (>= 0)',
      max_stock: 'number (>= min_stock)'
    }
  }
}
```

#### Layer 2: Business Logic Validation
```sql
-- Check for duplicate transactions
SELECT COUNT(*) FROM sales_transactions 
WHERE transaction_id = $1;

-- Verify outlet exists
SELECT EXISTS(SELECT 1 FROM outlets WHERE id = $1);

-- Validate data ranges
WHERE amount BETWEEN 0 AND 100000000
  AND date <= CURRENT_DATE
  AND date >= CURRENT_DATE - INTERVAL '30 days';
```

### 5.2 Quality Metrics Dashboard

```sql
-- Data freshness (time since last data)
SELECT 
    outlet_id,
    MAX(created_at) as last_transaction,
    NOW() - MAX(created_at) as data_age
FROM sales_transactions
GROUP BY outlet_id
HAVING NOW() - MAX(created_at) > INTERVAL '24 hours';

-- Data completeness (missing required fields)
SELECT 
    COUNT(*) as total_transactions,
    COUNT(amount) as valid_amounts,
    COUNT(CASE WHEN hour IS NULL THEN 1 END) as missing_hour
FROM sales_transactions
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days';

-- Duplicate rate
SELECT 
    COUNT(*) as total,
    COUNT(DISTINCT transaction_id) as unique_ids,
    (COUNT(*) - COUNT(DISTINCT transaction_id)) as duplicates
FROM sales_transactions
WHERE created_at >= CURRENT_DATE - INTERVAL '24 hours';
```

### 5.3 Drift Detection

```typescript
// Statistical drift detection for sales patterns
interface DriftDetection {
  // Population Stability Index (PSI)
  calculatePSI(expected: number[], actual: number[]): number;
  
  // PSI thresholds
  PSI_THRESHOLD = {
    NO_DRIFT: < 0.1,
    MODERATE_DRIFT: 0.1 - 0.25,
    SIGNIFICANT_DRIFT: > 0.25
  };
  
  // Feature drift monitoring
  features: [
    'daily_sales_mean',
    'daily_sales_std',
    'transaction_count_mean',
    'hourly_distribution',
    'day_of_week_distribution'
  ];
}
```

### 5.4 Alert Triggers for Data Quality

```sql
-- Alert when data quality degrades
INSERT INTO alerts (outlet_id, type, severity, title, description)
SELECT 
    outlet_id,
    'SYSTEM' as type,
    CASE 
        WHEN data_age > INTERVAL '48 hours' THEN 'P1_HIGH'
        ELSE 'P2_MEDIUM'
    END as severity,
    'Data Ingestion Issue' as title,
    'No transactions received for ' || EXTRACT(HOUR FROM data_age) || ' hours' as description
FROM (
    SELECT 
        o.id as outlet_id,
        NOW() - COALESCE(MAX(st.created_at), o.created_at) as data_age
    FROM outlets o
    LEFT JOIN sales_transactions st ON o.id = st.outlet_id
    WHERE o.status = 'ACTIVE'
    GROUP BY o.id, o.created_at
) sub
WHERE data_age > INTERVAL '24 hours';
```

---

## 6. Anomaly Detection on Incoming Data

### 6.1 Real-Time Anomaly Detection

```typescript
// ml-anomaly-score edge function logic
interface AnomalyDetectionConfig {
  // Z-score threshold for anomaly flagging
  Z_SCORE_THRESHOLD = 2.5;
  
  // Minimum historical data points
  MIN_DATA_POINTS = 5;
  
  // Confidence calculation
  calculateAnomalyScore(currentSales: number, outletId: number): {
    score: number;          // Z-score
    is_anomaly: boolean;
    percentile: number;     // 0-100
    confidence: number;      // 0-1
  };
}
```

### 6.2 Anomaly Types Detected

| Anomaly Type | Description | Detection Method | Severity |
|-------------|-------------|------------------|----------|
| **Sudden Spike** | Unusually high sales | Z-score > 2.5 | P0/P1 |
| **Sudden Drop** | Unusually low sales | Z-score < -2.5 | P0/P1 |
| **Gradual Decline** | Slow trend downward | Week-over-week < -20% | P2 |
| **Zero Transactions** | No sales recorded | Data gap > expected hours | P1/P2 |
| **Extreme Values** | Outlier amounts | IQR method | P2 |

### 6.3 Batch Anomaly Detection

```sql
-- Nightly batch anomaly check
WITH daily_sales AS (
    SELECT 
        outlet_id,
        date,
        SUM(amount) as daily_total,
        AVG(amount) as daily_avg,
        STDDEV(amount) as daily_std
    FROM sales_transactions
    WHERE date >= CURRENT_DATE - INTERVAL '90 days'
    GROUP BY outlet_id, date
),
outlet_stats AS (
    SELECT 
        outlet_id,
        AVG(daily_total) as expected_sales,
        STDDEV(daily_total) as expected_std,
        COUNT(*) as data_points
    FROM daily_sales
    GROUP BY outlet_id
    HAVING COUNT(*) >= 30
)
SELECT 
    ds.outlet_id,
    ds.date,
    ds.daily_total,
    os.expected_sales,
    os.expected_std,
    (ds.daily_total - os.expected_sales) / NULLIF(os.expected_std, 0) as z_score,
    CASE 
        WHEN ABS((ds.daily_total - os.expected_sales) / NULLIF(os.expected_std, 0)) > 2.5 
        THEN true ELSE false 
    END as is_anomaly
FROM daily_sales ds
JOIN outlet_stats os ON ds.outlet_id = os.outlet_id
WHERE ds.date = CURRENT_DATE - 1;
```

---

## 7. Stockout Prediction

### 7.1 Prediction Model

```typescript
interface StockoutPrediction {
  // Risk levels based on days until stockout
  RISK_THRESHOLDS = {
    HIGH: 3,      // < 3 days = HIGH
    MEDIUM: 7,    // 3-7 days = MEDIUM
    LOW: Infinity  // > 7 days = LOW
  };
  
  // Daily usage calculation
  calculateDailyUsage(salesAmounts: number[], days: number): number;
  
  // Days until stockout
  calculateDaysUntilStockout(currentStock: number, dailyUsage: number): number;
  
  // Risk score (0-100, higher = more risk)
  calculateRiskScore(
    daysUntilStockout: number,
    currentStock: number,
    minStock: number,
    dailyUsage: number
  ): number;
}
```

### 7.2 Prediction Features

| Feature | Source | Update Frequency |
|---------|--------|------------------|
| Current Stock Level | `inventory.current_stock` | Real-time |
| Minimum Stock Level | `inventory.min_stock` | Daily |
| Average Daily Usage | `sales_transactions` (30-day) | Daily |
| Days Until Stockout | Calculated | Daily |
| Recommended Order | Calculated | Daily |
| Stock Velocity Trend | 7-day vs 30-day comparison | Weekly |

### 7.3 Inventory Monitoring Query

```sql
-- Stockout risk for all outlets
WITH daily_usage AS (
    SELECT 
        outlet_id,
        SUM(amount) / 30 as avg_daily_usage
    FROM sales_transactions
    WHERE date >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY outlet_id
),
inventory_status AS (
    SELECT 
        i.outlet_id,
        SUM(i.current_stock) as total_stock,
        SUM(i.min_stock) as total_min_stock
    FROM inventory i
    GROUP BY i.outlet_id
)
SELECT 
    o.id as outlet_id,
    o.name as outlet_name,
    COALESCE(ins.total_stock, 0) as current_stock,
    COALESCE(ins.total_min_stock, 0) as min_stock,
    COALESCE(du.avg_daily_usage, 0) as avg_daily_usage,
    CASE 
        WHEN COALESCE(du.avg_daily_usage, 0) = 0 THEN 999
        ELSE COALESCE(ins.total_stock, 0) / du.avg_daily_usage
    END as days_until_stockout,
    CASE 
        WHEN COALESCE(du.avg_daily_usage, 0) = 0 THEN 'LOW'
        WHEN COALESCE(ins.total_stock, 0) / du.avg_daily_usage < 3 THEN 'HIGH'
        WHEN COALESCE(ins.total_stock, 0) / du.avg_daily_usage < 7 THEN 'MEDIUM'
        ELSE 'LOW'
    END as risk_level
FROM outlets o
LEFT JOIN inventory_status ins ON o.id = ins.outlet_id
LEFT JOIN daily_usage du ON o.id = du.outlet_id
WHERE o.status = 'ACTIVE'
ORDER BY days_until_stockout ASC;
```

---

## 8. Data Pipeline Edge Functions

### 8.1 Function Catalog

| Function | Type | Trigger | Purpose |
|----------|------|---------|---------|
| `ingestion-webhook` | Real-time | HTTP POST | Receive POS data |
| `ingestion-csv` | Batch | HTTP POST | Bulk CSV upload |
| `data-validator` | Validation | Internal | Validate incoming data |
| `ml-anomaly-score` | Real-time | HTTP POST | Calculate anomaly score |
| `ml-stockout-risk` | Near-RT | HTTP POST | Calculate stockout risk |
| `ml-batch-score` | Batch | Cron (2 AM) | Nightly batch processing |
| `ml-scheduler` | Orchestrator | Cron (2 AM) | Coordinate batch pipeline |
| `alert-generator` | Alert | Triggered | Generate alerts |
| `notification-send` | Notification | Triggered | Send alerts via email/WhatsApp |

### 8.2 Pipeline Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           INCOMING DATA                                 │
│    POS Webhook | CSV Upload | ERP Integration | Manual Entry            │
└────────────────────────────────┬────────────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      VALIDATION (data-validator)                        │
│   Schema → Business Rules → Duplicates → Outlet Check                   │
│   ↓ Valid                        ↓ Invalid                              │
│   Continue                       Reject + Log Error                     │
└────────────────────────────────┬────────────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        ODS (PostgreSQL)                                 │
│              sales_transactions | inventory | outlets                    │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
              ┌──────────────────┴──────────────────┐
              ▼                                     ▼
┌─────────────────────────┐           ┌─────────────────────────┐
│    REAL-TIME PATH      │           │      BATCH PATH        │
│  On each transaction   │           │    Nightly (2 AM)      │
├─────────────────────────┤           ├─────────────────────────┤
│ 1. Extract features     │           │ 1. Aggregate features  │
│ 2. Call ml-anomaly-     │           │ 2. Call ml-batch-score│
│    score                 │           │ 3. Process all outlets│
│ 3. If anomaly → Alert    │           │ 4. Generate alerts    │
│ 4. Update real-time     │           │ 5. Persist scores     │
│    feature store         │           │ 6. Update dashboards  │
└─────────────────────────┘           └─────────────────────────┘
              │                                     │
              └──────────────────┬──────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           ALERTS LAYER                                   │
│   Anomaly Alert | Stockout Alert | Data Quality Alert | System Alert    │
│   Severity: P0_CRITICAL → P1_HIGH → P2_MEDIUM → P3_LOW                  │
└────────────────────────────────┬────────────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      CASE MANAGEMENT                                    │
│   NEW → ACKNOWLEDGED → IN_PROGRESS → RESOLVED → CLOSED                 │
└────────────────────────────────┬────────────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      NOTIFICATIONS                                      │
│   Email | WhatsApp | Push | Dashboard                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Monitoring & Observability

### 9.1 Key Metrics

| Metric | Target | Alert Threshold |
|--------|--------|------------------|
| Pipeline Latency (P95) | < 500ms | > 2 seconds |
| Data Freshness | < 1 hour | > 4 hours |
| Anomaly Detection Accuracy | > 85% | < 70% |
| Stockout Prediction Accuracy | > 80% | < 60% |
| False Positive Rate | < 15% | > 30% |
| Pipeline Success Rate | > 99% | < 95% |

### 9.2 Logging Strategy

```typescript
// Structured logging for all pipeline steps
interface PipelineLog {
  timestamp: string;
  function: string;
  step: 'start' | 'process' | 'complete' | 'error';
  outlet_id?: number;
  duration_ms?: number;
  metadata?: Record<string, any>;
}

// Example log entries
console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  function: 'ml-anomaly-score',
  step: 'start',
  outlet_id: 123,
  metadata: { transaction_amount: 150000 }
}));

console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  function: 'ml-anomaly-score',
  step: 'complete',
  outlet_id: 123,
  duration_ms: 45,
  metadata: { 
    z_score: 2.8, 
    is_anomaly: true,
    data_points: 150
  }
}));
```

### 9.3 Dashboard Queries

```sql
-- Pipeline health dashboard
SELECT 
    date_trunc('hour', created_at) as hour,
    function_name,
    COUNT(*) as total_runs,
    COUNT(CASE WHEN status = 'success' THEN 1 END) as successes,
    COUNT(CASE WHEN status = 'error' THEN 1 END) as errors,
    AVG(duration_ms) as avg_duration
FROM ml_pipeline_logs
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY 1, 2
ORDER BY 1 DESC;

-- Alert summary
SELECT 
    DATE(triggered_at) as date,
    type,
    severity,
    COUNT(*) as count,
    COUNT(CASE WHEN status = 'RESOLVED' THEN 1 END) as resolved
FROM alerts
WHERE triggered_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY 1, 2, 3
ORDER BY 1 DESC, 4 DESC;
```

---

## 10. Future Enhancements

### 10.1 Phase 2 Features

1. **Sales Forecasting**
   - Prophet-based time series forecasting
   - 7-day, 30-day predictions
   - Seasonal decomposition

2. **Advanced Anomaly Detection**
   - Isolation Forest for multivariate anomalies
   - LSTM-based sequence anomaly detection
   - Contextual anomaly detection (holidays, events)

3. **Inventory Optimization**
   - Economic Order Quantity (EOQ)
   - Safety stock optimization
   - Multi-SKU demand forecasting

### 10.2 Infrastructure Improvements

1. **Feature Store** (Feast)
   - Redis for real-time features
   - PostgreSQL for batch features
   - Feature versioning and lineage

2. **MLOps Platform**
   - Model versioning and A/B testing
   - Automated retraining triggers
   - Performance monitoring

3. **Real-time Streaming**
   - Kafka for event streaming
   - Flink for real-time processing
   - GRAFANA for visualization

---

## 11. Appendix

### A. Database Schema Summary

```
┌──────────────────────┐     ┌──────────────────────┐
│  sales_transactions  │     │      inventory       │
├──────────────────────┤     ├──────────────────────┤
│ id (PK)              │     │ id (PK)              │
│ outlet_id (FK)       │◄────│ outlet_id (FK)       │
│ transaction_id       │     │ sku                  │
│ date                 │     │ product_name         │
│ amount               │     │ current_stock        │
│ transaction_count    │     │ min_stock            │
│ hour                 │     │ max_stock            │
│ day_of_week          │     │ last_restock_at      │
│ anomaly_score        │     └──────────────────────┘
│ is_anomaly           │
└──────────────────────┘     ┌──────────────────────┐
                             │      ml_scores       │
┌──────────────────────┐     ├──────────────────────┤
│       alerts         │     │ id (PK)              │
├──────────────────────┤     │ outlet_id (FK)       │
│ id (PK)              │     │ model_type           │
│ outlet_id (FK)       │     │ score                │
│ type                 │     │ is_anomaly           │
│ severity             │     │ risk_level           │
│ status               │     │ days_until_stockout  │
│ title                │     │ data_points          │
│ description          │     │ scored_at            │
│ score                │     └──────────────────────┘
│ triggered_at         │
└──────────────────────┘
```

### B. Edge Function URLs

| Function | Production URL |
|----------|----------------|
| `ingestion-webhook` | `https://xxx.supabase.co/functions/v1/ingestion-webhook` |
| `ml-anomaly-score` | `https://xxx.supabase.co/functions/v1/ml-anomaly-score` |
| `ml-stockout-risk` | `https://xxx.supabase.co/functions/v1/ml-stockout-risk` |
| `ml-batch-score` | `https://xxx.supabase.co/functions/v1/ml-batch-score` |
| `ml-scheduler` | `https://xxx.supabase.co/functions/v1/ml-scheduler` |

### C. Environment Variables

```bash
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Webhook Security
WEBHOOK_HMAC_SECRET=whsec_...

# ML Configuration
Z_SCORE_THRESHOLD=2.5
STOCKOUT_HIGH_THRESHOLD=3
STOCKOUT_MEDIUM_THRESHOLD=7
RECENT_THRESHOLD_HOURS=12
```

---

**Document Version:** 1.0  
**Last Updated:** July 20, 2026  
**Author:** ML Engineer (Fajar)
