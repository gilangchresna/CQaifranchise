/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Check if user_profiles table is empty
  const { count, error: countError } = await supabase
    .from("user_profiles")
    .select("*", { count: "exact", head: true });

  if (countError) {
    return new Response(JSON.stringify({
      success: false,
      error: `Failed to check user_profiles: ${countError.message}`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (count && count > 0) {
    return new Response(JSON.stringify({
      success: true,
      message: `user_profiles already has ${count} records. Skipping seed.`,
      skipped: true,
      user_profiles: count,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Seed user_profiles
  const userProfiles = [
    {
      email: "sarah.jenkins@cyberquote.com",
      full_name: "Sarah Jenkins",
      role: "HQ_ADMIN",
      phone: "+65 9123 4567",
      is_active: true,
    },
    {
      email: "marcus.chen@cyberquote.com",
      full_name: "Marcus Chen",
      role: "REGIONAL_MANAGER",
      region_id: 1, // Singapore
      phone: "+65 9234 5678",
      is_active: true,
    },
    {
      email: "elena.rodriguez@cyberquote.com",
      full_name: "Elena Rodriguez",
      role: "REGIONAL_MANAGER",
      region_id: 2, // Jakarta
      phone: "+62 812 3456 7890",
      is_active: true,
    },
    {
      email: "david.kim@cyberquote.com",
      full_name: "David Kim",
      role: "FRANCHISEE_OWNER",
      outlet_id: 1,
      phone: "+65 9345 6789",
      is_active: true,
    },
    {
      email: "james.wilson@cyberquote.com",
      full_name: "James Wilson",
      role: "FRANCHISEE_OWNER",
      outlet_id: 2,
      phone: "+65 9456 7890",
      is_active: false, // Suspended
    },
    {
      email: "ana.santos@cyberquote.com",
      full_name: "Ana Santos",
      role: "REGIONAL_MANAGER",
      region_id: 5, // Bangkok
      phone: "+66 89 123 4567",
      is_active: true,
    },
    {
      email: "raj.kumar@cyberquote.com",
      full_name: "Raj Kumar",
      role: "FRANCHISEE_OWNER",
      outlet_id: 3,
      phone: "+65 9567 8901",
      is_active: true,
    },
    {
      email: "lisa.tan@cyberquote.com",
      full_name: "Lisa Tan",
      role: "FRANCHISEE_OWNER",
      outlet_id: 4,
      phone: "+62 821 2345 6789",
      is_active: true,
    },
  ];

  const { error: userError } = await supabase.from("user_profiles").upsert(userProfiles);
  if (userError) {
    return new Response(JSON.stringify({
      success: false,
      error: `Failed to seed user_profiles: ${userError.message}`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({
    success: true,
    message: "Successfully seeded user_profiles",
    user_profiles: userProfiles.length,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
