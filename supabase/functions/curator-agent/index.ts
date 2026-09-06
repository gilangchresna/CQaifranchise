// Curator Agent: Knowledge base quality monitoring
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getServiceClient, createInsight, logAgentRun } from "../_shared/agentInsights.ts";

const supabase = getServiceClient();
const SOP_STALE_DAYS = 90; // SOP older than 90 days = stale
const POLICY_STALE_DAYS = 180; // Policy older than 180 days = review needed

serve(async (req) => {
  try {
    const today = new Date();
    const insights: any[] = [];

    // 1. Check for stale SOPs
    const staleDate = new Date(today.getTime() - SOP_STALE_DAYS * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: staleSOPs } = await supabase
      .from("knowledge_sops")
      .select("id, title, version, updated_at, outlet_id")
      .lt("updated_at", staleDate)
      .eq("is_active", true);

    for (const sop of staleSOPs ?? []) {
      await createInsight(supabase, {
        agentName: "curator",
        module: "Knowledge",
        outletId: sop.outlet_id?.toString() ?? null,
        category: "stale_sop",
        severity: "medium",
        title: `Stale SOP: ${sop.title}`,
        details: `SOP last updated ${SOP_STALE_DAYS}+ days ago. Version ${sop.version}. Review and update recommended.`,
      });
      insights.push({ type: "stale_sop", title: sop.title });
    }

    // 2. Check for expired/missing policies
    const { data: expiredPolicies } = await supabase
      .from("knowledge_policies")
      .select("id, title, effective_date, is_active")
      .lt("effective_date", today.toISOString().split('T')[0])
      .eq("is_active", true);

    for (const policy of expiredPolicies ?? []) {
      await createInsight(supabase, {
        agentName: "curator",
        module: "Knowledge",
        outletId: policy.outlet_id?.toString() ?? null,
        category: "expired_policy",
        severity: "high",
        title: `Expired policy: ${policy.title}`,
        details: `Policy effective date: ${policy.effective_date}. Policy needs renewal or retirement.`,
      });
      insights.push({ type: "expired_policy", title: policy.title });
    }

    // 3. Check for unresolved knowledge_incidents (post-mortems without resolution)
    const { data: unresolvedIncidents } = await supabase
      .from("knowledge_incidents")
      .select("id, incident_type, description, created_at")
      .is("resolution", null);

    for (const incident of unresolvedIncidents ?? []) {
      await createInsight(supabase, {
        agentName: "curator",
        module: "Knowledge",
        outletId: incident.outlet_id?.toString() ?? null,
        category: "unresolved_incident",
        severity: "medium",
        title: `Unresolved incident: ${incident.incident_type}`,
        details: `Incident created ${new Date(incident.created_at).toLocaleDateString()} without resolution. Document resolution for future reference.`,
      });
      insights.push({ type: "unresolved_incident", title: incident.incident_type });
    }

    // 4. Check for inactive SOPs that might need reactivation
    const { data: inactiveSOPs } = await supabase
      .from("knowledge_sops")
      .select("id, title")
      .eq("is_active", false);

    // Only flag if there are very few active SOPs
    const { count: activeSOPCount } = await supabase
      .from("knowledge_sops")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);

    if (inactiveSOPs && inactiveSOPs.length > 5 && (activeSOPCount ?? 0) < 10) {
      await createInsight(supabase, {
        agentName: "curator",
        module: "Knowledge",
        outletId: null,
        category: "low_sop_coverage",
        severity: "low",
        title: `Low SOP coverage: ${activeSOPCount} active SOPs`,
        details: `Only ${activeSOPCount} active SOPs. ${inactiveSOPs.length} inactive SOPs available for review. Consider reactivating relevant ones.`,
      });
    }

    await logAgentRun(supabase, "curator", { 
      sops_checked: staleSOPs?.length ?? 0,
      policies_checked: expiredPolicies?.length ?? 0,
      insights_created: insights.length 
    });

    return new Response(JSON.stringify({ 
      success: true,
      insights_created: insights.length,
      details: insights
    }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Curator error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
