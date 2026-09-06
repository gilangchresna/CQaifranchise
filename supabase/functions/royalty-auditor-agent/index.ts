// supabase/functions/royalty-auditor-agent/index.ts
//
// Royalty Auditor: validates that the rate actually applied to each outlet
// matches what the performance-score band says it should be (per the
// Royalty Program Module's Score Multipliers table: 90-100 -> 4.2%, etc).
// Distinct from Ledger (which checks money actually collected vs. expected) —
// this checks formula correctness itself. Suggested cadence: on each royalty run.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getServiceClient, createInsight, logAgentRun } from "../_shared/agentInsights.ts";

const supabase = getServiceClient();

// Mirrors the Score Multipliers table from the Royalty Program Module slide.
// Keep in sync with RoyaltySettings — consider sourcing this from a
// royalty_rate_bands table instead of hardcoding, once that table exists.
const SCORE_BANDS = [
  { min: 90, max: 100, rate: 0.042 },
  { min: 80, max: 89, rate: 0.051 },
  { min: 70, max: 79, rate: 0.060 },
  { min: 60, max: 69, rate: 0.069 },
  { min: 0, max: 59, rate: 0.090 },
];

function expectedRateForScore(score: number): number {
  const band = SCORE_BANDS.find((b) => score >= b.min && score <= b.max);
  return band ? band.rate : SCORE_BANDS[SCORE_BANDS.length - 1].rate;
}

interface OutletRoyaltyRun {
  outlet_id: string;
  performance_score: number;
  applied_rate: number;
  formula_type: "simple" | "performance" | "hybrid" | "combined";
}

serve(async (req) => {
  try {
    const { runs } = (await req.json()) as { runs: OutletRoyaltyRun[] };
    if (!Array.isArray(runs) || runs.length === 0) {
      return new Response(JSON.stringify({ error: "runs[] required" }), { status: 400 });
    }

    const flagged = [];
    for (const r of runs) {
      // SIMPLE formula intentionally ignores score — skip validation for it.
      if (r.formula_type === "simple") continue;

      const expected = expectedRateForScore(r.performance_score);
      const diff = Math.abs(r.applied_rate - expected);

      if (diff > 0.002) { // more than 0.2pp off the expected band rate
        await createInsight(supabase, {
          agentName: "royalty_auditor",
          module: "Royalty",
          outletId: r.outlet_id,
          category: "rate_mismatch",
          severity: diff > 0.01 ? "high" : "medium",
          title: `Applied rate ${(r.applied_rate * 100).toFixed(2)}% doesn't match score band (expected ~${(expected * 100).toFixed(2)}%)`,
          details: `Performance score ${r.performance_score} under ${r.formula_type} formula should map to ${(expected * 100).toFixed(2)}%.`,
          payload: { performance_score: r.performance_score, applied_rate: r.applied_rate, expected_rate: expected, formula_type: r.formula_type },
        });
        flagged.push({ outlet_id: r.outlet_id, diff });
      }
    }

    await logAgentRun(supabase, "royalty_auditor", { runs_checked: runs.length, flagged: flagged.length });

    return new Response(JSON.stringify({ flagged }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
