// supabase/functions/scout-agent/index.ts
//
// Scout: analyses peer benchmark and territory data to recommend expansion
// sites or flag cannibalisation risk between nearby outlets — the growth-
// oriented counterpart to Benchmarker's performance-nudge focus. Suggested
// cadence: monthly (this is a strategic signal, not an operational one).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getServiceClient, createInsight, logAgentRun } from "../_shared/agentInsights.ts";

const supabase = getServiceClient();

const CANNIBALIZATION_DISTANCE_KM = 2;
const CANNIBALIZATION_SALES_OVERLAP_THRESHOLD = 0.25; // estimated shared catchment

interface OutletPair {
  outlet_a_id: string;
  outlet_a_name: string;
  outlet_b_id: string;
  outlet_b_name: string;
  distance_km: number;
  estimated_catchment_overlap: number; // 0-1
  combined_sales_trend: number;         // % change, both outlets together
}

interface ExpansionSignal {
  territory_name: string;
  region_id: number;
  underserved_score: number; // 0-100, higher = more opportunity, from peer/territory data
  nearest_outlet_distance_km: number;
}

serve(async (req) => {
  try {
    const { outletPairs, expansionCandidates } = (await req.json()) as {
      outletPairs?: OutletPair[];
      expansionCandidates?: ExpansionSignal[];
    };

    const flagged = [];

    for (const p of outletPairs ?? []) {
      const isCannibalizing =
        p.distance_km <= CANNIBALIZATION_DISTANCE_KM &&
        p.estimated_catchment_overlap >= CANNIBALIZATION_SALES_OVERLAP_THRESHOLD &&
        p.combined_sales_trend < 0;

      if (!isCannibalizing) continue;

      await createInsight(supabase, {
        agentName: "scout",
        module: "Peer",
        outletId: p.outlet_a_id, // primary reference; b is in payload
        category: "cannibalization_risk",
        severity: p.estimated_catchment_overlap > 0.5 ? "high" : "medium",
        title: `${p.outlet_a_name} & ${p.outlet_b_name}: possible cannibalisation (${p.distance_km.toFixed(1)}km apart)`,
        details: `Estimated ${(p.estimated_catchment_overlap * 100).toFixed(0)}% catchment overlap with combined sales trending down ${(Math.abs(p.combined_sales_trend) * 100).toFixed(1)}%.`,
        payload: { outlet_b_id: p.outlet_b_id, distance_km: p.distance_km, overlap: p.estimated_catchment_overlap },
      });
      flagged.push({ pair: [p.outlet_a_id, p.outlet_b_id], type: "cannibalization" });
    }

    for (const e of expansionCandidates ?? []) {
      if (e.underserved_score < 70) continue;

      await createInsight(supabase, {
        agentName: "scout",
        module: "Peer",
        outletId: null,
        category: "expansion_opportunity",
        severity: "low",
        title: `${e.territory_name}: expansion opportunity (underserved score ${e.underserved_score})`,
        details: `Nearest existing outlet is ${e.nearest_outlet_distance_km.toFixed(1)}km away — worth evaluating for a new site.`,
        payload: { territory_name: e.territory_name, region_id: e.region_id, underserved_score: e.underserved_score },
      });
      flagged.push({ territory: e.territory_name, type: "expansion" });
    }

    await logAgentRun(supabase, "scout", {
      pairs_scanned: outletPairs?.length ?? 0,
      candidates_scanned: expansionCandidates?.length ?? 0,
      flagged: flagged.length,
    });

    return new Response(JSON.stringify({ flagged }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
