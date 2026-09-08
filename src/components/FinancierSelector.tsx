import React, { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import { Role } from "@/src/types";

// This component did not exist anywhere in the delivered source, even though
// three Edge Functions (send-financing-request, underwriter-agent,
// ledger-agent) already depend on the financiers/financing_requests tables
// it's meant to populate. Built to match the ACTUAL function contract:
// send-financing-request expects a POST body of { request_id, financier_id }
// (snake_case, not { requestId } as an earlier draft of this component assumed).

interface FinancierSelectorProps {
  activeRole: Role | null;
  outletId: number;
  market: "SG" | "ID";
}

interface Financier {
  id: string;
  name: string;
  market: "SG" | "ID" | "Both";
  contactName: string | null;
  contactEmail: string;
  logoUrl: string | null;
}

export function FinancierSelector({ activeRole, outletId, market }: FinancierSelectorProps) {
  const [financiers, setFinanciers] = useState<Financier[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFinancier, setActiveFinancier] = useState<Financier | null>(null);
  const [purpose, setPurpose] = useState("Business expansion");
  const [requestedAmount, setRequestedAmount] = useState<number>(50000);
  const [termMonths, setTermMonths] = useState<number>(24);
  const [sending, setSending] = useState(false);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("financiers")
        .select("*")
        .eq("status", "active")
        .or(`market.eq.${market},market.eq.Both`);

      if (error) {
        console.error("Failed to load financiers:", error.message);
        setLoading(false);
        return;
      }

      setFinanciers(
        (data ?? []).map((f: any) => ({
          id: f.id,
          name: f.name,
          market: f.market,
          contactName: f.contact_name,
          contactEmail: f.contact_email,
          logoUrl: f.logo_url,
        }))
      );
      setLoading(false);
    }
    load();
  }, [market]);

  async function submitRequest(financier: Financier) {
    setSending(true);

    const { data: inserted, error: insertErr } = await supabase
      .from("financing_requests")
      .insert({
        outlet_id: outletId,
        financier_id: financier.id,
        purpose,
        requested_amount: requestedAmount,
        currency: "SGD",
        requested_term_months: termMonths,
        market,
        status: "pending",
      })
      .select()
      .single();

    if (insertErr || !inserted) {
      console.error("Failed to create financing request:", insertErr?.message);
      setSending(false);
      return;
    }

    // Matches send-financing-request's actual expected body shape exactly.
    const { error: fnErr } = await supabase.functions.invoke("send-financing-request", {
      body: { request_id: inserted.id, financier_id: financier.id },
    });
    if (fnErr) {
      console.error("send-financing-request failed:", fnErr.message);
    }

    setSentIds((prev) => new Set(prev).add(financier.id));
    setSending(false);
    setActiveFinancier(null);
  }

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading financiers…</div>;
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Financing Partners</h2>
        <p className="text-sm text-slate-500">Select a financier to send a financing request.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {financiers.map((f) => (
          <div key={f.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="font-semibold text-slate-800">{f.name}</div>
            <div className="text-xs text-slate-400">{f.market}</div>
            <button
              onClick={() => setActiveFinancier(f)}
              className="mt-4 w-full rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
              disabled={sending}
            >
              {sentIds.has(f.id) ? "Request sent ✓ — send again" : "Request Financing"}
            </button>
          </div>
        ))}
        {financiers.length === 0 && (
          <div className="col-span-full rounded-lg border border-dashed border-slate-200 p-8 text-center text-slate-400">
            No financiers available for this market yet.
          </div>
        )}
      </div>

      {activeFinancier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-slate-800">Request financing — {activeFinancier.name}</h3>

            <label className="mt-3 block text-xs font-medium text-slate-600">Purpose</label>
            <input
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
            />

            <label className="mt-3 block text-xs font-medium text-slate-600">Requested amount</label>
            <input
              type="number"
              value={requestedAmount}
              onChange={(e) => setRequestedAmount(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
            />

            <label className="mt-3 block text-xs font-medium text-slate-600">Term (months)</label>
            <input
              type="number"
              value={termMonths}
              onChange={(e) => setTermMonths(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setActiveFinancier(null)}
                className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
                disabled={sending}
              >
                Cancel
              </button>
              <button
                onClick={() => submitRequest(activeFinancier)}
                className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
                disabled={sending}
              >
                {sending ? "Sending…" : "Send request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FinancierSelector;
