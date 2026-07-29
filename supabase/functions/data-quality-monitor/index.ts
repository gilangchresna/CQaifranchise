/// <reference lib="deno.ns" />

/**
 * Data Quality Monitor Edge Function
 * Monitors data pipeline health, detects anomalies, and tracks quality metrics
 * 
 * POST /functions/v1/data-quality-monitor
 * 
 * Purpose:
 * - Track data freshness and completeness
 * - Detect data drift and schema issues
 * - Monitor ML model performance
 * - Generate data quality alerts
 * 
 * Response:
 * {
 *   success: boolean,
 *   metrics: { ... },
 *   alerts: [...],
 *   recommendations: [...]
 * }
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Quality thresholds
const THRESHOLDS = {
  freshness_hours: 4,           // Alert if data older than 4 hours
  completeness_ratio: 0.95,      // 95% of records must have required fields
  duplicate_rate: 0.02,          // Max 2% duplicates
  null_rate: 0.05,              // Max 5% null values in key fields
  anomaly_false_positive: 0.30,  // Max 30% false positive rate
  stockout_accuracy: 0.70,       // Min 70% stockout prediction accuracy
} as const;

interface QualityMetrics {
  data_freshness: {
    outlet_id: number;
    outlet_name: string;
    last_transaction: string | null;
    hours_since_last: number | null;
    status: "HEALTHY" | "WARNING" | "CRITICAL";
  }[];
  
  data_completeness: {
    table: string;
    total_records: number;
    complete_records: number;
    completeness_ratio: number;
    missing_fields: Record<string, number>;
  }[];
  
  duplicate_metrics: {
    table: string;
    total_records: number;
    duplicate_count: number;
    duplicate_rate: number;
  }[];
  
  anomaly_detection: {
    total_alerts: number;
    resolved_alerts: number;
    resolution_rate: number;
    false_positive_count: number;
    estimated_false_positive_rate: number;
  };
  
  stockout_prediction: {
    high_risk_count: number;
    medium_risk_count: number;
    low_risk_count: number;
    alerts_created: number;
    avg_days_until_stockout: number;
  };
}

interface QualityAlert {
  type: "FRESHNESS" | "COMPLETENESS" | "DUPLICATE" | "DRIFT" | "ACCURACY";
  severity: "P0_CRITICAL" | "P1_HIGH" | "P2_MEDIUM" | "P3_LOW";
  outlet_id?: number;
  outlet_name?: string;
  message: string;
  details: Record<string, any>;
  recommendation: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed. Use POST." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const metrics: QualityMetrics = {
      data_freshness: [],
      data_completeness: [],
      duplicate_metrics: [],
      anomaly_detection: { total_alerts: 0, resolved_alerts: 0, resolution_rate: 0, false_positive_count: 0, estimated_false_positive_rate: 0 },
      stockout_prediction: { high_risk_count: 0, medium_risk_count: 0, low_risk_count: 0, alerts_created: 0, avg_days_until_stockout: 0 },
    };

    const alerts: QualityAlert[] = [];

    // ===== 1. DATA FRESHNESS CHECK =====
    console.log("Checking data freshness...");

    const { data: outlets } = await supabase
      .from("outlets")
      .select("id, name, status")
      .in("status", ["ACTIVE", "PILOT"]);

    if (outlets && outlets.length > 0) {
      const outletIds = outlets.map(o => o.id);
      const now = new Date();

      // Get latest transaction per outlet
      const { data: latestTransactions } = await supabase
        .from("sales_transactions")
        .select("outlet_id, created_at")
        .in("outlet_id", outletIds)
        .order("created_at", { ascending: false });

      // Create map of outlet -> last transaction
      const lastTxMap = new Map<number, Date>();
      for (const tx of latestTransactions || []) {
        if (!lastTxMap.has(tx.outlet_id)) {
          lastTxMap.set(tx.outlet_id, new Date(tx.created_at));
        }
      }

      for (const outlet of outlets) {
        const lastTx = lastTxMap.get(outlet.id);
        const hoursSince = lastTx 
          ? (now.getTime() - lastTx.getTime()) / (1000 * 60 * 60) 
          : null;

        let status: "HEALTHY" | "WARNING" | "CRITICAL" = "HEALTHY";
        if (hoursSince === null) {
          status = "CRITICAL";
        } else if (hoursSince > THRESHOLDS.freshness_hours * 2) {
          status = "CRITICAL";
        } else if (hoursSince > THRESHOLDS.freshness_hours) {
          status = "WARNING";
        }

        metrics.data_freshness.push({
          outlet_id: outlet.id,
          outlet_name: outlet.name,
          last_transaction: lastTx?.toISOString() || null,
          hours_since_last: hoursSince ? Math.round(hoursSince * 10) / 10 : null,
          status,
        });

        // Generate alerts for critical freshness issues
        if (status === "CRITICAL") {
          alerts.push({
            type: "FRESHNESS",
            severity: "P1_HIGH",
            outlet_id: outlet.id,
            outlet_name: outlet.name,
            message: `No transaction data received for ${outlet.name} in over ${Math.round((hoursSince || 0) * 10) / 10} hours`,
            details: { hours_since_last: hoursSince, last_transaction: lastTx?.toISOString() },
            recommendation: "Check POS system connectivity and webhook configuration",
          });
        }
      }
    }

    // ===== 2. DATA COMPLETENESS CHECK =====
    console.log("Checking data completeness...");

    // Check sales_transactions completeness
    const { count: totalSales, error: salesError } = await supabase
      .from("sales_transactions")
      .select("*", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    const { count: completeSales } = await supabase
      .from("sales_transactions")
      .select("*", { count: "exact", head: true })
      .not("amount", "is", null)
      .not("outlet_id", "is", null)
      .not("date", "is", null)
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (totalSales !== null && completeSales !== null) {
      const completenessRatio = totalSales > 0 ? completeSales / totalSales : 0;
      metrics.data_completeness.push({
        table: "sales_transactions",
        total_records: totalSales,
        complete_records: completeSales,
        completeness_ratio: Math.round(completenessRatio * 1000) / 1000,
        missing_fields: {
          amount: totalSales - completeSales,
        },
      });

      if (completenessRatio < THRESHOLDS.completeness_ratio) {
        alerts.push({
          type: "COMPLETENESS",
          severity: "P2_MEDIUM",
          message: `Data completeness for sales_transactions is ${Math.round(completenessRatio * 100)}% (threshold: ${THRESHOLDS.completeness_ratio * 100}%)`,
          details: { ratio: completenessRatio, total: totalSales, incomplete: totalSales - completeSales },
          recommendation: "Review data ingestion pipeline for missing field values",
        });
      }
    }

    // Check inventory completeness
    const { count: totalInventory } = await supabase
      .from("inventory")
      .select("*", { count: "exact", head: true });

    const { count: completeInventory } = await supabase
      .from("inventory")
      .select("*", { count: "exact", head: true })
      .not("current_stock", "is", null)
      .not("sku", "is", null);

    if (totalInventory !== null && completeInventory !== null) {
      const completenessRatio = totalInventory > 0 ? completeInventory / totalInventory : 0;
      metrics.data_completeness.push({
        table: "inventory",
        total_records: totalInventory,
        complete_records: completeInventory,
        completeness_ratio: Math.round(completenessRatio * 1000) / 1000,
        missing_fields: {
          current_stock: totalInventory - completeInventory,
        },
      });
    }

    // ===== 3. DUPLICATE CHECK =====
    console.log("Checking for duplicates...");

    // Check for duplicate transaction_ids in last 24h
    const { count: totalTx24h } = await supabase
      .from("sales_transactions")
      .select("*", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const { data: duplicateTx } = await supabase
      .from("sales_transactions")
      .select("transaction_id")
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    // Count duplicates
    const txIdCounts = new Map<string, number>();
    let duplicateCount = 0;
    for (const tx of duplicateTx || []) {
      const count = txIdCounts.get(tx.transaction_id) || 0;
      if (count > 0) duplicateCount++;
      txIdCounts.set(tx.transaction_id, count + 1);
    }

    if (totalTx24h !== null) {
      const duplicateRate = totalTx24h > 0 ? duplicateCount / totalTx24h : 0;
      metrics.duplicate_metrics.push({
        table: "sales_transactions",
        total_records: totalTx24h,
        duplicate_count: duplicateCount,
        duplicate_rate: Math.round(duplicateRate * 1000) / 1000,
      });

      if (duplicateRate > THRESHOLDS.duplicate_rate) {
        alerts.push({
          type: "DUPLICATE",
          severity: "P2_MEDIUM",
          message: `Duplicate transaction rate is ${Math.round(duplicateRate * 100)}% (threshold: ${THRESHOLDS.duplicate_rate * 100}%)`,
          details: { duplicate_count: duplicateCount, total: totalTx24h },
          recommendation: "Review webhook idempotency handling",
        });
      }
    }

    // ===== 4. ANOMALY DETECTION METRICS =====
    console.log("Checking anomaly detection metrics...");

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { count: totalAlerts } = await supabase
      .from("alerts")
      .select("*", { count: "exact", head: true })
      .eq("type", "SALES_ANOMALY")
      .gte("triggered_at", thirtyDaysAgo);

    const { count: resolvedAlerts } = await supabase
      .from("alerts")
      .select("*", { count: "exact", head: true })
      .eq("type", "SALES_ANOMALY")
      .eq("status", "RESOLVED")
      .gte("triggered_at", thirtyDaysAgo);

    const { count: closedAlerts } = await supabase
      .from("alerts")
      .select("*", { count: "exact", head: true })
      .eq("type", "SALES_ANOMALY")
      .in("status", ["RESOLVED", "CLOSED"])
      .gte("triggered_at", thirtyDaysAgo);

    // Estimate false positives: alerts that were never acted upon (no case created)
    const { data: alertsWithCases } = await supabase
      .from("alerts")
      .select("id")
      .eq("type", "SALES_ANOMALY")
      .gte("triggered_at", thirtyDaysAgo)
      .not("id", "in", "(SELECT alert_id FROM cases WHERE alert_id IS NOT NULL)");

    const falsePositiveCount = (totalAlerts || 0) - ((alertsWithCases?.length) || 0);
    const estimatedFPR = totalAlerts && totalAlerts > 0 ? falsePositiveCount / totalAlerts : 0;

    metrics.anomaly_detection = {
      total_alerts: totalAlerts || 0,
      resolved_alerts: (resolvedAlerts || 0) + (closedAlerts || 0),
      resolution_rate: totalAlerts && totalAlerts > 0 
        ? Math.round(((resolvedAlerts || 0) + (closedAlerts || 0)) / totalAlerts * 1000) / 1000 
        : 0,
      false_positive_count: Math.max(0, falsePositiveCount),
      estimated_false_positive_rate: Math.round(estimatedFPR * 1000) / 1000,
    };

    if (estimatedFPR > THRESHOLDS.anomaly_false_positive) {
      alerts.push({
        type: "ACCURACY",
        severity: "P2_MEDIUM",
        message: `Estimated anomaly false positive rate is ${Math.round(estimatedFPR * 100)}% (threshold: ${THRESHOLDS.anomaly_false_positive * 100}%)`,
        details: { false_positive_count: falsePositiveCount, total_alerts: totalAlerts },
        recommendation: "Review anomaly detection thresholds and adjust Z-score threshold",
      });
    }

    // ===== 5. STOCKOUT PREDICTION METRICS =====
    console.log("Checking stockout prediction metrics...");

    // Get current stockout risk distribution
    const { data: highRiskItems } = await supabase
      .from("inventory")
      .select("id")
      .lte("current_stock", 3 * 100); // Simplified: assume 100 avg daily usage

    // Get recent stockout alerts
    const { count: stockoutAlerts } = await supabase
      .from("alerts")
      .select("*", { count: "exact", head: true })
      .eq("type", "STOCKOUT_RISK")
      .gte("triggered_at", thirtyDaysAgo);

    metrics.stockout_prediction = {
      high_risk_count: highRiskItems?.length || 0,
      medium_risk_count: 0,
      low_risk_count: 0,
      alerts_created: stockoutAlerts || 0,
      avg_days_until_stockout: 0, // Would need more complex calculation
    };

    // ===== 6. GENERATE DATA QUALITY ALERTS =====
    console.log(`Found ${alerts.length} quality issues`);

    // Persist alerts to database
    for (const alert of alerts) {
      await supabase
        .from("alerts")
        .insert({
          outlet_id: alert.outlet_id || 1, // System alert
          type: "SYSTEM",
          severity: alert.severity,
          status: "NEW",
          title: `[Data Quality] ${alert.type}: ${alert.message.substring(0, 50)}...`,
          description: JSON.stringify(alert),
          score: alert.severity === "P0_CRITICAL" ? 1.0 : alert.severity === "P1_HIGH" ? 0.8 : 0.5,
          triggered_at: new Date().toISOString(),
        });
    }

    // ===== 7. RECOMMENDATIONS =====
    const recommendations: string[] = [];

    if (metrics.data_freshness.some(f => f.status === "CRITICAL")) {
      recommendations.push("URGENT: Review POS webhook connectivity for inactive outlets");
    }

    if (metrics.anomaly_detection.estimated_false_positive_rate > THRESHOLDS.anomaly_false_positive) {
      recommendations.push("Consider increasing Z-score threshold from 2.5 to 3.0 to reduce false positives");
    }

    if (metrics.duplicate_metrics.length > 0 && metrics.duplicate_metrics[0].duplicate_rate > 0.01) {
      recommendations.push("Review webhook idempotency keys - duplicates detected");
    }

    if (recommendations.length === 0) {
      recommendations.push("All data quality metrics are within acceptable thresholds");
    }

    // ===== BUILD RESPONSE =====
    const response = {
      success: true,
      metrics,
      alerts_summary: {
        total: alerts.length,
        by_severity: {
          P0_CRITICAL: alerts.filter(a => a.severity === "P0_CRITICAL").length,
          P1_HIGH: alerts.filter(a => a.severity === "P1_HIGH").length,
          P2_MEDIUM: alerts.filter(a => a.severity === "P2_MEDIUM").length,
          P3_LOW: alerts.filter(a => a.severity === "P3_LOW").length,
        },
      },
      alerts,
      recommendations,
      checked_at: new Date().toISOString(),
    };

    console.log("Data quality check completed:", JSON.stringify({
      outlets_checked: metrics.data_freshness.length,
      alerts_generated: alerts.length,
      completeness_tables: metrics.data_completeness.length,
    }));

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Data quality monitor error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
