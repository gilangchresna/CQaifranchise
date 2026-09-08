// Royalty Auditor: validates that each royalty_calculations row's
// effective_rate actually matches what the published Score Multipliers
// table says it should be for that outlet's risk_score. Distinct from Ledger
// (which checks money collected vs. calculated); this checks the *formula
// application* itself.
//
// Was previously a stub that did nothing — this is the real implementation,
// querying royalty_calculations directly rather than accepting synthetic
// input, since that's the actual table the royalty-calculator function
// writes to (see 20260828000000_royalty_program.sql).
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getServiceClient, createInsight, logAgentRun } from "../_shared/agentInsights.ts";

const supabase = getServiceClient();

// Mirrors the Score Multipliers table shown in the Royalty Program Module
// (90-100 -> 4.2%, ... 0-59 -> 7.8%). Keep in sync with whatever
// royalty-calculator actually uses — ideally both should read from one
// shared rate-bands table in a future migration rather than duplicating
// this list in two places.
const SCORE_BANDS = [
  { min: 90, max: 100, rate: 0.042 },
  { min: 80, max: 89, rate: 0.051 },
  { min: 70, max: 79, rate: 0.060 },
  { min: 60, max: 69, rate: 0.069 },
  { min: 0, max: 59, rate: 0.078 },
];

function expectedRateForScore(score: number): number {
  const band = SCORE_BANDS.find((b) => score >= b.min && score <= b.max);
  return band ? band.rate : SCORE_BANDS[SCORE_BANDS.length - 1].rate;
}

serve(async (req) => {
  try {
    // Only check recent, unwaived, non-flat-rate calculations that have a
    // risk_score to validate against.
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: calcs, error } = await supabase
      .from("royalty_calculations")
      .select("id, franchisee_id, outlet_id, risk_score, effective_rate, period_month, status")
      .not("risk_score", "is", null)
      .neq("status", "WAIVED")
      .gte("created_at", thirtyDaysAgo)
      .limit(200);

    if (error) throw error;

    const flagged: any[] = [];

    for (const calc of calcs ?? []) {
      const expected = expectedRateForScore(calc.risk_score);
      const diff = Math.abs(Number(calc.effective_rate) - expected);
      if (diff <= 0.002) continue; // within 0.2pp tolerance

      // royalty_calculations.outlet_id is stored as uuid with no FK constraint
      // in the existing schema (a pre-existing inconsistency, not introduced
      // here — outlets.id is actually integer). Best-effort: resolve the real
      // integer outlet id via the franchisee relationship instead of trusting
      // that column. A franchisee with multiple outlets may not resolve
      // perfectly here; this is a known limitation.
      let resolvedOutletId: number | null = null;
      if (calc.franchisee_id) {
        const { data: outlet } = await supabase
          .from("outlets")
          .select("id")
          .eq("franchisee_id", calc.franchisee_id)
          .limit(1)
          .maybeSingle();
        resolvedOutletId = outlet?.id ?? null;
      }

      await createInsight(supabase, {
        agentName: "royalty_auditor",
        module: "Royalty",
        outletId: resolvedOutletId !== null ? String(resolvedOutletId) : null,
        category: "rate_mismatch",
        severity: diff > 0.01 ? "high" : "medium",
        title: `Applied rate ${(Number(calc.effective_rate) * 100).toFixed(2)}% doesn't match risk-score band (expected ~${(expected * 100).toFixed(2)}%)`,
        details: `Calculation ${calc.id} for period ${calc.period_month}: risk_score ${calc.risk_score} should map to ${(expected * 100).toFixed(2)}%, but effective_rate is ${(Number(calc.effective_rate) * 100).toFixed(2)}%.`,
        payload: { calculation_id: calc.id, risk_score: calc.risk_score, effective_rate: calc.effective_rate, expected_rate: expected },
      });
      flagged.push({ calculation_id: calc.id, diff });
    }

    await logAgentRun(supabase, "royalty_auditor", { calculations_checked: calcs?.length ?? 0, flagged: flagged.length });

    return new Response(JSON.stringify({ success: true, calculations_checked: calcs?.length ?? 0, flagged }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Royalty Auditor error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
