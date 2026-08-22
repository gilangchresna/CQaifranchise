// POS Simulator Script
// Run: node scripts/pos-simulator.js

const https = require('https');

const SUPABASE_URL = 'https://ploqeifazcgzwjzmukgp.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsb3FlaWZhemNnd3p6bW1rZ3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY0MjU0MTkyMCwiZXhwIjoxOTU4MTE3OTIwfQ.HQT0oiJ9p7KUBP1U9kULj3zIY_8n3V3z6VJdKJwT4cQ';

// SG Outlets
const SG_OUTLETS = [
  { id: 164, name: 'Kopitiam Tampines' },
  { id: 165, name: 'Chicken Rice Jurong Point' },
  { id: 167, name: 'Laksa King Paya Lebar' },
  { id: 168, name: 'Kopitiam Clementis' },
  { id: 169, name: 'Mookata Woodlands' },
  { id: 170, name: 'Roti Prata Hougang' },
  { id: 171, name: 'Economic Rice Bishan' },
  { id: 200, name: 'SG Marina Bay' },
  { id: 202, name: 'SG Changi' },
  { id: 201, name: 'SG Orchard' },
];

// Menu items with prices
const MENU_ITEMS = [
  { name: 'Chicken Rice Set', price: 8.50, cost: 3.40 },
  { name: 'Kopi O', price: 3.00, cost: 1.20 },
  { name: 'Roti Prata', price: 4.50, cost: 1.80 },
  { name: 'Laksa', price: 7.00, cost: 2.80 },
  { name: 'Mookata BBQ', price: 18.00, cost: 7.20 },
  { name: 'Economical Rice', price: 6.50, cost: 2.60 },
  { name: 'Nasi Lemak', price: 7.50, cost: 3.00 },
  { name: 'Teh Tarik', price: 3.50, cost: 1.40 },
  { name: 'Char Kway Teow', price: 8.00, cost: 3.20 },
  { name: 'Fried Rice', price: 7.50, cost: 3.00 },
];

const PAYMENT_METHODS = ['cash', 'qrcode', 'card', 'grab', 'foodpanda'];
const PLATFORMS = ['dine_in', 'takeaway', 'delivery'];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateTransactionId(outletId, outletCode) {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toISOString().slice(11, 19).replace(/:/g, '');
  const suffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${outletCode}-${dateStr}-T${timeStr}-${suffix}`;
}

function generateTransaction(outletId, outletCode) {
  const hour = randomInt(8, 22);
  const dayOfWeek = new Date().getDay();
  
  // Generate 1-5 items
  const itemCount = randomInt(1, 5);
  let totalAmount = 0;
  let totalCost = 0;
  const itemNames = [];
  
  for (let j = 0; j < itemCount; j++) {
    const item = randomChoice(MENU_ITEMS);
    totalAmount += item.price;
    totalCost += item.cost;
    itemNames.push(item.name);
  }
  
  // Add variation (+/- 20%)
  const variation = 0.8 + Math.random() * 0.4;
  totalAmount = Math.round(totalAmount * variation * 100) / 100;
  totalCost = Math.round(totalCost * variation * 100) / 100;
  
  const tax = Math.round(totalAmount * 0.07 * 100) / 100;
  const netAmount = Math.round((totalAmount + tax) * 100) / 100;
  const discount = Math.random() > 0.8 ? Math.round(totalAmount * 0.1 * 100) / 100 : 0;
  const platformFee = randomChoice(['grab', 'foodpanda']).includes(randomChoice(['grab', 'foodpanda'])) 
    ? Math.round(totalAmount * 0.25 * 100) / 100 
    : 0;
  
  return {
    outlet_id: outletId,
    transaction_id: generateTransactionId(outletId, outletCode),
    date: new Date().toISOString().slice(0, 10),
    amount: totalAmount,
    transaction_count: itemCount,
    hour,
    day_of_week: dayOfWeek,
    anomaly_score: null,
    is_anomaly: false,
    metadata: JSON.stringify({ items: itemNames }),
    payment_method: randomChoice(PAYMENT_METHODS),
    customer_id: Math.random() > 0.7 ? `CUST${randomInt(1000, 9999)}` : null,
    staff_id: `STF${String(randomInt(1, 20)).padStart(3, '0')}`,
    discount,
    tax,
    cost: totalCost,
    net_amount: netAmount - discount,
    platform: randomChoice(PLATFORMS),
    platform_order_id: null,
    platform_fee: platformFee,
    settlement_amount: netAmount - discount - platformFee,
    currency_code: 'SGD',
    created_at: new Date().toISOString(),
  };
}

async function runSimulator(options = {}) {
  const { transactionsPerOutlet = 5, outlets = SG_OUTLETS.map(o => o.id) } = options;
  
  console.log(`\n🚀 POS Simulator`);
  console.log(`================`);
  console.log(`Outlets: ${outlets.length}`);
  console.log(`Transactions per outlet: ${transactionsPerOutlet}`);
  console.log(`Total transactions: ${outlets.length * transactionsPerOutlet}\n`);
  
  const allTransactions = [];
  
  for (const outletId of outlets) {
    const outlet = SG_OUTLETS.find(o => o.id === outletId);
    if (!outlet) continue;
    
    const outletCode = outlet.name
      .split(' ')
      .map(w => w[0])
      .join('')
      .substring(0, 3)
      .toUpperCase();
    
    for (let i = 0; i < transactionsPerOutlet; i++) {
      allTransactions.push(generateTransaction(outletId, outletCode));
    }
    
    console.log(`✅ ${outlet.name}: ${transactionsPerOutlet} transactions`);
  }
  
  // Insert to Supabase
  console.log(`\n📤 Inserting to Supabase...`);
  
  const data = JSON.stringify(allTransactions);
  
  const options2 = {
    hostname: 'ploqeifazcgzwjzmukgp.supabase.co',
    port: 443,
    path: '/rest/v1/sales_transactions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ANON_KEY}`,
      'Prefer': 'return=minimal',
      'Content-Length': data.length,
    }
  };
  
  return new Promise((resolve, reject) => {
    const req = https.request(options2, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`\n✅ Success! Generated ${allTransactions.length} transactions`);
          
          // Show summary
          const byOutlet = {};
          allTransactions.forEach(tx => {
            if (!byOutlet[tx.outlet_id]) byOutlet[tx.outlet_id] = { count: 0, total: 0 };
            byOutlet[tx.outlet_id].count++;
            byOutlet[tx.outlet_id].total += tx.amount;
          });
          
          console.log(`\n📊 Summary by Outlet:`);
          for (const [outletId, stats] of Object.entries(byOutlet)) {
            const outlet = SG_OUTLETS.find(o => o.id === parseInt(outletId));
            console.log(`  ${outlet?.name || outletId}: ${stats.count} tx, $${stats.total.toFixed(2)}`);
          }
          
          resolve({ success: true, count: allTransactions.length });
        } else {
          console.log(`❌ Error: ${res.statusCode} - ${body}`);
          reject(new Error(body));
        }
      });
    });
    
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// CLI Interface
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
POS Simulator Script
====================

Usage:
  node scripts/pos-simulator.js [options]

Options:
  --help, -h     Show this help
  --count, -c    Transactions per outlet (default: 5)
  --outlets, -o  Comma-separated outlet IDs (default: all SG)

Examples:
  node scripts/pos-simulator.js                    # 5 tx per outlet
  node scripts/pos-simulator.js -c 10             # 10 tx per outlet
  node scripts/pos-simulator.js -o 164,165,169     # Only 3 outlets
  node scripts/pos-simulator.js -c 3 -o 169       # 3 tx for Mookata only
  `);
  process.exit(0);
}

// Parse arguments
let transactionsPerOutlet = 5;
let outlets = SG_OUTLETS.map(o => o.id);

for (let i = 0; i < args.length; i++) {
  if (args[i] === '-c' || args[i] === '--count') {
    transactionsPerOutlet = parseInt(args[i + 1]) || 5;
    i++;
  }
  if (args[i] === '-o' || args[i] === '--outlets') {
    outlets = args[i + 1].split(',').map(id => parseInt(id.trim()));
    i++;
  }
}

runSimulator({ transactionsPerOutlet, outlets })
  .then(() => console.log(`\n✨ Done!`))
  .catch(err => console.error(`\n❌ Error:`, err.message));
