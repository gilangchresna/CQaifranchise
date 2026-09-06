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
  
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    
    const body = await req.json();
    const { outlets } = body;
    
    // Update each outlet
    for (const outlet of outlets) {
      const { error } = await supabase
        .from("outlets")
        .update({
          address: outlet.address,
          phone: outlet.phone,
          daily_target: outlet.daily_target,
        })
        .eq("id", outlet.id);
      
      if (error) console.error(`Error updating ${outlet.id}:`, error);
    }
    
    return new Response(JSON.stringify({ success: true, updated: outlets.length }), { headers: corsHeaders });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
