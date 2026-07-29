#!/usr/bin/env node
/**
 * Historical Sales Data Generator
 * Generates sales data from Jan 2026 to July 2026 for demo purposes
 */

import https from 'https';
import crypto from 'crypto';

// Configuration
const CONFIG = {
  webhookUrl: "https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/ingestion-webhook",
  hmacSecret: process.env.POS_HMAC_SECRET || "whsec_default_dev_secret_change_in_production",
  anonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
};

// 8 Singapore Outlet IDs
const OUTLETS = [
  { id: 156, name: "Kopitiam @ Tampines Mall", products: ["Kaya Toast", "Kopi", "Soft Boiled Egg", "Teh"] },
  { id: 157, name: "Chicken Rice @ Jurong Point", products: ["Chicken Rice", "Roasted Chicken", "Rice", "Soup"] },
  { id: 158, name: "Nasi Lemak Express AMK", products: ["Nasi Lemak", "Chicken Wings", "Egg", "Sambal"] },
  { id: 159, name: "Laksa King Paya Lebar", products: ["Laksa", "Curry Puff", "Kopi", "Teh"] },
  { id: 160, name: "Kaya Toast @ Clementi Mall", products: ["Kaya Toast", "Kopi O", "Egg", "Milo"] },
  { id: 161, name: "Mookata @ Woodlands", products: ["Mookata Set", "BBQ Chicken", "Vegetables", "Drinks"] },
  { id: 162, name: "Roti Prata @ Hougang Mall", products: ["Roti Prata", "Curry", "Milo", "Teh"] },
  { id: 163, name: "Economic Rice @ Bishan", products: ["Economy Rice", "Vegetable", "Chicken", "Fish"] },
];

const PRICE_RANGES_SGD = [
  { name: "Teh", range: [3, 5] },
  { name: "Kopi", range: [4, 7] },
  { name: "Milo", range: [5, 8] },
  { name: "Toast", range: [5, 8] },
  { name: "Chicken Rice", range: [10, 16] },
  { name: "Laksa", range: [12, 18] },
  { name: "Nasi Lemak", range: [10, 15] },
  { name: "Economy Rice", range: [8, 14] },
  { name: "Mookata", range: [30, 50] },
  { name: "Roti Prata", range: [4, 8] },
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateHmac(data, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(data));
  return `sha256=${hmac.digest('hex')}`;
}

function generateSale(outlet, timestamp) {
  const numItems = randomInt(1, 4);
  const items = [];
  let subtotal = 0;

  for (let i = 0; i < numItems; i++) {
    const product = randomChoice(PRICE_RANGES_SGD);
    const quantity = randomInt(1, 2);
    const unitPrice = randomInt(product.range[0], product.range[1]);
    const itemSubtotal = quantity * unitPrice;

    items.push({
      sku: `SKU_${product.name.replace(/\s/g, '_')}`,
      name: product.name,
      quantity: quantity,
      unit_price: unitPrice,
      subtotal: itemSubtotal
    });

    subtotal += itemSubtotal;
  }

  // Add 9% GST for Singapore
  const tax = Math.round(subtotal * 0.09);
  const total = subtotal + tax;

  return {
    outlet_id: outlet.id,
    outlet_name: outlet.name,
    transaction_id: generateId('TXN'),
    amount: total,
    items: items,
    timestamp: timestamp,
  };
}

function sendToWebhook(sale) {
  return new Promise((resolve, reject) => {
    const url = new URL(CONFIG.webhookUrl);
    const payload = JSON.stringify(sale);
    const signature = generateHmac(sale, CONFIG.hmacSecret);

    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      'Authorization': `Bearer ${CONFIG.anonKey}`,
      'apikey': CONFIG.anonKey,
      'X-Signature-256': signature,
      'X-POS-Source': 'HISTORICAL-GENERATOR',
    };

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: headers,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, success: res.statusCode >= 200 && res.statusCode < 300 });
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Generate data for a specific day
async function generateDayData(date, outlet) {
  const sales = [];

  // Different sales patterns for weekday/weekend
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;

  // Peak hours: 11-14 (lunch), 18-21 (dinner)
  const baseTransactions = isWeekend ? 25 : 18;
  const numTransactions = baseTransactions + randomInt(-5, 5);

  for (let t = 0; t < numTransactions; t++) {
    // Random hour between 10-21
    const hour = randomInt(10, 21);
    const minute = randomInt(0, 59);
    const second = randomInt(0, 59);

    const timestamp = new Date(date);
    timestamp.setHours(hour, minute, second, 0);

    sales.push(generateSale(outlet, timestamp.toISOString()));
  }

  return sales;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     📊 HISTORICAL SALES DATA GENERATOR (Jan-Jul 2026)    ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  if (!CONFIG.anonKey) {
    console.log('❌ Error: SUPABASE_ANON_KEY not set!');
    console.log('   export SUPABASE_ANON_KEY="your-key"');
    process.exit(1);
  }

  // Date range: Jan 1, 2026 to Jul 29, 2026
  const startDate = new Date('2026-01-01');
  const endDate = new Date('2026-07-29');

  let totalSales = 0;
  let successCount = 0;
  let failCount = 0;

  // Loop through each day
  for (let currentDate = new Date(startDate); currentDate <= endDate; currentDate.setDate(currentDate.getDate() + 1)) {
    const dateStr = currentDate.toISOString().split('T')[0];
    process.stdout.write(`\r📅 ${dateStr} | Total: ${totalSales} | Success: ${successCount} | Failed: ${failCount}`);

    // Generate data for each outlet
    for (const outlet of OUTLETS) {
      const daySales = await generateDayData(new Date(currentDate), outlet);

      for (const sale of daySales) {
        try {
          await sendToWebhook(sale);
          successCount++;
          totalSales++;

          // Rate limit - send every 20ms to avoid overwhelming the API
          await new Promise(r => setTimeout(r, 20));
        } catch (err) {
          failCount++;
        }
      }
    }
  }

  console.log('\n');
  console.log('✅ Historical data generation complete!');
  console.log(`   Total transactions: ${totalSales}`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Failed: ${failCount}`);
  console.log(`   Date range: 2026-01-01 to 2026-07-29`);
  console.log(`   Outlets: ${OUTLETS.length}`);
}

main().catch(console.error);
