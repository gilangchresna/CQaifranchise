/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // Get all outlets
    const { data: outlets, error: outletsError } = await supabase
      .from("outlets")
      .select("id, code, name");

    if (outletsError || !outlets || outlets.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: "No outlets found. Run seed-singapore first."
      }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    // Clear existing historical data first (keep recent)
    console.log("Clearing existing historical data...");
    await supabase.from("sales_transactions").delete().neq("id", 0);
    await new Promise(r => setTimeout(r, 1000));

    // Singapore F&B products with realistic prices
    const products = [
      { name: "Nasi Lemak Set", price: 6.50, cost: 2.60 },
      { name: "Chicken Rice Set", price: 5.50, cost: 2.20 },
      { name: "Laksa", price: 5.00, cost: 2.00 },
      { name: "Kaya Toast Set", price: 4.50, cost: 1.80 },
      { name: "Roti Prata (2 pcs)", price: 4.00, cost: 1.60 },
      { name: "Milo (Large)", price: 3.50, cost: 1.40 },
      { name: "Kopi-O Kosong", price: 2.50, cost: 1.00 },
      { name: "Teh Tarik", price: 3.00, cost: 1.20 },
    ];

    // Payment methods distribution
    const paymentMethods = [
      { method: 'cash', weight: 25 },
      { method: 'qrcode', weight: 35 },
      { method: 'card', weight: 15 },
      { method: 'gofood', weight: 15 },
      { method: 'grabfood', weight: 10 },
    ];

    const staffIds = ['STF001', 'STF002', 'STF003', 'STF004', 'STF005'];

    // Helper: get weighted random
    function getWeightedRandom(items: { method: string; weight: number }[]): string {
      const total = items.reduce((sum, item) => sum + item.weight, 0);
      let random = Math.random() * total;
      for (const item of items) {
        random -= item.weight;
        if (random <= 0) return item.method;
      }
      return items[0].method;
    }

    // Generate unique ID
    let txCounter = Date.now();
    function genTxId(): string {
      return `H-${txCounter++}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    }

    // Generate 7 months of data (Jan 2026 - Jul 2026)
    const startDate = new Date('2026-01-01');
    const endDate = new Date('2026-07-25');
    
    let totalTransactions = 0;
    let totalRevenue = 0;
    let batches = 0;
    let currentBatch: Record<string, unknown>[] = [];
    const BATCH_SIZE = 100;

    const insertBatch = async (batch: Record<string, unknown>[]) => {
      const { error, count } = await supabase
        .from("sales_transactions")
        .insert(batch);
      
      if (error) {
        console.log(`Batch ${batches} error: ${error.message}`);
      } else {
        totalTransactions += batch.length;
      }
      batches++;
    };

    // Process each day
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayOfWeek = currentDate.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const weekendMultiplier = isWeekend ? 1.3 : 1.0;

      for (const outlet of outlets) {
        const baseTransactions = Math.floor(Math.random() * 25) + 15;
        const transactionsCount = Math.floor(baseTransactions * weekendMultiplier);

        for (let i = 0; i < transactionsCount; i++) {
          const product = products[Math.floor(Math.random() * products.length)];
          const paymentMethod = getWeightedRandom(paymentMethods);
          const isDelivery = ['gofood', 'grabfood'].includes(paymentMethod);

          const qty = Math.floor(Math.random() * 3) + 1;
          const amount = product.price * qty;
          const discount = Math.random() > 0.9 ? amount * 0.1 : 0;
          const tax = (amount - discount) * 0.09;
          const cost = product.cost * qty;
          const netAmount = amount - discount + tax;
          const platformFee = isDelivery ? netAmount * 0.23 : 0;
          const settlementAmount = netAmount - platformFee;
          const hour = Math.floor(Math.random() * 14) + 7;

          currentBatch.push({
            transaction_id: genTxId(),
            outlet_id: outlet.id,
            date: dateStr,
            amount,
            transaction_count: qty,
            hour,
            day_of_week: dayOfWeek,
            payment_method: paymentMethod,
            customer_id: Math.random() > 0.7 ? `CUST${Math.floor(Math.random() * 1000).toString().padStart(4, '0')}` : null,
            staff_id: staffIds[Math.floor(Math.random() * staffIds.length)],
            discount,
            tax,
            cost,
            net_amount: netAmount,
            platform: isDelivery ? paymentMethod : 'dine_in',
            platform_order_id: isDelivery ? `${paymentMethod.toUpperCase()}-${Math.random().toString(36).substring(7).toUpperCase()}` : null,
            platform_fee: platformFee,
            settlement_amount: settlementAmount,
          });

          totalRevenue += settlementAmount;

          if (currentBatch.length >= BATCH_SIZE) {
            await insertBatch(currentBatch);
            currentBatch = [];
          }
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);

      const daysElapsed = Math.floor((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysElapsed % 30 === 0) {
        console.log(`Progress: Day ${daysElapsed}/206, Inserted: ${totalTransactions}`);
      }
    }

    if (currentBatch.length > 0) {
      await insertBatch(currentBatch);
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Seeded ${totalTransactions.toLocaleString()} transactions`,
      summary: {
        outlets: outlets.length,
        date_range: { start: '2026-01-01', end: '2026-07-25' },
        total_transactions: totalTransactions,
        total_revenue_sgd: Math.round(totalRevenue * 100) / 100,
        batches: batches
      }
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("Seed Error:", err);
    return new Response(JSON.stringify({
      success: false,
      error: "Seed failed",
      details: err instanceof Error ? err.message : String(err)
    }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
