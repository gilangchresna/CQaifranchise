// POS Simulator - Generate realistic sales transactions
// For SG region outlets (164-171, 200-202)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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
]

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
]

// Payment methods
const PAYMENT_METHODS = ['cash', 'qrcode', 'card', 'grab', 'foodpanda']

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function generateTransactionId(outletId: number, outletCode: string): string {
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
  const timeStr = now.toISOString().slice(11, 19).replace(/:/g, '')
  const suffix = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `${outletCode}-${dateStr}-T${timeStr}-${suffix}`
}

function generateTransactions(count: number, outletId: number, outletCode: string) {
  const transactions = []
  
  for (let i = 0; i < count; i++) {
    // Random hour between 8 AM and 10 PM
    const hour = randomInt(8, 22)
    const dayOfWeek = new Date().getDay()
    
    // Generate 1-5 items per transaction
    const itemCount = randomInt(1, 5)
    let totalAmount = 0
    let totalCost = 0
    let itemNames: string[] = []
    
    for (let j = 0; j < itemCount; j++) {
      const item = randomChoice(MENU_ITEMS)
      totalAmount += item.price
      totalCost += item.cost
      itemNames.push(item.name)
    }
    
    // Add some variation (+/- 20%)
    const variation = 0.8 + Math.random() * 0.4
    totalAmount = Math.round(totalAmount * variation * 100) / 100
    totalCost = Math.round(totalCost * variation * 100) / 100
    
    const tax = Math.round(totalAmount * 0.07 * 100) / 100
    const netAmount = Math.round((totalAmount + tax) * 100) / 100
    const discount = Math.random() > 0.8 ? Math.round(totalAmount * 0.1 * 100) / 100 : 0
    const platformFee = randomChoice(['grab', 'foodpanda']).includes(randomChoice(['grab', 'foodpanda'])) 
      ? Math.round(totalAmount * 0.25 * 100) / 100 
      : 0
    
    const transaction = {
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
      platform: randomChoice(['dine_in', 'takeaway', 'delivery']),
      platform_order_id: null,
      platform_fee: platformFee,
      settlement_amount: netAmount - discount - platformFee,
      currency_code: 'SGD',
      created_at: new Date().toISOString(),
    }
    
    transactions.push(transaction)
  }
  
  return transactions
}

serve(async (req) => {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Parse request body
    let config = {
      transactions_per_outlet: 5,
      outlets: SG_OUTLETS.map(o => o.id),
    }
    
    if (req.body) {
      const body = await req.json()
      config = { ...config, ...body }
    }
    
    console.log(`Generating POS data: ${config.transactions_per_outlet} tx per outlet`)
    
    // Generate transactions for each outlet
    let totalGenerated = 0
    let allTransactions: any[] = []
    
    for (const outletId of config.outlets) {
      const outlet = SG_OUTLETS.find(o => o.id === outletId)
      if (!outlet) continue
      
      const outletCode = outlet.name
        .split(' ')
        .map(w => w[0])
        .join('')
        .substring(0, 3)
        .toUpperCase()
      
      const transactions = generateTransactions(
        config.transactions_per_outlet,
        outletId,
        outletCode
      )
      
      allTransactions.push(...transactions)
    }
    
    // Batch insert (100 at a time)
    const batchSize = 100
    for (let i = 0; i < allTransactions.length; i += batchSize) {
      const batch = allTransactions.slice(i, i + batchSize)
      const { error } = await supabase
        .from('sales_transactions')
        .insert(batch)
      
      if (error) {
        console.error('Insert error:', error)
      } else {
        totalGenerated += batch.length
      }
    }
    
    console.log(`Generated ${totalGenerated} transactions`)
    
    return new Response(JSON.stringify({
      success: true,
      transactions_generated: totalGenerated,
      outlets_affected: config.outlets.length,
      message: `Generated ${totalGenerated} POS transactions for ${config.outlets.length} outlets`,
    }), {
      headers: { 'Content-Type': 'application/json' },
    })
    
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
