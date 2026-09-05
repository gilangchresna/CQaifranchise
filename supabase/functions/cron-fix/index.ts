/// <reference lib="deno.ns" />
/**
 * Cron Fix - Repair broken pg_cron jobs
 * Run this once to fix the executor-cron job
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL") || "";
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const sb = createClient(SB_URL, SB_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: HEADERS });
  }

  try {
    // Use the admin client to execute raw SQL
    // Note: This requires pg_cron extension access
    
    // First check current cron jobs
    const { data: currentJobs, error: checkError } = await sb.rpc("cron_trigger_agent", {
      search: "executor",
    }).catch(() => ({ data: null, error: "RPC not found" }));
    
    // Try to fix by calling a maintenance function
    // Since we can't directly update pg_cron from edge functions,
    // we need to rely on the REST API or direct DB access
    
    // For now, return instructions
    return new Response(
      JSON.stringify({
        success: true,
        message: "Manual fix required",
        instructions: [
          "1. Go to Supabase Dashboard > SQL Editor",
          "2. Run the fix SQL from /tmp/fix_executor_cron_migration.sql",
          "3. Or use: SELECT cron.unschedule('executor-cron'); then re-create with correct key"
        ],
        fix_sql: `SELECT cron.unschedule('executor-cron');
SELECT cron.schedule(
  'executor-cron',
  '*/5 * * * *',
  $$SELECT net.http_post(
    url=>'https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/executor-cron',
    headers=>'{"Content-Type": "application/json", "apikey": "${SB_KEY}"}',
    body=>'{"triggered_by":"cron"}'
  )$$
);`
      }),
      { headers: { ...HEADERS, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ success: false, error: e.message }),
      { status: 500, headers: { ...HEADERS, "Content-Type": "application/json" } }
    );
  }
});
