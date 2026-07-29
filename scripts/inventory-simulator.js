#!/usr/bin/env node
/**
 * CyberQuote Inventory Simulator
 * Seeds initial inventory and simulates stock movements
 * 
 * Usage: node inventory-simulator.js [--seed] [--restock]
 * 
 * Environment Variables:
 *   CYBERQUOTE_WEBHOOK - Webhook URL (optional)
 *   POS_HMAC_SECRET   - HMAC secret (optional)
 */

import https from 'https';
import crypto from 'crypto';

// Configuration
const CONFIG = {
  webhookUrl: process.env.CYBERQUOTE_WEBHOOK || 
    "https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/ingestion-webhook",
  interval: parseInt(process.argv.find(arg => arg.startsWith('--interval'))?.split('=')[1] || '15000'), // 15 seconds default
  hmacSecret: process.env.POS_HMAC_SECRET || "whsec_default_dev_secret_change_in_production",
  anonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
};

// 24 Outlet IDs that exist in DB
const OUTLET_IDS = [37, 36, 41, 9, 33, 35, 25, 27, 26, 23, 22, 24, 28, 30, 29, 39, 11, 40, 10, 34, 38, 12, 8, 32];

// Product catalog (SKU -> name, category, unit)
const PRODUCTS = [
  // Minuman
  { sku: 'MNL_ES_TEH', name: 'Es Teh Manis', category: 'Minuman', unit: 'glass', cost_range: [3000, 5000], sell_range: [8000, 12000], min_stock: 50, max_stock: 200 },
  { sku: 'MNL_ES_JERUK', name: 'Es Jeruk Peras', category: 'Minuman', unit: 'glass', cost_range: [4000, 6000], sell_range: [10000, 15000], min_stock: 40, max_stock: 150 },
  { sku: 'MNL_KOPI', name: 'Kopi Hitam', category: 'Minuman', unit: 'cup', cost_range: [5000, 8000], sell_range: [12000, 20000], min_stock: 30, max_stock: 120 },
  { sku: 'MNL_JUS', name: 'Jus Jeruk Segar', category: 'Minuman', unit: 'glass', cost_range: [6000, 10000], sell_range: [15000, 25000], min_stock: 25, max_stock: 100 },
  
  // Makanan Ringan
  { sku: 'MGR_PANGGANG', name: 'Roti Bakar', category: 'Makanan Ringan', unit: 'pcs', cost_range: [8000, 12000], sell_range: [18000, 25000], min_stock: 20, max_stock: 80 },
  { sku: 'MGR_GORENGAN', name: 'Gorengan Assorti', category: 'Makanan Ringan', unit: 'porsi', cost_range: [5000, 10000], sell_range: [12000, 20000], min_stock: 30, max_stock: 100 },
  { sku: 'MGR_TAHU', name: 'Tahu Crispy', category: 'Makanan Ringan', unit: 'porsi', cost_range: [4000, 8000], sell_range: [10000, 18000], min_stock: 25, max_stock: 90 },
  { sku: 'MGR_TEMPE', name: 'Tempe Goreng', category: 'Makanan Ringan', unit: 'porsi', cost_range: [3000, 6000], sell_range: [8000, 15000], min_stock: 30, max_stock: 100 },
  
  // Makanan Berat
  { sku: 'MBT_NASI_GORENG', name: 'Nasi Goreng Spesial', category: 'Makanan Berat', unit: 'porsi', cost_range: [12000, 18000], sell_range: [25000, 40000], min_stock: 15, max_stock: 60 },
  { sku: 'MBT_MIE_GORENG', name: 'Mie Goreng Jawa', category: 'Makanan Berat', unit: 'porsi', cost_range: [10000, 15000], sell_range: [22000, 35000], min_stock: 15, max_stock: 60 },
  { sku: 'MBT_AYAM_GPREK', name: 'Ayam Geprek Sambel', category: 'Makanan Berat', unit: 'porsi', cost_range: [15000, 22000], sell_range: [30000, 45000], min_stock: 12, max_stock: 50 },
  { sku: 'MBT_BAKSO', name: 'Bakso Komplit', category: 'Makanan Berat', unit: 'porsi', cost_range: [13000, 20000], sell_range: [28000, 42000], min_stock: 12, max_stock: 50 },
  { sku: 'MBT_SOTO', name: 'Soto Ayam Bening', category: 'Makanan Berat', unit: 'porsi', cost_range: [14000, 20000], sell_range: [30000, 45000], min_stock: 10, max_stock: 45 },
  { sku: 'MBT_RAWON', name: 'Rawon Setan', category: 'Makanan Berat', unit: 'porsi', cost_range: [18000, 25000], sell_range: [35000, 55000], min_stock: 8, max_stock: 40 },
  { sku: 'MBT_SATE', name: 'Sate Ayam Khas', category: 'Makanan Berat', unit: 'porsi', cost_range: [16000, 23000], sell_range: [32000, 50000], min_stock: 10, max_stock: 45 },
  { sku: 'MBT_RENDANG', name: 'Rendang Sapi', category: 'Makanan Berat', unit: 'porsi', cost_range: [20000, 28000], sell_range: [40000, 65000], min_stock: 8, max_stock: 35 },
];

// Helper: Random number in range
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper: Random float
function randomFloat(min, max, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

// Helper: Generate UUID-like ID
function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Helper: Generate HMAC-SHA256 signature
function generateHmac(data, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(data));
  return `sha256=${hmac.digest('hex')}`;
}

// Generate initial inventory for an outlet
function generateInitialInventory(outletId) {
  const inventory = [];
  
  for (const product of PRODUCTS) {
    // Randomize initial stock between min and max
    const currentStock = randomInt(product.min_stock, product.max_stock);
    
    inventory.push({
      outlet_id: outletId,
      sku: product.sku,
      product_name: product.name,
      category: product.category,
      current_stock: currentStock,
      min_stock: product.min_stock,
      max_stock: product.max_stock,
      unit: product.unit,
      cost_price: randomFloat(product.cost_range[0], product.cost_range[1]),
      sell_price: randomFloat(product.sell_range[0], product.sell_range[1]),
    });
  }
  
  return inventory;
}

// Generate stock movement (consumption from sale)
function generateStockMovement(outletId, type = 'sale') {
  // Pick random product
  const product = PRODUCTS[randomInt(0, PRODUCTS.length - 1)];
  const quantity = randomInt(1, 3);
  
  return {
    outlet_id: outletId,
    sku: product.sku,
    product_name: product.name,
    movement_type: type, // 'sale' or 'restock'
    quantity: type === 'sale' ? -quantity : quantity,
    reference_type: type === 'sale' ? 'transaction' : 'purchase_order',
    reference_id: generateId(type === 'sale' ? 'TXN' : 'PO'),
    notes: type === 'sale' ? `Sale: ${quantity} ${product.unit}` : `Restock: ${quantity} ${product.unit}`,
    timestamp: new Date().toISOString(),
  };
}

// HTTP POST helper
function httpPost(url, payload, headers = {}) {
  return new Promise((resolve, reject) => {
    try {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(JSON.stringify(payload)),
          ...headers,
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, data });
          }
        });
      });

      req.on('error', reject);
      req.write(JSON.stringify(payload));
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

// Seed inventory to database
async function seedInventory() {
  console.log('🌱 Seeding inventory for all outlets...\n');
  
  const totalProducts = OUTLET_IDS.length * PRODUCTS.length;
  let seeded = 0;
  
  for (const outletId of OUTLET_IDS) {
    const inventory = generateInitialInventory(outletId);
    
    try {
      // Insert via REST API
      const response = await httpPost(
        `https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/inventory`,
        inventory,
        {
          'apikey': CONFIG.anonKey,
          'Authorization': `Bearer ${CONFIG.anonKey}`,
          'Prefer': 'resolution=merge-duplicates',
        }
      );
      
      seeded += inventory.length;
      const pct = Math.round((seeded / totalProducts) * 100);
      process.stdout.write(`\r  Progress: ${pct}% (${seeded}/${totalProducts})`);
    } catch (err) {
      console.error(`\n❌ Error seeding outlet ${outletId}:`, err.message);
    }
  }
  
  console.log('\n\n✅ Inventory seeding complete!');
  console.log(`   Total items: ${seeded}`);
  console.log(`   Outlets: ${OUTLET_IDS.length}`);
  console.log(`   Products per outlet: ${PRODUCTS.length}`);
}

// Run stock simulation
async function runSimulation() {
  console.log('\n📦 Stock Movement Simulator');
  console.log('═'.repeat(50));
  console.log(`   Interval: ${CONFIG.interval}ms`);
  console.log(`   Outlets: ${OUTLET_IDS.length}`);
  console.log(`   Products: ${PRODUCTS.length}\n`);
  
  let saleCount = 0;
  let restockCount = 0;
  
  const intervalId = setInterval(async () => {
    // Pick random outlet
    const outletId = OUTLET_IDS[randomInt(0, OUTLET_IDS.length - 1)];
    
    // 80% chance of sale, 20% chance of restock
    const isRestock = Math.random() < 0.2;
    const movement = generateStockMovement(outletId, isRestock ? 'restock' : 'sale');
    
    const timestamp = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const icon = isRestock ? '📥' : '📤';
    const action = isRestock ? 'RESTOCK' : 'SALE';
    
    if (isRestock) restockCount++;
    else saleCount++;
    
    // Calculate stock level after movement
    const stockChange = Math.abs(movement.quantity);
    const stockStatus = movement.quantity < 0 ? '↓' : '↑';
    
    console.log(`  [${timestamp}] ${icon} ${action.padEnd(7)} | Outlet ${outletId.toString().padStart(2)} | ${movement.product_name.substring(0, 20).padEnd(20)} | ${stockStatus}${stockChange} ${movement.unit}`);
    
    // Send to webhook (if endpoint exists)
    try {
      const signature = generateHmac(movement, CONFIG.hmacSecret);
      await httpPost(
        CONFIG.webhookUrl,
        movement,
        {
          'x-signature': signature,
          'apikey': CONFIG.anonKey,
          'Authorization': `Bearer ${CONFIG.anonKey}`,
        }
      );
    } catch (err) {
      // Webhook might not handle stock movements yet - that's ok
    }
  }, CONFIG.interval);
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    clearInterval(intervalId);
    console.log('\n\n⏹️  Simulation stopped');
    console.log(`   Total sales: ${saleCount}`);
    console.log(`   Total restocks: ${restockCount}`);
    process.exit(0);
  });
}

// Check current inventory status
async function checkInventory() {
  console.log('📊 Current Inventory Status\n');
  
  try {
    const response = await httpPost(
      `https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/rpc/get_inventory_summary`,
      {},
      {
        'apikey': CONFIG.anonKey,
        'Authorization': `Bearer ${CONFIG.anonKey}`,
      }
    );
    
    if (response.data) {
      console.log(JSON.stringify(response.data, null, 2));
    }
  } catch (err) {
    console.log('Using direct inventory query...\n');
    
    // Direct query
    const response = await new Promise((resolve, reject) => {
      const url = new URL(`https://ploqeifazcgzwjzmukgp.supabase.co/rest/v1/inventory?select=*&limit=100`);
      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          'apikey': CONFIG.anonKey,
          'Authorization': `Bearer ${CONFIG.anonKey}`,
        },
      };
      
      https.get(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch { resolve([]); }
        });
      }).on('error', reject);
    });
    
    if (Array.isArray(response) && response.length > 0) {
      console.log(`Found ${response.length} inventory records`);
      console.log('\nSample records:');
      console.table(response.slice(0, 5).map(r => ({
        Outlet: r.outlet_id,
        SKU: r.sku,
        Product: r.product_name,
        Stock: r.current_stock,
        Min: r.min_stock,
        Max: r.max_stock,
      })));
    } else {
      console.log('No inventory data found. Run with --seed to populate.');
    }
  }
}

// Main
async function main() {
  const args = process.argv.slice(2);
  
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║         CYBERQUOTE INVENTORY SIMULATOR                     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  if (args.includes('--seed')) {
    await seedInventory();
  } else if (args.includes('--check')) {
    await checkInventory();
  } else if (args.includes('--restock')) {
    await runSimulation();
  } else {
    console.log('Usage: node inventory-simulator.js [options]\n');
    console.log('Options:');
    console.log('  --seed    Seed inventory for all outlets');
    console.log('  --check   Check current inventory status');
    console.log('  --restock Run stock movement simulation');
    console.log('  --interval=5000  Set interval (ms)');
    console.log('\nExamples:');
    console.log('  node inventory-simulator.js --seed');
    console.log('  node inventory-simulator.js --check');
    console.log('  node inventory-simulator.js --restock --interval=10000');
  }
}

main().catch(console.error);
