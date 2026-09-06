// supabase/functions/gatekeeper-agent/index.ts
//
// Gatekeeper: monitors POS/lender webhook and connector health. Every other
// agent (Underwriter, Ledger, Monitor) depends on this data being fresh — a
// connector that silently stops sending data corrupts every downstream
// computation without anyone noticing until numbers look wrong. Suggested
// cadence: every 15 min (same as the operational agents), since staleness
// detection needs to be fast.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getServiceClient, createInsight, logAgentRun } from "../_shared/agentInsights.ts";

const supabase = getServiceClient();

const STALE_MINUTES_THRESHOLD = 30; // no data received in this window = flag

interface ConnectorSignal {
  connector_id: string;
  connector_name: string;
  connector_type: "pos" | "lender_webhook" | "accounting" | "bureau";
  last_received_at: string; // ISO timestamp
  error_rate_last_hour: number; // 0-1
}

function minutesSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60));
}

serve(async (req) => {
  try {
    const { connectors } = (await req.json()) as { connectors: ConnectorSignal[] };
    if (!Array.isArray(connectors) || connectors.length === 0) {
      return new Response(JSON.stringify({ error: "connectors[] required" }), { status: 400 });
    }

    const flagged = [];
    for (const c of connectors) {
      const staleMinutes = minutesSince(c.last_received_at);
      const isStale = staleMinutes > STALE_MINUTES_THRESHOLD;
      const isErroring = c.error_rate_last_hour > 0.05;

      if (!isStale && !isErroring) continue;

      await createInsight(supabase, {
        agentName: "gatekeeper",
        module: "Integrations",
        outletId: null,
        category: isStale ? "connector_stale" : "connector_error_rate",
        severity: isStale && staleMinutes > STALE_MINUTES_THRESHOLD * 2 ? "high" : "medium",
        title: `${c.connector_name} (${c.connector_type}): ${isStale ? `no data in ${staleMinutes}m` : `${(c.error_rate_last_hour * 100).toFixed(0)}% error rate`}`,
        details: isStale
          ? "Downstream risk scores, royalty calculations, and dashboards may be working off stale data until this is resolved."
          : "Elevated error rate — check connector logs before it silently drops data.",
        payload: { connector_id: c.connector_id, stale_minutes: staleMinutes, error_rate: c.error_rate_last_hour },
      });
      flagged.push({ connector_id: c.connector_id, is_stale: isStale, is_erroring: isErroring });
    }

    await logAgentRun(supabase, "gatekeeper", { connectors_scanned: connectors.length, flagged: flagged.length });

    return new Response(JSON.stringify({ flagged }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
