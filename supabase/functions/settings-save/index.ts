/// <reference lib="deno.ns" />

/**
 * Settings Save Edge Function
 * Saves settings to the settings table (upsert by key)
 *
 * POST /functions/v1/settings-save
 *
 * Request Body:
 * {
 *   settings: Record<string, string | number | boolean>
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   saved: number,
 *   errors?: string[]
 * }
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

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed. Use POST." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { settings } = body as { settings: Record<string, any> };

    if (!settings || typeof settings !== "object") {
      return new Response(
        JSON.stringify({ success: false, error: "settings object is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const errors: string[] = [];
    let saved = 0;

    // Upsert each setting
    for (const [key, value] of Object.entries(settings)) {
      const { error } = await supabase
        .from("settings")
        .upsert(
          {
            key,
            value: String(value),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" }
        );

      if (error) {
        errors.push(`${key}: ${error.message}`);
      } else {
        saved++;
      }
    }

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        saved,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
