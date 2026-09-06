// Voice: monitors case response times
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getServiceClient, createInsight, logAgentRun } from "../_shared/agentInsights.ts";

const supabase = getServiceClient();

serve(async (req) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Check cases without updates in 24h
    const { data: oldCases } = await supabase
      .from("cases")
      .select("id, title, status, updated_at")
      .neq("status", "closed")
      .order("updated_at", { ascending: true })
      .limit(20);

    const stale: any[] = [];
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;

    for (const c of oldCases ?? []) {
      const updatedAt = new Date(c.updated_at).getTime();
      if (updatedAt < dayAgo) {
        await createInsight(supabase, {
          agentName: "voice",
          module: "Cases",
          outletId: null,
          category: "stale_case",
          severity: "medium",
          title: `Case not updated in 24h: ${c.title?.slice(0, 50)}`,
          details: `Case ${c.id} (${c.status}) last updated ${Math.floor((Date.now() - updatedAt) / (1000 * 60 * 60))} hours ago.`,
        });
        stale.push(c.id);
      }
    }

    await logAgentRun(supabase, "voice", { cases_checked: oldCases?.length ?? 0, stale: stale.length });

    return new Response(JSON.stringify({ 
      success: true,
      cases_checked: oldCases?.length ?? 0,
      stale_cases: stale.length
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Voice error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
