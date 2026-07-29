#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function detailedCheck() {
  console.log('DETAILED DATA QUALITY ANALYSIS\n');

  // 1. Count by outlet
  const { data: outletData } = await supabase
    .from('sales_transactions')
    .select('outlet_id');
  
  if (outletData) {
    const counts = {};
    for (const r of outletData) {
      counts[r.outlet_id] = (counts[r.outlet_id] || 0) + 1;
    }
    const sorted = Object.entries(counts).sort((a, b) => Number(a[0]) - Number(b[0]));
    console.log('Records per outlet (first 10):');
    sorted.slice(0, 10).forEach(([k, v]) => console.log('  Outlet', k.padStart(3), ':', v));
    console.log('  ...');
    console.log('  Total outlets:', sorted.length);
    console.log('  Total records:', outletData.length);
  }

  // 2. Sample amount values
  console.log('\nSample amount values (first 10):');
  const { data: samples } = await supabase
    .from('sales_transactions')
    .select('id, amount, settlement_amount, net_amount')
    .limit(10);
  if (samples) {
    samples.forEach(s => console.log('  ID', s.id + ':', 'amount=' + s.amount, 'settlement=' + s.settlement_amount, 'net=' + s.net_amount));
  }

  // 3. Top amounts
  console.log('\nTop 10 highest amounts:');
  const { data: topAmounts } = await supabase
    .from('sales_transactions')
    .select('amount')
    .order('amount', { ascending: false })
    .limit(10);
  if (topAmounts) {
    topAmounts.forEach(r => console.log('  Rp', r.amount.toLocaleString()));
  }

  // 4. Payment method - full scan
  console.log('\nPayment method distribution (all records):');
  const { data: allPayments } = await supabase
    .from('sales_transactions')
    .select('payment_method');
  
  if (allPayments) {
    const pmCounts = {};
    for (const r of allPayments) {
      const m = r.payment_method || 'NULL';
      pmCounts[m] = (pmCounts[m] || 0) + 1;
    }
    Object.entries(pmCounts).sort((a, b) => b[1] - a[1]).forEach(([m, c]) => {
      console.log('  ' + (m || 'NULL').padEnd(12) + ':', c.toLocaleString().padStart(7), '(' + (c/allPayments.length*100).toFixed(1) + '%)');
    });
  }

  // 5. Settlement amount coverage
  console.log('\nSettlement amount coverage (all records):');
  const { data: allSettlement } = await supabase
    .from('sales_transactions')
    .select('settlement_amount');
  
  if (allSettlement) {
    const withSettlement = allSettlement.filter(r => r.settlement_amount !== null).length;
    const withoutSettlement = allSettlement.filter(r => r.settlement_amount === null).length;
    console.log('  With settlement_amount:', withSettlement.toLocaleString());
    console.log('  Without settlement_amount:', withoutSettlement.toLocaleString());
  }

  // 6. Settlement samples with platform info
  console.log('\nSample records WITH settlement_amount:');
  const { data: settlementSamples } = await supabase
    .from('sales_transactions')
    .select('id, amount, net_amount, platform_fee, platform, settlement_amount')
    .not('settlement_amount', 'is', null)
    .limit(5);
  if (settlementSamples) {
    settlementSamples.forEach(s => {
      console.log('  ID', s.id + ':');
      console.log('    amount=' + s.amount, 'net_amount=' + s.net_amount, 'platform_fee=' + s.platform_fee);
      console.log('    platform=' + s.platform, 'settlement=' + s.settlement_amount);
      if (s.net_amount !== null && s.platform_fee !== null) {
        const calc = s.net_amount - s.platform_fee;
        console.log('    calculated (net - fee):', calc, 'MATCH:', calc === s.settlement_amount ? 'YES' : 'NO');
      }
    });
  }

  // 7. Platform distribution
  console.log('\nPlatform distribution:');
  const { data: platforms } = await supabase
    .from('sales_transactions')
    .select('platform');
  
  if (platforms) {
    const platCounts = {};
    for (const r of platforms) {
      const p = r.platform || 'NULL';
      platCounts[p] = (platCounts[p] || 0) + 1;
    }
    Object.entries(platCounts).sort((a, b) => b[1] - a[1]).forEach(([p, c]) => {
      console.log('  ' + (p || 'NULL').padEnd(12) + ':', c.toLocaleString().padStart(7), '(' + (c/platforms.length*100).toFixed(1) + '%)');
    });
  }

  // 8. Check for POS webhook data
  console.log('\nChecking POS webhook seeded data vs historical:');
  const { data: recent } = await supabase
    .from('sales_transactions')
    .select('date, amount, payment_method')
    .gte('date', '2026-07-20')
    .limit(20);
  if (recent) {
    console.log('Recent records (last 5 days):');
    recent.slice(0, 5).forEach(r => {
      console.log('  ' + r.date + ': amount=' + r.amount + ', payment=' + r.payment_method);
    });
  }

  const { data: older } = await supabase
    .from('sales_transactions')
    .select('date, amount, payment_method')
    .lt('date', '2026-07-01')
    .limit(20);
  if (older) {
    console.log('\nOlder records (before July):');
    older.slice(0, 5).forEach(r => {
      console.log('  ' + r.date + ': amount=' + r.amount + ', payment=' + r.payment_method);
    });
  }
}

detailedCheck().catch(console.error);
