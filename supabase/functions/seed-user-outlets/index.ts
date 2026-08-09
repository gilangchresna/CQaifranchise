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

  // Use service role to query auth.users
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Query all users
  const { data: users, error: usersError } = await supabase.auth.admin.listUsers();

  if (usersError || !users) {
    return new Response(JSON.stringify({ error: usersError?.message || "No users" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const franchiseeUsers = users.users.filter(u =>
    u.user_metadata?.role === "FRANCHISEE_OWNER" ||
    u.user_metadata?.role === "FRANCHISEE_STAFF"
  );

  if (franchiseeUsers.length === 0) {
    return new Response(JSON.stringify({ message: "No franchisee users found", users: users.users.map(u => ({ id: u.id, email: u.email, role: u.user_metadata?.role })) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Clear existing
  await supabase.from("user_outlets").delete().neq("id", 0);

  // Insert user_outlets for each franchisee user
  const inserts = franchiseeUsers.map(u => ({
    user_id: u.id,
    outlet_id: 1, // Demo: all franchisees map to outlet 1 (WKW Singapore Standard)
    role: u.user_metadata?.role || "FRANCHISEE_OWNER",
  }));

  const { error: insertError } = await supabase.from("user_outlets").insert(inserts);

  if (insertError) {
    return new Response(JSON.stringify({ error: insertError.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({
    message: "user_outlets seeded",
    inserted: inserts.length,
    users: franchiseeUsers.map(u => ({ id: u.id, email: u.email, role: u.user_metadata?.role })),
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
