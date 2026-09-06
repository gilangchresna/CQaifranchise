/**
 * Embeddings Search Edge Function
 * Semantic search for RAG using vector similarity
 * POST endpoint - Input: { query, source_types?, limit?, threshold? }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SearchRequest {
  query: string;
  source_types?: string[];
  limit?: number;
  threshold?: number;
  outlet_id?: number;
}

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
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

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

  // Only allow POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body: SearchRequest = await req.json();
    const limit = Math.min(body.limit || 5, 20);
    const threshold = body.threshold || 0.7;

    if (!body.query) {
      return new Response(
        JSON.stringify({ error: "query is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Check if Gemini API key is available
    if (!geminiApiKey) {
      // Fallback: simple text search
      const { data, error } = await supabase
        .from("knowledge_embeddings")
        .select("id, content, source_type, metadata")
        .ilike("content", `%${body.query}%`)
        .limit(limit);

      if (error) throw error;

      return new Response(
        JSON.stringify({
          success: true,
          results: data || [],
          query: body.query,
          mode: "text_search",
          message: "No Gemini API key - using text search fallback"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create query embedding
    const embedRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "models/text-embedding-004",
          content: { parts: [{ text: body.query }] }
        })
      }
    );

    if (!embedRes.ok) {
      throw new Error("Failed to create query embedding");
    }

    const embedData = await embedRes.json();
    const queryEmbedding = embedData.embedding?.values;

    if (!queryEmbedding) {
      throw new Error("No embedding returned");
    }

    // Semantic search using RPC function
    const { data: results, error } = await supabase.rpc("match_knowledge_embeddings", {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: limit
    });

    if (error) {
      // Fallback to text search if RPC fails
      console.warn("RPC search failed, falling back to text search:", error.message);
      
      const { data: fallbackResults, error: fallbackError } = await supabase
        .from("knowledge_embeddings")
        .select("id, content, source_type, metadata")
        .ilike("content", `%${body.query}%`)
        .limit(limit);

      if (fallbackError) throw fallbackError;

      return new Response(
        JSON.stringify({
          success: true,
          results: fallbackResults || [],
          query: body.query,
          mode: "text_search_fallback",
          message: "Vector search unavailable - using text search"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter by source types if provided
    let filteredResults = results || [];
    if (body.source_types && body.source_types.length > 0) {
      filteredResults = filteredResults.filter((r: any) =>
        body.source_types!.includes(r.source_type)
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        results: filteredResults,
        query: body.query,
        mode: "vector_search",
        count: filteredResults.length
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Search error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
