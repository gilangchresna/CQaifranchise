// supabase/functions/ledger-agent/index.ts
//
// Ledger: reconciles the royalty formula engine's expected output against
// what actually landed in the bank GL / sales ledger for the same period.
// Flags variances before they become franchisee disputes.
// Suggested cadence: on royalty period close (e.g. monthly), or weekly for
// early detection.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getServiceClient, createInsight, logAgentRun } from "../_shared/agentInsights.ts";

const supabase = getServiceClient();

const VARIANCE_FLAG_THRESHOLD_PCT = 0.03; // flag if actual differs from expected by >3%

interface ReconciliationInput {
  outlet_id: string;
  period_start: string;
  period_end: string;
  expected_royalty: number;  // from RoyaltyDashboard / royalty-calculator edge fn
  ledger_royalty: number;    // derived from bank GL + sales ledger for the same period
}

serve(async (req) => {
  try {
    const { entries } = (await req.json()) as { entries: ReconciliationInput[] };
    if (!Array.isArray(entries) || entries.length === 0) {
      return new Response(JSON.stringify({ error: "entries[] required" }), { status: 400 });
    }

    const flagged = [];
    for (const e of entries) {
      const variance = e.ledger_royalty - e.expected_royalty;
      const variancePct = e.expected_royalty === 0 ? 0 : variance / e.expected_royalty;
      const shouldFlag = Math.abs(variancePct) > VARIANCE_FLAG_THRESHOLD_PCT;

      const { error } = await supabase.from("royalty_reconciliation").insert({
        outlet_id: e.outlet_id,
        period_start: e.period_start,
        period_end: e.period_end,
        expected_royalty: e.expected_royalty,
        ledger_royalty: e.ledger_royalty,
        flagged: shouldFlag,
      });
      if (error) throw error;

      if (shouldFlag) {
        await createInsight(supabase, {
          agentName: "ledger",
          module: "Royalty",
          outletId: e.outlet_id,
          category: "royalty_variance",
          severity: Math.abs(variancePct) > 0.10 ? "high" : "medium",
          title: `Royalty variance ${(variancePct * 100).toFixed(1)}% for period ${e.period_end}`,
          details: `Expected ${e.expected_royalty}, ledger shows ${e.ledger_royalty} (variance ${variance.toFixed(2)}).`,
          payload: { period_start: e.period_start, period_end: e.period_end, variance, variance_pct: variancePct },
        });
        flagged.push({ outlet_id: e.outlet_id, variance, variance_pct: variancePct });
      }
    }

    await logAgentRun(supabase, "ledger", { entries_processed: entries.length, flagged: flagged.length });

    return new Response(JSON.stringify({ flagged }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
