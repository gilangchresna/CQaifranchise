/**
 * Knowledge Base List Edge Function
 * Lists knowledge items (SOPs, manuals, incidents, policies)
 * GET endpoint - Query params: type, category, search, limit, page
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Verify JWT authentication
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Unauthorized: Missing Authorization header" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const token = authHeader.substring(7);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    // Verify token
    const verifyRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { "Authorization": `Bearer ${token}`, "apikey": serviceKey },
    });

    if (!verifyRes.ok) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Authentication failed" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Only allow GET
  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use GET." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabase = createClient(supabaseUrl, serviceKey);
    const url = new URL(req.url);
    
    const type = url.searchParams.get("type") || "sops";
    const category = url.searchParams.get("category");
    const search = url.searchParams.get("search");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
    const page = Math.max(parseInt(url.searchParams.get("page") || "1"), 1);
    const offset = (page - 1) * limit;

    let query;
    let countQuery;
    let table;

    switch (type) {
      case "sops":
        table = "knowledge_sops";
        query = supabase.from(table).select("*", { count: "exact" });
        countQuery = supabase.from(table).select("*", { count: "exact", head: true });
        break;
      
      case "manuals":
        table = "knowledge_manuals";
        query = supabase.from(table).select("*", { count: "exact" });
        countQuery = supabase.from(table).select("*", { count: "exact", head: true });
        break;
      
      case "incidents":
        table = "knowledge_incidents";
        query = supabase.from(table).select("*", { count: "exact" });
        countQuery = supabase.from(table).select("*", { count: "exact", head: true });
        break;
      
      case "policies":
        table = "knowledge_policies";
        query = supabase.from(table).select("*", { count: "exact" });
        countQuery = supabase.from(table).select("*", { count: "exact", head: true });
        break;
      
      case "embeddings":
        table = "knowledge_embeddings";
        query = supabase.from(table).select("id, content, source_type, metadata, created_at", { count: "exact" });
        countQuery = supabase.from(table).select("id", { count: "exact", head: true });
        break;
      
      default:
        return new Response(
          JSON.stringify({ error: "Invalid type. Use: sops, manuals, incidents, policies, or embeddings" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    // Apply filters
    if (category) {
      if (type === "sops") {
        query = query.eq("category", category);
        countQuery = countQuery.eq("category", category);
      } else if (type === "policies") {
        query = query.eq("policy_type", category);
        countQuery = countQuery.eq("policy_type", category);
      } else if (type === "incidents") {
        query = query.eq("incident_type", category);
        countQuery = countQuery.eq("incident_type", category);
      }
    }

    if (search) {
      query = query.ilike("content", `%${search}%`);
      countQuery = countQuery.ilike("content", `%${search}%`);
    }

    // Filter active items only (except embeddings and incidents)
    if (["sops", "manuals", "policies"].includes(type)) {
      query = query.eq("is_active", true);
      countQuery = countQuery.eq("is_active", true);
    }

    // Order by most recent
    query = query.order("created_at", { ascending: false });
    
    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    // Execute queries
    const { data: items, error, count } = await query;
    
    if (error) throw error;

    return new Response(
      JSON.stringify({
        success: true,
        type,
        items: items || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / limit)
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Knowledge list error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
