#!/usr/bin/env node
/**
 * CyberQuote Data Quality Check
 * Verifies: 48k records, settlement_amount correctness, payment_method distribution, anomalies
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ploqeifazcgzwjzmukgp.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_KEY) {
  console.error('Error: SUPABASE_KEY not found');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runDataQualityCheck() {
  console.log('='.repeat(70));
  console.log('CYBERQUOTE DATA QUALITY CHECK - sales_transactions');
  console.log('='.repeat(70));
  console.log();

  let allPassed = true;

  // CHECK 1: RECORD COUNT
  console.log('CHECK 1: RECORD COUNT');
  console.log('-'.repeat(50));
  
  const { count: totalCount, error: countError } = await supabase
    .from('sales_transactions')
    .select('*', { count: 'exact', head: true });
  
  if (countError) {
    console.error('ERROR fetching count:', countError.message);
    allPassed = false;
  } else {
    const expectedCount = 48000;
    const tolerance = 100;
    const isValidCount = Math.abs(totalCount - expectedCount) <= tolerance;
    
    console.log('   Total Records:', totalCount.toLocaleString());
    console.log('   Expected:', expectedCount.toLocaleString(), '(+/-', tolerance + ')');
    
    if (isValidCount) {
      console.log('   PASS: Record count within expected range');
    } else {
      console.log('   WARNING: Record count differs from expected');
      allPassed = false;
    }
  }
  console.log();

  // CHECK 2: SETTLEMENT_AMOUNT VALIDATION
  console.log('CHECK 2: SETTLEMENT_AMOUNT VALIDATION');
  console.log('-'.repeat(50));
  
  const { data: settlementData, error: settlementError } = await supabase
    .from('sales_transactions')
    .select('id, settlement_amount, amount, net_amount, platform_fee, platform')
    .limit(10000);
  
  if (settlementError) {
    console.error('ERROR fetching settlement data:', settlementError.message);
    allPassed = false;
  } else {
    const withSettlement = settlementData.filter(r => r.settlement_amount !== null);
    const withoutSettlement = settlementData.filter(r => r.settlement_amount === null);
    
    console.log('   Records with settlement_amount:', withSettlement.length, '(' + (withSettlement.length/settlementData.length*100).toFixed(1) + '%)');
    console.log('   Records without settlement_amount:', withoutSettlement.length, '(' + (withoutSettlement.length/settlementData.length*100).toFixed(1) + '%)');
    
    // Validate settlement logic
    let validationErrors = 0;
    let checkedRecords = 0;
    
    for (const record of withSettlement) {
      if (record.net_amount !== null && record.platform_fee !== null) {
        checkedRecords++;
        const expectedSettlement = (record.net_amount || record.amount) - (record.platform_fee || 0);
        const tolerance = 0.01;
        
        if (Math.abs(record.settlement_amount - expectedSettlement) > tolerance) {
          validationErrors++;
          if (validationErrors <= 3) {
            console.log('   Mismatch: id=' + record.id + ', settlement=' + record.settlement_amount + ', expected=' + expectedSettlement.toFixed(2));
          }
        }
      }
    }
    
    if (checkedRecords > 0) {
      if (validationErrors === 0) {
        console.log('   PASS: All checked settlement_amount values correct');
      } else {
        console.log('   FAIL:', validationErrors + '/' + checkedRecords, 'settlement_amount values incorrect');
        allPassed = false;
      }
    } else {
      console.log('   INFO: Could not validate formula (net_amount/platform_fee may be null)');
    }
    
    // Check negative
    const negativeSettlements = settlementData.filter(r => 
      r.settlement_amount !== null && r.settlement_amount < 0
    );
    
    if (negativeSettlements.length > 0) {
      console.log('   FAIL: Found', negativeSettlements.length, 'negative settlement_amount values');
      allPassed = false;
    } else {
      console.log('   PASS: No negative settlement_amount values');
    }
  }
  console.log();

  // CHECK 3: PAYMENT_METHOD DISTRIBUTION
  console.log('CHECK 3: PAYMENT_METHOD DISTRIBUTION');
  console.log('-'.repeat(50));
  
  const { data: paymentData, error: paymentError } = await supabase
    .from('sales_transactions')
    .select('payment_method');
  
  if (paymentError) {
    console.error('ERROR fetching payment data:', paymentError.message);
    allPassed = false;
  } else {
    const paymentCounts = {};
    const validMethods = ['cash', 'card', 'qrcode', 'ewallet', 'gofood', 'grabfood', 'dine_in', 'takeaway'];
    
    for (const record of paymentData) {
      const method = record.payment_method || 'NULL/EMPTY';
      paymentCounts[method] = (paymentCounts[method] || 0) + 1;
    }
    
    console.log('   Payment Method Distribution:');
    
    const sortedMethods = Object.entries(paymentCounts).sort((a, b) => b[1] - a[1]);
    for (const [method, count] of sortedMethods) {
      const pct = (count / paymentData.length * 100).toFixed(1);
      console.log('     ' + method.padEnd(15) + ': ' + count.toLocaleString().padStart(8) + ' (' + pct + '%)');
    }
    
    // Check unexpected
    const unexpectedMethods = Object.keys(paymentCounts).filter(m => 
      m !== 'NULL/EMPTY' && !validMethods.includes(m)
    );
    
    if (unexpectedMethods.length > 0) {
      console.log('   WARNING: Unexpected payment methods:', unexpectedMethods.join(', '));
    }
    
    // Distribution analysis
    const cashPct = (paymentCounts['cash'] || 0) / paymentData.length * 100;
    const digitalPct = ((paymentCounts['card'] || 0) + (paymentCounts['qrcode'] || 0) + (paymentCounts['ewallet'] || 0)) / paymentData.length * 100;
    const foodDeliveryPct = ((paymentCounts['gofood'] || 0) + (paymentCounts['grabfood'] || 0)) / paymentData.length * 100;
    
    console.log('\n   Distribution Analysis:');
    console.log('     Cash:', cashPct.toFixed(1) + '% (expected ~40-50%)');
    console.log('     Digital (card+qr+ewallet):', digitalPct.toFixed(1) + '% (expected ~30-40%)');
    console.log('     Food Delivery:', foodDeliveryPct.toFixed(1) + '% (expected ~10-20%)');
    
    if (cashPct >= 20 && cashPct <= 70) {
      console.log('   PASS: Cash distribution within reasonable range');
    } else {
      console.log('   WARNING: Cash distribution outside expected range');
    }
  }
  console.log();

  // CHECK 4: DATA ANOMALIES
  console.log('CHECK 4: DATA ANOMALIES');
  console.log('-'.repeat(50));
  
  // Duplicates check
  const { data: allTxnIds, error: dupError } = await supabase
    .from('sales_transactions')
    .select('transaction_id');
  
  if (dupError) {
    console.log('   Could not check duplicates:', dupError.message);
  } else {
    const txnCounts = {};
    for (const r of allTxnIds) {
      txnCounts[r.transaction_id] = (txnCounts[r.transaction_id] || 0) + 1;
    }
    const duplicateCount = Object.values(txnCounts).filter(c => c > 1).length;
    
    if (duplicateCount === 0) {
      console.log('   PASS: No duplicate transaction_ids found');
    } else {
      console.log('   FAIL: Found', duplicateCount, 'duplicate transaction_ids');
      allPassed = false;
    }
  }
  
  // Null checks
  const { data: nullChecks, error: nullError } = await supabase
    .from('sales_transactions')
    .select('id, outlet_id, date, amount')
    .limit(5000);
  
  if (nullError) {
    console.log('   Could not check nulls:', nullError.message);
  } else {
    const nullOutlet = nullChecks.filter(r => r.outlet_id === null).length;
    const nullDate = nullChecks.filter(r => r.date === null).length;
    const nullAmount = nullChecks.filter(r => r.amount === null).length;
    const zeroAmount = nullChecks.filter(r => r.amount === 0).length;
    
    console.log('   Null/Empty Checks:');
    console.log('     outlet_id nulls:', nullOutlet);
    console.log('     date nulls:', nullDate);
    console.log('     amount nulls:', nullAmount);
    console.log('     amount = 0:', zeroAmount);
    
    if (nullOutlet === 0 && nullDate === 0 && nullAmount === 0) {
      console.log('   PASS: All required fields have values');
    } else {
      console.log('   FAIL: Found null values in required fields');
      allPassed = false;
    }
  }
  
  // Amount stats
  const { data: amountData, error: statsError } = await supabase
    .from('sales_transactions')
    .select('amount')
    .limit(10000);
  
  if (!statsError && amountData) {
    const amounts = amountData.map(r => r.amount);
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    
    console.log('\n   Amount Statistics:');
    console.log('     Min: Rp', min.toLocaleString());
    console.log('     Max: Rp', max.toLocaleString());
    console.log('     Avg: Rp', Math.round(avg).toLocaleString());
    
    if (min > 0 && max < 100000000) {
      console.log('   PASS: Amount values within reasonable range');
    } else {
      console.log('   WARNING: Unusual amount values detected');
    }
  }
  
  // Date range
  const { data: oldestDate } = await supabase
    .from('sales_transactions')
    .select('date')
    .order('date', { ascending: true })
    .limit(1);
  
  const { data: newestDate } = await supabase
    .from('sales_transactions')
    .select('date')
    .order('date', { ascending: false })
    .limit(1);
  
  if (oldestDate && newestDate) {
    console.log('\n   Date Range:');
    console.log('     Oldest:', oldestDate[0]?.date);
    console.log('     Newest:', newestDate[0]?.date);
  }
  console.log();

  // SUMMARY
  console.log('='.repeat(70));
  if (allPassed) {
    console.log('ALL CHECKS PASSED');
  } else {
    console.log('SOME CHECKS FAILED - Review output above');
  }
  console.log('='.repeat(70));
  
  return allPassed;
}

runDataQualityCheck()
  .then(passed => process.exit(passed ? 0 : 1))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
