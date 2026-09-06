/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth, isAtLeastRole, unauthorizedResponse, forbiddenResponse } from "../_shared/auth.ts";

serve(async (req) => {
  // SECURITY: this function uses the service-role key (bypasses RLS) and can
  // mutate/delete data. Restrict it to authenticated HQ_ADMIN callers only.
  const auth = await verifyAuth(req);
  if (!auth.success || !auth.user) {
    return unauthorizedResponse(auth.error);
  }
  if (!isAtLeastRole(auth.user, 'HQ_ADMIN')) {
    return forbiddenResponse('HQ_ADMIN role required for this operation');
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  
  // Get sample sales
  const { data: sales } = await supabase.from('sales_transactions').select('*').limit(3);
  
  // Get sample inventory
  const { data: inventory } = await supabase.from('inventory').select('*').limit(3);
  
  return Response.json({
    sales_fields: sales?.[0] ? Object.keys(sales[0]) : [],
    sales_sample: sales,
    inventory_fields: inventory?.[0] ? Object.keys(inventory[0]) : [],
    inventory_sample: inventory
  });
});
