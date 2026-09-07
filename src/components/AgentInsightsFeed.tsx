import React, { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import { Role } from "@/src/types";

interface AgentInsightsFeedProps {
  activeRole: Role | null;
  module: string;              // e.g. "Workforce", "Knowledge", "Integrations", "Access", "Peer", "Cases"
  agentName?: string;          // optional: further filter to a single agent, e.g. "shift"
  title?: string;
}

interface AgentInsight {
  id: number;
  agentName: string;
  module: string;
  outletId: string | null;
  outletName?: string;
  category: string;
  severity: "low" | "medium" | "high";
  title: string;
  details: string | null;
  status: "open" | "acknowledged" | "resolved";
  createdAt: string;
}

const SEVERITY_COLOR: Record<string, string> = {
  low: "text-slate-600 bg-slate-100",
  medium: "text-amber-700 bg-amber-50",
  high: "text-red-700 bg-red-50",
};

export function AgentInsightsFeed({ activeRole, module, agentName, title }: AgentInsightsFeedProps) {
  const [insights, setInsights] = useState<AgentInsight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      let query = supabase
        .from("agent_insights")
        .select("*, outlets(name)")
        .eq("module", module)
        .eq("status", "open")
        .order("severity", { ascending: false })
        .order("created_at", { ascending: false });

      if (agentName) query = query.eq("agent_name", agentName);

      const { data, error } = await query;
      if (error) {
        console.error(`Failed to load agent_insights for ${module}:`, error.message);
        setLoading(false);
        return;
      }

      setInsights(
        (data ?? []).map((row: any) => ({
          id: row.id,
          agentName: row.agent_name,
          module: row.module,
          outletId: row.outlet_id,
          outletName: row.outlets?.name,
          category: row.category,
          severity: row.severity,
          title: row.title,
          details: row.details,
          status: row.status,
          createdAt: row.created_at,
        }))
      );
      setLoading(false);
    }
    load();
  }, [module, agentName]);

  async function acknowledge(id: number) {
    const { error } = await supabase.from("agent_insights").update({ status: "acknowledged" }).eq("id", id);
    if (error) {
      console.error("Failed to acknowledge insight:", error.message);
      return;
    }
    setInsights((prev) => prev.filter((i) => i.id !== id));
  }

  const canAcknowledge = activeRole === "HQ" || activeRole === "Regional";

  if (loading) {
    return <div className="p-4 text-center text-sm text-slate-400">Loading agent insights…</div>;
  }

  return (
    <div className="space-y-2">
      {title && <h3 className="text-sm font-semibold text-slate-700">{title}</h3>}
      {insights.map((insight) => (
        <div
          key={insight.id}
          className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
        >
          <div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SEVERITY_COLOR[insight.severity]}`}>
                {insight.severity.toUpperCase()}
              </span>
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{insight.agentName}</span>
              {insight.outletName && <span className="text-xs text-slate-400">· {insight.outletName}</span>}
            </div>
            <p className="mt-1 text-sm font-medium text-slate-800">{insight.title}</p>
            {insight.details && <p className="text-xs text-slate-500">{insight.details}</p>}
          </div>
          {canAcknowledge && (
            <button
              onClick={() => acknowledge(insight.id)}
              className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Acknowledge
            </button>
          )}
        </div>
      ))}
      {insights.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
          No open insights for {module}.
        </div>
      )}
    </div>
  );
}

export default AgentInsightsFeed;
