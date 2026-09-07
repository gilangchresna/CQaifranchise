import React, { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";

interface ReconciliationRow {
  id: number;
  outletId: string;
  outletName?: string;
  periodStart: string;
  periodEnd: string;
  expectedRoyalty: number;
  ledgerRoyalty: number;
  variance: number;
  variancePct: number;
  flagged: boolean;
}

export function RoyaltyReconciliationPanel() {
  const [rows, setRows] = useState<ReconciliationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("royalty_reconciliation")
        .select("*, outlets(name)")
        .order("period_end", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Failed to load royalty reconciliation:", error.message);
        setLoading(false);
        return;
      }

      setRows(
        (data ?? []).map((r: any) => ({
          id: r.id,
          outletId: r.outlet_id,
          outletName: r.outlets?.name,
          periodStart: r.period_start,
          periodEnd: r.period_end,
          expectedRoyalty: r.expected_royalty,
          ledgerRoyalty: r.ledger_royalty,
          variance: r.variance,
          variancePct: r.variance_pct,
          flagged: r.flagged,
        }))
      );
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="p-6 text-center text-slate-500">Loading royalty reconciliation…</div>;

  return (
    <div className="p-6 space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Royalty Reconciliation — Ledger</h2>
        <p className="text-sm text-slate-500">
          Expected (formula-calculated) royalty vs. what landed in the bank GL / sales ledger, per period.
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-slate-600">Outlet</th>
              <th className="px-4 py-2 text-left font-medium text-slate-600">Period</th>
              <th className="px-4 py-2 text-left font-medium text-slate-600">Expected</th>
              <th className="px-4 py-2 text-left font-medium text-slate-600">Ledger</th>
              <th className="px-4 py-2 text-left font-medium text-slate-600">Variance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id} className={r.flagged ? "bg-red-50/40" : undefined}>
                <td className="px-4 py-2 font-medium text-slate-800">{r.outletName ?? r.outletId}</td>
                <td className="px-4 py-2 text-slate-700">{r.periodStart} – {r.periodEnd}</td>
                <td className="px-4 py-2 text-slate-700">{r.expectedRoyalty.toLocaleString()}</td>
                <td className="px-4 py-2 text-slate-700">{r.ledgerRoyalty.toLocaleString()}</td>
                <td className={`px-4 py-2 font-medium ${r.flagged ? "text-red-700" : "text-slate-700"}`}>
                  {r.variance >= 0 ? "+" : ""}{r.variance.toLocaleString()} ({(r.variancePct * 100).toFixed(1)}%)
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">No reconciliation runs yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default RoyaltyReconciliationPanel;
