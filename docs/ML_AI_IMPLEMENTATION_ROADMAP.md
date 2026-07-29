# CyberQuote ML/AI Implementation Plan & Product Roadmap

**Role:** ML Engineer + Product Manager  
**Date:** July 23, 2026  
**Version:** 1.0

---

## Executive Summary

This document combines the ML Engineering implementation plan with the Product Roadmap to provide a unified view of CyberQuote's AI capabilities evolution from MVP to Scale.

**Current State (MVP):**
- ✅ Z-score anomaly detection (basic)
- ✅ 6 AI agents defined (ATHENA, MONITOR, ANALYST, COORDINATOR, TRIAGE, EXECUTOR)
- ✅ Basic Athena chat interface
- ✅ Core monitoring + alerts
- ✅ ML batch scheduler

**Target State (Scale Phase):**
- Production ML models for all use cases
- Full Agentic AI orchestration
- RAG-powered knowledge base
- Autonomous actions with guardrails

---

## Part 1: ML/AI Implementation Plan

### ML Use Case Prioritization Matrix

| Use Case | Business Value | Technical Complexity | MVP | Phase 2 | Phase 3 |
|----------|----------------|---------------------|-----|---------|---------|
| Sales Anomaly Detection | 🔴 Critical | 🟢 Low | ✅ | Enhance | Optimize |
| Stockout Prediction | 🔴 Critical | 🟢 Low | ✅ | Enhance | Full autonomy |
| Churn Risk Prediction | 🟡 High | 🟡 Medium | - | MVP | Production |
| Fraud Detection | 🔴 Critical | 🔴 High | - | MVP | Production |
| Sales Forecasting | 🟡 High | 🟡 Medium | - | MVP | Production |
| Demand Forecasting | 🟡 High | 🟡 Medium | - | MVP | Production |
| Compliance Monitoring | 🟡 High | 🟡 Medium | - | - | MVP |
| Franchise Distress Score | 🟢 Medium | 🟡 Medium | - | - | MVP |

---

### ML Implementation Roadmap

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ML IMPLEMENTATION ROADMAP                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PHASE 1: Foundation (Month 1-2)                                           │
│  ═══════════════════════════════                                           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │
│  │ Anomaly     │ │ Stockout    │ │ Feature     │ │ Data        │         │
│  │ Detection   │ │ Prediction  │ │ Store       │ │ Quality     │         │
│  │ [ENHANCE]   │ │ [ENHANCE]   │ │ [BUILD]     │ │ [MONITOR]   │         │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘         │
│                                                                             │
│  PHASE 2: AI Enablement (Month 3-4)                                       │
│  ═════════════════════════════════════                                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │
│  │ Churn Risk  │ │ Sales       │ │ Fraud       │ │ RAG         │         │
│  │ Prediction  │ │ Forecasting  │ │ Detection   │ │ Foundation  │         │
│  │ [BUILD]     │ │ [BUILD]     │ │ [BUILD]     │ │ [BUILD]     │         │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘         │
│                                                                             │
│  PHASE 3: Agentic AI (Month 5-7)                                          │
│  ════════════════════════════════════════                                   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │
│  │ LLM Gateway │ │ Agent       │ │ Workflow    │ │ Copilot    │         │
│  │ + RAG       │ │ Orchestration│ │ Engine      │ │ Interface  │         │
│  │ [BUILD]     │ │ [BUILD]     │ │ [BUILD]     │ │ [BUILD]    │         │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘         │
│                                                                             │
│  PHASE 4: Scale (Month 8-12)                                               │
│  ═══════════════════════════════════════                                   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │
│  │ Full        │ │ Autonomous  │ │ Multi-      │ │ Advanced    │         │
│  │ Production  │ │ Actions     │ │ Country     │ │ Analytics   │         │
│  │ [DEPLOY]    │ │ [DEPLOY]    │ │ [EXPAND]    │ │ [DEPLOY]    │         │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Phase 1: Foundation (Month 1-2)

#### 1.1 Anomaly Detection Enhancement

**Current State:** Z-score based, basic thresholds  
**Target State:** Multi-variate anomaly detection with contextual awareness

**Implementation Tasks:**

```sql
-- Enhanced anomaly features
ALTER TABLE ml_features_batch ADD COLUMN IF NOT EXISTS:
  - hourly_pattern_deviation (float)
  - day_of_week_deviation (float)
  - trend_slope (float)
  - velocity_change (float)
  - competitor_correlation (float, future)
```

**Technical Requirements:**
- [ ] Add rolling window statistics (7d, 14d, 30d)
- [ ] Implement IQR-based anomaly detection supplement
- [ ] Add temporal pattern recognition
- [ ] Build confidence scoring mechanism
- [ ] Add drift detection (Population Stability Index)

**ML Model Evolution:**
```
v1.0 (Current): Single Z-score threshold
     ↓
v1.5 (Month 1): Multi-window Z-score with confidence
     ↓
v2.0 (Month 2): Isolation Forest baseline
     ↓
v2.5 (Month 3): LSTM for temporal patterns (future)
```

**Estimated Effort:** 2 weeks  
**Owner:** ML Engineer (Fajar)

---

#### 1.2 Stockout Prediction Enhancement

**Current State:** Days-until-stockout calculation  
**Target State:** Multi-SKU prediction with replenishment optimization

**Implementation Tasks:**
- [ ] Multi-product stockout scoring per outlet
- [ ] Lead time consideration
- [ ] Seasonal pattern awareness
- [ ] Supplier reliability scoring
- [ ] Recommended order quantity generation

**Feature Engineering:**
```sql
-- New features for stockout model
- stock_velocity_7d (float)
- stock_velocity_30d (float)
- velocity_trend (float)  -- 7d vs 30d comparison
- days_since_restock (int)
- avg_lead_time (float)
- supplier_reliability_score (float)
- seasonality_factor (float)
```

**Estimated Effort:** 2 weeks  
**Owner:** ML Engineer (Fajar)

---

#### 1.3 Feature Store Implementation

**Architecture:**
```
┌─────────────────────────────────────────────────────────────┐
│                    FEATURE STORE                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Real-Time Features (In-Memory/Redis)                       │
│  ─────────────────────────────────                          │
│  • Rolling aggregates (1h, 4h, 24h)                        │
│  • Latest transaction metrics                               │
│  • Current inventory levels                                 │
│  • Real-time anomaly scores                                 │
│                                                             │
│  Batch Features (PostgreSQL)                                │
│  ────────────────────────────                               │
│  • Daily aggregates (7d, 30d, 90d)                         │
│  • Weekly trends                                            │
│  • Monthly seasonality patterns                              │
│  • Historical anomaly flags                                 │
│                                                             │
│  Training Features (Feature Store)                         │
│  ─────────────────────────────────                          │
│  • Labeled datasets for model training                       │
│  • Versioned feature sets                                   │
│  • A/B testing support                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Implementation:**
- [ ] Real-time feature cache (use PostgreSQL JSONB initially)
- [ ] Batch feature aggregation views
- [ ] Feature versioning system
- [ ] Feature documentation

**Estimated Effort:** 3 weeks  
**Owner:** ML Engineer + Backend Lead

---

#### 1.4 Data Quality Monitoring

**Metrics Dashboard:**
```sql
-- Data freshness
SELECT 
    outlet_id,
    MAX(created_at) as last_transaction,
    NOW() - MAX(created_at) as data_age
FROM sales_transactions
GROUP BY outlet_id;

-- Completeness
SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN amount IS NULL THEN 1 END) as missing_amount
FROM sales_transactions;

-- Drift detection
-- PSI calculation for key features
```

**Alerts:**
- [ ] Data freshness > 24 hours → P2 alert
- [ ] Completeness < 95% → P2 alert
- [ ] PSI > 0.25 → P1 alert (significant drift)

**Estimated Effort:** 1 week  
**Owner:** Backend Lead (Dimas)

---

### Phase 2: AI Enablement (Month 3-4)

#### 2.1 Churn Risk Prediction

**Business Context:** Predict which outlets/franchisees may become inactive or underperforming

**Features:**
- Historical performance trends
- Engagement metrics (reporting frequency, data quality)
- Support ticket frequency
- Payment patterns
- Market conditions

**Model Approach:**
```
Phase 2 MVP: Logistic Regression + Random Forest ensemble
Phase 3: Gradient Boosting (XGBoost/LightGBM)
Phase 4: Neural network with temporal patterns (LSTM)
```

**Risk Factors:**
```json
{
  "performance_decline_rate": "weight: 0.3",
  "data_quality_score": "weight: 0.2",
  "support_ticket_frequency": "weight: 0.15",
  "payment_delinquency": "weight: 0.2",
  "market_competition_score": "weight: 0.15"
}
```

**Estimated Effort:** 3 weeks  
**Owner:** ML Engineer

---

#### 2.2 Sales Forecasting

**Use Cases:**
1. Daily/weekly sales prediction for outlet
2. Demand forecasting for inventory planning
3. Campaign impact prediction

**Model Architecture:**
```
Input Features:
├── Historical sales (30d, 90d, 365d)
├── Day of week / hour / month
├── Seasonal factors
├── Campaign calendar
├── External factors (weather, holidays)
└── Outlet characteristics

Model: Prophet or Temporal Fusion Transformer (TFT)
```

**Implementation Phases:**
- [ ] Daily aggregate forecasting (MVP)
- [ ] SKU-level demand forecasting
- [ ] Campaign impact modeling
- [ ] External factor integration

**Estimated Effort:** 4 weeks  
**Owner:** ML Engineer

---

#### 2.3 Fraud Detection

**Detection Patterns:**
1. Transaction anomalies (unusual amounts, timing)
2. Inventory discrepancies
3. Payment fraud signals
4. Collusion patterns

**Implementation Approach:**
```
Phase 2 MVP:
├── Rule-based detection (threshold violations)
├── Statistical anomaly detection
└── Simple pattern matching

Phase 3+:
├── Graph-based anomaly detection (for collusion)
├── Sequential pattern mining
└── Real-time scoring
```

**Risk Categories:**
| Category | Detection Method | Severity |
|----------|------------------|----------|
| Amount Anomaly | Z-score > 3.0 | P2 |
| Timing Anomaly | Off-hours transactions | P2 |
| Volume Spike | > 200% of average | P1 |
| Collusion Risk | Graph pattern matching | P1 |

**Estimated Effort:** 4 weeks  
**Owner:** ML Engineer + Security

---

#### 2.4 RAG Foundation

**Knowledge Base Structure:**
```
Vector Database (pgvector initially)
├── SOP Documents
│   ├── Standard operating procedures
│   ├── Escalation protocols
│   └── Compliance guidelines
├── Franchise Manuals
│   ├── Training materials
│   ├── Best practices
│   └── Troubleshooting guides
├── Historical Incidents
│   ├── Past issues and resolutions
│   ├── Common problems
│   └── Recovery patterns
├── Policy Documents
│   ├── Corporate policies
│   ├── Regional variations
│   └── Compliance requirements
└── Campaign Playbooks
    ├── Promotional guidelines
    └── Execution checklists
```

**Implementation Tasks:**
- [ ] Document ingestion pipeline
- [ ] Chunking strategy (512 tokens, 50 token overlap)
- [ ] Embedding model selection (sentence-transformers)
- [ ] Vector store setup (pgvector)
- [ ] Retrieval evaluation framework

**Embedding Model:** `sentence-transformers/all-MiniLM-L6-v2` (fast, good quality)

**Estimated Effort:** 4 weeks  
**Owner:** ML Engineer + Backend Lead

---

### Phase 3: Agentic AI (Month 5-7)

#### 3.1 LLM Gateway + RAG

**Architecture:**
```
┌─────────────────────────────────────────────────────────────────┐
│                        LLM GATEWAY                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Request → Router → Rate Limiter → Cache → LLM Provider       │
│                              ↓                                  │
│                     RAG Service                                 │
│                     ├── Vector Search                          │
│                     ├── Context Builder                        │
│                     └── Citation Generator                     │
│                              ↓                                  │
│                     Response + Citations                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Providers (Multi-Provider Support):**
1. OpenAI (GPT-4o) - Primary for complex reasoning
2. Anthropic (Claude) - For long context tasks
3. Local (Llama 3) - Cost-effective for simple tasks

**RAG Configuration:**
```yaml
retrieval:
  top_k: 5
  similarity_threshold: 0.7
  rerank: true
  
context:
  max_tokens: 8000
  include_citations: true
  include_confidence: true
```

**Estimated Effort:** 4 weeks  
**Owner:** ML Engineer + Backend Lead

---

#### 3.2 Agent Orchestration

**Agent Architecture:**
```
┌─────────────────────────────────────────────────────────────────┐
│                    AGENT ORCHESTRATOR                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐          │
│  │ ATHENA  │  │MONITOR  │  │ANALYST  │  │COORDIN. │          │
│  │ (Chat)  │  │(Watch)  │  │(Analyze)│  │(Assign) │          │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘          │
│       │             │             │             │               │
│       └─────────────┴──────┬─────┴─────────────┘               │
│                            ↓                                    │
│                     Tool Registry                               │
│       ┌──────────┬──────────┬──────────┬──────────┐           │
│       │Query KPI │Get History│Send Alert│Create Case│          │
│       │RAG Search│Policy Look│Email Notif│Ticket Sys│          │
│       └──────────┴──────────┴──────────┴──────────┘           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Agent Specifications:**

| Agent | Role | Capabilities | Autonomy Level |
|-------|------|--------------|----------------|
| ATHENA | AI Copilot | Q&A, recommendations, explanations | Advisory |
| MONITOR | Watchtower | Alert detection, anomaly flagging | Semi-autonomous |
| ANALYST | Investigator | Root cause analysis, pattern detection | Semi-autonomous |
| COORDINATOR | Manager | Case assignment, workflow initiation | Supervised |
| TRIAGE | Router | Priority assessment, categorization | Autonomous |
| EXECUTOR | Action-taker | Pre-approved actions execution | Highly supervised |

**Estimated Effort:** 6 weeks  
**Owner:** ML Engineer + Backend Lead

---

#### 3.3 Workflow Engine

**Workflow Patterns:**
```
┌────────────────────────────────────────────────────────────────┐
│                      WORKFLOW PATTERNS                         │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Alert → Investigation → Case Creation → Assignment → Action  │
│                                                                │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    │
│  │  Alert  │───▶│ Triage  │───▶│ Analyst │───▶│  Case   │    │
│  │Created  │    │         │    │Investig.│    │ Created │    │
│  └─────────┘    └─────────┘    └─────────┘    └────┬────┘    │
│                                                      │         │
│                                                      ▼         │
│                         ┌─────────┐    ┌─────────┐            │
│                         │ Assign  │───▶│ Action  │            │
│                         │         │    │ Execute │            │
│                         └─────────┘    └─────────┘            │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**Implementation:**
- [ ] Workflow definition language
- [ ] State machine implementation
- [ ] Dead-letter queue handling
- [ ] Retry logic with exponential backoff
- [ ] Audit logging

**Estimated Effort:** 4 weeks  
**Owner:** Backend Lead

---

#### 3.4 Copilot Interface

**User Experience Layers:**

| User Type | Interface | Primary Use Cases |
|-----------|-----------|-------------------|
| HQ Admin | Dashboard + Copilot | Overview, strategic decisions |
| Regional Manager | Dashboard + Copilot | Mid-level oversight, coaching |
| Franchisee | Mobile + Simple Chat | Daily operations, troubleshooting |

**Copilot Capabilities:**
```
Franchisee Copilot (Simple Mode):
├── "Why did my sales drop yesterday?"
├── "When should I reorder?"
├── "How do I handle a customer complaint?"
└── "What are my KPIs this week?"

Manager Copilot (Advanced Mode):
├── "Which outlets need attention today?"
├── "Compare outlet 104 to similar outlets"
├── "Draft an action plan for underperforming outlet"
├── "What training topics should I focus on?"
└── "Predict this month's revenue"

HQ Copilot (Strategic Mode):
├── "Portfolio health summary"
├── "Cross-regional trends"
├── "Franchisee satisfaction analysis"
├── "Compliance status across network"
└── "Campaign performance analysis"
```

**Estimated Effort:** 3 weeks  
**Owner:** Frontend Lead

---

### Phase 4: Scale (Month 8-12)

#### 4.1 Production ML Operations

**MLOps Pipeline:**
```
┌─────────────────────────────────────────────────────────────────┐
│                       MLOps PIPELINE                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Data → Feature Engineering → Training → Evaluation → Deploy   │
│    │                                      │                    │
│    └────────── Feedback Loop ◀────────────┘                    │
│                                                                 │
│  Components:                                                    │
│  ├── Automated retraining (weekly/monthly)                     │
│  ├── A/B testing framework                                     │
│  ├── Performance monitoring                                     │
│  ├── Model versioning                                           │
│  └── Rollback capabilities                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key Metrics:**
- Model accuracy (per use case)
- Prediction latency (< 500ms for real-time)
- Feature drift indices
- Business outcome correlation

**Estimated Effort:** 8 weeks (ongoing)  
**Owner:** ML Engineer

---

#### 4.2 Autonomous Actions

**Action Categories:**

| Level | Description | Example | Requires Approval |
|-------|-------------|---------|-------------------|
| L1 - Inform | Just notify | "Sales dropped" alert | No |
| L2 - Recommend | Suggest action | "Reorder stock now" | No |
| L3 - Approve-Then-Act | Propose, execute if approved | "Approve discount?" | Yes |
| L4 - Auto-Execute | Pre-approved actions | Auto-assign case | Yes (initial) |
| L5 - Full Autonomy | Context-dependent | Reserved for low-risk | Yes + monitoring |

**Guardrails:**
- [ ] Confidence threshold (min 0.85 for autonomous)
- [ ] Human-in-the-loop for high-impact actions
- [ ] Action allowlist (only pre-approved actions)
- [ ] Audit log for all agent actions
- [ ] Rollback capability

**Estimated Effort:** 6 weeks  
**Owner:** ML Engineer + Security

---

#### 4.3 Multi-Country Expansion

**Considerations:**
- Data residency requirements
- Local currency/format handling
- Regional language support
- Local compliance requirements
- Timezone-aware scheduling

**Expansion Priority:**
1. Indonesia (existing)
2. Singapore
3. Malaysia
4. Philippines

**Estimated Effort:** 12 weeks (ongoing per country)  
**Owner:** Full team

---

#### 4.4 Advanced Analytics

**Future Capabilities:**
- Causal inference for interventions
- Counterfactual analysis
- Network effect modeling
- Predictive LTV for franchisees
- Sentiment analysis from feedback

**Estimated Effort:** 8 weeks  
**Owner:** Data Science Lead

---

## Part 2: Product Roadmap

### Product Vision

**Mission:** Empower franchise networks with AI-driven insights that enable proactive operations, reduce losses, and maximize performance.

**North Star Metrics:**
1. Stockout Rate Reduction: -40% YoY
2. Alert-to-Resolution Time: < 4 hours (P1)
3. Franchisee Retention: > 95% YoY
4. Revenue per Outlet Uplift: +15% YoY

---

### Roadmap Timeline

```
2026
├── Q3 (Jul-Sep): Foundation & AI Enablement
│   ├── Month 1: Feature store, anomaly enhancement, data quality
│   ├── Month 2: Churn prediction MVP, sales forecasting MVP
│   └── Month 3: RAG foundation, fraud detection MVP
│
├── Q4 (Oct-Dec): Agentic AI Launch
│   ├── Month 4: LLM gateway, RAG integration
│   ├── Month 5: Agent orchestration, workflow engine
│   └── Month 6: Copilot UI launch (beta)
│
└── 2027
    ├── Q1: Production Readiness
    │   ├── MLOps pipeline completion
    │   ├── Autonomous actions pilot
    │   └── Multi-country prep
    │
    ├── Q2: Scale
    │   ├── Singapore expansion
    │   ├── Advanced analytics
    │   └── Enterprise features
    │
    └── Q3+: Continuous Improvement
        ├── Model optimization
        ├── New use cases
        └── Market expansion
```

---

### Feature Roadmap by Quarter

#### Q3 2026: Foundation & AI Enablement

**P0 (Must Have):**
- [ ] Feature store implementation
- [ ] Enhanced anomaly detection (multi-variate)
- [ ] Data quality monitoring dashboard
- [ ] Churn risk prediction MVP
- [ ] RAG knowledge base (initial)
- [ ] LLM gateway (basic)

**P1 (Should Have):**
- [ ] Sales forecasting MVP
- [ ] Fraud detection MVP
- [ ] Agent orchestration framework
- [ ] Copilot beta (select users)

**P2 (Nice to Have):**
- [ ] Advanced visualization
- [ ] Mobile notifications
- [ ] Custom report builder

#### Q4 2026: Agentic AI Launch

**P0 (Must Have):**
- [ ] Full RAG implementation
- [ ] 6 AI agents operational
- [ ] Workflow engine production-ready
- [ ] Copilot UI (general availability)
- [ ] Autonomous actions (Level 1-2)

**P1 (Should Have):**
- [ ] Human-in-the-loop approval flows
- [ ] Multi-channel notifications
- [ ] Regional dashboards
- [ ] Performance benchmarking

**P2 (Nice to Have):**
- [ ] White-label options
- [ ] Custom branding
- [ ] API marketplace

#### Q1 2027: Production Readiness

**P0 (Must Have):**
- [ ] MLOps pipeline (automated retraining)
- [ ] Model monitoring & alerting
- [ ] A/B testing framework
- [ ] Rollback capabilities
- [ ] SLA guarantees

**P1 (Should Have):**
- [ ] Autonomous actions (Level 3)
- [ ] Singapore expansion
- [ ] Compliance reporting
- [ ] Audit trail

#### Q2-Q4 2027: Scale

**P0 (Must Have):**
- [ ] Multi-country support
- [ ] Advanced analytics
- [ ] Enterprise SSO
- [ ] Custom integrations

**P1 (Should Have):**
- [ ] White-label platform
- [ ] Advanced ML models
- [ ] Causal inference

---

### Success Metrics

#### Technical Metrics

| Metric | Baseline | Q3 Target | Q4 Target | Q1 2027 Target |
|--------|----------|-----------|-----------|----------------|
| ML Prediction Latency | < 2s | < 500ms | < 200ms | < 100ms |
| Model Accuracy (Anomaly) | 85% | 88% | 90% | 92% |
| Feature Freshness | 1h | 15min | 5min | Real-time |
| RAG Retrieval Accuracy | N/A | 70% | 80% | 85% |
| Agent Action Success Rate | N/A | 90% | 95% | 98% |

#### Business Metrics

| Metric | Baseline | Q3 Target | Q4 Target | Q1 2027 Target |
|--------|----------|-----------|-----------|----------------|
| Stockout Rate | 8% | 6% | 5% | 4% |
| Alert-to-Resolution (P1) | 8h | 6h | 4h | 2h |
| Franchisee NPS | 45 | 50 | 55 | 60 |
| Data Quality Score | 90% | 95% | 98% | 99% |
| Active Users | 50 | 100 | 200 | 400 |

---

### Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Data quality degrades with scale | High | High | Automated monitoring, data contracts |
| Agent hallucinations | Medium | High | RAG grounding, confidence thresholds, human-in-loop |
| LLM cost escalation | Medium | Medium | Multi-tier routing, caching, token optimization |
| Model drift | High | High | Automated retraining, A/B testing |
| Integration complexity | Medium | Medium | Standardized APIs, middleware layer |
| Compliance requirements | Low | High | Legal review, regional champions |
| User adoption resistance | Medium | Medium | Training, phased rollout, feedback loops |

---

### Dependencies

```
Critical Path:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Week 1-2:   Feature Store ──────────────────────────────────────────────┐
                 │                                                    │
Week 3-4:        ▼         Anomaly Enhancement ──────────────────────▶│
                      │                                               │
Week 5-6:              ▼         Data Quality ───────────────────────▶│
                            │                                          │
Week 7-8:                    ▼         Churn MVP ─────────────────────▶│
                                  │                                    │
Week 9-10:                           ▼         RAG Foundation ─────────▶│
                                        │                              │
Week 11-12:                                ▼         LLM Gateway ───────▶│
                                              │                        │
Week 13-14:                                      ▼         Agent ───────▶│
                                                    │                  │
Week 15-16:                                          ▼         Copilot ─▶│
```

---

### Resource Requirements

#### Phase 1 (Foundation)
- 1 ML Engineer (Fajar)
- 0.5 Backend Lead (Dimas)
- 0.5 Data Analyst

#### Phase 2 (AI Enablement)
- 1 ML Engineer (Fajar)
- 1 Backend Lead (Dimas)
- 0.5 Data Analyst
- 1 ML/Data Science Contractor (optional)

#### Phase 3 (Agentic AI)
- 1 ML Engineer (Fajar)
- 1 Backend Lead (Dimas)
- 1 Frontend Lead
- 1 ML/Data Science Contractor
- 0.5 Product Manager

#### Phase 4 (Scale)
- Full team + dedicated DevOps
- Optional: Security Engineer for compliance

---

## Appendix

### A. Technical Stack Summary

| Layer | Technology | Notes |
|-------|------------|-------|
| ML Framework | Python, scikit-learn, XGBoost | Core ML |
| Deep Learning | PyTorch | Complex patterns |
| Feature Store | PostgreSQL JSONB → Feast (future) | Feature management |
| Vector DB | pgvector | RAG storage |
| LLM Gateway | LiteLLM | Multi-provider |
| Orchestration | Custom + Temporal (future) | Workflow |
| Monitoring | Prometheus + Grafana | System metrics |
| ML Monitoring | Evidently AI | Model drift |

### B. Documentation Requirements

- [ ] ML model cards (all models)
- [ ] Feature definitions catalog
- [ ] API documentation (auto-generated)
- [ ] Agent behavior specifications
- [ ] RAG knowledge base structure
- [ ] Incident runbooks

### C. Training Requirements

| Role | Training | Frequency |
|------|----------|-----------|
| Franchisee | Basic copilot usage | Onboarding |
| Regional Manager | Dashboard + insights | Monthly |
| HQ Admin | Full platform | Quarterly |
| Engineers | ML updates | As needed |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-23 | ML Engineer + PM | Initial combined document |

---

**Next Steps:**
1. Review with engineering team
2. Prioritize Phase 1 tasks
3. Allocate resources
4. Define Q3 milestones
5. Stakeholder alignment meeting
