# CyberQuote Documentation Index

**Project:** CyberQuote MVP  
**Supabase:** ploqeifazcgzwjzmukgp  
**Last Updated:** July 16, 2026

---

## 📚 Documentation List

| Document | File | Description |
|----------|------|-------------|
| README | `README.md` | Quick start guide |
| Technical Docs | `docs/technical-documentation.md` | Complete system documentation |
| API Reference | `docs/api-reference.md` | All API endpoints |
| Gap Analysis | `docs/app-gap-analysis.md` | Component analysis |
| Frontend Plan | `docs/frontend-integration-plan.md` | Frontend integration |
| Missing Tables | `docs/missing-tables-implementation-plan.md` | Table implementation |
| Cron Setup | `docs/cron-setup.sql` | SQL for pg_cron |
| Migration Guide | `docs/MIGRATION_STATUS.md` | Migration history |

---

## 🚀 Quick Links

### Live System
- **Frontend:** https://cyberquote.app (local: http://localhost:5173)
- **Supabase:** https://supabase.com/dashboard/project/ploqeifazcgzwjzmukgp

### Key Functions
- **ML Pipeline:** `POST /functions/v1/cron-run`
- **Alerts:** `GET /functions/v1/alerts-list`
- **Stockout:** `POST /functions/v1/ml-stockout-risk`

---

## 📊 Current Status

### Database
| Table | Records |
|-------|---------|
| regions | 9 |
| outlets | 24 |
| alerts | 26 |
| cases | 12 |
| sales_transactions | 720 |
| inventory | 105 |
| staff | 104 |
| ai_agents | 7 |
| ml_model_versions | 4 |
| integrations | 4 |

### Edge Functions
- **Total:** 34 deployed
- **Key:** alerts-list, ml-anomaly-score, ml-stockout-risk, case-create, cron-run

### Frontend
- **Components:** 11 (all working)
- **Integration:** Complete

---

## 🔧 Common Tasks

### 1. Run ML Pipeline
```bash
curl -X POST https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/cron-run \
  -H "Authorization: Bearer <JWT>"
```

### 2. Check Alerts
```bash
curl https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/alerts-list \
  -H "Authorization: Bearer <JWT>"
```

### 3. Seed Data
```bash
# Sales
curl -X POST https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/seed-sales \
  -H "Authorization: Bearer <JWT>"

# Inventory
curl -X POST https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/seed-inventory \
  -H "Authorization: Bearer <JWT>"
```

### 4. Create Alert
```bash
curl -X POST https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/alert-generator \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"outlet_id": 37, "trigger_type": "MANUAL", "severity": "P2_MEDIUM"}'
```

---

## 📝 Edit History

| Date | Change |
|------|--------|
| 2026-07-16 | Initial documentation created |
| 2026-07-16 | Added API reference |
| 2026-07-16 | Added cron-setup.sql |
| 2026-07-16 | Added technical-documentation.md |
