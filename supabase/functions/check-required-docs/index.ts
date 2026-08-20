// supabase/functions/check-required-docs/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Required documents by country
const REQUIRED_DOCS: Record<string, string[]> = {
  SGP: ["SGP_ACRA_ANNUAL", "SGP_ACRA_XBRL"],
  IDN: ["IDN_AHU_ANNUAL", "IDN_LKPM_Q1", "IDN_LKPM_Q2", "IDN_LKPM_Q3", "IDN_LKPM_Q4", "IDN_DJP_SPT"],
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const { entity_id, country } = await req.json();

    if (!entity_id || !country) {
      return new Response(JSON.stringify({ error: "entity_id and country required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get required docs for country
    const requiredDocs = REQUIRED_DOCS[country] || [];

    if (requiredDocs.length === 0) {
      return new Response(JSON.stringify({
        valid: false,
        error: `Unknown country: ${country}`,
        required_docs: [],
        missing_docs: [],
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check which docs exist for this entity
    const { data: existingDocs, error: fetchError } = await supabaseClient
      .from("regulatory_documents")
      .select("document_type")
      .eq("entity_id", entity_id)
      .in("document_type", requiredDocs);

    if (fetchError) {
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find missing docs
    const existingTypes = new Set((existingDocs || []).map((d: any) => d.document_type));
    const missingDocs = requiredDocs.filter(doc => !existingTypes.has(doc));

    const result = {
      valid: missingDocs.length === 0,
      entity_id,
      country,
      required_docs: requiredDocs,
      existing_docs: Array.from(existingTypes),
      missing_docs: missingDocs,
      checked_at: new Date().toISOString(),
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
