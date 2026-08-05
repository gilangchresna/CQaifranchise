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
  
  const { data, error } = await supabase.from("integrations").insert([
    { name: "Aloha POS", type: "POS", status: "CONNECTED" },
    { name: "SAP Accounting", type: "ACCOUNTING", status: "CONNECTED" },
    { name: "Slack Alerts", type: "SLACK", status: "CONNECTED" },
    { name: "Workday HR", type: "HR", status: "DISCONNECTED" },
  ]).select();
  
  return new Response(JSON.stringify({ 
    success: !error, 
    seeded: data?.length || 0,
    error: error?.message || null
  }), { headers: { "Content-Type": "application/json" } });
});
