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
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env.local
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
} catch (e) {
  // .env.local not found, use env vars
}

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
    
    // Check if exists first
    const { data: existing } = await supabase
      .from('inventory')
      .select('id')
      .eq('outlet_id', outletId)
      .eq('sku', product.sku)
      .single();
    
    if (existing) {
      // Update
      const { error } = await supabase
        .from('inventory')
        .update({
          product_name: product.name,
          category: product.category,
          current_stock: currentStock,
          min_stock: product.stock_min,
          max_stock: product.stock_max,
          unit: product.unit,
          updated_at: new Date().toISOString()
        })
        .eq('outlet_id', outletId)
        .eq('sku', product.sku);
      
      if (error) {
        console.log(`  ❌ ${product.name}: ${error.message}`);
      } else {
        console.log(`  ✅ ${product.name}: ${currentStock} ${product.unit} (updated)`);
      }
    } else {
      // Insert
      const { error } = await supabase
        .from('inventory')
        .insert({
          outlet_id: outletId,
          sku: product.sku,
          product_name: product.name,
          category: product.category,
          current_stock: currentStock,
          min_stock: product.stock_min,
          max_stock: product.stock_max,
          unit: product.unit,
          updated_at: new Date().toISOString()
        });
      
      if (error) {
        console.log(`  ❌ ${product.name}: ${error.message}`);
      } else {
        console.log(`  ✅ ${product.name}: ${currentStock} ${product.unit}`);
      }
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
    
    const newStock = Math.max(0, current.current_stock - item.quantity);
    
    // Update stock
    await supabase
      .from('inventory')
      .update({ 
        current_stock: newStock,
        updated_at: new Date().toISOString()
      })
      .eq('outlet_id', outletId)
      .eq('sku', item.sku);
    
    results.deducted.push({
      sku: item.sku,
      name: current.product_name,
      qty: item.quantity,
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
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
        'x-pos-signature': signature,
        'x-pos-dev-bypass': 'dev-mode-2026' // Dev bypass for testing
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
// Staff cache for performance
let staffCache = new Map();

async function fetchStaffForOutlet(outletId) {
  if (!supabase) return [];
  
  if (staffCache.has(outletId)) {
    return staffCache.get(outletId);
  }
  
  const { data, error } = await supabase
    .from('staff')
    .select('id, name')
    .eq('outlet_id', outletId);
  
  if (error) {
    console.log(`⚠️ Error fetching staff for outlet ${outletId}: ${error.message}`);
    return [];
  }
  
  staffCache.set(outletId, data || []);
  return data || [];
}

function generateSale(outletId, staffMember = null) {
  const transactionId = `TXN-${Date.now()}-${outletId}-${randomInt(100000, 999999)}`;
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay();
  
  // Generate 1-5 items per transaction
  const itemCount = randomInt(1, 5);
  const items = [];
  let subtotal = 0;
  
  // Weight: beverages more common as add-ons
  for (let i = 0; i < itemCount; i++) {
    let pool = PRODUCTS;
    if (i > 0 && items.length > 0) {
      const beverages = PRODUCTS.filter(p => p.category === 'Beverages');
      pool = Math.random() < 0.7 ? beverages : PRODUCTS;
    }
    
    const product = randomChoice(pool);
    const qty = i === 0 ? 1 : randomInt(1, 2);
    const sellPrice = product.sell;
    const costPrice = product.cost;
    
    items.push({
      sku: product.sku,
      name: product.name,
      quantity: qty,
      sell_price: sellPrice,
      cost_price: costPrice,
      amount: sellPrice * qty
    });
    
    subtotal += sellPrice * qty;
  }
  
  // Calculate totals
  const discount = 0; // No discount for now
  const tax = parseFloat((subtotal * 0.08).toFixed(2)); // GST 8%
  const serviceCharge = parseFloat((subtotal * 0.10).toFixed(2)); // 10% SC
  const grossAmount = subtotal + discount;
  const totalAmount = parseFloat((grossAmount + tax + serviceCharge).toFixed(2));
  const cost = parseFloat((items.reduce((sum, item) => sum + (item.cost_price * item.quantity), 0)).toFixed(2));
  const netAmount = parseFloat((totalAmount - cost).toFixed(2));
  
  // Platform fee (2.5% for delivery platforms)
  const paymentMethod = randomChoice(['cash', 'card', 'qrcode', 'ewallet']);
  // Valid platforms: dine_in, gofood, grabfood, shopeefood, pos
  const platform = paymentMethod === 'cash' || paymentMethod === 'card' 
    ? 'dine_in' 
    : randomChoice(['dine_in', 'gofood', 'grabfood', 'shopeefood']);
  const platformFee = platform !== 'dine_in' ? parseFloat((totalAmount * 0.025).toFixed(2)) : 0;
  const settlementAmount = parseFloat((totalAmount - platformFee).toFixed(2));
  
  return {
    outlet_id: outletId,
    transaction_id: transactionId,
    date: now.toISOString().split('T')[0],
    amount: totalAmount,
    subtotal: subtotal,
    currency_code: 'SGD',
    transaction_count: 1,
    hour: hour,
    day_of_week: dayOfWeek,
    payment_method: paymentMethod,
    platform: platform,
    discount: discount,
    tax: tax,
    cost: cost,
    net_amount: netAmount,
    serviceCharge: serviceCharge,
    platform_fee: platformFee,
    settlement_amount: settlementAmount,
    // Staff ID - use real staff.id from staff table
    staff_id: staffMember ? String(staffMember.id) : null,
    items: items, // For inventory deduction
    timestamp: now.toISOString()
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
  // Fetch a random staff member for this outlet
  const staffMembers = await fetchStaffForOutlet(outletId);
  const randomStaff = staffMembers.length > 0 
    ? staffMembers[Math.floor(Math.random() * staffMembers.length)]
    : null;
  
  const sale = generateSale(outletId, randomStaff);
  
  console.log('\n💰 SALE TRANSACTION');
  console.log('─'.repeat(50));
  console.log(`Outlet: ${sale.outlet_id}`);
  console.log(`TXN: ${sale.transaction_id}`);
  console.log(`Date: ${sale.date} ${sale.hour}:00`);
  console.log(`Staff: ${randomStaff ? `${randomStaff.name} (ID: ${randomStaff.id})` : 'None'}`);
  console.log('\nItems:');
  
  for (const item of sale.items) {
    console.log(`  • ${item.name} x${item.quantity} = S$${item.amount.toFixed(2)}`);
  }
  
  console.log(`\nSubtotal (calculated): S$${sale.subtotal}`);
  console.log(`Tax (8%): S$${sale.tax}`);
  console.log(`Service (10%): S$${sale.serviceCharge}`);
  console.log(`TOTAL: S$${sale.amount}`);
  console.log(`Payment: ${sale.payment_method}`);
  console.log(`Platform: ${sale.platform}`);
  
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
        console.log(`  ${d.name}: ${d.stockBefore} → ${d.stockAfter} (-${d.qty})`);
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
    
    // Fetch random staff for this outlet
    const staffMembers = await fetchStaffForOutlet(outletId);
    const randomStaff = staffMembers.length > 0
      ? staffMembers[Math.floor(Math.random() * staffMembers.length)]
      : null;
    
    const sale = generateSale(outletId, randomStaff);
    totalSales++;
    totalRevenue += sale.amount;
    
    // Console output
    const time = new Date().toLocaleTimeString();
    const icon = sale.items.length > 2 ? '🛒' : '💰';
    console.log(`${icon} [${time}] ${sale.transaction_id}`);
    console.log(`   Outlet ${outletId} | Staff: ${randomStaff?.name || 'None'} | ${sale.items.length} items | S$${sale.amount.toFixed(2)}`);
    
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
