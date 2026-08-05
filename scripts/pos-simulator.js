#!/usr/bin/env node
/**
 * CyberQuote POS Simulator
 * Generates and sends fake sales data to CyberQuote webhook
 * 
 * Usage: node pos-simulator.js [--outlets 24] [--interval 3000]
 * 
 * Environment Variables:
 *   CYBERQUOTE_WEBHOOK - Webhook URL (optional)
 *   POS_HMAC_SECRET   - HMAC secret (optional, uses default dev secret)
 */

import https from 'https';
import crypto from 'crypto';

// Configuration
const CONFIG = {
  webhookUrl: process.env.CYBERQUOTE_WEBHOOK || 
    "https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/ingestion-webhook",
  interval: parseInt(process.argv.find(arg => arg.startsWith('--interval'))?.split('=')[1] || '10000'),  // 10 seconds default
  numOutlets: parseInt(process.argv.find(arg => arg.startsWith('--outlets'))?.split('=')[1] || '24'),
  // HMAC secret - MUST match the server's WEBHOOK_HMAC_SECRET
  // Default: "whsec_default_dev_secret_change_in_production"
  hmacSecret: process.env.POS_HMAC_SECRET || "whsec_default_dev_secret_change_in_production",
};

// Outlet definitions (mimicking real franchise outlets)
// Only use IDs that exist in the database!
const OUTLETS = [
  { id: 37, name: "Ayam Geprek sambel", products: ["Ayam Geprek", "Sambel", "Nasi", "Es Teh"] },
  { id: 36, name: "Bakso Malang Jaya", products: ["Bakso", "Mie Ayam", "Pangsit", "Es Jeruk"] },
  { id: 41, name: "Batak Hutanta", products: ["Nasi Babi", "Saksang", "Na Niribu", "Es Teh"] },
  { id: 9, name: "Mie Ayam Barokah", products: ["Mie Ayam", "Pangsit", "Bakso", "Es Jeruk"] },
  { id: 33, name: "Nasi Goreng END", products: ["Nasi Goreng", "Mie Goreng", "Ayam Geprek", "Es Teh"] },
  { id: 35, name: "Outlet Bandung Pusat", products: ["Nasi Goreng", "Mie Goreng", "Kwetiau", "Es Teh"] },
  { id: 25, name: "Outlet Bandung Timur", products: ["Nasi Goreng", "Soto", "Bakso", "Es Jeruk"] },
  { id: 27, name: "Outlet Bandung Utara", products: ["Mie Ayam", "Bakso", "Pangsit", "Es Teh"] },
  { id: 26, name: "Outlet Jakarta Barat", products: ["Nasi Goreng", "Ayam Geprek", "Mie Goreng", "Es Teh"] },
  { id: 23, name: "Outlet Jakarta Pusat", products: ["Mie Ayam", "Bakso", "Kwetiau", "Es Jeruk"] },
  { id: 22, name: "Outlet Jakarta Selatan", products: ["Nasi Goreng", "Soto", "Rawon", "Es Teh"] },
  { id: 24, name: "Outlet Surabaya Pusat", products: ["Nasi Goreng", "Mie Goreng", "Bakso", "Es Jeruk"] },
  { id: 28, name: "Outlet Surabaya Timur", products: ["Mie Ayam", "Pangsit", "Bakso", "Es Teh"] },
  { id: 30, name: "Outlet Surabaya Utara", products: ["Nasi Goreng", "Ayam Geprek", "Soto", "Es Jeruk"] },
  { id: 29, name: "Rawon Setan", products: ["Rawon", "Nasi", "Tahu Tempe", "Es Teh"] },
  { id: 39, name: "Rawon Setan Budi", products: ["Rawon", "Nasi", "Ayam", "Es Jeruk"] },
  { id: 11, name: "Rendang Sederhana", products: ["Rendang", "Nasi", "Gulai", "Es Teh"] },
  { id: 40, name: "Sate Ayam Pak Somad", products: ["Sate Ayam", "Nasi", "Lontong", "Es Jeruk"] },
  { id: 10, name: "Sate Ayam一级棒", products: ["Sate Ayam", "Nasi", "Sate Kambing", "Es Teh"] },
  { id: 34, name: "Soto Ayam Makmur", products: ["Soto", "Nasi", "Tahu", "Es Jeruk"] },
  { id: 38, name: "Soto Ayam Mba Sri", products: ["Soto", "Nasi", "Ayam", "Es Teh"] },
  { id: 12, name: "Warung Kopi Nusantara", products: ["Kopi", "Teh", "Roti", "Gorengan"] },
  { id: 8, name: "Warung Kopi Nusantara", products: ["Kopi", "Teh", "Nasi", "Mie"] },
  { id: 32, name: "Warung Kopi Nusantara", products: ["Kopi", "Teh", "Pisang", "Gorengan"] },
];

// SGD Price ranges (Singapore Dollars)
const PRICE_RANGES_SGD = [
  { name: "Minuman", range: [3, 8] },           // S$ 3 - 8
  { name: "Makanan Ringan", range: [5, 12] },    // S$ 5 - 12
  { name: "Makanan Berat", range: [10, 25] },    // S$ 10 - 25
  { name: "Dessert", range: [4, 10] },          // S$ 4 - 10
];

// SGD price for outlet products
const OUTLET_PRODUCT_PRICE_SGD = [8, 25];  // S$ 8 - 25

const PAYMENT_METHODS = ["CASH", "QRIS", "DEBIT", "EWALLET"];

// Helper: Generate random number in range
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper: Generate HMAC-SHA256 signature (MUST match server format)
function generateHmac(data, secret) {
  // Server expects: sha256=<hex_digest>
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(data));
  return `sha256=${hmac.digest('hex')}`;
}

// Helper: Generate UUID-like ID
function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Generate fake sale transaction
function generateSale() {
  const outlet = OUTLETS[randomInt(0, Math.min(CONFIG.numOutlets, OUTLETS.length) - 1)];
  const numItems = randomInt(1, 5);
  const items = [];
  let subtotal = 0;
  
  for (let i = 0; i < numItems; i++) {
    // Mix of products from outlet menu
    const useLocalProduct = Math.random() > 0.3;
    const priceRange = useLocalProduct 
      ? OUTLET_PRODUCT_PRICE_SGD
      : PRICE_RANGES_SGD[randomInt(0, PRICE_RANGES_SGD.length - 1)].range;
    
    const productName = useLocalProduct 
      ? outlet.products[randomInt(0, outlet.products.length - 1)]
      : PRICE_RANGES_SGD[randomInt(0, PRICE_RANGES_SGD.length - 1)].name;
    
    const quantity = randomInt(1, 3);
    const unitPrice = randomInt(priceRange[0], priceRange[1]);
    const itemSubtotal = quantity * unitPrice;
    
    items.push({
      sku: `SKU_${productName.replace(/\s/g, '_').substring(0, 10)}`,
      name: productName,
      quantity: quantity,
      unit_price: unitPrice,
      subtotal: itemSubtotal
    });
    
    subtotal += itemSubtotal;
  }
  
  // Add tax (11% PPN)
  const tax = Math.round(subtotal * 0.11);
  const total = subtotal + tax;
  
  return {
    outlet_id: outlet.id,
    outlet_name: outlet.name,
    transaction_id: generateId('TXN'),
    amount: total, // total with tax
    items: items,
    timestamp: new Date().toISOString(),
  };
}

// Send sale to webhook
function sendToWebhook(sale) {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(CONFIG.webhookUrl);
      const payload = JSON.stringify(sale);
      const signature = generateHmac(sale, CONFIG.hmacSecret);
      
      // Get anon key from env or prompt user
      const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
      if (!anonKey) {
        console.log('\n⚠️  WARNING: SUPABASE_ANON_KEY not set!');
        console.log('   Set environment variable:');
        console.log('   export SUPABASE_ANON_KEY=\"your-anon-key\"');
        console.log('   Or add to .env.local: SUPABASE_ANON_KEY=your-anon-key\n');
      }
      
      const headers = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'Authorization': `Bearer ${anonKey || ''}`,
        'apikey': anonKey || '',
        'X-Signature-256': signature,
        'X-POS-Source': 'POS-SIMULATOR',
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
          resolve({
            status: res.statusCode,
            body: data,
            success: res.statusCode >= 200 && res.statusCode < 300
          });
        });
      });
      
      req.on('error', (err) => {
        reject(err);
      });
      
      req.write(payload);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

// Format currency
function formatRupiah(num) {
  return 'Rp ' + num.toLocaleString('id-ID');
}

// Print banner
function printBanner() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                  🚀 CYBERQUOTE POS SIMULATOR 🚀               ║
╠══════════════════════════════════════════════════════════════╣
║  Generates fake POS sales data and sends to CyberQuote       ║
║  webhook endpoint for demo purposes                          ║
╚══════════════════════════════════════════════════════════════╝
  `);
}

// Print config
function printConfig() {
  console.log('📋 Configuration:');
  console.log(`   Webhook URL: ${CONFIG.webhookUrl}`);
  console.log(`   Interval: ${CONFIG.interval}ms (${(60000/CONFIG.interval).toFixed(1)} sales/min)`);
  console.log(`   Outlets: ${CONFIG.numOutlets} outlets`);
  console.log(`   HMAC Auth: ${CONFIG.hmacSecret ? '✅ Enabled' : '❌ Disabled'}`);
  console.log('─'.repeat(65));
}

// Main simulation loop
async function runSimulation() {
  printBanner();
  printConfig();
  
  console.log('📡 Starting simulation...\n');
  
  let totalSales = 0;
  let successCount = 0;
  let errorCount = 0;
  let startTime = Date.now();
  
  // Track outlet activity
  const outletActivity = {};
  OUTLETS.forEach(o => outletActivity[o.id] = 0);
  
  const intervalId = setInterval(async () => {
    // Generate sale (picks random outlet internally)
    const sale = generateSale();
    const timestamp = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const outletId = sale.outlet_id;
    
    // Send to webhook
    try {
      const result = await sendToWebhook(sale);
      totalSales++;
      outletActivity[sale.outlet_id]++;
      if (result.success) {
        successCount++;
        console.log(
          `  [${timestamp}] ✅ Sale #${String(totalSales).padStart(4, '0')} | ` +
          `Outlet ${sale.outlet_id} | ${sale.items.length} items | ` +
          `${formatRupiah(sale.amount)}`
        );
      } else {
        errorCount++;
        console.log(
          `  [${timestamp}] ⚠️  Error ${result.status} | ` +
          `Outlet ${sale.outlet_id} | ${result.body.substring(0, 80)}`
        );
      }
    } catch (err) {
      errorCount++;
      console.log(`  [${timestamp}] ❌ Failed | Outlet ${sale.outlet_id} | ${err.message}`);
    }
    
    // Print stats every 30 seconds
    if (totalSales > 0 && totalSales % 10 === 0) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000) || 1;
      const rate = (totalSales / elapsed * 60).toFixed(1);
      console.log('\n  📊 --- STATS ---');
      console.log(`     Total: ${totalSales} | ✅ ${successCount} | ❌ ${errorCount} | Rate: ${rate}/min`);
      console.log(`     Uptime: ${Math.floor(elapsed/60)}m ${elapsed%60}s\n`);
    }
    
  }, CONFIG.interval);
  
  // Graceful shutdown
  const shutdown = () => {
    console.log('\n\n🛑 Shutting down simulator...');
    clearInterval(intervalId);
    
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    console.log('\n📊 --- FINAL STATS ---');
    console.log(`   Total Sales: ${totalSales}`);
    console.log(`   Successful: ${successCount} (${((successCount/totalSales)*100).toFixed(1)}%)`);
    console.log(`   Failed: ${errorCount} (${((errorCount/totalSales)*100).toFixed(1)}%)`);
    console.log(`   Duration: ${Math.floor(elapsed/60)}m ${elapsed%60}s`);
    console.log(`   Average Rate: ${(totalSales/elapsed*60).toFixed(1)} sales/min`);
    
    console.log('\n📍 Outlet Activity:');
    const sortedOutlets = Object.entries(outletActivity)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    sortedOutlets.forEach(([id, count]) => {
      const outlet = OUTLETS.find(o => o.id === parseInt(id));
      console.log(`   Outlet ${id} (${outlet?.name || 'Unknown'}): ${count} sales`);
    });
    
    console.log('\n👋 Simulator stopped.\n');
    process.exit(0);
  };
  
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  
  console.log('   Press Ctrl+C to stop\n');
}

// Run
runSimulation().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
