# CyberQuote MVP - Data Model (SAP Standard)

## 📋 Overview

Dokumen ini mendefinisikan data model CyberQuote MVP menggunakan standar penamaan **SAP ERP** untuk kemudahan pembacaan oleh pengguna SAP.

### SAP Module Mapping

| SAP Module | Deskripsi | Tabel CyberQuote |
|-----------|-----------|-----------------|
| **FI** (Finance) | Finance & Accounting | AR, AP, GL, GL_ACC |
| **CO** (Controlling) | Controlling | Cost Center, Profit Center |
| **SD** (Sales Distribution) | Sales & Distribution | Billing, Customer |
| **MM** (Materials Management) | Inventory & Purchasing | Material, Storage, PO |
| **PP** (Production Planning) | Production | BOM, Work Center |
| **QM** (Quality Management) | Quality | Inspection |

---

## 🎯 Quick Reference - SAP Fields

| Field | SAP Meaning | Usage |
|-------|-----------|-------|
| `BUKRS` | Company Code | Kode perusahaan |
| `WERKS` | Plant | Pabrik/Outlet |
| `LGORT` | Storage Location | Lokasi penyimpanan |
| `KUNNR` | Customer | Pelanggan |
| `LIFNR` | Vendor | Pemasok |
| `MATNR` | Material | Material/Produk |
| `BELNR` | Document Number | Nomor dokumen |
| `BUDAT` | Posting Date | Tanggal posting |
| `GJAHR` | Fiscal Year | Tahun fiskal |
| `MENGE` | Quantity | Jumlah |
| `DMBTR` | Amount in LC | Jumlah dalam mata uang lokal |
| `WAERS` | Currency | Mata uang |

---

## 📊 Tabel Utama (SAP Convention)

### 1. Company Code - TB_BUKRS

**SAP Table:** T001  
**Module:** FI (Finance)

| Field | Type | Description | Contoh |
|-------|------|-------------|--------|
| `BUKRS` | VARCHAR(4) | Company Code | `CQPL` |
| `BUTXT` | VARCHAR(50) | Company Name | CyberQuote Pte Ltd |
| `ORT01` | VARCHAR(25) | City | Singapore |
| `LAND1` | VARCHAR(3) | Country | SGP |
| `WAERS` | VARCHAR(3) | Currency | SGD |
| `PERIV` | VARCHAR(2) | Fiscal Year Variant | S1 |
| `KTOPL` | VARCHAR(4) | Chart of Accounts | SACH |
| `ACTIVE` | BOOLEAN | Status aktif | TRUE |

---

### 2. Business Area / Region - TB_GSBER

**SAP Table:** TGSB  
**Module:** FI/CO

| Field | Type | Description | Contoh |
|-------|------|-------------|--------|
| `GSBER` | VARCHAR(4) | Business Area | `CENT` |
| `GTEXT` | VARCHAR(50) | Business Area Name | Central Region |
| `LAND1` | VARCHAR(3) | Country | SGP |
| `ACTIVE` | BOOLEAN | Status aktif | TRUE |

**Sample Data:**
| GSBER | GTEXT | LAND1 |
|-------|-------|-------|
| CENT | Central Region | SGP |
| EAST | East Region | SGP |
| WEST | West Region | SGP |
| NORTH | North Region | SGP |
| SOUTH | South Region | SGP |

---

### 3. Cost Center - TB_KOSTL

**SAP Table:** CSKS  
**Module:** CO (Controlling)

| Field | Type | Description | Contoh |
|-------|------|-------------|--------|
| `KOKRS` | VARCHAR(4) | Controlling Area | `CQCO` |
| `KOSTL` | VARCHAR(10) | Cost Center | `CC-001` |
| `KTEXT` | VARCHAR(40) | Cost Center Description | Central Kitchen |
| `DATAB` | DATE | Valid From | 2024-01-01 |
| `DATBI` | DATE | Valid To | 9999-12-31 |
| `VERAK` | VARCHAR(20) | Person Responsible | HQ_ADMIN |

---

### 4. Profit Center - TB_PRCTR

**SAP Table:** CEPC  
**Module:** CO (Controlling)

| Field | Type | Description | Contoh |
|-------|------|-------------|--------|
| `PRCTR` | VARCHAR(10) | Profit Center | `PC-001` |
| `KTEXT` | VARCHAR(40) | Profit Center Desc | Outlet Profit Center |
| `GSBER` | VARCHAR(4) | Business Area | CENT |
| `DATAB` | DATE | Valid From | 2024-01-01 |
| `DATBI` | DATE | Valid To | 9999-12-31 |

---

## 🏪 SD - Sales Distribution (Outlet Management)

### 5. Outlet / Plant - TB_WERKS

**SAP Table:** T001W  
**Module:** SD/MM (Plant)

| Field | Type | Description | Contoh |
|-------|------|-------------|--------|
| `WERKS` | VARCHAR(4) | Plant Code | `OUT-8` |
| `NAME1` | VARCHAR(30) | Plant Name | Warung Kopi Nusantara |
| `BUKRS` | VARCHAR(4) | Company Code | CQPL |
| `GSBER` | VARCHAR(4) | Business Area | CENT |
| `KUNNR` | VARCHAR(10) | Customer (Owner) | CUST-001 |
| `STRAS` | VARCHAR(35) | Street/Address | 123 Orchard Road |
| `ORT01` | VARCHAR(25) | City | Singapore |
| `TELF1` | VARCHAR(16) | Phone | +65 6123 4567 |
| `STATUS` | VARCHAR(10) | Plant Status | ACTIVE |
| `DAILY_TARGET` | DECIMAL(15,2) | Daily Sales Target | 500.00 |

**Sample Data:**
| WERKS | NAME1 | GSBER | KUNNR | STATUS | DAILY_TARGET |
|-------|-------|-------|-------|--------|--------------|
| OUT-1 | Warung Kopi Jaya | CENT | CUST-001 | ACTIVE | 500.00 |
| OUT-8 | Warung Kopi Nusantara | CENT | CUST-008 | ACTIVE | 800.00 |
| OUT-15 | Mie Ayam Barokah | EAST | CUST-015 | ACTIVE | 600.00 |

---

### 6. Customer Master - TB_KUNNR

**SAP Table:** KNA1  
**Module:** SD (Customer)

| Field | Type | Description | Contoh |
|-------|------|-------------|--------|
| `KUNNR` | VARCHAR(10) | Customer Number | `CUST-001` |
| `KUNNR_UUID` | UUID | User ID (Supabase) | - |
| `NAME1` | VARCHAR(35) | Customer Name | Steve Gilang |
| `NAME2` | VARCHAR(35) | Contact Person | - |
| `STRAS` | VARCHAR(35) | Street | 123 Main Street |
| `ORT01` | VARCHAR(25) | City | Singapore |
| `TELF1` | VARCHAR(16) | Phone | +65 9123 4567 |
| `EMAIL` | VARCHAR(50) | Email | steve@email.com |
| `STCD1` | VARCHAR(16) | ID Card Number | S1234567A |
| `KTOKD` | VARCHAR(4) | Customer Account Group | CUS1 |
| `WAERS` | VARCHAR(3) | Currency | SGD |
| `ZTERM` | VARCHAR(4) | Payment Terms | PT01 |
| `KTGRD` | VARCHAR(2) | Acct Assignment Group | 01 |
| `ROLE` | VARCHAR(20) | User Role | FRANCHISEE_OWNER |
| `GSBER` | VARCHAR(4) | Business Area | CENT |
| `ACTIVE` | BOOLEAN | Status aktif | TRUE |

**Sample Data:**
| KUNNR | NAME1 | EMAIL | ROLE | GSBER | ACTIVE |
|-------|-------|-------|------|-------|--------|
| CUST-001 | Steve Gilang | steve@email.com | FRANCHISEE_OWNER | CENT | TRUE |
| CUST-002 | Budi Santoso | budi@email.com | REGIONAL_MANAGER | EAST | TRUE |

---

### 7. Storage Location - TB_LGORT

**SAP Table:** T001L  
**Module:** MM (Storage Location)

| Field | Type | Description | Contoh |
|-------|------|-------------|--------|
| `LGORT` | VARCHAR(4) | Storage Location | `SL01` |
| `WERKS` | VARCHAR(4) | Plant | OUT-8 |
| `LGOBE` | VARCHAR(25) | Storage Location Name | Main Storage |
| `LKZUN` | VARCHAR(1) | Spare Parts Indicator | - |

---

## 💰 FI - Finance (AR/AP/GL)

### 8. Account Receivable - TB_AR

**SAP Table:** BSID / BSIK  
**Module:** FI (AR)

| Field | Type | Description | Contoh |
|-------|------|-------------|--------|
| `BELNR` | VARCHAR(10) | Document Number | AR-2024-0001 |
| `BUKRS` | VARCHAR(4) | Company Code | CQPL |
| `GJAHR` | VARCHAR(4) | Fiscal Year | 2024 |
| `BUZEI` | INTEGER | Line Item | 1 |
| `BUDAT` | DATE | Posting Date | 2024-07-22 |
| `BLDAT` | DATE | Document Date | 2024-07-22 |
| `KUNNR` | VARCHAR(10) | Customer | CUST-001 |
| `UMSKS` | VARCHAR(1) | Special GL Indicator | - |
| `UMSKZ` | VARCHAR(1) | Special GL Transaction | - |
| `SAKNR` | VARCHAR(10) | G/L Account | 110001 |
| `HKONT` | VARCHAR(10) | G/L Account | 110001 |
| `DMBTR` | DECIMAL(15,2) | Amount in LC | 155.00 |
| `WAERS` | VARCHAR(3) | Currency | SGD |
| `WRSOL` | DECIMAL(15,2) | Open Amount | 155.00 |
| `SHKZG` | VARCHAR(1) | Debit/Credit | S (Debit) |
| `KTOSL` | VARCHAR(3) | Transaction Key | DRB |
| `XBLNR` | VARCHAR(16) | Reference | POS-123456 |
| `BKTXT` | VARCHAR(25) | Header Text | Daily Sales |

---

### 9. G/L Account Master - TB_SAKN

**SAP Table:** SKA1 / SKB1  
**Module:** FI (Chart of Accounts)

| Field | Type | Description | Contoh |
|-------|------|-------------|--------|
| `KTOPL` | VARCHAR(4) | Chart of Accounts | SACH |
| `SAKNR` | VARCHAR(10) | G/L Account | `110001` |
| `KTOKS` | VARCHAR(4) | G/L Account Group | AKT1 |
| `XBILK` | VARCHAR(1) | Balance Sheet Account | X |
| `WAERS` | VARCHAR(3) | Currency Key | SGD |
| `SAKNR_ALT` | VARCHAR(10) | Alternate Account | AR001 |
| `KTOPL_ALT` | VARCHAR(4) | Alt Chart of Accts | SACH |
| `XINTB` | VARCHAR(1) | Balance in LC Only | X |
| `KTANS` | VARCHAR(4) | Reconcile Account | 110001 |
| `BWVRT` | DECIMAL(15,2) | Tolerance Group | 0.00 |
| `XVERR` | VARCHAR(1) | P&L Account | - |
| `WAERS` | VARCHAR(3) | Currency | SGD |

**Chart of Accounts Structure:**
| SAKNR | KTOKS | Description | Type |
|-------|-------|-------------|------|
| 110001 | AKT1 | Accounts Receivable | Asset |
| 120001 | AKT1 | Cash | Asset |
| 140001 | AKT1 | Inventory | Asset |
| 210001 | PAS1 | Accounts Payable | Liability |
| 300001 | ERG1 | Sales Revenue | Revenue |
| 400001 | ERG1 | Cost of Goods Sold | Expense |
| 500001 | ERG1 | Operating Expenses | Expense |

---

## 📦 MM - Materials Management (Inventory)

### 10. Material Master - TB_MATNR

**SAP Table:** MARA / MARC / MARM  
**Module:** MM (Material)

| Field | Type | Description | Contoh |
|-------|------|-------------|--------|
| `MATNR` | VARCHAR(18) | Material Number | `MAT-001` |
| `MATKL` | VARCHAR(9) | Material Group | FOOD-01 |
| `MTART` | VARCHAR(4) | Material Type | FERT |
| `BISMT` | VARCHAR(18) | Old Material Number | - |
| `MAKTX` | VARCHAR(40) | Material Description | Es Teh Manis |
| `MEINS` | VARCHAR(3) | Base Unit of Measure | PCS |
| `MATKL_TEXT` | VARCHAR(20) | Material Group Name | Beverage |
| `SPART` | VARCHAR(2) | Division | 01 |
| `MTPOS_MARA` | VARCHAR(1) | Item Category Group | NORM |

---

### 11. Plant-Specific Material Data - TB_MARC

**SAP Table:** MARC  
**Module:** MM (Material - Plant)

| Field | Type | Description | Contoh |
|-------|------|-------------|--------|
| `MATNR` | VARCHAR(18) | Material | MAT-001 |
| `WERKS` | VARCHAR(4) | Plant | OUT-8 |
| `DISMMT` | VARCHAR(2) | MRP Type | PD |
| `DISPO` | VARCHAR(3) | MRP Controller | P01 |
| `MINBE` | DECIMAL(13,3) | Reorder Point | 50 |
| `MAXBE` | DECIMAL(13,3) | Maximum Stock | 200 |
| `EISBE` | DECIMAL(13,3) | Safety Stock | 20 |
| `BSTFE` | DECIMAL(13,3) | Fixed Lot Size | 0 |
| `BSTMI` | DECIMAL(13,3) | Minimum Lot Size | 10 |
| `BSTMA` | DECIMAL(13,3) | Maximum Lot Size | 100 |
| `BSTRF` | VARCHAR(1) | Rounding Value | X |

---

### 12. Material Valuation - TB_MBEW

**SAP Table:** MBEW  
**Module:** MM (Valuation)

| Field | Type | Description | Contoh |
|-------|------|-------------|--------|
| `MATNR` | VARCHAR(18) | Material | MAT-001 |
| `BWKEY` | VARCHAR(4) | Valuation Area | OUT-8 |
| `BKLAS` | VARCHAR(4) | Valuation Class | 3100 |
| `VPRSV` | VARCHAR(1) | Price Control | S |
| `STPRS` | DECIMAL(11,4) | Standard Price | 5.50 |
| `PEINH` | INTEGER | Price Unit | 1 |
| `WAERS` | VARCHAR(3) | Currency | SGD |

---

### 13. Inventory Document - TB_MSEG

**SAP Table:** MSEG  
**Module:** MM (Material Document)

| Field | Type | Description | Contoh |
|-------|------|-------------|--------|
| `MBLNR` | VARCHAR(10) | Material Document | `INV-001` |
| `MJAHR` | VARCHAR(4) | Fiscal Year | 2024 |
| `ZEILI` | VARCHAR(4) | Item | 0001 |
| `BUKRS` | VARCHAR(4) | Company Code | CQPL |
| `WERKS` | VARCHAR(4) | Plant | OUT-8 |
| `LGORT` | VARCHAR(4) | Storage Location | SL01 |
| `MATNR` | VARCHAR(18) | Material | MAT-001 |
| `MAKTX` | VARCHAR(40) | Material Description | Es Teh Manis |
| `ERFMG` | DECIMAL(13,3) | Quantity | 100 |
| `ERFME` | VARCHAR(3) | Unit | PCS |
| `DMBTR` | DECIMAL(13,2) | Amount | 550.00 |
| `WAERS` | VARCHAR(3) | Currency | SGD |
| `BUDAT` | DATE | Posting Date | 2024-07-22 |
| `BWART` | VARCHAR(3) | Movement Type | 101 |
| `SHKZG` | VARCHAR(1) | Debit/Credit | S |

**Movement Types:**
| BWART | Description |
|-------|-------------|
| 101 | Receipt from Purchase Order |
| 201 | Goods Issue (Sales) |
| 301 | Transfer Posting In |
| 302 | Transfer Posting Out |
| 309 | Goods Issue for Sampling |

---

### 14. Inventory Balance - TB_IMDO

**Custom Table**  
**Module:** MM (Real-time Inventory)

| Field | Type | Description | Contoh |
|-------|------|-------------|--------|
| `ID` | SERIAL | Primary Key | 1 |
| `OUTLET_ID` | INTEGER | Plant (FK) | 8 |
| `SKU` | VARCHAR(50) | Material SKU | `MNL_ES_TEH` |
| `MATNR` | VARCHAR(18) | Material Number | MAT-001 |
| `PRODUCT_NAME` | VARCHAR(200) | Material Desc | Es Teh Manis |
| `CATEGORY` | VARCHAR(100) | Material Group | Beverage |
| `CURRENT_STOCK` | INTEGER | Stock Qty | 54 |
| `MIN_STOCK` | INTEGER | Reorder Point | 50 |
| `MAX_STOCK` | INTEGER | Max Stock | 200 |
| `UNIT` | VARCHAR(20) | UoM | pcs |
| `LAST_RESTOCK_AT` | TIMESTAMP | Last Restock | 2024-07-22 08:00 |
| `UPDATED_AT` | TIMESTAMP | Last Update | 2024-07-22 15:30 |

**Sample Data:**
| SKU | PRODUCT_NAME | CURRENT_STOCK | MIN_STOCK | MAX_STOCK | RISK |
|-----|-------------|---------------|-----------|-----------|------|
| MNL_ES_TEH | Es Teh Manis | 54 | 50 | 200 | 0% |
| MNL_ES Jeruk | Es Jeruk | 15 | 40 | 150 | ⚠️ HIGH |
| MBT_SOTO | Soto Ayam | 13 | 10 | 45 | OK |

---

## 💳 SD - Sales Distribution (Transactions)

### 15. Billing Document - TB_VBRK

**SAP Table:** VBRK  
**Module:** SD (Billing)

| Field | Type | Description | Contoh |
|-------|------|-------------|--------|
| `VBELN` | VARCHAR(10) | Billing Document | `BILL-001` |
| `FKDAT` | DATE | Billing Date | 2024-07-22 |
| `KUNNR` | VARCHAR(10) | Sold-to Party | CUST-001 |
| `WERKS` | VARCHAR(4) | Plant (Outlet) | OUT-8 |
| `NETWR` | DECIMAL(13,2) | Net Value | 155.00 |
| `WAERK` | VARCHAR(3) | Currency | SGD |
| `MWST` | DECIMAL(13,2) | Tax Amount | 15.50 |
| `FKART` | VARCHAR(2) | Billing Type | RE |
| `FKSTO` | VARCHAR(1) | Billing Block | - |
| `FKSAA` | VARCHAR(1) | Billing Status | Completed |

---

### 16. Billing Line Items - TB_VBRP

**SAP Table:** VBRP  
**Module:** SD (Billing)

| Field | Type | Description | Contoh |
|-------|------|-------------|--------|
| `VBELN` | VARCHAR(10) | Billing Document | BILL-001 |
| `POSNR` | VARCHAR(6) | Item Number | 000001 |
| `MATNR` | VARCHAR(18) | Material | MAT-001 |
| `ARKTX` | VARCHAR(40) | Description | Es Teh Manis |
| `FKIMG` | DECIMAL(13,3) | Billing Qty | 2 |
| `VRKME` | VARCHAR(3) | Sales Unit | PCS |
| `NETWR` | DECIMAL(13,2) | Net Value | 14.00 |
| `WAERK` | VARCHAR(3) | Currency | SGD |
| `KMEIN` | VARCHAR(3) | Unit | PCS |

---

### 17. Sales Transaction - TB_SALES

**Custom Table**  
**Module:** SD (Real-time Sales)

| Field | Type | Description | Contoh |
|-------|------|-------------|--------|
| `ID` | BIGSERIAL | Primary Key | 1 |
| `OUTLET_ID` | INTEGER | Plant (FK) | 8 |
| `VBELN` | VARCHAR(100) | Transaction ID | TXN-2024-001 |
| `BUDAT` | DATE | Posting Date | 2024-07-22 |
| `NETWR` | DECIMAL(15,2) | Total Amount | 155.00 |
| `MWST` | DECIMAL(15,2) | Tax (11%) | 15.50 |
| `ITEMS_COUNT` | INTEGER | Item Count | 5 |
| `STUNDE` | INTEGER | Hour (0-23) | 14 |
| `WOCHENTAG` | INTEGER | Day of Week (0-6) | 1 |
| `ANOMALY_SCORE` | DECIMAL(5,4) | Anomaly Score | 0.0234 |
| `IS_ANOMALY` | BOOLEAN | Is Anomaly | FALSE |
| `METADATA` | JSONB | Extra Data | {} |
| `CREATED_AT` | TIMESTAMP | Created Time | 2024-07-22 14:30 |

**Sample Data:**
| VBELN | BUDAT | OUTLET | NETWR | ITEMS | ANOMALY |
|-------|-------|--------|-------|-------|---------|
| TXN-001 | 2024-07-22 | OUT-8 | 155.00 | 5 | FALSE |
| TXN-002 | 2024-07-22 | OUT-8 | 890.00 | 12 | ⚠️ TRUE |

---

## 🔔 AL - Alert Management

### 18. Alert Header - TB_ALERT_H

**Custom Table**  
**Module:** IS (Information System)

| Field | Type | Description | Contoh |
|-------|------|-------------|--------|
| `ID` | SERIAL | Primary Key | 1 |
| `OUTLET_ID` | INTEGER | Plant (FK) | 8 |
| `ART` | VARCHAR(20) | Alert Type | STOCKOUT_RISK |
| `Prio` | VARCHAR(10) | Priority | P0_CRITICAL |
| `STAT` | VARCHAR(15) | Status | NEW |
| `TITLE` | VARCHAR(200) | Alert Title | Low Stock Alert |
| `DESC` | TEXT | Description | Es Jeruk below min |
| `SCORE` | DECIMAL(5,4) | ML Score | 0.8567 |
| `TRIGGERD_AT` | TIMESTAMP | Trigger Time | 2024-07-22 15:00 |
| `ACK_AT` | TIMESTAMP | Acknowledged At | 2024-07-22 15:15 |
| `RESOLVED_AT` | TIMESTAMP | Resolved At | - |

**Alert Types:**
| ART | Description |
|-----|-------------|
| SALES_ANOMALY | Unusual sales pattern |
| STOCKOUT_RISK | Risk of stockout |
| ATTENDANCE_ISSUE | Attendance problem |
| COMPLAINT | Customer complaint |
| SYSTEM | System alert |

**Priority Levels:**
| Prio | Description | Response Time |
|------|-------------|---------------|
| P0_CRITICAL | Critical | 15 minutes |
| P1_HIGH | High | 1 hour |
| P2_MEDIUM | Medium | 4 hours |
| P3_LOW | Low | 24 hours |

---

## 📋 CS - Case Management

### 19. Case - TB_CASE

**Custom Table**  
**Module:** CS (Customer Service)

| Field | Type | Description | Contoh |
|-------|------|-------------|--------|
| `ID` | SERIAL | Primary Key | 1 |
| `ALERT_ID` | INTEGER | Alert (FK) | 1 |
| `ASSIGNED_TO` | UUID | Assignee (User) | - |
| `TITLE` | VARCHAR(200) | Case Title | Restock Es Jeruk |
| `DESC` | TEXT | Description | Need 50 units |
| `PRIO` | VARCHAR(10) | Priority | HIGH |
| `STAT` | VARCHAR(15) | Status | NEW |
| `SLA_DEADLINE` | TIMESTAMP | SLA Deadline | 2024-07-22 16:00 |
| `RESOLVED_AT` | TIMESTAMP | Resolved At | - |
| `CREATED_AT` | TIMESTAMP | Created At | 2024-07-22 15:00 |
| `UPDATED_AT` | TIMESTAMP | Updated At | 2024-07-22 15:30 |

---

## 📢 NA - Notification

### 20. Notification - TB_NOTIF

**Custom Table**  
**Module:** BC (Basis Components)

| Field | Type | Description | Contoh |
|-------|------|-------------|--------|
| `ID` | SERIAL | Primary Key | 1 |
| `ALERT_ID` | INTEGER | Alert (FK) | 1 |
| `USER_ID` | UUID | Recipient (User) | - |
| `CHANNEL` | VARCHAR(10) | Channel | WHATSAPP |
| `RECIPIENT` | VARCHAR(255) | Recipient | +65 9123 4567 |
| `SUBJECT` | VARCHAR(200) | Subject | Low Stock Alert |
| `MESSAGE` | TEXT | Message Content | - |
| `STAT` | VARCHAR(10) | Status | SENT |
| `EXT_ID` | VARCHAR(100) | External ID | WA-123456 |
| `SENT_AT` | TIMESTAMP | Sent At | 2024-07-22 15:01 |
| `DELIVERED_AT` | TIMESTAMP | Delivered At | 2024-07-22 15:02 |
| `ERROR_MSG` | TEXT | Error Message | - |
| `CREATED_AT` | TIMESTAMP | Created At | 2024-07-22 15:00 |

---

## 🤖 AI - AI Explanations

### 21. AI Explanation - TB_AI_EXP

**Custom Table**  
**Module:** ML (Machine Learning)

| Field | Type | Description | Contoh |
|-------|------|-------------|--------|
| `ID` | SERIAL | Primary Key | 1 |
| `ALERT_ID` | INTEGER | Alert (FK) | 1 |
| `USER_ID` | UUID | User (FK) | - |
| `QUESTION` | TEXT | User Question | Why this alert? |
| `ANSWER` | TEXT | AI Answer | Based on data... |
| `MODEL_USED` | VARCHAR(50) | AI Model | gpt-4 |
| `TOKENS_USED` | INTEGER | Token Count | 1500 |
| `CREATED_AT` | TIMESTAMP | Created At | 2024-07-22 15:30 |

---

## 📈 ML - Machine Learning

### 22. ML Model Version - TB_ML_VER

**Custom Table**  
**Module:** ML (Machine Learning)

| Field | Type | Description | Contoh |
|-------|------|-------------|--------|
| `ID` | SERIAL | Primary Key | 1 |
| `MODEL_NAME` | VARCHAR(100) | Model Name | anomaly_detector |
| `VERSION` | VARCHAR(20) | Version | v2.1.0 |
| `MODEL_TYPE` | VARCHAR(50) | Type | ANOMALY_DETECTION |
| `DESC` | TEXT | Description | Sales anomaly detection |
| `METRICS` | JSONB | Model Metrics | {"acc": 0.95} |
| `IS_PROD` | BOOLEAN | Production | TRUE |
| `TRAINED_AT` | TIMESTAMP | Trained At | 2024-07-01 |
| `DEPLOYED_AT` | TIMESTAMP | Deployed At | 2024-07-15 |
| `CREATED_AT` | TIMESTAMP | Created At | 2024-07-01 |

---

## 🔐 Security - Webhook

### 23. Webhook Secret - TB_WHSEC

**Custom Table**  
**Module:** BC (Security)

| Field | Type | Description | Contoh |
|-------|------|-------------|--------|
| `ID` | SERIAL | Primary Key | 1 |
| `OUTLET_ID` | INTEGER | Plant (FK) | 8 |
| `SECRET_KEY` | VARCHAR(255) | Secret Key | sk_live_xxx |
| `IS_ACTIVE` | BOOLEAN | Active | TRUE |
| `CREATED_AT` | TIMESTAMP | Created At | 2024-01-01 |
| `EXPIRES_AT` | TIMESTAMP | Expires At | 2025-01-01 |

---

## 🔗 Relationship Diagram (SAP Style)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FI - Finance (Company)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │  TB_BUKRS │  │  TB_SAKN │  │   TB_AR  │  │   TB_AP  │          │
│  │ (Company) │  │  (GL)    │  │   (AR)   │  │   (AP)   │          │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘          │
└───────┼──────────────┼─────────────┼─────────────┼────────────────┘
        │              │             │             │
        │              │             │             │
┌───────▼──────────────▼─────────────▼─────────────▼────────────────┐
│                     CO - Controlling                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                        │
│  │ TB_KOSTL │  │ TB_PRCTR │  │ TB_GSBER │  (Business Area)        │
│  │ (Cost Ctr)│  │ (Profit) │  └────┬─────┘                        │
│  └──────────┘  └──────────┘       │                              │
└────────────────────────────────────┼───────────────────────────────┘
                                     │
┌────────────────────────────────────▼───────────────────────────────┐
│                 SD - Sales Distribution                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ TB_WERKS │  │ TB_KUNNR │  │ TB_VBRK  │  │ TB_SALES │          │
│  │ (Plant)  │◄─┤(Customer)│  │ (Billing)│  │(POS Trans│          │
│  └────┬─────┘  └──────────┘  └──────────┘  └──────────┘          │
└───────┼───────────────────────────────────────────────────────────┘
        │
┌───────▼───────────────────────────────────────────────────────────┐
│                 MM - Materials Management                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ TB_MATNR │  │ TB_MARC  │  │ TB_IMDO  │  │ TB_MSEG  │          │
│  │(Material)│  │(Plant)   │  │(Balance) │  │(Document)│          │
│  └──────────┘  └────┬─────┘  └────┬─────┘  └──────────┘          │
└─────────────────────┼──────────────┼───────────────────────────────┘
                      │              │
              ┌───────▼──────┐       │
              │  TB_LGORT    │       │
              │(Storage Loc) │◄──────┘
              └──────────────┘
```

---

## 📊 Quick Lookup Tables

### Table Prefix Convention

| Prefix | SAP Module | Description |
|--------|-----------|-------------|
| `TB_` | Custom | CyberQuote Table |
| `T` | SAP Standard | SAP Master Data |
| `BS` | SAP Standard | Open Items |
| `SK` | SAP Standard | Chart of Accounts |
| `MK` | SAP Standard | Material Master |

### Status Codes

| Status | Description |
|--------|-------------|
| `ACTIVE` | Active/Open |
| `INACTIVE` | Inactive/Closed |
| `PENDING` | Pending |
| `COMPLETED` | Completed |
| `CANCELLED` | Cancelled |

### Alert Priorities

| Priority | Color | Response |
|----------|-------|----------|
| P0_CRITICAL | 🔴 Red | 15 min |
| P1_HIGH | 🟠 Orange | 1 hour |
| P2_MEDIUM | 🟡 Yellow | 4 hours |
| P3_LOW | 🟢 Green | 24 hours |

---

## 📝 Notes for SAP Users

1. **Currency**: All amounts in **SGD** (Singapore Dollar)
2. **Fiscal Year**: Calendar year (Jan-Dec)
3. **Company Code**: `CQPL` (CyberQuote Pte Ltd)
4. **Plant = Outlet**: Each outlet is a SAP Plant
5. **Storage Location**: Default `SL01` for all plants
6. **Customer = Franchisee**: Each franchisee is a Customer (KUNNR)

---

*Document Version: 1.0*  
*Last Updated: July 22, 2026*  
*Author: CyberQuote Team*
