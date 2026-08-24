#!/usr/bin/env node
/**
 * Fix POS Staff ID Mapping
 * 
 * Maps synthetic staff_id (STF001, STF002...) to real staff.id
 * Updates existing transactions without deleting data
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
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixStaffIdMapping() {
  console.log('🔧 AIFrCQ — Fixing POS Staff ID Mapping\n');
  console.log('='.repeat(60));

  // Step 1: Get all fake staff IDs that need mapping
  console.log('\n📊 Step 1: Finding fake staff IDs...');
  const { data: fakeStaffIds } = await supabase
    .from('sales_transactions')
    .select('staff_id')
    .in('staff_id', ['STF001', 'STF002', 'STF003', 'STF004', 'STF005', 'STF006', 'STF007', 'STF008', 'STF009', 'STF010']);

  const uniqueFakes = [...new Set(fakeStaffIds?.map(r => r.staff_id) || [])];
  console.log(`Found ${uniqueFakes.length} fake staff IDs: ${uniqueFakes.join(', ')}`);

  // Step 2: Get all real staff by outlet
  console.log('\n👥 Step 2: Fetching real staff by outlet...');
  const { data: realStaff } = await supabase
    .from('staff')
    .select('id, name, outlet_id')
    .not('outlet_id', 'is', null);

  // Group by outlet
  const staffByOutlet = {};
  realStaff?.forEach(s => {
    if (!staffByOutlet[s.outlet_id]) staffByOutlet[s.outlet_id] = [];
    staffByOutlet[s.outlet_id].push(s);
  });

  console.log(`Found ${realStaff?.length || 0} real staff across ${Object.keys(staffByOutlet).length} outlets`);

  // Step 3: Create mapping (fake → real)
  console.log('\n🔗 Step 3: Creating mapping...');
  const fakeToRealMapping = {};
  uniqueFakes.forEach((fakeId, index) => {
    // For each fake ID, we'll assign to a real staff member
    // The assignment will be done per-outlet in the update
    fakeToRealMapping[fakeId] = index;
  });

  // Step 4: Update transactions
  console.log('\n📝 Step 4: Updating transactions...');
  
  let updated = 0;
  let totalProcessed = 0;

  // Process each outlet's fake transactions
  for (const outletId of Object.keys(staffByOutlet)) {
    const staffList = staffByOutlet[outletId];
    if (staffList.length === 0) continue;

    // Get transactions for this outlet with fake staff IDs
    const { data: outletTx } = await supabase
      .from('sales_transactions')
      .select('id, staff_id, outlet_id')
      .eq('outlet_id', parseInt(outletId))
      .in('staff_id', uniqueFakes);

    if (!outletTx || outletTx.length === 0) continue;

    console.log(`\n📍 Outlet ${outletId}: ${outletTx.length} transactions to update`);

    // Update each transaction with a real staff ID
    for (const tx of outletTx) {
      // Round-robin assignment based on transaction index
      const staffIndex = totalProcessed % staffList.length;
      const newStaffId = String(staffList[staffIndex].id);

      const { error } = await supabase
        .from('sales_transactions')
        .update({ staff_id: newStaffId })
        .eq('id', tx.id);

      if (!error) {
        updated++;
        if (updated <= 5) {
          console.log(`   ✅ ${tx.staff_id} → ${staffList[staffIndex].name} (ID: ${newStaffId})`);
        }
      }
      totalProcessed++;
    }
  }

  if (updated > 5) {
    console.log(`   ... and ${updated - 5} more updates`);
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ MAPPING COMPLETE!`);
  console.log(`   Total transactions updated: ${updated}`);
  console.log(`\nNow run the POS simulator to generate NEW data with correct staff IDs.`);
}

fixStaffIdMapping().catch(console.error);
