/**
 * Seed All — Unified seeding endpoint
 * POST { "type": "outlet_features" | "historical_sales" | "workflow_data" | "embeddings" | "all" }
 * Auth: HQ_ADMIN required for all types
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth, isAtLeastRole, unauthorizedResponse, forbiddenResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ============================================================
// HELPERS
// ============================================================

function getWeightedRandom<T extends { method: string; weight: number }>(items: T[]): string {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * total;
  for (const item of items) {
    random -= item.weight;
    if (random <= 0) return item.method;
  }
  return items[0].method;
}

// ============================================================
// TYPE: outlet_features
// ============================================================
async function seedOutletFeatures(supabase: any) {
  // Fetch outlet data from outlet_classifications
  const { data: outlets, error: fetchErr } = await supabase
    .from("outlet_classifications")
    .select("outlet_id, outlet_code, region, outlet_type, size_category, location_type, staff_count");

  if (fetchErr) {
    return { success: false, error: `fetch: ${fetchErr.message}` };
  }

  // Compute features per outlet
  const features = (outlets ?? []).map((o: any) => {
    const rm = o.region === "Singapore" ? 1.4 : o.region === "Indonesia" ? 0.7 : 1.0;
    const tm = o.outlet_type === "premium" ? 1.6 : o.outlet_type === "express" ? 0.6 : 1.0;
    const sm = o.size_category === "large" ? 1.5 : o.size_category === "small" ? 0.6 : 1.0;

    const baseRevenue = 1800 * rm * tm * sm;
    const revenue7dAvg = baseRevenue * (0.9 + Math.random() * 0.2);
    const revenue7dStd = baseRevenue * 0.08;
    const staffCount = o.staff_count ?? 8;
    const cost7dAvg = baseRevenue * 0.6;

    return {
      outlet_id: o.outlet_id,
      outlet_code: o.outlet_code,
      revenue_7d_avg: Math.round(revenue7dAvg * 100) / 100,
      revenue_7d_std: Math.round(revenue7dStd * 100) / 100,
      revenue_30d_avg: Math.round(baseRevenue * 0.97 * 100) / 100,
      revenue_30d_std: Math.round(revenue7dStd * 100) / 100,
      revenue_same_hour_avg: Math.round(baseRevenue * 0.12 * 100) / 100,
      revenue_same_dow_avg: Math.round(baseRevenue * 0.14 * 100) / 100,
      cost_7d_avg: Math.round(cost7dAvg * 100) / 100,
      cost_revenue_ratio: 0.60,
      staff_count: staffCount,
      staff_productivity: Math.round((revenue7dAvg / staffCount) * 100) / 100,
      inventory_turnover: Math.round((2.5 + Math.random() * 2.0) * 100) / 100,
      stock_level_pct: Math.round((0.50 + Math.random() * 0.40) * 100) / 100,
      low_stock_items: Math.floor(Math.random() * 5),
      out_of_stock_items: Math.floor(Math.random() * 2),
      region: o.region,
      outlet_type: o.outlet_type,
      location_type: o.location_type,
      computed_at: new Date().toISOString(),
      feature_date: new Date().toISOString().split("T")[0],
    };
  });

  let upserted = 0;
  let upsertErr: string | null = null;
  if (features.length > 0) {
    const { error } = await supabase
      .from("outlet_features")
      .upsert(features, { onConflict: "outlet_id" });
    if (error) upsertErr = error.message;
    else upserted = features.length;
  }

  // Update ml_model_versions
  await supabase.from("ml_model_versions").upsert({
    model_name: "Sales Anomaly Detector",
    model_type: "isolation_forest",
    model_version: "v2.0.0",
    status: "deployed",
    is_production: true,
    training_samples: features.length,
    metrics: { precision: 0.78, recall: 0.72, f1: 0.75, false_positive_rate: 0.12 },
    validation_metrics: { precision: 0.75, recall: 0.70 },
    deployed_at: new Date().toISOString(),
  }, { onConflict: "model_name" });

  return {
    success: !upsertErr,
    upserted,
    outletsFound: outlets?.length ?? 0,
    error: upsertErr,
  };
}

// ============================================================
// TYPE: historical_sales
// ============================================================
async function seedHistoricalSales(supabase: any) {
  const { data: outlets, error: outletsError } = await supabase
    .from("outlets")
    .select("id, code, name");

  if (outletsError || !outlets || outlets.length === 0) {
    return { success: false, error: "No outlets found. Run seed-singapore first." };
  }

  // Clear existing
  await supabase.from("sales_transactions").delete().neq("id", 0);
  await new Promise(r => setTimeout(r, 1000));

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

  const paymentMethods = [
    { method: "cash", weight: 25 },
    { method: "qrcode", weight: 35 },
    { method: "card", weight: 15 },
    { method: "gofood", weight: 15 },
    { method: "grabfood", weight: 10 },
  ];

  const staffIds = ["STF001", "STF002", "STF003", "STF004", "STF005"];
  const BATCH_SIZE = 100;

  const startDate = new Date("2026-01-01");
  const endDate = new Date("2026-07-25");

  let totalTransactions = 0;
  let totalRevenue = 0;
  let batches = 0;
  let currentBatch: any[] = [];
  let txCounter = Date.now();

  function genTxId() {
    return `H-${txCounter++}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  }

  const insertBatch = async (batch: any[]) => {
    const { error } = await supabase.from("sales_transactions").insert(batch);
    if (!error) totalTransactions += batch.length;
    batches++;
  };

  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split("T")[0];
    const dayOfWeek = currentDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const weekendMultiplier = isWeekend ? 1.3 : 1.0;

    for (const outlet of outlets) {
      const transactionsCount = Math.floor((Math.floor(Math.random() * 25) + 15) * weekendMultiplier);

      for (let i = 0; i < transactionsCount; i++) {
        const product = products[Math.floor(Math.random() * products.length)];
        const paymentMethod = getWeightedRandom(paymentMethods);
        const isDelivery = ["gofood", "grabfood"].includes(paymentMethod);
        const qty = Math.floor(Math.random() * 3) + 1;
        const amount = product.price * qty;
        const discount = Math.random() > 0.9 ? amount * 0.1 : 0;
        const tax = (amount - discount) * 0.09;
        const netAmount = amount - discount + tax;
        const platformFee = isDelivery ? netAmount * 0.23 : 0;
        const settlementAmount = netAmount - platformFee;

        currentBatch.push({
          transaction_id: genTxId(),
          outlet_id: outlet.id,
          date: dateStr,
          amount,
          transaction_count: qty,
          hour: Math.floor(Math.random() * 14) + 7,
          day_of_week: dayOfWeek,
          payment_method: paymentMethod,
          staff_id: staffIds[Math.floor(Math.random() * staffIds.length)],
          discount,
          tax,
          cost: product.cost * qty,
          net_amount: netAmount,
          platform: isDelivery ? paymentMethod : "dine_in",
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
  }

  if (currentBatch.length > 0) await insertBatch(currentBatch);

  return {
    success: true,
    message: `Seeded ${totalTransactions.toLocaleString()} transactions`,
    total_transactions: totalTransactions,
    total_revenue_sgd: Math.round(totalRevenue * 100) / 100,
    batches,
  };
}

// ============================================================
// TYPE: workflow_data
// ============================================================
async function seedWorkflowData(supabase: any) {
  const cases = [
    { title: "Investigate Sales Dip @ Tampines", description: "Sales dropped 30% below baseline.", status: "IN_PROGRESS", priority: "HIGH", type: "sales_investigation", outlet_id: 156, region_id: 106 },
    { title: "Restock Chicken Rice @ Jurong", description: "Critical stock level for main ingredient.", status: "NEW", priority: "URGENT", type: "stock_restock", outlet_id: 157, region_id: 107 },
    { title: "Review GoFood Performance", description: "GoFood orders down 20% vs last week.", status: "NEW", priority: "MEDIUM", type: "performance_review", outlet_id: 158, region_id: 104 },
    { title: "Staff Training Required", description: "Customer complaints about service time.", status: "RESOLVED", priority: "LOW", type: "staff_training", outlet_id: 159, region_id: 106 },
  ];

  const alerts = [
    { outlet_id: 156, type: "SALES_ANOMALY", severity: "P1_HIGH", status: "NEW", title: "Sales Anomaly Detected", description: "Sales at Tampines outlet 40% below expected baseline.", score: 0.85, triggered_at: new Date().toISOString() },
    { outlet_id: 157, type: "STOCKOUT_RISK", severity: "P0_CRITICAL", status: "NEW", title: "Critical Stock: Chicken Rice Set", description: "Stock: 8 units, Min: 25 units.", score: 0.95, triggered_at: new Date().toISOString() },
    { outlet_id: 160, type: "STOCKOUT_RISK", severity: "P0_CRITICAL", status: "ACKNOWLEDGED", title: "Critical Stock: Milo", description: "Milo (Large) running low. 11 units remaining.", score: 0.78, triggered_at: new Date(Date.now() - 3600000).toISOString() },
    { outlet_id: 161, type: "STOCKOUT_RISK", severity: "P0_CRITICAL", status: "NEW", title: "Critical Stock: Mookata Set", description: "Mookata ingredients at 15% capacity.", score: 0.92, triggered_at: new Date(Date.now() - 7200000).toISOString() },
  ];

  const { error: casesError } = await supabase.from("cases").upsert(cases, { onConflict: "id" });
  const { error: alertsError } = await supabase.from("alerts").upsert(alerts, { onConflict: "id" });

  return {
    success: !casesError && !alertsError,
    cases_created: cases.length,
    alerts_created: alerts.length,
    errors: [casesError?.message, alertsError?.message].filter(Boolean),
  };
}

// ============================================================
// TYPE: embeddings
// ============================================================
async function seedEmbeddings(supabase: any, sourceType = "sop", limit = 50) {
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiApiKey) {
    return { success: false, error: "GEMINI_API_KEY not configured" };
  }

  const tableMap: Record<string, string> = {
    sop: "knowledge_sops", sops: "knowledge_sops",
    incident: "knowledge_incidents", incidents: "knowledge_incidents",
    manual: "knowledge_manuals", manuals: "knowledge_manuals",
    policy: "knowledge_policies", policies: "knowledge_policies",
  };

  const table = tableMap[sourceType] || "knowledge_sops";

  const { data: items, error } = await supabase.from(table).select("*").limit(limit);
  if (error) return { success: false, error: error.message };
  if (!items || items.length === 0) return { success: true, message: "No items found", count: 0 };

  const { data: existingEmbeddings } = await supabase
    .from("knowledge_embeddings")
    .select("source_id")
    .eq("source_type", sourceType === "sops" ? "sop" : sourceType);

  const existingIds = new Set(existingEmbeddings?.map((e: any) => e.source_id) || []);

  let success = 0, skipped = 0, errors: string[] = 0;

  for (const item of items) {
    if (existingIds.has(item.id)) { skipped++; continue; }
    const title = item.title || item.incident_type || "";
    const content = item.content || "";
    const fullText = `${title}\n\n${content}`;
    if (fullText.length < 10) { skipped++; continue; }

    try {
      const embedRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${geminiApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: "models/text-embedding-004", content: { parts: [{ text: fullText }] } }),
        }
      );

      if (!embedRes.ok) throw new Error(`Embedding API error: ${embedRes.status}`);
      const embedData = await embedRes.json();
      const embedding = embedData.embedding?.values;
      if (!embedding) throw new Error("No embedding returned");

      const metadata: Record<string, any> = {};
      if (item.category) metadata.category = item.category;
      if (item.incident_type) metadata.incident_type = item.incident_type;
      if (item.policy_type) metadata.policy_type = item.policy_type;

      const { error: insertError } = await supabase.from("knowledge_embeddings").insert({
        content: fullText,
        source_type: sourceType === "sops" ? "sop" : sourceType,
        source_id: item.id,
        metadata,
        embedding,
      });

      if (insertError) throw insertError;
      success++;
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (err: any) {
      errors.push(`${title?.substring(0, 30)}: ${err.message}`);
    }
  }

  return { success: true, embedded: `${success}/${items.length}`, skipped, errors };
}

// ============================================================
// MAIN SERVER
// ============================================================
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Auth: all seed types require HQ_ADMIN
  const auth = await verifyAuth(req);
  if (!auth.success || !auth.user) return unauthorizedResponse(auth.error);
  if (!isAtLeastRole(auth.user, "HQ_ADMIN")) return forbiddenResponse("HQ_ADMIN required");

  const supabase = createClient(supabaseUrl, serviceKey);

  // Parse request
  let seedType = "all";
  let subOptions: Record<string, any> = {};
  if (req.method === "POST") {
    try {
      const body = await req.json();
      seedType = body.type || "all";
      subOptions = body.options || {};
    } catch { /* use defaults */ }
  }

  const startTime = Date.now();
  const results: Record<string, any> = {};

  try {
    if (seedType === "outlet_features" || seedType === "all") {
      results.outlet_features = await seedOutletFeatures(supabase);
    }
    if (seedType === "historical_sales" || seedType === "all") {
      results.historical_sales = await seedHistoricalSales(supabase);
    }
    if (seedType === "workflow_data" || seedType === "all") {
      results.workflow_data = await seedWorkflowData(supabase);
    }
    if (seedType === "embeddings" || seedType === "all") {
      results.embeddings = await seedEmbeddings(supabase, subOptions.source_type || "sop", subOptions.limit || 50);
    }

    return new Response(JSON.stringify({
      success: true,
      type: seedType,
      duration_ms: Date.now() - startTime,
      results,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
