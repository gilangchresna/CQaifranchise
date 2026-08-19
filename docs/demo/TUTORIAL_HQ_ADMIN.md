# 🎓 Tutorial: HQ Admin Dashboard

**Role:** HQ_ADMIN (Full Platform Access)
**Email:** steve.gilang@gmail.com
**Password:** Steve123!@#
**URL:** https://cqaifrc.cqit.sg

---

## 📋 Overview

As **HQ Admin**, you have **full access** to all platform features:
- View all regions, outlets, and data globally
- Manage users and access control
- Configure system settings
- Monitor AI agents and alerts
- Access Bridge Financing and Document Vault

---

## 🔐 Step 1: Login

1. Go to **https://cqaifrc.cqit.sg**
2. Enter email: `steve.gilang@gmail.com`
3. Enter password: `Steve123!@#`
4. Click **Sign In**

**Expected:** Dashboard loads with global view (all 34 outlets, all regions)

---

## 📊 Step 2: Dashboard Overview

### What You See:
- **KPI Cards:** Revenue, Active Outlets, Low Stock Alerts, System Health
- **Revenue Chart:** 7-day sales trend with baseline comparison
- **Top Risk Outlets:** AI-detected anomalies
- **Recent Alerts:** Latest system alerts

### Key Features:
| Feature | Description |
|---------|-------------|
| **Country Filter** | Dropdown to filter by SG, ID, TH, MY |
| **Period Selector** | 7D, 30D, 90D time ranges |
| **Live Indicator** | Shows real-time data refresh (4-13s) |

### Try This:
1. Click **Country Filter** → Select **Singapore**
2. Watch all data update to show only SG outlets
3. Click **Indonesia** → See IDR currency, different outlets
4. Click **All** → Return to global view

---

## 🚨 Step 3: Alerts & Cases

### Accessing Alerts:
1. Click **Active Escalations** in sidebar
2. See list of AI-detected anomalies
3. Each alert shows: Outlet, Type, Severity, Status

### Alert Severity Levels:
| Level | Color | Response Time |
|-------|-------|---------------|
| P0_CRITICAL | 🔴 Red | Immediate |
| P1_HIGH | 🟠 Orange | 1 hour |
| P2_MEDIUM | 🟡 Yellow | 24 hours |
| P3_LOW | 🟢 Green | 72 hours |

### Creating a Case:
1. Click on an alert
2. Click **Create Case**
3. Assign priority and description
4. Case is created with SLA tracking

---

## 🤖 Step 4: Athena AI Chat

### Accessing Athena:
1. Look for **blue chat bubble** (bottom-right corner)
2. Click to open Athena chat panel

### Try These Questions:
| Question | Expected Response |
|----------|-------------------|
| "What's the total revenue this week?" | S$ amount with breakdown |
| "Which outlets have low stock?" | List of outlets with stock levels |
| "Show me anomalies in Singapore" | Filtered anomaly list |
| "What's the stockout risk?" | Risk assessment with recommendations |

### Athena Features:
- ✅ Currency-aware (SGD, IDR, THB, MYR)
- ✅ Context-aware (knows your role and region)
- ✅ Real-time data from database
- ✅ AI-powered recommendations

---

## 👥 Step 5: Access Control

### Accessing Access Control:
1. Click **Access Control** in sidebar
2. See list of all users (42 total)

### User Management:
| Action | How To |
|--------|--------|
| **View Users** | Scroll through user list |
| **Filter by Role** | Use role dropdown |
| **Reset Password** | Click user → Reset Password button |
| **Assign Outlets** | Click user → Assign Outlets |

### User Roles:
| Role | Access Level |
|------|--------------|
| HQ_ADMIN | Full platform access |
| REGIONAL_MANAGER | Region-scoped access |
| FRANCHISEE_OWNER | Own outlet access |
| FRANCHISEE_STAFF | Read-only outlet access |

---

## ⚙️ Step 6: Settings

### Accessing Settings:
1. Click **Settings** in sidebar
2. View system configuration

### Available Settings:
| Category | Settings |
|----------|----------|
| **AI** | ai_mode, ai_threshold, ai_caching |
| **Alerts** | anomaly_threshold, stockout_threshold |
| **SLA** | sla_high, sla_medium, sla_low |
| **Retention** | retention_days_alerts, retention_days_cases |

---

## 🏦 Step 7: Bridge Financing

### Accessing Bridge Financing:
1. Click **Bridge Financing** in sidebar
2. See list of financing applications

### Loan Application Flow:
1. Click **Apply for Loan**
2. **Consent Dialog** appears (PDPA compliance)
3. Review privacy notice
4. Check consent checkbox
5. Submit application
6. Upload documents (KYC, bank statements)

### Document Types:
| Type | Description |
|------|-------------|
| KYC_ID | Identity documents |
| BANK_STATEMENT | Bank statements (3-6 months) |
| FRANCHISEE_CONTRACT | Franchise agreement |
| FINANCIAL_REPORT | P&L statements |
| OTHER | Supporting documents |

---

## 📈 Step 8: Agent Orchestration

### Accessing Agent Orchestration:
1. Click **Agent Orchestration** in sidebar
2. See status of 8 AI agents

### Agent Status:
| Agent | Status | Purpose |
|-------|--------|---------|
| coordinator-pipeline | ✅ Active | Task routing |
| sla-escalator | ✅ Active | SLA monitoring |
| agent-monitor | ✅ Active | Anomaly detection |
| ml-anomaly-v2 | ✅ Active | ML scoring |
| ml-stockout-v2 | ✅ Active | Stockout prediction |
| agent-analyze | ✅ Active | Data analysis |
| agent-executor | ✅ Active | Action execution |
| agent-coordinator | ✅ Active | Orchestration |

---

## 🎯 Demo Talking Points

### For Chairman:
> "As HQ Admin, you have **complete visibility** across all 34 outlets in 6 countries.
> 
> The AI automatically detects anomalies and creates alerts — **response time drops from days to minutes**.
> 
> You can drill down from global view to specific outlet in **2 clicks**."

### For Client:
> "The dashboard is **intuitive** — your franchisees can learn it in 10 minutes.
> 
> **Role-based access** ensures each user only sees what they need.
> 
> **Athena AI** answers questions in natural language — no training required."

---

## ⚠️ Troubleshooting

| Issue | Solution |
|-------|----------|
| Login fails | Check email/password, clear browser cache |
| Dashboard empty | Check country filter, try "All" |
| Athena not responding | Check internet, try refreshing page |
| Alerts not showing | Check status filter (NEW/OPEN) |
| Can't create case | Check user permissions, try refresh |

---

## 📞 Support

| Issue | Contact |
|-------|---------|
| Technical | steve.gilang@gmail.com |
| Demo Issues | Demo Team |
| Feedback | chairman@company.com |

---

**Document Version:** 1.0
**Last Updated:** Aug 18, 2026
**Prepared For:** Chairman & Client Demo
