#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function verify48k() {
  console.log('VERIFYING 48K RECORDS REQUIREMENT\n');

  // Count total
  const { count: total } = await supabase
    .from('sales_transactions')
    .select('*', { count: 'exact', head: true });
  
  console.log('Total records:', total);
  console.log('Expected: 48,000');
  console.log('Difference:', total - 48000);
  
  // Check outlet distribution
  console.log('\nOutlet distribution:');
  const { data: outletData } = await supabase
    .from('sales_transactions')
    .select('outlet_id');
  
  const counts = {};
  if (outletData) {
    for (const r of outletData) {
      counts[r.outlet_id] = (counts[r.outlet_id] || 0) + 1;
    }
  }
  console.log('Unique outlets:', Object.keys(counts).length);
  console.log('Records per outlet:');
  Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log('  Outlet', k, ':', v, 'records');
  });

  // Compare with outlets table
  console.log('\nOutlets table status:');
  const { data: outlets } = await supabase.from('outlets').select('id, code, status');
  if (outlets && outlets.length > 0) {
    console.log('Total outlets in outlets table:', outlets.length);
  } else {
    console.log('WARNING: outlets table is empty or inaccessible');
  }

  // Check if this is POS webhook data vs historical seed data
  console.log('\nData source analysis:');
  const { data: recentTxns } = await supabase
    .from('sales_transactions')
    .select('date, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (recentTxns) {
    console.log('Most recent transactions:');
    recentTxns.forEach(t => console.log('  ', t.date, '- created_at:', t.created_at));
  }

  // Check settlement amounts across different dates
  console.log('\nSettlement coverage by date:');
  const { data: byDate } = await supabase
    .from('sales_transactions')
    .select('date, settlement_amount')
    .order('date', { ascending: false })
    .limit(10);
  
  if (byDate) {
    const grouped = {};
    byDate.forEach(r => {
      if (!grouped[r.date]) {
        grouped[r.date] = { total: 0, withSettlement: 0 };
      }
      grouped[r.date].total++;
      if (r.settlement_amount !== null) grouped[r.date].withSettlement++;
    });
    Object.entries(grouped).forEach(([date, stats]) => {
      console.log('  ' + date + ':', stats.withSettlement + '/' + stats.total, 'have settlement');
    });
  }
}

verify48k().catch(console.error);
