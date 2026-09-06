/**
 * Cleanup & Seed Script
 * Run: POST to /functions/v1/seed-clean
 *
 * 1. Deletes all transaction/task data
 * 2. Seeds clean demo data
 * 3. Disables agent tasks
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth, isAtLeastRole, unauthorizedResponse, forbiddenResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // SECURITY: HQ_ADMIN only
  const auth = await verifyAuth(req);
  if (!auth.success || !auth.user) {
    return unauthorizedResponse(auth.error);
  }
  if (!isAtLeastRole(auth.user, 'HQ_ADMIN')) {
    return forbiddenResponse('HQ_ADMIN required');
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const results: any = { steps: [] };

  try {
    // ============================================================
    // STEP 1: Delete transaction/task data
    // ============================================================
    console.log('🗑️ Cleaning up data...');

    // Delete agent tasks
    const { error: tasksErr } = await supabase.from('agent_tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    results.steps.push({ step: 'agent_tasks', deleted: !tasksErr, error: tasksErr?.message });

    // Delete agent logs
    const { error: logsErr } = await supabase.from('agent_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    results.steps.push({ step: 'agent_logs', deleted: !logsErr, error: logsErr?.message });

    // Delete agent metrics
    const { error: metricsErr } = await supabase.from('agent_metrics').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    results.steps.push({ step: 'agent_metrics', deleted: !metricsErr, error: metricsErr?.message });

    // Delete alerts
    const { error: alertsErr } = await supabase.from('alerts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    results.steps.push({ step: 'alerts', deleted: !alertsErr, error: alertsErr?.message });

    // Delete cases
    const { error: casesErr } = await supabase.from('cases').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    results.steps.push({ step: 'cases', deleted: !casesErr, error: casesErr?.message });

    // Delete notifications
    const { error: notifErr } = await supabase.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    results.steps.push({ step: 'notifications', deleted: !notifErr, error: notifErr?.message });

    // Delete notification logs
    const { error: notifLogErr } = await supabase.from('notification_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    results.steps.push({ step: 'notification_logs', deleted: !notifLogErr, error: notifLogErr?.message });

    // Delete sales transactions (keep structure)
    const { error: salesErr } = await supabase.from('sales_transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    results.steps.push({ step: 'sales_transactions', deleted: !salesErr, error: salesErr?.message });

    // Delete ml_anomaly_scores
    const { error: anomalyErr } = await supabase.from('ml_anomaly_scores').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    results.steps.push({ step: 'ml_anomaly_scores', deleted: !anomalyErr, error: anomalyErr?.message });

    // Delete ml_stockout_risk
    const { error: stockoutErr } = await supabase.from('ml_stockout_risk').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    results.steps.push({ step: 'ml_stockout_risk', deleted: !stockoutErr, error: stockoutErr?.message });

    // Delete workflow instances
    const { error: wfErr } = await supabase.from('workflow_instances').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    results.steps.push({ step: 'workflow_instances', deleted: !wfErr, error: wfErr?.message });

    // Delete workflow steps
    const { error: wfStepErr } = await supabase.from('workflow_steps').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    results.steps.push({ step: 'workflow_steps', deleted: !wfStepErr, error: wfStepErr?.message });

    // ============================================================
    // STEP 2: Seed Clean Demo Data
    // ============================================================
    console.log('📦 Seeding clean data...');

    // Seed 5 Singapore outlets with realistic data
    const sgOutlets = [
      { id: 156, region_id: 104, code: "KT-TMP-001", name: "Kopitiam @ Tampines Mall", status: "ACTIVE", daily_target: 2500 },
      { id: 157, region_id: 107, code: "CR-JGP-001", name: "Chicken Rice @ Jurong Point", status: "ACTIVE", daily_target: 2800 },
      { id: 158, region_id: 104, code: "NL-AMK-001", name: "Nasi Lemak @ AMK Hub", status: "ACTIVE", daily_target: 2200 },
      { id: 159, region_id: 106, code: "LK-PLB-001", name: "Laksa King @ Paya Lebar", status: "ACTIVE", daily_target: 2400 },
      { id: 160, region_id: 107, code: "KT-CMT-001", name: "Kaya Toast @ Clementi Mall", status: "ACTIVE", daily_target: 2300 },
    ];

    const { error: outletErr } = await supabase.from('outlets').upsert(sgOutlets, { onConflict: 'id' });
    results.steps.push({ step: 'seed_outlets', success: !outletErr, error: outletErr?.message });

    // Seed inventory for each outlet
    const menuItems = [
      { name: "Kopi", unit: "cups", min_stock: 50 },
      { name: "Teh", unit: "cups", min_stock: 50 },
      { name: "Roti", unit: "pieces", min_stock: 30 },
      { name: "Nasi", unit: "kg", min_stock: 20 },
      { name: "Ayam", unit: "kg", min_stock: 15 },
      { name: "Laksa", unit: "portions", min_stock: 40 },
      { name: "Mie", unit: "kg", min_stock: 25 },
    ];

    const inventoryItems: any[] = [];
    for (const outlet of sgOutlets) {
      for (let i = 0; i < menuItems.length; i++) {
        const item = menuItems[i];
        // Random stock between 50-100% of target
        const stockPct = 0.5 + Math.random() * 0.5;
        const currentStock = Math.round(item.min_stock * stockPct);
        inventoryItems.push({
          outlet_id: outlet.id,
          item_name: item.name,
          item_code: `${outlet.code}-${String(i + 1).padStart(3, '0')}`,
          current_stock: currentStock,
          min_stock: item.min_stock,
          max_stock: item.min_stock * 3,
          unit: item.unit,
          category: "Food & Beverage",
          last_restocked: new Date(Date.now() - Math.random() * 7 * 86400000).toISOString(),
        });
      }
    }

    // Delete existing inventory for these outlets
    await supabase.from('inventory').delete().in('outlet_id', sgOutlets.map(o => o.id));
    const { error: invErr } = await supabase.from('inventory').insert(inventoryItems);
    results.steps.push({ step: 'seed_inventory', count: inventoryItems.length, success: !invErr, error: invErr?.message });

    // Seed 30 days of sales data
    const salesData: any[] = [];
    const today = new Date();
    for (const outlet of sgOutlets) {
      for (let dayOffset = 30; dayOffset >= 0; dayOffset--) {
        const saleDate = new Date(today.getTime() - dayOffset * 86400000);
        const dateStr = saleDate.toISOString().split('T')[0];

        // Skip Sundays for some outlets
        if (saleDate.getDay() === 0 && Math.random() > 0.3) continue;

        // 3-5 transactions per day
        const numTx = 3 + Math.floor(Math.random() * 3);
        for (let tx = 0; tx < numTx; tx++) {
          const hour = 9 + Math.floor(Math.random() * 10); // 9 AM - 7 PM
          const minute = Math.floor(Math.random() * 60);
          const txTime = new Date(saleDate.getTime() + hour * 3600000 + minute * 60000);

          const amount = outlet.daily_target * (0.8 + Math.random() * 0.4) / numTx;
          const cost = amount * 0.35;

          salesData.push({
            outlet_id: outlet.id,
            date: dateStr,
            transaction_time: txTime.toISOString(),
            amount: Math.round(amount * 100) / 100,
            settlement_amount: Math.round(amount * 0.98 * 100) / 100, // 2% platform fee
            cost: Math.round(cost * 100) / 100,
            currency_code: "SGD",
            payment_method: Math.random() > 0.3 ? "BANK_TRANSFER" : "CASH",
            platform: Math.random() > 0.5 ? "Grab" : "foodpanda",
            transaction_count: Math.floor(1 + Math.random() * 3),
          });
        }
      }
    }

    const { error: salesErr2 } = await supabase.from('sales_transactions').insert(salesData);
    results.steps.push({ step: 'seed_sales', count: salesData.length, success: !salesErr2, error: salesErr2?.message });

    // ============================================================
    // STEP 3: Disable/Configure Agent Tasks
    // ============================================================
    console.log('🤖 Configuring agent tasks...');

    // Create sample agent tasks (just 3-5 for demo)
    const sampleTasks = [
      { agent_id: 'monitor', task_type: 'anomaly_check', status: 'completed', priority: 2, description: 'Daily sales anomaly scan' },
      { agent_id: 'analyst', task_type: 'stockout_predict', status: 'completed', priority: 3, description: 'Inventory stockout prediction' },
      { agent_id: 'triage', task_type: 'alert_triage', status: 'pending', priority: 1, description: 'Alert prioritization check' },
    ];

    const taskInserts = sampleTasks.map((t, i) => ({
      ...t,
      input_data: { created_by: 'system', demo: true },
      created_at: new Date(Date.now() - i * 60000).toISOString(),
      started_at: new Date(Date.now() - i * 60000 + 1000).toISOString(),
      completed_at: t.status === 'completed' ? new Date(Date.now() - i * 60000 + 5000).toISOString() : null,
    }));

    const { error: taskErr } = await supabase.from('agent_tasks').insert(taskInserts);
    results.steps.push({ step: 'seed_agent_tasks', count: taskInserts.length, success: !taskErr, error: taskErr?.message });

    // Create agent logs
    const logs = [
      { agent_id: 'coordinator', log_level: 'info', message: 'System initialized - clean data loaded', metadata: { event: 'init' } },
      { agent_id: 'monitor', log_level: 'info', message: 'Anomaly detection completed', metadata: { anomalies: 0 } },
      { agent_id: 'analyst', log_level: 'info', message: 'Stockout analysis completed', metadata: { predictions: 5 } },
    ];

    const { error: logErr } = await supabase.from('agent_logs').insert(logs);
    results.steps.push({ step: 'seed_agent_logs', count: logs.length, success: !logErr, error: logErr?.message });

    // ============================================================
    // STEP 4: Summary
    // ============================================================
    const salesCount = salesData.length;
    const inventoryCount = inventoryItems.length;
    const outletCount = sgOutlets.length;

    results.summary = {
      outlets: outletCount,
      inventory_items: inventoryCount,
      sales_transactions: salesCount,
      agent_tasks: taskInserts.length,
      message: 'Clean data seeded successfully!',
    };

    console.log('✅ Cleanup & seed complete:', results.summary);

    return new Response(JSON.stringify({
      success: true,
      ...results,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      ...results,
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
