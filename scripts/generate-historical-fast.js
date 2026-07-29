#!/usr/bin/env node
/**
 * Fast Historical Sales Generator - Direct DB Insert
 * Bypasses webhook for faster bulk insert
 */

const SUPABASE_URL = "https://ploqeifazcgzwjzmukgp.supabase.co";
const SUPABASE_SERVICE_KEY = ""; // Need service role key for direct insert

const OUTLETS = [
  { id: 156, products: ["Kaya Toast", "Kopi", "Egg", "Teh"], baseRevenue: 55 },
  { id: 157, products: ["Chicken Rice", "Rice", "Soup"], baseRevenue: 67 },
  { id: 158, products: ["Nasi Lemak", "Egg", "Sambal"], baseRevenue: 50 },
  { id: 159, products: ["Laksa", "Kopi", "Teh"], baseRevenue: 54 },
  { id: 160, products: ["Kaya Toast", "Kopi O", "Milo"], baseRevenue: 53 },
  { id: 161, products: ["Mookata Set", "Vegetables"], baseRevenue: 80 },
  { id: 162, products: ["Roti Prata", "Curry", "Milo"], baseRevenue: 48 },
  { id: 163, products: ["Economy Rice", "Chicken"], baseRevenue: 59 },
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateDailySummary(outlet, date) {
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  const baseTxns = isWeekend ? 250 : 200;
  const variance = randomInt(-20, 20);
  const transactionCount = baseTxns + variance;

  // Add some daily variation
  const dailyVariance = 0.8 + (Math.random() * 0.4); // 80% - 120%
  const revenue = Math.round(outlet.baseRevenue * dailyVariance);
  const avgTransaction = Math.round((revenue / transactionCount) * 100) / 100;

  // Simulate anomaly (5% chance)
  const isAnomaly = Math.random() < 0.05;
  const anomalyScore = isAnomaly ? randomInt(60, 95) / 100 : randomInt(0, 30) / 100;

  return {
    outlet_id: outlet.id,
    date: date.toISOString().split('T')[0],
    amount: revenue,
    transaction_count: transactionCount,
    anomaly_score: anomalyScore,
    is_anomaly: isAnomaly,
  };
}

async function insertBatch(summaries) {
  // Since we don't have service key, we'll output SQL to run manually
  return summaries;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  📊 FAST HISTORICAL SALES GENERATOR (Jan - Jul 2026)   ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const summaries = [];
  const startDate = new Date('2026-01-01');
  const endDate = new Date('2026-07-29');

  // Generate data for each day and outlet
  for (let currentDate = new Date(startDate); currentDate <= endDate; currentDate.setDate(currentDate.getDate() + 1)) {
    const dateStr = currentDate.toISOString().split('T')[0];

    for (const outlet of OUTLETS) {
      const summary = generateDailySummary(outlet, new Date(currentDate));
      summaries.push(summary);
    }

    // Progress update every 10 days
    const daysPassed = Math.floor((currentDate - startDate) / (1000 * 60 * 60 * 24));
    if (daysPassed % 10 === 0) {
      process.stdout.write(`\r📅 ${dateStr} | Generated: ${summaries.length} records...`);
    }
  }

  console.log('\n\n✅ Generation complete!');
  console.log(`   Total records: ${summaries.length}`);
  console.log(`   Date range: 2026-01-01 to 2026-07-29`);
  console.log(`   Outlets: ${OUTLETS.length}`);

  // Generate SQL for direct insert
  console.log('\n📝 Generating SQL insert statements...\n');

  // Create values string for bulk insert
  const values = summaries.map(s =>
    `(${s.outlet_id}, '${s.date}', ${s.amount}, ${s.transaction_count}, ${s.anomaly_score}, ${s.is_anomaly})`
  ).join(',\n');

  const sql = `
-- Historical Sales Data (${summaries.length} records)
-- Generated: ${new Date().toISOString()}

INSERT INTO sales_transactions (outlet_id, date, amount, transaction_count, anomaly_score, is_anomaly)
VALUES
${values}
ON CONFLICT DO NOTHING;
`;

  // Save to file
  const fs = await import('fs');
  fs.writeFileSync('historical-sales-data.sql', sql);
  console.log('✅ SQL saved to: historical-sales-data.sql');
  console.log('\n📋 Next steps:');
  console.log('   1. Run this SQL in Supabase SQL Editor:');
  console.log('   2. Copy contents of historical-sales-data.sql');
  console.log('   3. Paste in https://supabase.com/dashboard → SQL Editor');
  console.log('   4. Execute!\n');
}

main().catch(console.error);
