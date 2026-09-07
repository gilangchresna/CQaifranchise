import React, { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";

interface RepaymentEvent {
  id: number;
  outletId: string;
  outletName?: string;
  dueDate: string;
  amountDue: number;
  amountPaid: number;
  daysLate: number;
  status: "due" | "paid" | "late" | "defaulted";
}

const STATUS_COLOR: Record<string, string> = {
  due: "text-slate-600 bg-slate-100",
  paid: "text-green-700 bg-green-50",
  late: "text-amber-700 bg-amber-50",
  defaulted: "text-red-700 bg-red-50",
};

export function RepaymentsPanel() {
  const [events, setEvents] = useState<RepaymentEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("repayment_events")
        .select("*, outlets(name)")
        .order("due_date", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Failed to load repayment events:", error.message);
        setLoading(false);
        return;
      }

      setEvents(
        (data ?? []).map((r: any) => ({
          id: r.id,
          outletId: r.outlet_id,
          outletName: r.outlets?.name,
          dueDate: r.due_date,
          amountDue: r.amount_due,
          amountPaid: r.amount_paid,
          daysLate: r.days_late,
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
              <th className="px-4 py-2 text-left font-medium text-slate-600">Amount due</th>
              <th className="px-4 py-2 text-left font-medium text-slate-600">Paid</th>
              <th className="px-4 py-2 text-left font-medium text-slate-600">Days late</th>
              <th className="px-4 py-2 text-left font-medium text-slate-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {events.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-2 font-medium text-slate-800">{e.outletName ?? e.outletId}</td>
                <td className="px-4 py-2 text-slate-700">{e.dueDate}</td>
                <td className="px-4 py-2 text-slate-700">{e.amountDue.toLocaleString()}</td>
                <td className="px-4 py-2 text-slate-700">{e.amountPaid.toLocaleString()}</td>
                <td className="px-4 py-2 text-slate-700">{e.daysLate > 0 ? e.daysLate : "—"}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLOR[e.status]}`}>
                    {e.status}
                  </span>
                </td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">No repayment events yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default RepaymentsPanel;
