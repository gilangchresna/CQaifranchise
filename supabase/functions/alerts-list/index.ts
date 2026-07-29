/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  
  const { data, error } = await supabase
    .from('alerts')
    .select('*, outlets(name, code)')
    .order('created_at', { ascending: false })
    .limit(50);
  
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  
  return Response.json({ data }, { headers: corsHeaders });
});
