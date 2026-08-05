# CyberQuote MVP - README

**CyberQuote MVP is LIVE**\
Last Updated: August 5, 2026

---

## 🚀 Quick Start

### Frontend

```bash
cd CQaifranchise
npm install
npm run dev
```

Open: http://localhost:3000 (port is set in package.json's "dev" script)

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
| Frontend       | ✅ 15+ components           |
| Cron Jobs      | ✅ Orchestrator ready       |
| i18n           | ✅ EN + ID supported        |

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

4. **Financing Module** *(NEW)*
   - Lender bridge integration
   - Stakeholder reporting

5. **Multi-language (i18n)** *(NEW)*
   - English (EN) + Indonesian (ID)
   - Language switcher in header

6. **POS Simulator** *(NEW)*
   - Live transaction simulation
   - Real-time transaction feed

7. **AI Chat** *(NEW)*
   - Floating chat button
   - AI-powered assistance

---

## 📋 Changelog

| Date       | Summary |
| ---------- | ------- |
| 2026-08-05 | Financing module, i18n, POS Simulator, FloatingChat |
| 2026-08-01 | Security fixes, RLS cleanup |
| 2026-07-16 | MVP launch |

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
