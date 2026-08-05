# Agent Orchestration - Complete Flow Diagram

**Project:** CyberQuote AI Platform  
**Purpose:** Show where Agent Orchestration fits in the system

---

## System Overview - Where Agent Orchestration Lives

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CYBERQUOTE SYSTEM                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     1. DATA SOURCES (Bottom)                     │   │
│  │                                                                  │   │
│  │   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │   │
│  │   │   POS    │  │ Inventory│  │  Staff   │  │  Alerts  │       │   │
│  │   │ System   │  │  System  │  │  System  │  │  System  │       │   │
│  │   └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘       │   │
│  │        │              │              │              │            │   │
│  │        └──────────────┴──────────────┴──────────────┘            │   │
│  │                              │                                      │   │
│  │                     ┌────────▼────────┐                           │   │
│  │                     │   SUPABASE DB   │                           │   │
│  │                     │  sales_trans    │                           │   │
│  │                     │  inventory      │                           │   │
│  │                     │  staff          │                           │   │
│  │                     │  alerts         │                           │   │
│  │                     │  cases         │                           │   │
│  │                     └────────┬────────┘                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                      │
│                                    │                                      │
│                                    ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                     2. AGENT ORCHESTRATION LAYER                    │ │
│  │                                                                      │ │
│  │     ┌──────────────────────────────────────────────────────────┐    │ │
│  │     │                      COORDINATOR                          │    │ │
│  │     │                   (The Brain)                            │    │ │
│  │     │                                                          │    │ │
│  │     │   Listens to: All data changes                           │    │ │
│  │     │   Decides: What agent to call                            │    │ │
│  │     │   Routes: Tasks to correct agent                         │    │ │
│  │     └─────────────────────────┬────────────────────────────────┘    │ │
│  │                               │                                     │ │
│  │     ┌────────────┬───────────┴───────────┬────────────┐             │ │
│  │     │            │                       │            │             │ │
│  │     ▼            ▼                       ▼            ▼             │ │
│  │  ┌──────┐   ┌────────┐            ┌─────────┐   ┌──────────┐      │ │
│  │  │Athena│   │Monitor │            │Analyst  │   │  Triage  │      │ │
│  │  │(AI)  │   │(Detect)│            │(Predict)│   │ (Route)  │      │ │
│  │  └──┬───┘   └────┬───┘            └────┬────┘   └────┬─────┘      │ │
│  │     │             │                      │            │            │ │
│  │     └─────────────┴──────────────────────┴────────────┘            │ │
│  │                               │                                     │ │
│  │                               ▼                                     │ │
│  │                         ┌──────────┐                              │ │
│  │                         │Executor  │                              │ │
│  │                         │(Action)  │                              │ │
│  │                         └────┬─────┘                              │ │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                      │
│                                    │                                      │
│                                    ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                     3. OUTPUTS (Top)                                │ │
│  │                                                                      │ │
│  │   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐         │ │
│  │   │Dashboard │  │  Chat    │  │   App    │  │ Webhook  │         │ │
│  │   │ (Stats)  │  │ (Athena) │  │(Notif)   │  │ (External)│         │ │
│  │   └──────────┘  └──────────┘  └──────────┘  └──────────┘         │ │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Detailed Agent Flow

### FLOW 1: Real-time Monitoring (Monitor Agent)

```
┌─────────────────────────────────────────────────────────────────┐
│              FLOW 1: REAL-TIME MONITORING                       │
│              (Automatic - runs every 5 minutes)                 │
└─────────────────────────────────────────────────────────────────┘

START: Cron Job triggers every 5 minutes
        │
        ▼
┌───────────────────┐
│   Monitor Agent   │
│   (ML Anomaly)    │
└─────────┬─────────┘
          │
          │ 1. Query sales_transactions
          │    - Last 24 hours per outlet
          │    - Calculate anomaly score
          │
          ▼
┌───────────────────┐
│  Anomaly Check    │
│  Score > 0.7?     │
└─────────┬─────────┘
          │
    ┌─────┴─────┐
    │           │
   YES          NO
    │           │
    ▼           ▼
┌────────┐   ┌────────────┐
│ CREATE │   │   NO ALERT  │
│ ALERT  │   │   LOG OK   │
└───┬────┘   └────────────┘
    │
    │ Alert created:
    │ - type: SALES_ANOMALY
    │ - severity: P1_HIGH
    │ - outlet_id: X
    │ - score: 0.85
    │
    ▼
┌───────────────────┐
│   Triage Agent    │
│   (Auto-triggered)│
└─────────┬─────────┘
          │
          │ 2. Classify alert
          │    - Assign priority
          │    - Route to owner
          │    - Set SLA
          │
          ▼
┌───────────────────┐
│  Update Alert     │
│  status: TRIAGED  │
│  assigned_to: HQ  │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│   Executor Agent  │
│   (Send Notify)   │
└─────────┬─────────┘
          │
          │ 3. Send notification
          │    - Push to Dashboard
          │    - In-app notification
          │    - (Future: SMS/WhatsApp)
          │
          ▼
    ┌──────────┐
    │  END     │
    │  Alert   │
    │  visible │
    │  in UI   │
    └──────────┘
```

### FLOW 2: User Query via Chat (Athena Agent)

```
┌─────────────────────────────────────────────────────────────────┐
│              FLOW 2: USER QUERY (On-Demand)                      │
│              (Triggered when user types in chat)                 │
└─────────────────────────────────────────────────────────────────┘

START: User types in Chat
        │
        │ "revenue outlet mana yang paling bagus?"
        ▼
┌───────────────────┐
│  User Chat Input  │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│   Athena Agent    │
│   (AI Chat)       │
└─────────┬─────────┘
          │
          │ 1. Parse intent
          │    - Action: query_revenue
          │    - Entity: outlet performance
          │    - TimeRange: YTD
          │
          ▼
┌───────────────────┐
│  Query Database  │
│  (via Coordinator)│
└─────────┬─────────┘
          │
          │ 2. Fetch data
          │    - sales_transactions
          │    - Group by outlet
          │    - Calculate revenue
          │
          ▼
┌───────────────────┐
│  Generate Report  │
│  (with context)   │
└─────────┬─────────┘
          │
          │ 3. Create AI response
          │    - Top outlet: Tampines (S$ 125,000)
          │    - Recommendations
          │    - Supporting data
          │
          ▼
┌───────────────────┐
│   Executor Agent  │
│   (Format Output) │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│   Return to User  │
│   (Chat Interface)│
└───────────────────┘
          │
          ▼
    ┌──────────────┐
    │ User sees:   │
    │ "Top Outlet: │
    │ 1. Tampines  │
    │ 2. Clementi  │
    │ 3. Jurong    │
    └──────────────┘
```

### FLOW 3: Stockout Prediction (Analyst Agent)

```
┌─────────────────────────────────────────────────────────────────┐
│              FLOW 3: STOCKOUT PREDICTION                        │
│              (Automatic - runs every 15 minutes)                │
└─────────────────────────────────────────────────────────────────┘

START: Cron Job triggers every 15 minutes
        │
        ▼
┌───────────────────┐
│  Analyst Agent    │
│  (ML Prediction)  │
└─────────┬─────────┘
          │
          │ 1. Query inventory
          │    - Current stock levels
          │    - Sales velocity
          │    - Historical patterns
          │
          ▼
┌───────────────────┐
│  ML Model Run     │
│  (Stockout Risk)  │
└─────────┬─────────┘
          │
          │ 2. Predict stockout probability
          │    - Product X: 85% risk
          │    - Product Y: 60% risk
          │    - Product Z: 20% risk
          │
          ▼
┌───────────────────┐
│  Threshold Check  │
│  Risk > 70%?      │
└─────────┬─────────┘
          │
    ┌─────┴─────┐
    │           │
   YES          NO
    │           │
    ▼           ▼
┌────────┐   ┌────────────┐
│ CREATE │   │   NO ALERT │
│ ALERT  │   │   LOG OK   │
└───┬────┘   └────────────┘
    │
    │ Alert created:
    │ - type: STOCKOUT_RISK
    │ - severity: P0_CRITICAL
    │ - product: Roti Prata
    │ - outlet: Hougang
    │ - risk_score: 0.85
    │
    ▼
┌───────────────────┐
│   Triage Agent    │
│   (Auto-triggered)│
└─────────┬─────────┘
          │
          │ 3. Route to store manager
          │    - Notify outlet staff
          │    - Create restock task
          │
          ▼
┌───────────────────┐
│   Executor Agent  │
│   (Create Action) │
└─────────┬─────────┘
          │
          │ 4. Execute
          │    - Create case: RESTOCK
          │    - Send notification
          │    - Update dashboard
          │
          ▼
    ┌──────────────┐
    │ END          │
    │ - Case created│
    │ - Notif sent │
    │ - Dashboard  │
    │   updated    │
    └──────────────┘
```

### FLOW 4: Case Escalation (Triage + Coordinator)

```
┌─────────────────────────────────────────────────────────────────┐
│              FLOW 4: CASE ESCALATION                            │
│              (Triggered when alert needs human action)            │
└─────────────────────────────────────────────────────────────────┘

START: Alert generated OR User creates case
        │
        ▼
┌───────────────────┐
│   Triage Agent    │
│   (Classify Case) │
└─────────┬─────────┘
          │
          │ 1. Analyze case
          │    - Type: Attendance issue
          │    - Severity: P2_MEDIUM
          │    - Required action: Approve leave
          │
          ▼
┌───────────────────┐
│  Role Routing     │
│  (Who handles?)   │
└─────────┬─────────┘
          │
          │ 2. Determine handler
          │    - Franchisee: P1, P2
          │    - Regional: P0, P1
          │    - HQ: All + escalations
          │
          ▼
┌───────────────────┐
│   Coordinator     │
│   (Route Decision)│
└─────────┬─────────┘
          │
          │ 3. Route to appropriate handler
          │    - Update case.assigned_to
          │    - Set SLA deadline
          │
          ▼
┌───────────────────┐
│   Executor Agent  │
│   (Notify + Task) │
└─────────┬─────────┘
          │
          │ 4. Actions
          │    - Create task in queue
          │    - Send notification
          │    - Update case status
          │
          ▼
┌───────────────────┐
│   Dashboard       │
│   (Visible Queue) │
└───────────────────┘
          │
          ▼
┌───────────────────┐
│   User Approves   │
│   (Human Action)  │
└─────────┬─────────┘
          │
          │ 5. Update case
          │    - status: APPROVED
          │    - completed_at: NOW
          │
          ▼
    ┌──────────────┐
    │ END          │
    │ Case closed  │
    │ Log recorded │
    │ Metrics updated│
    └──────────────┘
```

---

## Integration Flow - End to End

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         COMPLETE USER JOURNEY                            │
│                                                                         │
│   FRANCHISEE: "Budi" owns 3 outlets in Singapore                       │
└─────────────────────────────────────────────────────────────────────────┘

╔═══════════════════════════════════════════════════════════════════════╗
║  MORNING (8:00 AM)                                                    ║
╠═══════════════════════════════════════════════════════════════════════╣
║                                                                       ║
║  AGENT ACTIVITY (Background - no user action needed)                  ║
║                                                                       ║
║  1. MONITOR AGENT (every 5 min)                                       ║
║     └─> Checks sales data                                              ║
║     └─> ✓ No anomalies detected                                        ║
║                                                                       ║
║  2. ANALYST AGENT (every 15 min)                                      ║
║     └─> Predicts stockout risk                                         ║
║     └─> ⚠️ "Roti Prata @ Hougang: 85% stockout risk"                  ║
║     └─> Creates ALERT                                                  ║
║                                                                       ║
║  3. TRIAGE AGENT (auto)                                               ║
║     └─> Routes alert to Hougang store manager                          ║
║     └─> Creates RESTOCK task                                          ║
║                                                                       ║
║  4. EXECUTOR AGENT (auto)                                             ║
║     └─> Sends push notification to Budi's phone                        ║
║     └─> "⚠️ Stockout Risk: Roti Prata @ Hougang. Tap to restock."    ║
║                                                                       ║
║  USER IMPACT: Budi wakes up → sees notification → taps to restock    ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
                                    │
                                    ▼
╔═══════════════════════════════════════════════════════════════════════╗
║  MID-MORNING (10:00 AM)                                               ║
╠═══════════════════════════════════════════════════════════════════════╣
║                                                                       ║
║  USER ACTION: Budi opens CyberQuote app                                 ║
║                                                                       ║
║  WHAT HE SEES:                                                        ║
║  ┌───────────────────────────────────────────────────────────────┐    ║
║  │ Dashboard Summary                                              │    ║
║  │                                                               │    ║
║  │  Revenue Today    │  Active Alerts │  Pending Tasks          │    ║
║  │     S$ 12,450    │       2        │       3                  │    ║
║  │  (▲ 15% from yesterday)                                   │    ║
║  │                                                               │    ║
║  │  ┌─────────────────────────────────────────────────────┐    │    ║
║  │  │ 🔴 Stockout Alert (P0)                    8:15 AM    │    │    ║
║  │  │ Roti Prata @ Hougang - Restock Required            │    │    ║
║  │  │ [VIEW] [RESTOCK NOW]                               │    │    ║
║  │  └─────────────────────────────────────────────────────┘    │    ║
║  │                                                               │    ║
║  │  ┌─────────────────────────────────────────────────────┐    │    ║
║  │  │ 🟡 Sales Anomaly (P1)                    9:30 AM    │    │    ║
║  │  │ Jurong sales -30% below normal                       │    │    ║
║  │  │ [VIEW] [INVESTIGATE]                                │    │    ║
║  │  └─────────────────────────────────────────────────────┘    │    ║
║  │                                                               │    ║
║  └───────────────────────────────────────────────────────────────┘    ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
                                    │
                                    ▼
╔═══════════════════════════════════════════════════════════════════════╗
║  USER QUERY (10:30 AM)                                                ║
╠═══════════════════════════════════════════════════════════════════════╣
║                                                                       ║
║  Budi types: "outlet mana yang paling bagus bulan ini?"               ║
║                                                                       ║
║  ATHENA AGENT (triggered by chat)                                     ║
║  └─> Queries database                                                  ║
║  └─> Analyzes data                                                    ║
║  └─> Generates response:                                              ║
║                                                                       ║
║  ┌───────────────────────────────────────────────────────────────┐    ║
║  │ Athena says:                                                   │    ║
║  │                                                               │    ║
║  │ "Based on July data, your top performing outlets are:        │    ║
║  │                                                               │    ║
║  │ 1. 🏆 Tampines - S$ 45,200 (▲ 18% MoM)                      │    ║
║  │ 2. 🥈 Jurong - S$ 38,100 (▼ 5% MoM)                        │    ║
║  │ 3. 🥉 Clementi - S$ 32,800 (▲ 8% MoM)                       │    ║
║  │                                                               │    ║
║  │ Recommendation: Jurong shows declining trend.               │    ║
║  │ Consider investigating cause of -5% drop."                   │    ║
║  │                                                               │    ║
║  │ [View Detailed Report] [Export Data]                         │    ║
║  └───────────────────────────────────────────────────────────────┘    ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
                                    │
                                    ▼
╔═══════════════════════════════════════════════════════════════════════╗
║  AFTERNOON (2:00 PM)                                                  ║
╠═══════════════════════════════════════════════════════════════════════╣
║                                                                       ║
║  MONITOR AGENT (5-minute check)                                        ║
║  └─> Detects: "Jurong sales anomaly continues"                        ║
║  └─> Alert escalated to P0                                             ║
║                                                                       ║
║  EXECUTOR AGENT                                                        ║
║  └─> Sends escalation to Regional Manager                             ║
║  └─> Regional Manager gets notified                                    ║
║                                                                       ║
║  ┌───────────────────────────────────────────────────────────────┐    ║
║  │ 📱 Notification to Regional Manager                           │    ║
║  │                                                               │    ║
║  │ "🚨 Escalation: Jurong outlet underperforming               │    ║
║  │    for 3 consecutive days. Please investigate."             │    ║
║  │                                                               │    ║
║  │    [CALL BUDI] [VIEW OUTLET] [DISMISS]                       │    ║
║  └───────────────────────────────────────────────────────────────┘    ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
                                    │
                                    ▼
╔═══════════════════════════════════════════════════════════════════════╗
║  EVENING (6:00 PM)                                                    ║
╠═══════════════════════════════════════════════════════════════════════╣
║                                                                       ║
║  USER ACTION: Regional Manager calls Budi                               ║
║                                                                       ║
║  RESOLUTION:                                                          ║
║  - Found: Staff shortage at Jurong                                    ║
║  - Action: Schedule adjustment                                         ║
║  - Case closed: RESOLVED                                              ║
║                                                                       ║
║  AGENT ACTIVITY:                                                      ║
║  - Case logged for historical analysis                                 ║
║  - Metrics updated (resolution time, root cause)                       ║
║  - Dashboard reflects "Resolved" status                                ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
                                    │
                                    ▼
╔═══════════════════════════════════════════════════════════════════════╗
║  DAY END                                                              ║
╠═══════════════════════════════════════════════════════════════════════╣
║                                                                       ║
║  AGENT ACTIVITY (Automatic):                                           ║
║                                                                       ║
║  1. Daily Report Generated                                            ║
║     └─> ATHENA: "Summary of today's operations"                      ║
║     └─> Sent to HQ Admin                                              ║
║                                                                       ║
║  2. Predictive Analysis                                                ║
║     └─> ANALYST: Next day forecast                                    ║
║     └─> "Expected high demand: Jurong (recovering)"                  ║
║     └─> "Stockout risk: Low across all outlets"                      ║
║                                                                       ║
║  3. Agent Metrics Updated                                             ║
║     └─> MONITOR: 144 checks today, 3 anomalies found                  ║
║     └─> TRIAGE: 3 alerts, avg response time: 2 min                    ║
║     └─> EXECUTOR: 5 notifications sent                               ║
║                                                                       ║
║  4. Dashboard Updated                                                ║
║     └─> Tomorrow's dashboard shows:                                   ║
║         - Yesterday's closed cases                                     ║
║         - Agent performance metrics                                    ║
║         - Trend analysis                                              ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
```

---

## Data Flow Summary

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DATA FLOW                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   POS / External ──────► Supabase ─────────────► Dashboard          │
│   Systems              │     │                  │                    │
│                        │     │                  │                    │
│                        │     ▼                  │                    │
│                        │  ┌─────────────────┐   │                    │
│                        │  │   MONITOR       │   │                    │
│                        │  │   AGENT         │───┼──► Anomaly Alerts │
│                        │  └─────────────────┘   │                    │
│                        │           │            │                    │
│                        │           ▼            │                    │
│                        │  ┌─────────────────┐   │                    │
│                        │  │   TRIAGE        │   │                    │
│                        │  │   AGENT         │───┼──► Prioritized    │
│                        │  └─────────────────┘   │      Queue         │
│                        │           │            │                    │
│                        │           ▼            │                    │
│                        │  ┌─────────────────┐   │                    │
│                        │  │   COORDINATOR   │   │                    │
│                        │  │   (Brain)       │───┼──► Routing        │
│                        │  └─────────────────┘   │      Decisions    │
│                        │           │            │                    │
│                        │           ▼            │                    │
│                        │  ┌─────────────────┐   │                    │
│                        │  │   EXECUTOR      │   │                    │
│                        │  │   AGENT         │───┼──► Notifications  │
│                        │  └─────────────────┘   │      + Actions    │
│                        │           │            │                    │
│                        │           ▼            │                    │
│                        │  ┌─────────────────┐   │                    │
│                        │  │   ATHENA        │   │                    │
│                        │  │   (AI Chat)     │───┼──► User Queries  │
│                        │  └─────────────────┘   │                    │
│                        │           │            │                    │
│                        │           ▼            │                    │
│                        │  ┌─────────────────┐   │                    │
│                        │  │   ANALYST       │   │                    │
│                        │  │   AGENT         │───┼──► Predictions    │
│                        │  └─────────────────┘   │      + Insights   │
│                        │                         │                    │
│                        └─────────────────────────┘                    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Key Metrics Tracked

| Agent | Metrics Collected | Dashboard Shows |
|-------|------------------|-----------------|
| Monitor | Checks/day, Anomalies found, Detection accuracy | Uptime, Alert count |
| Analyst | Predictions made, Accuracy rate | Risk distribution |
| Triage | Alerts classified, Avg classification time | Queue depth, SLA compliance |
| Executor | Actions completed, Notifications sent | Response time, Resolution rate |
| Athena | Queries answered, User satisfaction | Usage stats |

---

## User Touchpoints

| Time | User Action | Agent Response |
|------|-------------|----------------|
| Morning | Open app | See dashboard summary |
| Anytime | Type chat | Athena responds |
| Alert | Tap notification | View alert details |
| Task | Complete task | Case marked resolved |
| Evening | Review report | Agent generates summary |

---

**This is where Agent Orchestration fits in CyberQuote:**
- **Bottom:** Data sources (POS, Inventory, Staff)
- **Middle:** Agents working automatically
- **Top:** User-facing outputs (Dashboard, Chat, Notifications)
