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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: users, error: usersError } = await supabase.auth.admin.listUsers();

  if (usersError || !users) {
    return new Response(JSON.stringify({ error: usersError?.message || "Failed to list users" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Find HQ_ADMIN users to get their user IDs
  const hqUsers = users.users.filter(u => u.user_metadata?.role === "HQ_ADMIN");

  if (hqUsers.length === 0) {
    return new Response(JSON.stringify({ message: "No HQ users found", total: users.users.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Clear existing
  await supabase.from("user_outlets").delete().neq("id", 0);

  // Map each HQ user to outlet 1 (WKW Singapore Standard) for demo purposes
  // This allows the HQ user to see franchisee-scoped data when role-switching to Franchisee
  const inserts = hqUsers.map(u => ({
    user_id: u.id,
    outlet_id: 1,
    role: "HQ_ADMIN",
  }));

  const { error: insertError } = await supabase.from("user_outlets").insert(inserts);

  if (insertError) {
    return new Response(JSON.stringify({ error: insertError.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({
    message: "user_outlets seeded for demo",
    inserted: inserts.length,
    users: hqUsers.map(u => ({ id: u.id, email: u.email })),
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
