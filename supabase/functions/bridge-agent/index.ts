// supabase/functions/bridge-agent/index.ts
//
// Bridge: validates incoming POS/lender/accounting webhook payloads against
// the expected schema — distinct from Gatekeeper (uptime/freshness). A
// connector can be "up" and still send malformed or drifted payloads (a
// vendor changes a field name, a new POS version adds a nested object) that
// pass health checks but corrupt data quietly. Suggested cadence:
// event-triggered, on every payload received.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getServiceClient, createInsight, logAgentRun } from "../_shared/agentInsights.ts";

const supabase = getServiceClient();

interface SchemaCheckInput {
  connector_id: string;
  connector_name: string;
  expected_fields: string[];
  received_payload: Record<string, unknown>;
}

function findMissingAndUnexpected(expected: string[], payload: Record<string, unknown>) {
  const receivedKeys = Object.keys(payload);
  const missing = expected.filter((f) => !receivedKeys.includes(f));
  const unexpected = receivedKeys.filter((k) => !expected.includes(k));
  return { missing, unexpected };
}

serve(async (req) => {
  try {
    const { checks } = (await req.json()) as { checks: SchemaCheckInput[] };
    if (!Array.isArray(checks) || checks.length === 0) {
      return new Response(JSON.stringify({ error: "checks[] required" }), { status: 400 });
    }

    const flagged = [];
    for (const c of checks) {
      const { missing, unexpected } = findMissingAndUnexpected(c.expected_fields, c.received_payload);
      if (missing.length === 0 && unexpected.length === 0) continue;

      await createInsight(supabase, {
        agentName: "bridge",
        module: "Integrations",
        outletId: null,
        category: missing.length > 0 ? "schema_missing_fields" : "schema_drift",
        severity: missing.length > 0 ? "high" : "low",
        title: `${c.connector_name}: payload schema ${missing.length > 0 ? "missing fields" : "drifted"}`,
        details: [
          missing.length ? `Missing: ${missing.join(", ")}.` : "",
          unexpected.length ? `New/unexpected fields: ${unexpected.join(", ")} — may indicate a vendor schema change worth mapping.` : "",
        ].filter(Boolean).join(" "),
        payload: { connector_id: c.connector_id, missing, unexpected },
      });
      flagged.push({ connector_id: c.connector_id, missing, unexpected });
    }

    await logAgentRun(supabase, "bridge", { checks_run: checks.length, flagged: flagged.length });

    return new Response(JSON.stringify({ flagged }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
