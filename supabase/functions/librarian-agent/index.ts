// Librarian Agent: Document management and version control
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getServiceClient, createInsight, logAgentRun } from "../_shared/agentInsights.ts";

const supabase = getServiceClient();

serve(async (req) => {
  try {
    const today = new Date();
    const insights: any[] = [];

    // 1. Check for duplicate document titles (potential versioning issues)
    const { data: allDocs } = await supabase
      .from("documents")
      .select("id, title, category, created_at");

    const titleCount: Record<string, number> = {};
    for (const doc of allDocs ?? []) {
      const key = `${doc.category || 'uncategorized'}:${doc.title}`;
      titleCount[key] = (titleCount[key] || 0) + 1;
    }

    const duplicates = Object.entries(titleCount).filter(([_, count]) => count > 1);
    if (duplicates.length > 0) {
      await createInsight(supabase, {
        agentName: "librarian",
        module: "Knowledge",
        outletId: null,
        category: "duplicate_documents",
        severity: "low",
        title: `${duplicates.length} duplicate document titles found`,
        details: `Consider consolidating: ${duplicates.slice(0, 3).map(([t]) => t.split(':')[1]).join(', ')}${duplicates.length > 3 ? '...' : ''}`,
      });
    }

    // 2. Check for documents without category
    const { data: uncategorized } = await supabase
      .from("documents")
      .select("id")
      .is("category", null);

    if (uncategorized && uncategorized.length > 0) {
      await createInsight(supabase, {
        agentName: "librarian",
        module: "Knowledge",
        outletId: null,
        category: "uncategorized_documents",
        severity: "low",
        title: `${uncategorized.length} documents without category`,
        details: `${uncategorized.length} documents need categorization for better organization.`,
      });
    }

    // 3. Check for old financial_documents (audit trail)
    const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate()).toISOString();
    const { data: oldFinancialDocs } = await supabase
      .from("financial_documents")
      .select("id, document_type, created_at")
      .lt("created_at", oneYearAgo);

    if (oldFinancialDocs && oldFinancialDocs.length > 0) {
      await createInsight(supabase, {
        agentName: "librarian",
        module: "Knowledge",
        outletId: null,
        category: "archivable_documents",
        severity: "low",
        title: `${oldFinancialDocs.length} financial documents >1 year old`,
        details: `Consider archiving old financial documents to improve database performance.`,
      });
    }

    // 4. Check for regulatory_documents without expiry tracking
    const { data: regulatoryDocs } = await supabase
      .from("regulatory_documents")
      .select("id, title, expiry_date")
      .order("expiry_date", { ascending: true })
      .limit(10);

    const upcoming = (regulatoryDocs ?? []).filter(d => {
      const expiry = new Date(d.expiry_date);
      const daysUntil = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntil > 0 && daysUntil <= 30;
    });

    for (const doc of upcoming) {
      const daysUntil = Math.floor((new Date(doc.expiry_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      await createInsight(supabase, {
        agentName: "librarian",
        module: "Knowledge",
        outletId: null,
        category: "expiring_document",
        severity: daysUntil <= 7 ? "high" : "medium",
        title: `Document expiring in ${daysUntil} days: ${doc.title}`,
        details: `Regulatory document expires ${doc.expiry_date}. Renew before expiration.`,
      });
      insights.push({ type: "expiring_document", title: doc.title });
    }

    await logAgentRun(supabase, "librarian", { 
      documents_checked: allDocs?.length ?? 0,
      insights_created: insights.length + (uncategorized?.length ? 1 : 0)
    });

    return new Response(JSON.stringify({ 
      success: true,
      documents_checked: allDocs?.length ?? 0,
      insights_created: insights.length,
      details: insights
    }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Librarian error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
