import React, { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";

// FIXED: previously queried period_start/period_end/expected_royalty/
// ledger_royalty columns that don't exist — the corrected royalty_reconciliation
// table (matching what ledger-agent actually writes) uses period_month (text,
// 'YYYY-MM') and expected_amount/actual_amount/variance instead.
interface ReconciliationRow {
  id: number;
  outletId: number | null;
  outletName?: string;
  periodMonth: string;
  expectedAmount: number;
  actualAmount: number;
  variance: number;
  status: string;
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
        .order("period_month", { ascending: false })
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
          periodMonth: r.period_month,
          expectedAmount: r.expected_amount,
          actualAmount: r.actual_amount,
          variance: r.variance,
          status: r.status,
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
          Expected (formula-calculated) royalty vs. actual collected amount, per period.
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-slate-600">Outlet</th>
              <th className="px-4 py-2 text-left font-medium text-slate-600">Period</th>
              <th className="px-4 py-2 text-left font-medium text-slate-600">Expected</th>
              <th className="px-4 py-2 text-left font-medium text-slate-600">Actual</th>
              <th className="px-4 py-2 text-left font-medium text-slate-600">Variance</th>
              <th className="px-4 py-2 text-left font-medium text-slate-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id} className={r.status === "flagged" ? "bg-red-50/40" : undefined}>
                <td className="px-4 py-2 font-medium text-slate-800">{r.outletName ?? r.outletId ?? "—"}</td>
                <td className="px-4 py-2 text-slate-700">{r.periodMonth}</td>
                <td className="px-4 py-2 text-slate-700">{r.expectedAmount?.toLocaleString()}</td>
                <td className="px-4 py-2 text-slate-700">{r.actualAmount?.toLocaleString()}</td>
                <td className={`px-4 py-2 font-medium ${r.status === "flagged" ? "text-red-700" : "text-slate-700"}`}>
                  {r.variance >= 0 ? "+" : ""}{r.variance?.toLocaleString()}
                </td>
                <td className="px-4 py-2 text-slate-700">{r.status}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">No reconciliation runs yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default RoyaltyReconciliationPanel;
