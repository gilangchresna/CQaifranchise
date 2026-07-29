// Debug Function - Check Database State
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const results: any = {};
  
  // Check each table
  const tables = ["regions", "outlets", "user_profiles", "sales_transactions", "alerts", "pilot_outreach"];
  
  for (const table of tables) {
    const { data, error, count } = await supabase.from(table).select("*", { count: "exact", head: true });
    results[table] = { count: count || 0, error: error?.message || null };
  }
  
  return new Response(JSON.stringify({ 
    service_role_key_prefix: supabaseServiceKey.substring(0, 20) + "...",
    results 
  }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});
