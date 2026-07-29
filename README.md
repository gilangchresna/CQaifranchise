# CyberQuote MVP - README

**CyberQuote MVP is LIVE**\
Last Updated: July 16, 2026

---

## 🚀 Quick Start

### Frontend

```bash
cd ~/CyberquoteWeb/unified-ai-CQ
npm run dev
```

Open: http://localhost:5173

### Login

- Email: steve.gilang@gmail.com
- Password: (check .env.local)

---

## 📊 System Status

| Component      | Status                      |
| -------------- | --------------------------- |
| Database       | ✅ 10 tables, 1000+ records |
| Edge Functions | ✅ 34 deployed              |
| ML Pipeline    | ✅ Working                  |
| Frontend       | ✅ 11 components            |
| Cron Jobs      | ✅ Orchestrator ready       |

---

## 🎯 Key Features

1. **Real-time Alerting**
   - ML Anomaly Detection (Z-score)
   - Stockout Risk Prediction

2. **Case Management**
   - Alert → Case → Assignment → Resolution
   - SLA tracking

3. **Dashboard**
   - Region overview (9 regions)
   - Outlet monitoring (24 outlets)
   - Alert summary (26 alerts)

---

## 📁 Documentation

| Doc            | Location                                     |
| -------------- | -------------------------------------------- |
| Technical      | `docs/technical-documentation.md`            |
| Gap Analysis   | `docs/app-gap-analysis.md`                   |
| Frontend Plan  | `docs/frontend-integration-plan.md`          |
| Cron Setup     | `docs/cron-setup.sql`                        |
| Missing Tables | `docs/missing-tables-implementation-plan.md` |

---

## 🔧 Maintenance

### Seed Data

```bash
# Sales (720 records)
curl -X POST https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/seed-sales

# Inventory (105 items)
curl -X POST https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/seed-inventory

# Integrations (4 records)
curl -X POST https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/sql-seed-integrations
```

### Run ML Pipeline

```bash
curl -X POST https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/cron-run
```

---

## 🌐 Supabase Dashboard

https://supabase.com/dashboard/project/ploqeifazcgzwjzmukgp

---

## 📞 Support

For issues, check:

1. Edge Function logs in Supabase Dashboard
2. Browser console for frontend errors
3. Network tab for API failures

# CQaifranchise
