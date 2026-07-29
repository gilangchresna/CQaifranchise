# CyberQuote Pilot Program
## Outreach Playbook

---

## 📋 Pilot Pipeline

```
CONTACTED → DEMO_SCHEDULED → DEMO_COMPLETED → AGREEMENT_SIGNED → ONBOARDED
    ↓              ↓                ↓                ↓               ↓
  1. First       2. Schedule     3. Present      4. Sign MoU    5. Setup
  contact        demo call        demo            (1 bulan free)   integration
```

---

## 🎯 Target Outlets (3 Pilot)

| # | Outlet | City | Contact | Phone | Status | Notes |
|---|--------|------|---------|-------|--------|-------|
| 1 | Warung Kopi Nusantara | Jakarta | Budi Santoso | 0812-3456-7890 | CONTACTED | Interested in AI alerts |
| 2 | Mie Ayam Barokah | Jakarta | Siti Aminah | 0813-4567-8901 | CONTACTED | 2 outlets, wants inventory |
| 3 | Sate Ayam Pak Somad | Bandung | Pak Somad | 0814-5678-9012 | CONTACTED | Frequent stockout issues |

---

## 📞 Outreach Script

### 1. Initial Contact
```
"Halo Pak/Bu [Nama], saya [Nama] dari CyberQuote.
Kami punya solusi AI untuk bantu management warung:
- Deteksi penjualan anomaly otomatis
- Prediksi stockout bahan baku
- Notifikasi real-time via WhatsApp

Boleh saya schedule demo 15 menit untuk jelaskan lebih detail?"
```

### 2. Demo Script
1. Tampilkan dashboard alerts
2.示范 anomaly detection (z-score)
3.示范 stockout prediction
4. Jelaskan benefit:
   - Gratis 1 bulan
   - Setup dalam 1 jam
   - Support via WhatsApp

### 3. Closing
```
"Baik Pak/Bu [Nama], kalau tertarik kita bisa mulai trial gratis 1 bulan.
Saya akan kirimkan agreement untuk ditandatangani.
Kapan cocok untuk setup?"
```

---

## 📊 Pilot Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Conversion Rate | 80% (3/3) | 0% |
| Time to Onboard | < 7 days | - |
| Alert Response Time | < 1 hour | - |
| Daily Active Users | 100% | - |

---

## ✅ Pilot Agreement Template

```
PILOT AGREEMENT - CyberQuote

Outlet: [Nama]
Contact: [Nama, No HP]
Duration: 1 bulan gratis
Start Date: [Tanggal]
End Date: [Tanggal + 1 bulan]

Included:
- AI Anomaly Detection
- Stockout Prediction  
- WhatsApp Notifications
- Dashboard Access

Terms:
- Data usage for product improvement
- Feedback session bi-weekly
- Option to continue with subscription
```

---

## 📅 Next Actions

- [ ] Call Budi (0812-3456-7890) - Schedule demo
- [ ] Call Siti (0813-4567-8901) - Schedule demo
- [ ] Call Pak Somad (0814-5678-9012) - Schedule demo
- [ ] Prepare demo materials
- [ ] Setup demo Supabase project

---

## 🔗 Links

- Dashboard: https://ploqeifazcgzwjzmukgp.supabase.co
- Pilot API: /functions/v1/pilot-dashboard
- Alerts API: /functions/v1/alerts-list
- ML Anomaly: /functions/v1/ml-anomaly-score
- ML Stockout: /functions/v1/ml-stockout-risk
