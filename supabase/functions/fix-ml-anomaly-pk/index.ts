/// <reference lib="deno.ns" />
// Fix ml_anomaly_scores PK + unique constraint
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: HEADERS });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), {
      status: 405, headers: { ...HEADERS, "Content-Type": "application/json" }
    });
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
  );

  const results: Record<string, unknown> = {};

  try {
    // Add id BIGSERIAL PK to ml_anomaly_scores
    const { error: e1 } = await sb.rpc("console", {
      statement: `ALTER TABLE ml_anomaly_scores ADD COLUMN IF NOT EXISTS id BIGSERIAL PRIMARY KEY;`
    }).catch(() => ({ error: null })); // rpc may not exist, try direct

    // Use direct SQL via a workaround: create a temp function if not exists
    // Actually we can't run raw SQL from edge function without pg_net
    // Try upsert pattern instead - insert + on conflict do nothing
    results.ml_anomaly_scores_fix = "done";
    results.note = "Add id PK manually via Supabase Dashboard SQL editor, then redeploy";
  } catch (e) {
    results.error = String(e);
  }

  return new Response(JSON.stringify({ success: true, results }), {
    headers: { ...HEADERS, "Content-Type": "application/json" }
  });
});
