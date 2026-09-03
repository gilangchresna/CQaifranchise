# Singapore POS Integration — Architecture Specification

> **Document Version:** 1.0
> **Last Updated:** August 31, 2026
> **Status:** Research Complete — Integration Planning

---

## Executive Summary

Singapore F&B franchise market uses diverse POS systems. This document specifies integration requirements for CQaiFranchise platform to connect with Singapore POS vendors.

**Key Finding:** Most Singapore POS vendors offer proprietary APIs or partner integrations. No single universal connector exists. Integration requires vendor partnership or third-party middleware (Deliverect, API2Cart).

---

## Singapore POS Market Analysis

### Top Tier (Recommended for Integration)

| POS | Market Position | API Readiness | Users | Key Strength |
|-----|----------------|--------------|-------|-------------|
| **Edgeworks** | Enterprise/Multi-outlet | ✅ Open API | 3,000+ | Franchise-ready |
| **Raptor POS** | Mid-market/F&B | ✅ InterConnect | 7,000+ | Hospitality focus |
| **MEGAPOS** | SMB/F&B | ✅ iMakan API | 1,000+ | Cloud-based |
| **Qashier** | Micro/SMB | ⚠️ Limited | 25,000+ | PSG grant |
| **StoreHub** | SEA/F&B | ✅ Webhook | 5,000+ | SEA focus |

### ❌ Not Valid for SG

| POS | Reason |
|-----|--------|
| **Square** | Card processing NOT available in SG |
| **Fave** | Consumer rewards app, NOT a POS |

---

## 1. Edgeworks Solutions

**Website:** https://edgeworks.com.sg

### Company Profile

| Field | Value |
|-------|-------|
| **Founded** | 2005+ (19+ years) |
| **Users** | 3,000+ businesses |
| **Markets** | Singapore, Indonesia, Malaysia |
| **Focus** | Multi-outlet retail & F&B |
| **PSG Status** | Pre-approved |

### Products

| Product | Focus | Description |
|---------|-------|-------------|
| **EQuipPOS** | Retail | Multi-outlet POS with inventory |
| **F&B POS** | F&B | Restaurant POS with KDS |
| **EQuip Orders** | QR Ordering | Online ordering system |

### API Capabilities

| Feature | Status | Notes |
|---------|--------|-------|
| **Open API** | ✅ Available | Custom development tier |
| **Webhook** | ⚠️ Implied | Real-time sync |
| **eCommerce** | ✅ | WooCommerce, Shopify, Magento |
| **Accounting** | ✅ | Xero, QuickBooks |
| **Custom Dev** | ✅ | Level 3: Full integration |

### Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Edgeworks Integration                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Edgeworks POS (EQuipPOS / F&B POS)                       │
│           │                                                 │
│           ├──► Open API ───────► Custom Development       │
│           │                      (Level 3 Integration)       │
│           │                                                 │
│           ├──► Webhook ───────► Real-time sync             │
│           │                                                 │
│           └──► Partner ───────► Xero, QuickBooks           │
│                                   WooCommerce, Shopify       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Contact Information

| Channel | Value |
|---------|-------|
| **Website** | edgeworks.com.sg |
| **Sales** | Contact via website |
| **Support** | Local Singapore |

### Integration Effort

| Item | Estimate |
|------|----------|
| **API Access** | Partnership required |
| **Development** | 40-80 hours |
| **Testing** | 20 hours |
| **Total** | 60-100 hours |

---

## 2. Raptor POS

**Website:** http://raptorpos.com

### Company Profile

| Field | Value |
|-------|-------|
| **Founded** | 2013+ |
| **Users** | 7,000+ in APAC |
| **Markets** | SG, MY, ID, TH, PH, AU |
| **Focus** | Hospitality/F&B |
| **Partnership** | Adyen (payments) |

### Products

| Product | Description |
|---------|-------------|
| **Raptor POS** | Core POS system |
| **Raptor KDS** | Kitchen Display System |
| **Raptor Backoffice** | Management dashboard |
| **Raptor InterConnect** | Third-party integration platform |

### API Capabilities

| Feature | Status | Notes |
|---------|--------|-------|
| **InterConnect API** | ✅ Available | Developer platform |
| **Webhook** | ⚠️ Via Adyen | Payment webhooks |
| **Delivery** | ✅ Via Deliverect | GrabFood, Uber Eats |
| **Accounting** | ✅ Via QuickBooks | Direct integration |

### Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Raptor POS Integration                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Raptor POS                                                 │
│      │                                                       │
│      ├──► InterConnect ────► Third-party integrations     │
│      │                                                       │
│      ├──► Deliverect ────► GrabFood, Uber Eats, etc.     │
│      │                                                       │
│      └──► Adyen ───────► Payments, webhooks                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Contact Information

| Channel | Value |
|---------|-------|
| **Singapore** | (65) 6252 3393 |
| **Email** | sales@raptorpos.com |
| **Address** | 28 Sin Ming Lane #06-136, Singapore 573972 |

### Integration Effort

| Item | Estimate |
|------|----------|
| **API Access** | Developer partnership |
| **Development** | 40-80 hours |
| **Testing** | 20 hours |
| **Total** | 60-100 hours |

---

## 3. MEGAPOS

**Website:** https://megapos.com.sg

### Company Profile

| Field | Value |
|-------|-------|
| **Founded** | 2014+ |
| **Users** | 1,000+ |
| **Markets** | Singapore |
| **Focus** | F&B Cloud POS |
| **PSG Status** | Pre-approved |

### Products

| Product | Description |
|---------|-------------|
| **F&B POS** | Cloud-based F&B POS |
| **Self Ordering Kiosk** | Kiosk ordering |
| **QR Ordering** | Mobile ordering |
| **iMakan API** | Integration API |

### API Capabilities

| Feature | Status | Notes |
|---------|--------|-------|
| **iMakan API** | ✅ Available | api.imakan.app |
| **Webhook** | ⚠️ Cloud-based | Real-time cloud sync |
| **Delivery** | ✅ Via GrabFood | Direct integration |
| **QR/Kiosk** | ✅ | iMakan integration |

### Contact Information

| Channel | Value |
|---------|-------|
| **Address** | 160 Robinson Road, SBF Center #26-02, Singapore 068914 |
| **Phone** | (+65) 6224 5788 |
| **WhatsApp** | wa.link/8xt3zn |

### Integration Effort

| Item | Estimate |
|------|----------|
| **API Access** | Contact for partnership |
| **Development** | 30-60 hours |
| **Testing** | 15 hours |
| **Total** | 45-75 hours |

---

## 4. Qashier

**Website:** https://qashier.com

### Company Profile

| Field | Value |
|-------|-------|
| **Users** | 25,000+ merchants |
| **Markets** | SG, MY, TH, PH |
| **Focus** | Micro/SMB |
| **PSG Status** | ✅ Pre-approved |
| **Pricing** | $5/day flat |

### API Status

| Feature | Status | Notes |
|---------|--------|-------|
| **Public API** | ⚠️ Limited | Enterprise tier |
| **Webhook** | ⚠️ Limited | Enterprise tier |
| **Pricing** | Contact sales | API access requires enterprise |

### Recommendation

**Low priority** for franchise integration. Limited API access for SMB-focused product.

---

## 5. StoreHub

**Website:** https://storehub.com

### Company Profile

| Field | Value |
|-------|-------|
| **Founded** | 2015+ |
| **Users** | 5,000+ |
| **Markets** | SEA (MY focus) |
| **Focus** | F&B, Retail |
| **PSG Status** | ✅ Pre-approved |

### API Status

| Feature | Status | Notes |
|---------|--------|-------|
| **Webhook** | ✅ Available | Active webhook support |
| **Public API** | ⚠️ Partner | Requires partnership |

### Recommendation

**Medium priority**. SEA-focused with webhook support. Good for multi-market expansion.

---

## Integration Patterns

### Pattern 1: Direct API Integration

```
┌──────────────┐      ┌──────────────────┐      ┌─────────────────┐
│  POS System  │─────►│  CQaiFranchise    │─────►│  Dashboard      │
│  (Edgeworks) │      │  POS Connector    │      │  (Real-time)   │
└──────────────┘      └──────────────────┘      └─────────────────┘
       │                       │
       │                       ▼
       │               ┌──────────────────┐
       └──────────────►│  Edge Functions   │
                       │  (Normalize)      │
                       └──────────────────┘
```

**Pros:**
- Real-time data
- Full control
- No middleware cost

**Cons:**
- Requires vendor partnership
- Development effort
- Maintenance per vendor

### Pattern 2: Middleware Integration

```
┌──────────────┐      ┌──────────────────┐      ┌─────────────────┐
│  POS System  │─────►│  Deliverect/      │─────►│  CQaiFranchise  │
│  (Raptor)   │      │  API2Cart        │      │  POS Connector  │
└──────────────┘      └──────────────────┘      └─────────────────┘
```

**Pros:**
- Single integration, multiple POS
- Vendor-managed updates
- Faster time-to-market

**Cons:**
- Additional cost
- Middleware dependency
- Data transformation needed

### Pattern 3: Webhook Push (Push Model)

```
┌──────────────┐      ┌──────────────────┐      ┌─────────────────┐
│  POS System  │─────►│  CQaiFranchise   │─────►│  Database       │
│  (StoreHub) │      │  Webhook API     │      │  (Normalized)   │
└──────────────┘      └──────────────────┘      └─────────────────┘
```

**Pros:**
- Simple integration
- Event-driven
- Low maintenance

**Cons:**
- Vendor must support webhooks
- No control over timing
- Retry/error handling needed

---

## Data Requirements

### Minimum Data for Anomaly Detection

| Data Field | Type | Description |
|------------|------|-------------|
| `transaction_id` | UUID | Unique transaction ID |
| `outlet_id` | INT | Outlet identifier |
| `amount` | DECIMAL | Transaction amount |
| `currency` | VARCHAR | Currency code (SGD) |
| `transaction_date` | TIMESTAMP | Transaction datetime |
| `payment_method` | VARCHAR | CASH, CARD, QR, etc. |

### Enhanced Data for ML Models

| Data Field | Type | Description |
|------------|------|-------------|
| `items` | JSONB | Item details |
| `cost` | DECIMAL | COGS |
| `discount` | DECIMAL | Discount applied |
| `staff_id` | UUID | Staff identifier |
| `customer_id` | UUID | Customer (if loyalty) |

---

## Recommended Integration Priority

| Priority | POS | Rationale |
|----------|-----|-----------|
| 1 | **Edgeworks** | Multi-outlet ready, Open API, 3K+ users |
| 2 | **Raptor POS** | InterConnect platform, 7K users |
| 3 | **MEGAPOS** | iMakan API, SG-local F&B |

---

## Next Steps

1. **Contact vendors** — Request API documentation and partnership
2. **Evaluate integration effort** — 40-80 hours per POS
3. **Build MVP connector** — Start with Edgeworks
4. **Test with pilot franchisees** — Use existing relationships

---

## Related Documents

- [[Edge-Functions-Documentation]] — CQaiFranchise edge functions
- [[Webhook-Flow]] — Webhook architecture
- [[API-Endpoints]] — API reference
