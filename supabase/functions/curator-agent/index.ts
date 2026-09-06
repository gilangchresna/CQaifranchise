// supabase/functions/curator-agent/index.ts
//
// Curator: detects repeated similar cases with no matching SOP/knowledge
// article, and drafts a starter KB article for human review — turning
// resolved cases into institutional knowledge. Suggested cadence: weekly.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getServiceClient, createInsight, logAgentRun } from "../_shared/agentInsights.ts";

const supabase = getServiceClient();

const REPEAT_THRESHOLD = 3; // same case category recurring this many times with no KB match

interface CaseCluster {
  category: string;
  occurrences: number;
  sample_case_ids: string[];
  has_matching_kb_article: boolean;
}

serve(async (req) => {
  try {
    const { clusters } = (await req.json()) as { clusters: CaseCluster[] };
    if (!Array.isArray(clusters) || clusters.length === 0) {
      return new Response(JSON.stringify({ error: "clusters[] required" }), { status: 400 });
    }

    const drafted = [];
    for (const c of clusters) {
      if (c.has_matching_kb_article || c.occurrences < REPEAT_THRESHOLD) continue;

      await createInsight(supabase, {
        agentName: "curator",
        module: "Knowledge",
        outletId: null,
        category: "kb_gap_detected",
        severity: c.occurrences >= REPEAT_THRESHOLD * 2 ? "high" : "medium",
        title: `"${c.category}" has recurred ${c.occurrences}x with no matching SOP`,
        details: `Suggested draft: create a KB article for "${c.category}" covering the resolution pattern seen in cases ${c.sample_case_ids.join(", ")}. Review and publish via Knowledge Base Admin.`,
        payload: { category: c.category, occurrences: c.occurrences, sample_case_ids: c.sample_case_ids },
      });
      drafted.push({ category: c.category, occurrences: c.occurrences });
    }

    await logAgentRun(supabase, "curator", { clusters_scanned: clusters.length, drafted: drafted.length });

    return new Response(JSON.stringify({ drafted }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
