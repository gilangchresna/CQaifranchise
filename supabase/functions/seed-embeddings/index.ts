/**
 * Seed Embeddings Edge Function
 * Creates embeddings for existing SOPs and other knowledge items
 * POST endpoint - Input: { source_type?, limit? }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY")!;

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // Get source_type from request
    let sourceType = "sop";
    let limit = 50;
    
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      sourceType = body.source_type || "sop";
      limit = body.limit || 50;
    }

    // Map source_type to table
    const tableMap: Record<string, string> = {
      sop: "knowledge_sops",
      sops: "knowledge_sops",
      incident: "knowledge_incidents",
      incidents: "knowledge_incidents",
      manual: "knowledge_manuals",
      manuals: "knowledge_manuals",
      policy: "knowledge_policies",
      policies: "knowledge_policies",
    };

    const table = tableMap[sourceType] || "knowledge_sops";

    // Fetch items from source table
    const { data: items, error } = await supabase
      .from(table)
      .select("*")
      .limit(limit);

    if (error) throw error;
    if (!items || items.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No items found", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check which items already have embeddings
    const { data: existingEmbeddings } = await supabase
      .from("knowledge_embeddings")
      .select("source_id")
      .eq("source_type", sourceType === "sops" ? "sop" : sourceType);

    const existingIds = new Set(existingEmbeddings?.map(e => e.source_id) || []);

    const results = {
      success: 0,
      skipped: 0,
      errors: [] as string[],
      total: items.length,
    };

    // Process each item
    for (const item of items) {
      // Skip if already has embedding
      if (existingIds.has(item.id)) {
        results.skipped++;
        continue;
      }

      // Prepare content for embedding
      const title = item.title || item.incident_type || "";
      const content = item.content || "";
      const fullText = `${title}\n\n${content}`;

      if (fullText.length < 10) {
        results.skipped++;
        continue;
      }

      try {
        // Create embedding
        const embedRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${geminiApiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "models/text-embedding-004",
              content: { parts: [{ text: fullText }] }
            })
          }
        );

        if (!embedRes.ok) {
          throw new Error(`Embedding API error: ${embedRes.status}`);
        }

        const embedData = await embedRes.json();
        const embedding = embedData.embedding?.values;

        if (!embedding) {
          throw new Error("No embedding returned");
        }

        // Store embedding
        const metadata: Record<string, any> = {};
        if (item.category) metadata.category = item.category;
        if (item.incident_type) metadata.incident_type = item.incident_type;
        if (item.policy_type) metadata.policy_type = item.policy_type;

        const { error: insertError } = await supabase
          .from("knowledge_embeddings")
          .insert({
            content: fullText,
            source_type: sourceType === "sops" ? "sop" : sourceType,
            source_id: item.id,
            metadata: metadata,
            embedding: embedding,
          });

        if (insertError) {
          throw insertError;
        }

        results.success++;
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (err: any) {
        results.errors.push(`${title?.substring(0, 30)}: ${err.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Embedded ${results.success}/${results.total} items (${results.skipped} skipped, ${results.errors.length} errors)`,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
