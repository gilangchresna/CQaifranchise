import React, { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";

// Displays what sentinel-agent actually writes into compliance_flags
// (flag_type, severity, description, flagged_at) — this table existed only
// as an Edge Function write target with no UI to view it before this file.
interface ComplianceFlag {
  id: number;
  outletId: number | null;
  outletName?: string;
  flagType: string;
  severity: "low" | "medium" | "high";
  description: string | null;
  flaggedAt: string;
  status: "open" | "acknowledged" | "resolved";
}

const SEVERITY_COLOR: Record<string, string> = {
  low: "text-slate-600 bg-slate-100",
  medium: "text-amber-700 bg-amber-50",
  high: "text-red-700 bg-red-50",
};

export function ComplianceFlags() {
  const [flags, setFlags] = useState<ComplianceFlag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("compliance_flags")
        .select("*, outlets(name)")
        .eq("status", "open")
        .order("severity", { ascending: false })
        .order("flagged_at", { ascending: false });

      if (error) {
        console.error("Failed to load compliance flags:", error.message);
        setLoading(false);
        return;
      }

      setFlags(
        (data ?? []).map((f: any) => ({
          id: f.id,
          outletId: f.outlet_id,
          outletName: f.outlets?.name,
          flagType: f.flag_type,
          severity: f.severity,
          description: f.description,
          flaggedAt: f.flagged_at,
          status: f.status,
        }))
      );
      setLoading(false);
    }
    load();
  }, []);

  async function acknowledge(id: number) {
    const { error } = await supabase.from("compliance_flags").update({ status: "acknowledged" }).eq("id", id);
    if (error) {
      console.error("Failed to acknowledge flag:", error.message);
      return;
    }
    setFlags((prev) => prev.filter((f) => f.id !== id));
  }

  if (loading) return <div className="p-6 text-center text-slate-500">Loading compliance flags…</div>;

  return (
    <div className="p-6 space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Compliance — Sentinel</h2>
        <p className="text-sm text-slate-500">SLA breaches and other compliance flags raised by the Sentinel agent.</p>
      </div>
      <div className="space-y-2">
        {flags.map((flag) => (
          <div key={flag.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SEVERITY_COLOR[flag.severity]}`}>
                  {flag.severity.toUpperCase()}
                </span>
                <span className="font-medium text-slate-800">{flag.outletName ?? flag.outletId ?? "—"}</span>
                <span className="text-xs text-slate-400">{flag.flagType.replace(/_/g, " ")}</span>
              </div>
              {flag.description && <p className="mt-1 text-sm text-slate-600">{flag.description}</p>}
            </div>
            <button
              onClick={() => acknowledge(flag.id)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Acknowledge
            </button>
          </div>
        ))}
        {flags.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-slate-400">
            No open compliance flags.
          </div>
        )}
      </div>
    </div>
  );
}

export default ComplianceFlags;
