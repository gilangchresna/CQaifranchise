/**
 * Embeddings Create Edge Function
 * Creates vector embeddings for knowledge base documents
 * POST endpoint - Input: { content, source_type, metadata?, outlet_id? }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmbedRequest {
  content: string;
  source_type: "sop" | "manual" | "incident" | "policy";
  metadata?: Record<string, any>;
  outlet_id?: number;
  region_id?: number;
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
    const body: EmbedRequest = await req.json();

    // Validate required fields
    if (!body.content || !body.source_type) {
      return new Response(
        JSON.stringify({ error: "content and source_type are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validTypes = ["sop", "manual", "incident", "policy"];
    if (!validTypes.includes(body.source_type)) {
      return new Response(
        JSON.stringify({ error: `source_type must be one of: ${validTypes.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Check if Gemini API key is available
    if (!geminiApiKey) {
      // Fallback: store without embedding (for manual embedding later)
      const { data, error } = await supabase
        .from("knowledge_embeddings")
        .insert({
          content: body.content,
          source_type: body.source_type,
          metadata: body.metadata || {},
          outlet_id: body.outlet_id,
          region_id: body.region_id,
          embedding: null, // Will need manual embedding
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({
          success: true,
          id: data.id,
          message: "Content stored but embedding not generated (no GEMINI_API_KEY)"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create embedding using Gemini text-embedding
    const embedRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "models/text-embedding-004",
          content: { parts: [{ text: body.content }] }
        })
      }
    );

    if (!embedRes.ok) {
      const errText = await embedRes.text();
      throw new Error(`Embedding API error: ${errText}`);
    }

    const embedData = await embedRes.json();
    const embedding = embedData.embedding?.values;

    if (!embedding) {
      throw new Error("No embedding returned from API");
    }

    // Store in database
    const { data, error } = await supabase
      .from("knowledge_embeddings")
      .insert({
        content: body.content,
        source_type: body.source_type,
        metadata: body.metadata || {},
        embedding: embedding,
        outlet_id: body.outlet_id,
        region_id: body.region_id,
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({
        success: true,
        id: data.id,
        message: "Embedding created and stored successfully",
        embedding_dimensions: embedding.length
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Embeddings create error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
