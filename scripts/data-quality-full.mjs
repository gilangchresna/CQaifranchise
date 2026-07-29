#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function fullCheck() {
  console.log('FULL DATA QUALITY CHECK\n');

  // Get total count first
  const { count: totalCount } = await supabase
    .from('sales_transactions')
    .select('*', { count: 'exact', head: true });
  console.log('Total records in sales_transactions:', totalCount);

  // Get count by outlet using RPC or multiple queries
  console.log('\nRecords per outlet:');
  const { data: outletCounts } = await supabase
    .from('sales_transactions')
    .select('outlet_id');
  
  const counts = {};
  if (outletCounts) {
    for (const r of outletCounts) {
      counts[r.outlet_id] = (counts[r.outlet_id] || 0) + 1;
    }
  }
  
  const sorted = Object.entries(counts).sort((a, b) => Number(a[0]) - Number(b[0]));
  sorted.forEach(([k, v]) => console.log('  Outlet', k.padStart(3), ':', v));
  console.log('  Total outlets:', sorted.length);

  // Check outlets table
  console.log('\nOutlets table:');
  const { data: outlets } = await supabase.from('outlets').select('id, code, name');
  if (outlets) {
    console.log('  Total outlets:', outlets.length);
    outlets.slice(0, 5).forEach(o => console.log('  ', o.id, o.code, o.name));
  }

  // Full payment distribution
  console.log('\nFull payment method distribution:');
  const { data: allPayments } = await supabase
    .from('sales_transactions')
    .select('payment_method');
  
  const pmCounts = {};
  if (allPayments) {
    for (const r of allPayments) {
      const m = r.payment_method || 'NULL';
      pmCounts[m] = (pmCounts[m] || 0) + 1;
    }
  }
  Object.entries(pmCounts).sort((a, b) => b[1] - a[1]).forEach(([m, c]) => {
    console.log('  ' + (m || 'NULL').padEnd(12) + ':', c.toLocaleString().padStart(7), '(' + (c/(allPayments?.length || 1)*100).toFixed(1) + '%)');
  });

  // Full settlement coverage
  console.log('\nSettlement amount coverage:');
  const { data: allSettlement } = await supabase
    .from('sales_transactions')
    .select('settlement_amount');
  
  if (allSettlement) {
    const withSettlement = allSettlement.filter(r => r.settlement_amount !== null).length;
    const withoutSettlement = allSettlement.filter(r => r.settlement_amount === null).length;
    console.log('  With settlement_amount:', withSettlement.toLocaleString());
    console.log('  Without settlement_amount:', withoutSettlement.toLocaleString());
    console.log('  Coverage:', (withSettlement / allSettlement.length * 100).toFixed(1) + '%');
  }

  // Amount statistics from sampled data
  console.log('\nAmount statistics (from sample):');
  const { data: amountSample } = await supabase
    .from('sales_transactions')
    .select('amount')
    .limit(5000);
  
  if (amountSample) {
    const amounts = amountSample.map(r => Number(r.amount));
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const sum = amounts.reduce((a, b) => a + b, 0);
    console.log('  Min:', min);
    console.log('  Max:', max);
    console.log('  Avg:', avg.toFixed(2));
    console.log('  Sum:', sum.toLocaleString());
  }

  // Date range
  console.log('\nDate range:');
  const { data: oldest } = await supabase
    .from('sales_transactions')
    .select('date')
    .order('date', { ascending: true })
    .limit(1);
  const { data: newest } = await supabase
    .from('sales_transactions')
    .select('date')
    .order('date', { ascending: false })
    .limit(1);
  console.log('  Oldest:', oldest?.[0]?.date);
  console.log('  Newest:', newest?.[0]?.date);
}

fullCheck().catch(console.error);
