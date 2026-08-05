# Success Metrics

## CyberQuote MVP — Pilot Program

**Purpose:** Define measurable KPIs to evaluate pilot success  
**Scope:** Technical, Business, and Adoption metrics  
**Target:** 30 franchise outlets across Indonesia  
**Document Version:** 1.0  
**Last Updated:** July 13, 2026

---

## Executive Summary

This document defines the Key Performance Indicators (KPIs) for the CyberQuote MVP pilot program. Metrics are organized into three categories: **Technical**, **Business**, and **Adoption**. Each metric includes definition, target, measurement method, and reporting schedule.

---

## Category 1: Technical Metrics

These metrics measure system performance and reliability.

### 1.1 Webhook & Data Pipeline

| Metric | Definition | Target | Measurement Method | Frequency |
|--------|------------|--------|-------------------|-----------|
| **Webhook Uptime** | Percentage of time webhook endpoint is reachable | ≥ 99.5% | System monitoring (UptimeRobot) | Real-time |
| **Data Latency** | Time from POS transaction to data in dashboard | < 5 minutes (p95) | Edge Function logs | Daily |
| **Ingestion Success Rate** | % of incoming data successfully processed | ≥ 99% | Ingestion logs | Daily |
| **Data Quality Score** | % of records passing validation | ≥ 98% | Validation checks | Daily |
| **API Error Rate** | % of API calls returning 4xx/5xx errors | < 1% | API logs | Daily |

### 1.2 Alert System

| Metric | Definition | Target | Measurement Method | Frequency |
|--------|------------|--------|-------------------|-----------|
| **Alert Accuracy (Precision)** | % of alerts that were valid/actionable | ≥ 85% | User feedback survey | Weekly |
| **Alert Recall** | % of actual issues detected by system | ≥ 80% | Manual audit sample | Weekly |
| **False Positive Rate** | % of alerts dismissed as irrelevant | < 15% | User dismiss data | Weekly |
| **Alert Processing Time** | Time from data anomaly to alert generated | < 4 hours | Alert timestamps | Daily |
| **Alert Delivery Success** | % of alerts successfully delivered via channel | ≥ 95% | Delivery receipts | Daily |

### 1.3 ML Model Performance

| Metric | Definition | Target | Measurement Method | Frequency |
|--------|------------|--------|-------------------|-----------|
| **Anomaly Detection Precision** | % of flagged anomalies that are true anomalies | ≥ 70% | Ground truth validation | Weekly |
| **Stockout Prediction Accuracy** | % of predicted stockouts that occurred | ≥ 80% | Stockout event log | Weekly |
| **Model Drift Score (PSI)** | Population Stability Index | < 0.1 | Feature distribution monitoring | Weekly |
| **Prediction Lead Time** | Hours between prediction and stockout | ≥ 24 hours | Event analysis | Weekly |
| **ML Inference Latency** | Time for ML Edge Function to return result | < 2 seconds (p95) | Edge Function logs | Daily |

### 1.4 System Reliability

| Metric | Definition | Target | Measurement Method | Frequency |
|--------|------------|--------|-------------------|-----------|
| **System Uptime** | Overall platform availability | ≥ 99% | Uptime monitoring | Real-time |
| **Incident Count** | Number of P1/P2 incidents | < 2/month | Incident log | Monthly |
| **Mean Time to Detect (MTTD)** | Average time to detect system issues | < 15 minutes | Incident timestamps | Monthly |
| **Mean Time to Resolve (MTTR)** | Average time to resolve issues | < 4 hours | Incident resolution logs | Monthly |
| **Database Availability** | PostgreSQL connection availability | ≥ 99.9% | Supabase monitoring | Real-time |

---

## Category 2: Business Metrics

These metrics measure business impact and user value.

### 2.1 Alert Response

| Metric | Definition | Target | Measurement Method | Frequency |
|--------|------------|--------|-------------------|-----------|
| **Alert Acknowledgment Rate** | % of alerts acknowledged by outlet | ≥ 80% | Dashboard activity log | Weekly |
| **Average Acknowledgment Time** | Time from alert to outlet acknowledgment | < 1 hour | Alert timestamps | Weekly |
| **Action Taken Rate** | % of acknowledged alerts that resulted in action | ≥ 60% | User feedback survey | Weekly |
| **Mean Time to Resolve (MTTR)** | Time from alert to case resolution | < 24 hours | Case management log | Weekly |

### 2.2 Inventory Outcomes

| Metric | Definition | Target | Measurement Method | Frequency |
|--------|------------|--------|-------------------|-----------|
| **Stockout Reduction** | % decrease in stockouts vs baseline | ≥ 20% | Stockout event count | Monthly |
| **Inventory Turnover Improvement** | % change in inventory turnover ratio | ≥ 10% | Inventory reports | Monthly |
| **Dead Stock Reduction** | % decrease in slow-moving inventory | ≥ 15% | Inventory analysis | Monthly |
| **Emergency Order Reduction** | % decrease in rush/emergency orders | ≥ 25% | Order records | Monthly |
| **Carrying Cost Savings** | Estimated cost reduction from better inventory | Track only | Financial analysis | Monthly |

### 2.3 User Satisfaction

| Metric | Definition | Target | Measurement Method | Frequency |
|--------|------------|--------|-------------------|-----------|
| **User Satisfaction Score** | Average rating from surveys | ≥ 4.0 / 5.0 | Post-pilot survey | Weekly |
| **Net Promoter Score (NPS)** | Likelihood to recommend | ≥ 40 | End-of-pilot survey | Monthly |
| **System Ease of Use** | Average usability rating | ≥ 4.0 / 5.0 | Weekly survey | Weekly |
| **Alert Relevance Rating** | User rating of alert quality | ≥ 4.0 / 5.0 | Weekly survey | Weekly |
| **Support Satisfaction** | Rating of support team responsiveness | ≥ 4.5 / 5.0 | Support tickets | Weekly |

### 2.4 Operational Efficiency

| Metric | Definition | Target | Measurement Method | Frequency |
|--------|------------|--------|-------------------|-----------|
| **Time Saved per Week** | Hours outlet staff save on inventory tasks | ≥ 2 hours/week | Staff surveys | Monthly |
| **Decision Quality** | % of inventory decisions based on data | ≥ 80% | User interviews | Monthly |
| **Reporting Time Reduction** | Time saved on manual reporting | ≥ 50% | Time tracking | Monthly |
| **Reorder Accuracy** | % of reorders that match actual needs | ≥ 85% | Order vs consumption | Monthly |

---

## Category 3: Adoption Metrics

These metrics measure user engagement and system adoption.

### 3.1 User Engagement

| Metric | Definition | Target | Measurement Method | Frequency |
|--------|------------|--------|-------------------|-----------|
| **Daily Active Users (DAU)** | Unique users accessing dashboard per day | ≥ 80% of enrolled | Supabase analytics | Daily |
| **Weekly Active Users (WAU)** | Unique users accessing per week | ≥ 90% of enrolled | Supabase analytics | Weekly |
| **Session Duration** | Average time per dashboard session | ≥ 5 minutes | Analytics | Weekly |
| **Dashboard Views per Day** | Number of times dashboard is opened | ≥ 3 times/day | Analytics | Daily |
| **Feature Adoption Rate** | % of users using each core feature | ≥ 70% per feature | Feature flags | Weekly |

### 3.2 Feature Usage

| Metric | Definition | Target | Measurement Method | Frequency |
|--------|------------|--------|-------------------|-----------|
| **Alert List Usage** | % of users viewing alert list daily | ≥ 75% | Analytics | Daily |
| **Alert Detail View** | % of alerts opened for details | ≥ 60% | Analytics | Weekly |
| **Case Creation** | Cases created per 100 alerts | ≥ 20 | Case management log | Weekly |
| **Athena Queries** | Number of Athena AI queries per user | ≥ 5/week | Query logs | Weekly |
| **Report Downloads** | Reports downloaded per outlet | ≥ 2/week | Download logs | Weekly |
| **Settings Configuration** | % of outlets completing settings | 100% | Settings status | Weekly |

### 3.3 Training & Support

| Metric | Definition | Target | Measurement Method | Frequency |
|--------|------------|--------|-------------------|-----------|
| **Training Completion Rate** | % of outlets completing onboarding | 100% | Training records | Weekly |
| **Training Effectiveness** | Post-training quiz score | ≥ 80% | Quiz results | Per session |
| **Support Ticket Volume** | Tickets submitted per outlet per month | < 5 | Support system | Monthly |
| **Self-Service Rate** | % of issues resolved without support | ≥ 70% | Ticket analysis | Monthly |
| **Documentation Usage** | Help center views per user | ≥ 2/week | Analytics | Weekly |

### 3.4 Feedback & Iteration

| Metric | Definition | Target | Measurement Method | Frequency |
|--------|------------|--------|-------------------|-----------|
| **Survey Response Rate** | % of weekly surveys completed | ≥ 75% | Survey completion | Weekly |
| **Feedback Implementation** | % of feedback items addressed | ≥ 50% | Feedback tracker | Bi-weekly |
| **Feature Request Volume** | Number of new feature requests | Track only | Feedback system | Monthly |
| **Bug Report Rate** | Critical bugs per 1000 alerts | < 0.5 | Bug tracker | Monthly |

---

## Measurement & Reporting

### Daily Metrics Dashboard

```
┌────────────────────────────────────────────────────────────────┐
│                    CYBERQUOTE METRICS DASHBOARD                │
├────────────────────────────────────────────────────────────────┤
│  Technical Status          │  Business Impact                  │
│  ─────────────────────     │  ──────────────────               │
│  Uptime: 99.9%      ✅      │  Alerts Resolved: 45/52          │
│  Data Latency: 2.3m  ✅    │  Avg Response: 42 min            │
│  Alert Accuracy: 87% ✅    │  Stockout Prevention: 12         │
│  ML Latency: 1.2s    ✅    │  User Satisfaction: 4.2/5        │
│                                                                │
│  Adoption Status           │  Critical Alerts                  │
│  ─────────────────────     │  ────────────────                │
│  DAU: 28/30 outlets  93%   │  ⚠️ 3 unacknowledged            │
│  WAU: 30/30 outlets 100%   │  ⚠️ 1 critical stockout risk     │
│  Sessions: 142/day         │  ✅ 48 resolved today            │
└────────────────────────────────────────────────────────────────┘
```

### Weekly Report Template

```
═══════════════════════════════════════════════════════════════
              CYBERQUOTE PILOT — WEEKLY REPORT
═══════════════════════════════════════════════════════════════

REPORT PERIOD: [Start Date] - [End Date]
REPORT NUMBER: Week [#]
PREPARED BY: [Name]

1. EXECUTIVE SUMMARY
────────────────────────────────────────────────────────────────
[2-3 sentence overview of week's performance]

2. KEY METRICS
────────────────────────────────────────────────────────────────

   TECHNICAL
   ├── Webhook Uptime:           [X.X%] [Target: ≥99.5%]
   ├── Data Latency (p95):       [X.X] min [Target: <5 min]
   ├── Alert Accuracy:           [XX%] [Target: ≥85%]
   └── ML Inference Latency:     [X.X]s [Target: <2s]

   BUSINESS
   ├── Alert Acknowledgment:     [XX%] [Target: ≥80%]
   ├── Avg Response Time:        [XX] min [Target: <60 min]
   ├── Stockout Reduction:       [XX%] [Target: ≥20%]
   └── User Satisfaction:        [X.X/5] [Target: ≥4.0]

   ADOPTION
   ├── Daily Active Users:       [XX/XX] [Target: ≥80%]
   ├── Weekly Active Users:      [XX/XX] [Target: ≥90%]
   ├── Feature Adoption:         [XX%] [Target: ≥70%]
   └── Training Completion:      [XX/XX] [Target: 100%]

3. HIGHLIGHTS
────────────────────────────────────────────────────────────────
• [Achievement 1]
• [Achievement 2]
• [Positive feedback received]

4. ISSUES & ACTIONS
────────────────────────────────────────────────────────────────
| Issue | Severity | Action | Owner | Status |
|-------|----------|--------|-------|--------|
| [Desc]| [P1/P2] | [Action] | [Name] | [Open/Done] |

5. OUTLOOK FOR NEXT WEEK
────────────────────────────────────────────────────────────────
• [Planned activities]
• [Expected milestones]
• [Risks to monitor]

═══════════════════════════════════════════════════════════════
```

### Measurement Schedule

| Report Type | Frequency | Audience | Contents |
|-------------|-----------|----------|----------|
| **Real-time Dashboard** | Always-on | Operations | Core metrics, alerts, system status |
| **Daily Digest** | Daily (8 AM) | Support team | Overnight metrics, incidents, action items |
| **Weekly Report** | Monday (9 AM) | All stakeholders | Full metrics review, trends, issues |
| **Mid-Pilot Review** | Day 30 | Leadership | Progress vs targets, adjustments |
| **End-Pilot Review** | Day 90 | Leadership + Franchise | Final metrics, recommendations |

---

## Target Summary

### Must-Hit Targets (MVP Success Gate)

| Metric | Minimum Target | Stretch Target |
|--------|----------------|----------------|
| **Alert Accuracy** | ≥ 85% | ≥ 90% |
| **System Uptime** | ≥ 99% | ≥ 99.5% |
| **User Satisfaction** | ≥ 4.0/5.0 | ≥ 4.5/5.0 |
| **Alert Acknowledgment** | ≥ 80% | ≥ 90% |
| **Daily Active Users** | ≥ 80% | ≥ 90% |

### Track-Only Metrics (Gather Data)

| Metric | Purpose |
|--------|---------|
| Stockout Reduction | Validate business case |
| Carrying Cost Savings | Build ROI model |
| Time Saved per Week | Quantify operational value |
| NPS Score | Measure long-term viability |

---

## Appendix A: Metric Definitions

### Statistical Terms

| Term | Definition |
|------|------------|
| **p95** | 95th percentile — 95% of values are below this |
| **MTTD** | Mean Time to Detect — average time to discover an issue |
| **MTTR** | Mean Time to Resolve — average time to fix an issue |
| **PSI** | Population Stability Index — measures feature drift |
| **NPS** | Net Promoter Score — measures customer loyalty (-100 to +100) |

### Data Sources

| Source | Tool/Method |
|--------|-------------|
| System metrics | Supabase monitoring, custom dashboards |
| User behavior | Supabase Analytics, Mixpanel |
| User feedback | Custom surveys, Google Forms |
| Incident tracking | Linear, custom incident log |
| Business outcomes | Outlet reports, manual tracking |

---

## Appendix B: Alert Severity Levels

| Severity | Definition | Response SLA | Example |
|----------|------------|--------------|---------|
| **P1 - Critical** | Stockout imminent, urgent action required | < 15 minutes | Top seller at 0 stock |
| **P2 - High** | Low stock threshold breached | < 1 hour | Item below reorder point |
| **P3 - Medium** | Trending analysis, informational | < 24 hours | Unusual sales pattern detected |
| **P4 - Low** | Suggestions and recommendations | No SLA | Slow-moving inventory alert |

---

## Appendix C: Success Thresholds

### Green (On Track)

- All metrics meeting targets
- No critical incidents
- Positive user feedback trends

### Yellow (Attention Needed)

- 1-2 metrics below target
- Minor incidents resolved quickly
- Some user feedback concerns

### Red (At Risk)

- 3+ metrics below target
- P1 incidents occurring
- Significant user dissatisfaction
- Escalation required

---

**Document Status:** Approved for Pilot Program  
**Review Cycle:** Weekly during pilot  
**Escalation:** Metrics below target trigger team review within 48 hours
