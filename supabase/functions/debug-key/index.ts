/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

serve(async (req) => {
  return new Response(JSON.stringify({
    service_role_key: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    supabase_url: Deno.env.get("SUPABASE_URL"),
  }), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
  });
});
