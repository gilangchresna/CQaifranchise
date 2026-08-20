#!/usr/bin/env node
/**
 * CyberQuote Unified POS + Inventory Simulator
 * 
 * Simulates real POS sale that deducts inventory
 * 
 * Features:
 * - Generate sale transaction
 * - Deduct inventory based on items sold
 * - Check low stock / out of stock alerts
 * - Log inventory movements
 * 
 * Usage:
 *   node unified-pos-inventory.js --seed          # Seed inventory first
 *   node unified-pos-inventory.js --run           # Run continuous simulation
 *   node unified-pos-inventory.js --sale 200      # Single sale at outlet 200
 *   node unified-pos-inventory.js --dry-run       # Test without sending
 * 
 * SG Outlets (region_id = 114):
 *   164, 165, 167, 168, 169, 170, 171, 200, 201, 202
 */

import https from 'https';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// ── Configuration ────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ploqeifazcgzwjzmukgp.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const webhookUrl = `${SUPABASE_URL}/functions/v1/pos-webhook`;
const hmacSecret = process.env.POS_WEBHOOK_SECRET || 'whsec_default_dev_secret_change_in_production';

// SG Outlets (region_id = 114)
const SG_OUTLETS = [164, 165, 167, 168, 169, 170, 171, 200, 201, 202];

// Product catalog - realistic F&B items
const PRODUCTS = [
  // Beverages (Minuman)
  { sku: 'BEV_ICED_TEA', name: 'Iced Tea', category: 'Beverages', unit: 'glass', 
    cost: 1.50, sell: 5.50, stock_min: 30, stock_max: 100 },
  { sku: 'BEV_ORANGE_JUICE', name: 'Fresh Orange Juice', category: 'Beverages', unit: 'glass',
    cost: 2.00, sell: 7.50, stock_min: 25, stock_max: 80 },
  { sku: 'BEV_KOPI_O', name: 'Kopi O', category: 'Beverages', unit: 'cup',
    cost: 1.80, sell: 6.50, stock_min: 40, stock_max: 120 },
  { sku: 'BEV_LATTE', name: 'Cafe Latte', category: 'Beverages', unit: 'cup',
    cost: 2.50, sell: 8.50, stock_min: 35, stock_max: 100 },
  { sku: 'BEV_MILO', name: 'Milo Dinosaur', category: 'Beverages', unit: 'cup',
    cost: 2.20, sell: 7.00, stock_min: 30, stock_max: 90 },
  
  // Light Meals (Makanan Ringan)
  { sku: 'LMT_ROTI_CANAI', name: 'Roti Canai', category: 'Light Meals', unit: 'piece',
    cost: 2.50, sell: 8.00, stock_min: 20, stock_max: 60 },
  { sku: 'LMT_NASI_GORENG', name: 'Nasi Goreng', category: 'Light Meals', unit: 'plate',
    cost: 4.00, sell: 12.00, stock_min: 15, stock_max: 40 },
  { sku: 'LMT_MIE_GORENG', name: 'Mie Goreng', category: 'Light Meals', unit: 'bowl',
    cost: 3.50, sell: 10.00, stock_min: 15, stock_max: 45 },
  { sku: 'LMT_PRAWN_CRACKERS', name: 'Prawn Crackers', category: 'Light Meals', unit: 'packet',
    cost: 1.00, sell: 4.00, stock_min: 50, stock_max: 150 },
  { sku: 'LMT_SATE', name: 'Sate Ayam (10 pcs)', category: 'Light Meals', unit: 'plate',
    cost: 5.00, sell: 15.00, stock_min: 12, stock_max: 35 },
  
  // Main Meals (Makanan Berat)
  { sku: 'MNL_CHICKEN_RICE', name: 'Hainanese Chicken Rice', category: 'Main Meals', unit: 'plate',
    cost: 5.00, sell: 14.00, stock_min: 10, stock_max: 30 },
  { sku: 'MNL_LAKSA', name: 'Singapore Laksa', category: ' Main Meals', unit: 'bowl',
    cost: 5.50, sell: 15.50, stock_min: 10, stock_max: 25 },
  { sku: 'MNL_KWAY_TEOW', name: 'Char Kway Teow', category: 'Main Meals', unit: 'plate',
    cost: 5.00, sell: 13.00, stock_min: 12, stock_max: 30 },
  { sku: 'MNL_RICE_BOWL', name: 'Economic Rice Bowl', category: 'Main Meals', unit: 'bowl',
    cost: 4.50, sell: 11.00, stock_min: 15, stock_max: 40 },
  { sku: 'MNL_BEEG_HOON', name: 'Taipei Beeg Hoon', category: 'Main Meals', unit: 'bowl',
    cost: 6.00, sell: 16.00, stock_min: 8, stock_max: 20 },
];

// ── Utilities ─────────────────────────────────────────────────────────────────
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(2));
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

// ── Supabase Client ────────────────────────────────────────────────────────────
const supabase = SUPABASE_SERVICE_KEY 
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  : null;

// ── Database Functions ────────────────────────────────────────────────────────
async function getInventoryForOutlet(outletId) {
  if (!supabase) {
    console.log('⚠️ No service key - cannot query DB');
    return [];
  }
  
  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .eq('outlet_id', outletId);
  
  if (error) {
    console.log(`❌ Error fetching inventory: ${error.message}`);
    return [];
  }
  
  return data || [];
}

async function seedInventory(outletId) {
  if (!supabase) {
    console.log('⚠️ No service key - cannot seed inventory');
    return;
  }
  
  console.log(`\n🌱 Seeding inventory for outlet ${outletId}...`);
  
  for (const product of PRODUCTS) {
    const currentStock = randomInt(product.stock_min, product.stock_max);
    
    const { error } = await supabase
      .from('inventory')
      .upsert({
        outlet_id: outletId,
        sku: product.sku,
        product_name: product.name,
        category: product.category,
        current_stock: currentStock,
        min_stock: product.stock_min,
        max_stock: product.stock_max,
        unit: product.unit,
        cost_price: product.cost,
        sell_price: product.sell,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'outlet_id,sku'
      });
    
    if (error) {
      console.log(`  ❌ ${product.name}: ${error.message}`);
    } else {
      console.log(`  ✅ ${product.name}: ${currentStock} ${product.unit}`);
    }
  }
}

async function updateInventory(outletId, items) {
  if (!supabase) return;
  
  const results = {
    deducted: [],
    lowStock: [],
    outOfStock: []
  };
  
  for (const item of items) {
    // Get current stock
    const { data: current } = await supabase
      .from('inventory')
      .select('current_stock, min_stock, product_name, unit')
      .eq('outlet_id', outletId)
      .eq('sku', item.sku)
      .single();
    
    if (!current) {
      console.log(`  ⚠️ SKU ${item.sku} not found in inventory`);
      continue;
    }
    
    const newStock = Math.max(0, current.current_stock - item.qty);
    
    // Update stock
    await supabase
      .from('inventory')
      .update({ 
        current_stock: newStock,
        updated_at: new Date().toISOString()
      })
      .eq('outlet_id', outletId)
      .eq('sku', item.sku);
    
    // Log movement
    await supabase
      .from('inventory_movements')
      .insert({
        outlet_id: outletId,
        sku: item.sku,
        movement_type: 'sale',
        quantity: -item.qty,
        stock_before: current.current_stock,
        stock_after: newStock,
        reference: item.transaction_id,
        created_at: new Date().toISOString()
      });
    
    results.deducted.push({
      sku: item.sku,
      qty: item.qty,
      stockBefore: current.current_stock,
      stockAfter: newStock
    });
    
    // Check thresholds
    if (newStock <= 0) {
      results.outOfStock.push(item.sku);
    } else if (newStock <= current.min_stock) {
      results.lowStock.push(item.sku);
    }
  }
  
  return results;
}

async function sendWebhook(payload) {
  return new Promise((resolve) => {
    const body = JSON.stringify(payload);
    const signature = generateHmac(payload, hmacSecret);
    
    const url = new URL(webhookUrl);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'x-pos-signature': signature,
        'apikey': SUPABASE_ANON_KEY
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data });
      });
    });
    
    req.on('error', (err) => {
      resolve({ status: 500, body: err.message });
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      resolve({ status: 408, body: 'Timeout' });
    });
    
    req.write(body);
    req.end();
  });
}

// ── Sale Generator ────────────────────────────────────────────────────────────
function generateSale(outletId) {
  const transactionId = `TXN-${Date.now()}-${outletId}-${randomInt(100000, 999999)}`;
  
  // Generate 1-5 items per transaction
  const itemCount = randomInt(1, 5);
  const items = [];
  let total = 0;
  
  // Weight: beverages more common as add-ons
  for (let i = 0; i < itemCount; i++) {
    // 70% beverages if > 1 item (add-on), else balanced
    let pool = PRODUCTS;
    if (i > 0 && items.length > 0) {
      const beverages = PRODUCTS.filter(p => p.category === 'Beverages');
      pool = Math.random() < 0.7 ? beverages : PRODUCTS;
    }
    
    const product = randomChoice(pool);
    const qty = i === 0 ? 1 : randomInt(1, 2); // First item qty=1
    const amount = parseFloat((product.sell * qty).toFixed(2));
    
    items.push({
      sku: product.sku,
      name: product.name,
      quantity: qty,
      unit_price: product.sell,
      amount: amount
    });
    
    total += amount;
  }
  
  const timestamp = new Date().toISOString();
  const hour = new Date(timestamp).getHours();
  
  // Payment methods weighted by time of day
  let paymentMethods = ['cash', 'card', 'qr_code', 'ewallet'];
  let paymentWeights = [25, 20, 40, 15];
  
  // Lunch/dinner = more card/qr
  if ((hour >= 11 && hour <= 14) || (hour >= 18 && hour <= 21)) {
    paymentWeights = [15, 25, 45, 15];
  }
  
  const paymentMethod = randomChoice(
    paymentMethods.filter((_, i) => paymentWeights[i] > 0)
  );
  
  return {
    outlet_id: outletId,
    transaction_id: transactionId,
    items: items,
    subtotal: parseFloat(total.toFixed(2)),
    tax: parseFloat((total * 0.08).toFixed(2)), // GST 8%
    service_charge: parseFloat((total * 0.1).toFixed(2)), // 10% SC
    total: parseFloat((total * 1.18).toFixed(2)), // Inclusive GST+SC
    payment_method: paymentMethod,
    platform: randomChoice(['dine_in', 'takeaway', 'delivery']),
    customer_count: randomInt(1, 4),
    timestamp: timestamp
  };
}

// ── Main Functions ────────────────────────────────────────────────────────────
async function seedAllSGOutlets() {
  console.log('\n🌱 SEEDING INVENTORY FOR ALL SG OUTLETS\n');
  console.log('═'.repeat(50));
  
  for (const outletId of SG_OUTLETS) {
    await seedInventory(outletId);
  }
  
  console.log('\n✅ All SG outlets seeded!');
}

async function runSingleSale(outletId, dryRun = false) {
  const sale = generateSale(outletId);
  
  console.log('\n💰 SALE TRANSACTION');
  console.log('─'.repeat(50));
  console.log(`Outlet: ${sale.outlet_id}`);
  console.log(`TXN: ${sale.transaction_id}`);
  console.log(`Time: ${sale.timestamp}`);
  console.log('\nItems:');
  
  for (const item of sale.items) {
    console.log(`  • ${item.name} x${item.quantity} = S$${item.amount.toFixed(2)}`);
  }
  
  console.log(`\nSubtotal: S$${sale.subtotal.toFixed(2)}`);
  console.log(`GST (8%): S$${sale.tax.toFixed(2)}`);
  console.log(`Service (10%): S$${sale.service_charge.toFixed(2)}`);
  console.log(`TOTAL: S$${sale.total.toFixed(2)}`);
  console.log(`Payment: ${sale.payment_method}`);
  
  if (dryRun) {
    console.log('\n🔍 DRY RUN - Not sending to webhook');
    console.log('\nInventory deduction (simulated):');
    for (const item of sale.items) {
      console.log(`  - ${item.sku}: -${item.quantity}`);
    }
    return;
  }
  
  // Send to webhook
  console.log('\n📤 Sending to webhook...');
  const result = await sendWebhook(sale);
  
  if (result.status === 200 || result.status === 201) {
    console.log(`✅ Webhook accepted (${result.status})`);
    
    // Deduct inventory
    console.log('\n📦 Updating inventory...');
    const invResult = await updateInventory(outletId, sale.items);
    
    if (invResult) {
      console.log('\nInventory changes:');
      for (const d of invResult.deducted) {
        console.log(`  ${d.sku}: ${d.stockBefore} → ${d.stockAfter} (-${d.qty})`);
      }
      
      if (invResult.lowStock.length > 0) {
        console.log(`\n⚠️ LOW STOCK ALERT:`);
        for (const sku of invResult.lowStock) {
          console.log(`  🔶 ${sku} - below minimum stock!`);
        }
      }
      
      if (invResult.outOfStock.length > 0) {
        console.log(`\n🚨 OUT OF STOCK:`);
        for (const sku of invResult.outOfStock) {
          console.log(`  🔴 ${sku} - SOLD OUT!`);
        }
      }
    }
  } else {
    console.log(`❌ Webhook failed: ${result.status} - ${result.body}`);
  }
}

async function runSimulation(intervalSeconds = 10, count = 0) {
  console.log('\n🚀 STARTING UNIFIED POS + INVENTORY SIMULATION');
  console.log('═'.repeat(50));
  console.log(`Outlets: ${SG_OUTLETS.length} SG outlets`);
  console.log(`Interval: ${intervalSeconds}s`);
  console.log(`Count: ${count || '∞ (infinite)'}`);
  console.log('═'.repeat(50));
  console.log('\nPress Ctrl+C to stop\n');
  
  let totalSales = 0;
  let totalRevenue = 0;
  let lowStockAlerts = 0;
  let outOfStockAlerts = 0;
  
  while (true) {
    // Random outlet
    const outletId = randomChoice(SG_OUTLETS);
    
    const sale = generateSale(outletId);
    totalSales++;
    totalRevenue += sale.total;
    
    // Console output
    const time = new Date().toLocaleTimeString();
    const icon = sale.items.length > 2 ? '🛒' : '💰';
    console.log(`${icon} [${time}] ${sale.transaction_id}`);
    console.log(`   Outlet ${outletId} | ${sale.items.length} items | S$${sale.total.toFixed(2)} | ${sale.payment_method}`);
    
    // Send to webhook
    const result = await sendWebhook(sale);
    
    if (result.status === 200 || result.status === 201) {
      // Deduct inventory
      const invResult = await updateInventory(outletId, sale.items);
      
      if (invResult) {
        if (invResult.lowStock.length > 0) {
          lowStockAlerts++;
          console.log(`   ⚠️ LOW STOCK: ${invResult.lowStock.join(', ')}`);
        }
        if (invResult.outOfStock.length > 0) {
          outOfStockAlerts++;
          console.log(`   🚨 OUT OF STOCK: ${invResult.outOfStock.join(', ')}`);
        }
      }
    } else {
      console.log(`   ❌ Webhook failed: ${result.status}`);
    }
    
    // Progress
    if (totalSales % 10 === 0) {
      console.log('\n📊 STATS:');
      console.log(`   Total Sales: ${totalSales}`);
      console.log(`   Total Revenue: S$${totalRevenue.toFixed(2)}`);
      console.log(`   Avg Ticket: S$${(totalRevenue / totalSales).toFixed(2)}`);
      console.log(`   Low Stock Alerts: ${lowStockAlerts}`);
      console.log(`   Out of Stock: ${outOfStockAlerts}`);
      console.log('─'.repeat(50));
    }
    
    if (count > 0 && totalSales >= count) {
      break;
    }
    
    await new Promise(r => setTimeout(r, intervalSeconds * 1000));
  }
  
  console.log('\n✅ SIMULATION COMPLETE');
  console.log('═'.repeat(50));
  console.log(`Total Sales: ${totalSales}`);
  console.log(`Total Revenue: S$${totalRevenue.toFixed(2)}`);
}

// ── CLI Interface ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const command = args[0] || '--help';

async function main() {
  switch (command) {
    case '--seed':
      await seedAllSGOutlets();
      break;
      
    case '--sale': {
      const outletId = parseInt(args[1]) || randomChoice(SG_OUTLETS);
      const dryRun = args.includes('--dry-run');
      await runSingleSale(outletId, dryRun);
      break;
    }
    
    case '--run': {
      const interval = parseInt(args.find(a => a.startsWith('--interval='))?.split('=')[1]) || 10;
      const count = parseInt(args.find(a => a.startsWith('--count='))?.split('=')[1]) || 0;
      await runSimulation(interval, count);
      break;
    }
    
    case '--dry-run': {
      const outletId = parseInt(args[1]) || randomChoice(SG_OUTLETS);
      await runSingleSale(outletId, true);
      break;
    }
    
    default:
      console.log(`
╔══════════════════════════════════════════════════════════╗
║     CyberQuote Unified POS + Inventory Simulator         ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  Commands:                                              ║
║                                                          ║
║  --seed              Seed inventory for all SG outlets   ║
║                                                          ║
║  --sale [outlet]    Generate single sale               ║
║                       outlet: 164,165,167,168,etc       ║
║                       default: random SG outlet           ║
║                                                          ║
║  --sale 200 --dry-run  Preview sale without sending     ║
║                                                          ║
║  --run               Continuous simulation               ║
║  --run --interval=5  Every 5 seconds                   ║
║  --run --count=10   10 sales then stop                 ║
║                                                          ║
║  --dry-run [outlet] Preview sale (no webhook)          ║
║                                                          ║
║  SG Outlets (region_id = 114):                         ║
║    164, 165, 167, 168, 169, 170, 171,               ║
║    200, 201, 202                                      ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
`);
  }
}

main().catch(console.error);
