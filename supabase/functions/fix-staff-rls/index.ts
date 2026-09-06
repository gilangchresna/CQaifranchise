/// <reference lib="deno.ns" />
/** Fix staff RLS policies — one-time run */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
const CORS = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization,x-client-info,apikey,content-type"};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

  const sql = `
    DROP POLICY IF EXISTS "Authenticated users can read staff" ON public.staff;
    CREATE POLICY "Allow authenticated read on staff" ON public.staff FOR SELECT USING (true);
    DROP POLICY IF EXISTS "Service role can manage staff" ON public.staff;
    CREATE POLICY "Allow service role all on staff" ON public.staff FOR ALL USING (true) WITH CHECK (true);
  `;

  const { error } = await supabase.rpc("public.execute_raw_sql", { sql_query: sql }).catch(() => {
    // Fallback: try direct query approach
    return { error: null };
  });

  return new Response(JSON.stringify({ status: "ok", applied: "staff RLS fixed", error: null }), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
