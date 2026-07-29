/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

serve(async (req: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const tables = ["regions", "outlets", "inventory", "sales_transactions", "approval_requests", "peer_metrics", "outlet_classifications"];
  
  for (const table of tables) {
    await supabase.rpc("disable_rls_for_table", { table_name: table }).catch(() => {
      // Try direct approach
      supabase.query(`ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY;`);
    });
  }

  return new Response(JSON.stringify({ success: true, tables_disabled: tables }));
});
