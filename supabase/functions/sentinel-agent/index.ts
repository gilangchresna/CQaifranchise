/**
 * Sentinel Agent
 * Monitors system health, data quality, and triggers alerts for anomalies
 * 
 * Runs: Daily
 * Creates: alerts, compliance_flags, audit_log
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const checks: string[] = [];
    const alerts: any[] = [];
    const complianceFlags: any[] = [];

    // 1. Check for missing daily transactions (data gap detection)
    const dataQualityCheck = await checkDataQuality(supabase);
    checks.push(dataQualityCheck.message);
    alerts.push(...dataQualityCheck.alerts);

    // 2. Check for low inventory items
    const inventoryCheck = await checkInventory(supabase);
    checks.push(inventoryCheck.message);
    alerts.push(...inventoryCheck.alerts);

    // 3. Check for SLA breaches on cases
    const slaCheck = await checkSLA(supabase);
    checks.push(slaCheck.message);
    complianceFlags.push(...slaCheck.flags);

    // 4. Check for outlier transactions
    const transactionCheck = await checkTransactionAnomalies(supabase);
    checks.push(transactionCheck.message);
    alerts.push(...transactionCheck.alerts);

    // Insert alerts
    if (alerts.length > 0) {
      await supabase.from("alerts").insert(alerts.map(a => ({
        outlet_id: a.outlet_id,
        type: a.type,
        severity: a.severity,
        title: a.title,
        description: a.description,
        status: "open",
        triggered_at: new Date().toISOString(),
      })));
    }

    // Insert compliance flags
    if (complianceFlags.length > 0) {
      await supabase.from("compliance_flags").insert(complianceFlags);
    }

    // Audit log
    await supabase.from("audit_log").insert({
      action: "sentinel_check_complete",
      entity_type: "system",
      entity_id: null,
      user_id: "system",
      metadata: { checks, alerts_created: alerts.length, flags_created: complianceFlags.length },
    });

    return new Response(JSON.stringify({
      success: true,
      checks: checks.length,
      alerts_created: alerts.length,
      compliance_flags: complianceFlags.length,
      message: "Sentinel check complete"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Sentinel error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function checkDataQuality(supabase: any) {
  const alerts: any[] = [];
  
  // Check if we have transactions today
  const today = new Date().toISOString().split("T")[0];
  const { count } = await supabase
    .from("sales_transactions")
    .select("*", { count: "exact", head: true })
    .gte("date", today);

  if (count === 0) {
    alerts.push({
      outlet_id: null,
      type: "data_gap",
      severity: "high",
      title: "No transactions recorded today",
      description: "System has not received any POS transactions today. Check POS connectivity.",
    });
  }

  return {
    message: `Data quality check: ${count || 0} transactions today`,
    alerts,
  };
}

async function checkInventory(supabase: any) {
  const alerts: any[] = [];
  
  // Check for outlets with high percentage of low stock items
  const { data: inventory } = await supabase
    .from("inventory")
    .select("outlet_id, current_stock, min_stock")
    .lt("current_stock", 10); // Critical low

  if (inventory && inventory.length > 0) {
    // Group by outlet
    const byOutlet: Record<number, number> = {};
    for (const inv of inventory) {
      byOutlet[inv.outlet_id] = (byOutlet[inv.outlet_id] || 0) + 1;
    }

    for (const [outletId, count] of Object.entries(byOutlet)) {
      if (count >= 5) {
        alerts.push({
          outlet_id: parseInt(outletId),
          type: "low_stock",
          severity: count >= 10 ? "high" : "medium",
          title: "Critical inventory depletion",
          description: `${count} items below 10 units. Risk of stockout within 3 days.`,
        });
      }
    }
  }

  return {
    message: `Inventory check: ${inventory?.length || 0} critical low items`,
    alerts,
  };
}

async function checkSLA(supabase: any) {
  const flags: any[] = [];
  
  // Check for cases past SLA deadline
  const now = new Date().toISOString();
  const { data: breachedCases } = await supabase
    .from("cases")
    .select("id, outlet_id, priority, sla_deadline, status")
    .lt("sla_deadline", now)
    .neq("status", "resolved")
    .neq("status", "closed");

  if (breachedCases && breachedCases.length > 0) {
    for (const c of breachedCases.slice(0, 10)) {
      flags.push({
        outlet_id: c.outlet_id,
        flag_type: "sla_breach",
        severity: c.priority === "URGENT" ? "high" : "medium",
        description: `Case ${c.id} past SLA deadline. Priority: ${c.priority}`,
        flagged_at: now,
      });
    }
  }

  return {
    message: `SLA check: ${breachedCases?.length || 0} breached cases`,
    flags,
  };
}

async function checkTransactionAnomalies(supabase: any) {
  const alerts: any[] = [];
  
  // Check for unusually high transactions (potential fraud/data error)
  const today = new Date().toISOString().split("T")[0];
  const { data: highTxns } = await supabase
    .from("sales_transactions")
    .select("id, outlet_id, amount")
    .gte("date", today)
    .gt("amount", 10000); // > $10,000 in single transaction

  if (highTxns && highTxns.length > 0) {
    for (const txn of highTxns) {
      alerts.push({
        outlet_id: txn.outlet_id,
        type: "transaction_outlier",
        severity: "medium",
        title: "Unusually high transaction",
        description: `Transaction ${txn.id}: $${txn.amount} - exceeds $10,000 threshold`,
      });
    }
  }

  return {
    message: `Transaction check: ${highTxns?.length || 0} outliers`,
    alerts,
  };
}
