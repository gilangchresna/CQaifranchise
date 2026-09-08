// Ledger Agent: Royalty reconciliation and financial oversight
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getServiceClient, createInsight, logAgentRun } from "../_shared/agentInsights.ts";

const supabase = getServiceClient();

serve(async (req) => {
  try {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const insights: any[] = [];

    // 1. Check for missing royalty_reconciliation records
    const { data: reconciliation } = await supabase
      .from("royalty_reconciliation")
      .select("outlet_id, period_month, status")
      .eq("period_month", monthStart.slice(0, 7));

    const reconciledOutlets = new Set((reconciliation ?? []).map(r => r.outlet_id));
    
    const { data: activeOutlets } = await supabase
      .from("outlets")
      .select("id")
      .eq("status", "ACTIVE"); // FIXED: outlet_status enum values are uppercase (ACTIVE/INACTIVE/SUSPENDED); "active" matched zero rows

    const missingReconciliation: number[] = [];
    for (const outlet of activeOutlets ?? []) {
      if (!reconciledOutlets.has(outlet.id)) {
        missingReconciliation.push(outlet.id);
      }
    }

    if (missingReconciliation.length > 0) {
      await createInsight(supabase, {
        agentName: "ledger",
        module: "Financing",
        outletId: null,
        category: "missing_reconciliation",
        severity: "medium",
        title: `${missingReconciliation.length} outlets missing ${monthStart.slice(0, 7)} reconciliation`,
        details: `${missingReconciliation.length} active outlets have no royalty reconciliation record for this period. Submit reconciliation promptly.`,
      });
      insights.push({ type: "missing_reconciliation", count: missingReconciliation.length });
    }

    // 2. Check for overdue reconciliation (status = pending)
    const { data: pendingReconciliation } = await supabase
      .from("royalty_reconciliation")
      .select("id, outlet_id, period_month, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    for (const recon of (pendingReconciliation ?? []).slice(0, 10)) {
      const daysPending = Math.floor((today.getTime() - new Date(recon.created_at).getTime()) / (1000 * 60 * 60 * 24));
      if (daysPending > 7) {
        await createInsight(supabase, {
          agentName: "ledger",
          module: "Financing",
          outletId: recon.outlet_id?.toString() ?? null,
          category: "pending_reconciliation",
          severity: daysPending > 14 ? "high" : "medium",
          title: `Reconciliation pending ${daysPending} days`,
          details: `Outlet ${recon.outlet_id} reconciliation for ${recon.period_month} has been pending since ${new Date(recon.created_at).toLocaleDateString()}.`,
        });
        insights.push({ type: "pending_reconciliation", outlet: recon.outlet_id, days: daysPending });
      }
    }

    // 3. Check for variance in royalty payments (large discrepancies)
    const { data: varianceRecords } = await supabase
      .from("royalty_reconciliation")
      .select("outlet_id, period_month, expected_amount, actual_amount, variance")
      .gte("period_month", monthStart.slice(0, 7));

    for (const record of varianceRecords ?? []) {
      if (record.variance && Math.abs(record.variance) > 100) {
        const variancePct = record.expected_amount ? (record.variance / record.expected_amount) * 100 : 0;
        if (Math.abs(variancePct) > 10) {
          await createInsight(supabase, {
            agentName: "ledger",
            module: "Financing",
            outletId: record.outlet_id?.toString() ?? null,
            category: "royalty_variance",
            severity: Math.abs(variancePct) > 25 ? "high" : "medium",
            title: `Royalty variance: ${Math.round(variancePct)}%`,
            details: `Expected: $${record.expected_amount}, Actual: $${record.actual_amount}, Variance: $${record.variance}. Investigate discrepancy.`,
          });
          insights.push({ type: "royalty_variance", outlet: record.outlet_id, variance: record.variance });
        }
      }
    }

    // 4. Check for financing_requests status
    const { data: pendingFinancing } = await supabase
      .from("financing_requests")
      .select("id, outlet_id, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    for (const req of (pendingFinancing ?? []).slice(0, 5)) {
      const daysPending = Math.floor((today.getTime() - new Date(req.created_at).getTime()) / (1000 * 60 * 60 * 24));
      if (daysPending > 14) {
        await createInsight(supabase, {
          agentName: "ledger",
          module: "Financing",
          outletId: req.outlet_id?.toString() ?? null,
          category: "pending_financing",
          severity: daysPending > 30 ? "high" : "medium",
          title: `Financing request pending ${daysPending} days`,
          details: `Request ${req.id} for outlet ${req.outlet_id} awaiting response for ${daysPending} days. Follow up with financier.`,
        });
        insights.push({ type: "pending_financing", request: req.id });
      }
    }

    await logAgentRun(supabase, "ledger", { 
      insights_created: insights.length,
      pending_reconciliation: pendingReconciliation?.length ?? 0
    });

    return new Response(JSON.stringify({ 
      success: true,
      insights_created: insights.length,
      details: insights
    }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Ledger error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
