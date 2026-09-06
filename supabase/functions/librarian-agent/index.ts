// supabase/functions/librarian-agent/index.ts
//
// Librarian: audits existing knowledge base content for staleness — articles
// not reviewed in a long time, or articles that keep getting attached to
// cases that end up escalated anyway (suggesting the article no longer
// resolves the issue). Distinct from Curator (which creates new content);
// Librarian maintains what already exists. Suggested cadence: monthly.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getServiceClient, createInsight, logAgentRun } from "../_shared/agentInsights.ts";

const supabase = getServiceClient();

const STALE_DAYS_THRESHOLD = 365;
const INEFFECTIVE_ESCALATION_RATE = 0.4; // articles attached to cases that still escalate >40% of the time

interface KbArticleSignal {
  article_id: string;
  title: string;
  last_reviewed_at: string; // ISO date
  attached_case_count: number;
  attached_case_escalation_rate: number; // 0-1
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

serve(async (req) => {
  try {
    const { articles } = (await req.json()) as { articles: KbArticleSignal[] };
    if (!Array.isArray(articles) || articles.length === 0) {
      return new Response(JSON.stringify({ error: "articles[] required" }), { status: 400 });
    }

    const flagged = [];
    for (const a of articles) {
      const staleDays = daysSince(a.last_reviewed_at);
      const isStale = staleDays > STALE_DAYS_THRESHOLD;
      const isIneffective =
        a.attached_case_count >= 5 && a.attached_case_escalation_rate > INEFFECTIVE_ESCALATION_RATE;

      if (!isStale && !isIneffective) continue;

      const reasons = [];
      if (isStale) reasons.push(`not reviewed in ${staleDays} days`);
      if (isIneffective)
        reasons.push(`${(a.attached_case_escalation_rate * 100).toFixed(0)}% of attached cases still escalate`);

      await createInsight(supabase, {
        agentName: "librarian",
        module: "Knowledge",
        outletId: null,
        category: isIneffective ? "kb_article_ineffective" : "kb_article_stale",
        severity: isIneffective ? "high" : "low",
        title: `"${a.title}" needs review — ${reasons.join(", ")}`,
        details: "Flagged for human review in Knowledge Base Admin — consider updating or retiring this article.",
        payload: { article_id: a.article_id, stale_days: staleDays, escalation_rate: a.attached_case_escalation_rate },
      });
      flagged.push({ article_id: a.article_id, reasons });
    }

    await logAgentRun(supabase, "librarian", { articles_scanned: articles.length, flagged: flagged.length });

    return new Response(JSON.stringify({ flagged }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
