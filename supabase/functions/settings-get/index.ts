/// <reference lib="deno.ns" />

/**
 * Settings Get Edge Function
 * Gets settings from settings table
 *
 * GET /functions/v1/settings-get
 * Query params: ?category=notifications
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use GET." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const category = url.searchParams.get("category");

    let query = supabase.from("settings").select("*");

    if (category) {
      query = query.eq("category", category);
    }

    const { data: settings, error } = await query;

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Transform to key-value object
    const settingsObj: Record<string, any> = {};
    for (const s of settings || []) {
      settingsObj[s.key] = s.value;
    }

    // Add default values if not set
    const defaults = {
      notifications_enabled: "true",
      email_notifications_enabled: "true",
      whatsapp_notifications_enabled: "false",
      sla_warning_threshold: "50",
      anomaly_threshold: "0.7",
      stockout_days: "3",
    };

    for (const [key, value] of Object.entries(defaults)) {
      if (settingsObj[key] === undefined) {
        settingsObj[key] = value;
      }
    }

    return new Response(
      JSON.stringify({
        settings: settingsObj,
        categories: category ? [category] : ["notifications", "alerts", "ml", "general"],
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
