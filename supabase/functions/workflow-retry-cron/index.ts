/// <reference lib="deno.ns" />

/**
 * Workflow Retry Cron
 * pg_cron: Every 5 minutes
 * 
 * Finds failed workflows where next_retry_at <= NOW()
 * and retry_count < max_retries
 * and re-enqueues them by re-calling the pipeline
 * 
 * This enables automatic retry with exponential backoff:
 * Retry 1: +5 min, Retry 2: +15 min, Retry 3: +60 min
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Map workflow_name → trigger endpoint
const WORKFLOW_TRIGGERS: Record<string, { url: string; method: string }> = {
  "coordinator-pipeline": {
    url: `${SUPABASE_URL}/functions/v1/coordinator-pipeline`,
    method: "POST",
  },
  "ml-scheduler": {
    url: `${SUPABASE_URL}/functions/v1/ml-scheduler`,
    method: "POST",
  },
  "sla-escalator": {
    url: `${SUPABASE_URL}/functions/v1/sla-escalator`,
    method: "POST",
  },
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Find workflows due for retry
    const now = new Date().toISOString();
    const { data: dueRetries, error } = await supabase
      .from("workflow_instances")
      .select("id, workflow_name, payload, retry_count, max_retries, error_detail")
      .eq("status", "failed")
      .lte("next_retry_at", now)
      .lt("retry_count", 3);

    if (error) {
      console.error("Failed to fetch due retries:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    for (const instance of dueRetries || []) {
      const trigger = WORKFLOW_TRIGGERS[instance.workflow_name];
      if (!trigger) {
        console.log(`No trigger for workflow: ${instance.workflow_name}`);
        // Mark as permanently failed
        await supabase
          .from("workflow_instances")
          .update({
            status: "failed",
            error_detail: `No trigger configured for workflow: ${instance.workflow_name}`,
            next_retry_at: null,
          })
          .eq("id", instance.id);
        results.push({ instance_id: instance.id, workflow: instance.workflow_name, action: "no_trigger" });
        continue;
      }

      // Re-enqueue
      try {
        // Reset to pending
        await supabase
          .from("workflow_instances")
          .update({
            status: "pending",
            current_step: null,
            next_retry_at: null,
          })
          .eq("id", instance.id);

        // Fire the workflow
        const fireRes = await fetch(trigger.url, {
          method: trigger.method,
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
          },
          body: JSON.stringify({
            ...instance.payload,
            triggered_by: "retry",
            _retry_instance_id: instance.id,
          }),
        });

        const fireResult = await fireRes.json().catch(() => ({}));
        results.push({
          instance_id: instance.id,
          workflow: instance.workflow_name,
          action: "retriggered",
          http_status: fireRes.status,
        });
      } catch (e: any) {
        console.error(`Failed to re-trigger ${instance.id}:`, e);
        results.push({
          instance_id: instance.id,
          workflow: instance.workflow_name,
          action: "error",
          error: e.message,
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      timestamp: now,
      retried: results.length,
      results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("workflow-retry-cron error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
