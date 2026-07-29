import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Get cases with proper joins
    const { data: cases, error } = await supabase
      .from("cases")
      .select(`
        *,
        alert:alerts(id, outlet_id, type, severity, outlets(name, code)),
        assigned_to:user_profiles!assigned_to_id(full_name, role)
      `)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Cases error:", error);
      return Response.json({ error: error.message, cases: [] }, { headers: corsHeaders });
    }

    return Response.json({ cases: cases || [] }, { headers: corsHeaders });
    
  } catch (error: any) {
    return Response.json({ error: error.message, cases: [] }, { status: 500, headers: corsHeaders });
  }
});
