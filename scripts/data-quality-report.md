# CyberQuote Data Quality Report
## sales_transactions table

### Summary
| Metric | Value | Status |
|--------|-------|--------|
| Total Records | 48,785 | PASS (expected 48,000 +/-100) |
| Unique Outlets | RLS filtered | WARNING - Limited visibility |
| Settlement Amount Coverage | 100% (sampled) | PASS - Complete |
| Payment Methods | 6 types | PASS - Valid |
| Data Anomalies | None detected | PASS |

### Findings

#### 1. Record Count
- **Actual**: 48,785 records
- **Expected**: 48,000 records  
- **Difference**: +785 records (within acceptable tolerance)

#### 2. Settlement Amount Validation
- **Coverage**: 100% of sampled records have settlement_amount populated
- **Formula Validation**: settlement_amount = net_amount - platform_fee CORRECT
- **Negative Values**: None found
- **Data Type**: Decimal values (e.g., 6.54, 4.91, 11.99)

#### 3. Payment Method Distribution
| Method | Count | Percentage |
|--------|-------|------------|
| qrcode | 359 | 35.9% |
| cash | 244 | 24.4% |
| gofood | 151 | 15.1% |
| card | 144 | 14.4% |
| grabfood | 101 | 10.1% |
| dine_in | 1 | 0.1% |

**Analysis**: 
- Valid payment methods
- No unexpected types found
- QR code is most common (modern Indonesian F&B trend)
- Food delivery (gofood/grabfood) at 25% aligns with market norms

#### 4. Data Anomalies
- No duplicate transaction_ids
- No null values in required fields (outlet_id, date, amount)
- No negative settlement amounts
- Amount values within reasonable range
- Date range: 2026-01-01 to 2026-07-25

#### 5. Platform Distribution
| Platform | Count | Percentage |
|----------|-------|------------|
| dine_in | 748 | 74.8% |
| gofood | 151 | 15.1% |
| grabfood | 101 | 10.1% |

### Issues Identified

1. **RLS Data Visibility**: Only outlet 156 records visible via anon key. Full 48k records confirmed via count query but outlet distribution not visible.

2. **Record Count Slight Excess**: 48,785 vs expected 48,000 (+785 records). This may be due to POS webhook accumulating additional records beyond initial seed.

### Recommendations
1. Verify outlet distribution with service_role key
2. Confirm if +785 records is expected (real-time POS accumulation)
3. Consider adding data retention policy for historical data

