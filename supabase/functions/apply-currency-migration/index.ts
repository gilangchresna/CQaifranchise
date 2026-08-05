/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Run ONCE migration to add currency columns to regions
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Step 1: Add columns via raw SQL — use postgrest RPC workaround
    // Since we can't run ALTER TABLE directly, the migration SQL file
    // needs to be applied via Supabase Dashboard SQL Editor:
    //
    // ALTER TABLE public.regions ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3) NOT NULL DEFAULT 'MYR';
    // ALTER TABLE public.regions ADD COLUMN IF NOT EXISTS locale_code VARCHAR(10);
    // UPDATE public.regions SET currency_code = 'SGD', locale_code = 'en-SG' WHERE code = 'SG';
    // UPDATE public.regions SET currency_code = 'IDR', locale_code = 'id-ID' WHERE code = 'JKT';
    // UPDATE public.regions SET currency_code = 'IDR', locale_code = 'id-ID' WHERE code = 'BDG';
    // UPDATE public.regions SET currency_code = 'IDR', locale_code = 'id-ID' WHERE code = 'SBY';
    // UPDATE public.regions SET currency_code = 'THB', locale_code = 'th-TH' WHERE code = 'BKK';
    // UPDATE public.regions SET currency_code = 'MYR', locale_code = 'en-MY' WHERE code = 'KUL';
    //
    // Step 2: Update region currency values via REST API (if columns exist)

    // Step 2: Update region currency values
    const updates = await Promise.all([
      supabase.from("regions").update({ currency_code: "SGD", locale_code: "en-SG" }).eq("code", "SG"),
      supabase.from("regions").update({ currency_code: "IDR", locale_code: "id-ID" }).eq("code", "JKT"),
      supabase.from("regions").update({ currency_code: "IDR", locale_code: "id-ID" }).eq("code", "BDG"),
      supabase.from("regions").update({ currency_code: "IDR", locale_code: "id-ID" }).eq("code", "SBY"),
      supabase.from("regions").update({ currency_code: "THB", locale_code: "th-TH" }).eq("code", "BKK"),
      supabase.from("regions").update({ currency_code: "MYR", locale_code: "en-MY" }).eq("code", "KUL"),
    ]);

    // Verify
    const { data: regions } = await supabase
      .from("regions")
      .select("id, name, code, currency_code, locale_code")
      .order("id");

    return new Response(JSON.stringify({
      status: "ok",
      columns_added: addCol,
      regions_updated: updates.map(u => u.error ? u.error.message : "ok"),
      result: regions,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
