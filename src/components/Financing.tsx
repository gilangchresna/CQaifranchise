import React, { useEffect, useState } from 'react';
import {
  Landmark,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  Banknote,
  RefreshCw,
  AlertCircle,
  PlusCircle,
} from 'lucide-react';
import { Role } from '@/src/types';
import { supabase, EDGE_FUNCTIONS_URL } from '@/src/lib/supabase';

// Mirrors public.financing_application_status in
// supabase/migrations/20260805000000_financing_and_reporting.sql
type FinancingStatus =
  | 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'DECLINED'
  | 'DISBURSED' | 'REPAYING' | 'CLOSED' | 'CANCELLED';

interface FinancingApplication {
  id: string;
  purpose: string;
  requested_amount: number;
  currency: string;
  status: FinancingStatus;
  lender_code: string;
  lender_reference_id: string | null;
  approved_amount: number | null;
  disbursed_amount: number | null;
  decision_reason: string | null;
  created_at: string;
  outlet_id: number | null;
}

const STATUS_STYLE: Record<FinancingStatus, { label: string; className: string; icon: React.ElementType }> = {
  DRAFT: { label: 'Draft', className: 'bg-slate-50 text-slate-600 border-slate-200', icon: Clock },
  SUBMITTED: { label: 'Submitted', className: 'bg-blue-50 text-blue-700 border-blue-200', icon: Send },
  UNDER_REVIEW: { label: 'Under Review', className: 'bg-orange-50 text-orange-700 border-orange-200', icon: Clock },
  APPROVED: { label: 'Approved', className: 'bg-green-50 text-green-700 border-green-200', icon: CheckCircle2 },
  DECLINED: { label: 'Declined', className: 'bg-red-50 text-red-700 border-red-200', icon: XCircle },
  DISBURSED: { label: 'Disbursed', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: Banknote },
  REPAYING: { label: 'Repaying', className: 'bg-purple-50 text-purple-700 border-purple-200', icon: RefreshCw },
  CLOSED: { label: 'Closed', className: 'bg-slate-50 text-slate-500 border-slate-200', icon: CheckCircle2 },
  CANCELLED: { label: 'Cancelled', className: 'bg-slate-50 text-slate-400 border-slate-200', icon: XCircle },
};

export function Financing({ activeRole }: { activeRole: Role }) {
  const [applications, setApplications] = useState<FinancingApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [purpose, setPurpose] = useState('FRANCHISEE_SETUP');
  const [amount, setAmount] = useState('');
  const [termMonths, setTermMonths] = useState('12');

  useEffect(() => {
    fetchApplications();
  }, []);

  async function fetchApplications() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('financing_applications')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setApplications(data || []);
    } catch (err) {
      console.error('Error fetching financing applications:', err);
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitApplication(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    const requestedAmount = parseFloat(amount);
    if (!requestedAmount || requestedAmount <= 0) {
      setSubmitError('Enter a valid loan amount.');
      return;
    }

    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${EDGE_FUNCTIONS_URL}/lender-bridge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({
          action: 'submit_application',
          purpose,
          requested_amount: requestedAmount,
          requested_term_months: parseInt(termMonths, 10) || null,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || `Request failed (${response.status})`);
      }
      await fetchApplications();
      setShowApplyModal(false);
      setAmount('');
      setPurpose('FRANCHISEE_SETUP');
      setTermMonths('12');
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit application.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-3 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  const activeCount = applications.filter((a) => !['CLOSED', 'CANCELLED', 'DECLINED'].includes(a.status)).length;
  const totalDisbursed = applications.reduce((sum, a) => sum + (a.disbursed_amount || 0), 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Franchisee Bridge Financing</h2>
          <p className="text-sm text-slate-500 mt-1">
            Request working-capital bridge loans for franchisee setup (fit-out, opening inventory, staffing)
            through CyberQuote's lender bridge integration.
          </p>
        </div>
        <button
          onClick={() => setShowApplyModal(true)}
          className="rounded-md px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-all flex items-center gap-2 shadow-sm"
        >
          <PlusCircle className="w-4 h-4" /> Apply for Bridge Loan
        </button>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Active Applications</p>
          <p className="text-2xl font-semibold text-slate-900 mt-2">{activeCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Total Applications</p>
          <p className="text-2xl font-semibold text-slate-900 mt-2">{applications.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Total Disbursed</p>
          <p className="text-2xl font-semibold text-slate-900 mt-2">
            {applications[0]?.currency || 'SGD'} {totalDisbursed.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
          <Landmark className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-slate-900">Applications</h3>
        </div>
        {applications.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Landmark className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">No bridge-loan applications yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <th className="px-6 py-3">Purpose</th>
                <th className="px-6 py-3">Requested</th>
                <th className="px-6 py-3">Lender Ref</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => {
                const style = STATUS_STYLE[app.status] || STATUS_STYLE.DRAFT;
                const Icon = style.icon;
                return (
                  <tr key={app.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-6 py-4 font-medium text-slate-900">{app.purpose.replaceAll('_', ' ')}</td>
                    <td className="px-6 py-4 text-slate-700">
                      {app.currency} {Number(app.requested_amount).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">{app.lender_reference_id || '—'}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-medium uppercase tracking-wider ${style.className}`}>
                        <Icon className="w-3 h-3" /> {style.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs">
                      {new Date(app.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showApplyModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Apply for Bridge Loan</h3>
              <button onClick={() => setShowApplyModal(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
            </div>
            <form onSubmit={handleSubmitApplication} className="p-6 space-y-4">
              {submitError && (
                <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {submitError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Purpose</label>
                <select
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                >
                  <option value="FRANCHISEE_SETUP">Franchisee Setup (fit-out, opening)</option>
                  <option value="INVENTORY">Opening Inventory</option>
                  <option value="EQUIPMENT">Equipment</option>
                  <option value="WORKING_CAPITAL">General Working Capital</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Requested Amount (SGD)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g. 50000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Term (months)</label>
                <input
                  type="number"
                  min="1"
                  value={termMonths}
                  onChange={(e) => setTermMonths(e.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <p className="text-xs text-slate-400">
                Submitted to the configured lender via the lender-bridge integration. If no lender is
                connected yet, this runs in simulate mode so the flow can be reviewed end-to-end.
              </p>
              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md shadow-sm"
                >
                  {submitting ? 'Submitting…' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
