import React, { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";

// FIXED: previously queried a "repayment_events" table using this component's
// own invented column names (amount_due/amount_paid/days_late) — that table
// never existed under this schema; the real EMI tracking table is
// repayment_schedule, keyed by application_id (joined here through
// financing_applications to resolve outlet_id/name).
interface RepaymentRow {
  id: string;
  outletId: number | null;
  outletName?: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  daysOverdue: number;
  status: string;
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: "text-slate-600 bg-slate-100",
  PAID: "text-green-700 bg-green-50",
  OVERDUE: "text-amber-700 bg-amber-50",
  DEFAULTED: "text-red-700 bg-red-50",
};

export function RepaymentsPanel() {
  const [rows, setRows] = useState<RepaymentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("repayment_schedule")
        .select("id, due_date, total_amount, paid_amount, status, days_overdue, financing_applications(outlet_id, outlets(name))")
        .order("due_date", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Failed to load repayment schedule:", error.message);
        setLoading(false);
        return;
      }

      setRows(
        (data ?? []).map((r: any) => ({
          id: r.id,
          outletId: r.financing_applications?.outlet_id ?? null,
          outletName: r.financing_applications?.outlets?.name,
          dueDate: r.due_date,
          totalAmount: r.total_amount,
          paidAmount: r.paid_amount,
          daysOverdue: r.days_overdue ?? 0,
          status: r.status,
        }))
      );
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="p-6 text-center text-slate-500">Loading repayment schedule…</div>;

  return (
    <div className="p-6 space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Repayments — Collector</h2>
        <p className="text-sm text-slate-500">Post-disbursement EMI tracking, monitored continuously by the Collector agent.</p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-slate-600">Outlet</th>
              <th className="px-4 py-2 text-left font-medium text-slate-600">Due date</th>
              <th className="px-4 py-2 text-left font-medium text-slate-600">Total amount</th>
              <th className="px-4 py-2 text-left font-medium text-slate-600">Paid</th>
              <th className="px-4 py-2 text-left font-medium text-slate-600">Days overdue</th>
              <th className="px-4 py-2 text-left font-medium text-slate-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2 font-medium text-slate-800">{r.outletName ?? r.outletId ?? "—"}</td>
                <td className="px-4 py-2 text-slate-700">{r.dueDate}</td>
                <td className="px-4 py-2 text-slate-700">{r.totalAmount?.toLocaleString()}</td>
                <td className="px-4 py-2 text-slate-700">{r.paidAmount?.toLocaleString()}</td>
                <td className="px-4 py-2 text-slate-700">{r.daysOverdue > 0 ? r.daysOverdue : "—"}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLOR[r.status] ?? "text-slate-600 bg-slate-100"}`}>
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">No repayment schedule entries yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default RepaymentsPanel;
