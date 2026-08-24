#!/usr/bin/env node
/**
 * Check Supabase Database Structure
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envFile = resolve(__dirname, '../.env.local');

try {
  const envContent = readFileSync(envFile, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=').trim();
      if (!process.env[key]) process.env[key] = value;
    }
  }
} catch (e) {}

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ploqeifazcgzwjzmukgp.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStructure() {
  console.log('🔍 AIFrCQ Database Structure Analysis\n');
  console.log('='.repeat(60));

  // 1. Check tables
  console.log('\n📋 ALL TABLES:');
  const { data: tables, error: tErr } = await supabase.rpc('pg_catalog.pg_tables', { 
    schemaname: 'public' 
  }).select('tablename');

  // Alternative query
  const { data: tablesAlt } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public');
  
  console.log('Tables found:', tablesAlt?.map(t => t.table_name).join(', '));

  // 2. Check sales_transactions
  console.log('\n📊 SALES_TRANSACTIONS Structure:');
  const { data: txCols } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type, is_nullable')
    .eq('table_name', 'sales_transactions')
    .eq('table_schema', 'public')
    .order('ordinal_position');
  console.log(txCols);

  // 3. Check staff
  console.log('\n👥 STAFF Structure:');
  const { data: staffCols } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type, is_nullable')
    .eq('table_name', 'staff')
    .eq('table_schema', 'public')
    .order('ordinal_position');
  console.log(staffCols);

  // 4. Check sample data
  console.log('\n📝 Sample STAFF data:');
  const { data: staffSample } = await supabase
    .from('staff')
    .select('id, name, outlet_id')
    .limit(5);
  console.log(staffSample);

  // 5. Check POS staff_id values
  console.log('\n💰 POS staff_id DISTRIBUTION:');
  const { data: posStaffIds } = await supabase
    .from('sales_transactions')
    .select('staff_id')
    .limit(1000);
  
  const staffIdCount = {};
  posStaffIds?.forEach(tx => {
    const sid = tx.staff_id || 'NULL';
    staffIdCount[sid] = (staffIdCount[sid] || 0) + 1;
  });
  
  console.log('Staff ID counts (sample of 1000):');
  Object.entries(staffIdCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([sid, cnt]) => console.log(`  ${sid}: ${cnt}`));

  // 6. Check relationship
  console.log('\n🔗 RELATIONSHIP CHECK:');
  console.log('POS staff_id values:', Object.keys(staffIdCount).slice(0, 10));
  console.log('Staff.id values:', staffSample?.map(s => s.id));

  console.log('\n' + '='.repeat(60));
  console.log('ANALYSIS:');
  console.log('- Does POS staff_id match staff.id?', 
    Object.keys(staffIdCount).some(sid => 
      staffSample?.some(s => String(s.id) === sid)
    ) ? 'YES ✅' : 'NO ❌');
}

checkStructure().catch(console.error);
