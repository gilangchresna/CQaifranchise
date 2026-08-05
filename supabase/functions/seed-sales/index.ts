import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth, isAtLeastRole, unauthorizedResponse, forbiddenResponse } from "../_shared/auth.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const { data: outlets, error: outletError } = await supabase
    .from("outlets")
    .select("id, code, daily_target")
    .in("status", ["ACTIVE", "PILOT"]);
  
  if (outletError) {
    return new Response(JSON.stringify({ success: false, error: outletError.message }));
  }
  
  if (!outlets || outlets.length === 0) {
    return new Response(JSON.stringify({ success: false, error: "No outlets found" }));
  }
  
  // Build records
  const records: any[] = [];
  for (const outlet of outlets) {
    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dow = date.getDay();
      const dateStr = date.toISOString().split("T")[0];
      
      const multiplier = (dow === 0 || dow === 6) ? 1.15 : (dow === 5 ? 1.1 : 1.0);
      let amount = Number(outlet.daily_target) * multiplier * (0.8 + Math.random() * 0.4);
      if (Math.random() < 0.1) amount *= (Math.random() < 0.5) ? 0.5 : 1.5;
      const txCount = Math.max(1, Math.floor(amount / 50000));
      
      records.push({
        outlet_id: outlet.id,
        transaction_id: `${outlet.code}-${dateStr}-${Math.random().toString(36).substr(2, 9)}`,
        date: dateStr,
        amount: Math.floor(amount),
        transaction_count: txCount,
        day_of_week: dow,
      });
    }
  }
  
  // Insert all at once
  const { error: insertError, count } = await supabase
    .from("sales_transactions")
    .insert(records);
  
  return new Response(JSON.stringify({ 
    success: !insertError, 
    error: insertError?.message || null,
    outlets: outlets.length,
    records: records.length,
    inserted: count || records.length
  }));
});
