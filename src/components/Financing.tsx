import React, { useEffect, useState } from 'react';
import {
  Landmark,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  X,
  Banknote,
  RefreshCw,
  AlertCircle,
  PlusCircle,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Shield,
  Activity,
  Calendar,
  FileText,
  Wallet,
  FileSpreadsheet,
} from 'lucide-react';
import { Role } from '@/src/types';
import { supabase, EDGE_FUNCTIONS_URL } from '@/src/lib/supabase';
import { ConsentDialog, useConsent } from './ConsentDialog';
import { DocumentVault } from './DocumentVault';
import { CashFlowUpload } from './CashFlowUpload';
import { CashFlowDashboard } from './CashFlowDashboard';
import { CashFlowTemplateDownload } from './CashFlowTemplateDownload';
import { BankStatementUpload } from './BankStatementUpload';
import { FinancialStatementUpload } from './FinancialStatementUpload';

// Mirrors public.financing_application_status in
// supabase/migrations/20260805000000_financing_and_reporting.sql
type FinancingStatus =
  | 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'DECLINED'
  | 'DISBURSED' | 'REPAYING' | 'CLOSED' | 'CANCELLED';

type TabType = 'applications' | 'repayments' | 'risk' | 'documents' | 'cashflow' | 'financial';

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
  disbursed_at: string | null;
  decision_reason: string | null;
  created_at: string;
  outlet_id: number | null;
}

interface RepaymentEvent {
  id: string;
  application_id: string;
  event_type: string;
  event_subtype: string | null;
  amount: number | null;
  currency: string;
  emi_number: number | null;
  days_overdue: number;
  delinquency_level: string;
  received_at: string;
}

interface RepaymentScheduleEntry {
  id: string;
  application_id: string;
  emi_number: number;
  due_date: string;
  total_amount: number;
  paid_amount: number;
  status: string;
  days_overdue: number;
}

interface RiskScore {
  id: string;
  application_id: string;
  overall_risk_score: number;
  risk_level: string;
  payment_timing_score: number;
  delinquency_score: number;
  affordability_score: number;
  risk_factors: string[];
  computed_at: string;
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
  const [activeTab, setActiveTab] = useState<'applications' | 'repayments' | 'risk' | 'documents' | 'cashflow'>('applications');
  const [applications, setApplications] = useState<FinancingApplication[]>([]);
  const [repaymentEvents, setRepaymentEvents] = useState<RepaymentEvent[]>([]);
  const [repaymentSchedule, setRepaymentSchedule] = useState<RepaymentScheduleEntry[]>([]);
  const [riskScores, setRiskScores] = useState<RiskScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [uploadMode, setUploadMode] = useState<'csv' | 'pdf'>('csv');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Doc check state for financing gate
  const [checkDocsLoading, setCheckDocsLoading] = useState(false);
  const [missingDocs, setMissingDocs] = useState<string[]>([]);
  const [showDocBlockModal, setShowDocBlockModal] = useState(false);
  const [userCountry, setUserCountry] = useState('SGP');

  const [purpose, setPurpose] = useState('FRANCHISEE_SETUP');
  const [amount, setAmount] = useState('');
  const [termMonths, setTermMonths] = useState('12');

  // PDPA Consent hook — get userId and regionId from auth on mount
  const [userId, setUserId] = useState('');
  const [userRegionId, setUserRegionId] = useState<number | null>(null);

  // Check required regulatory documents before applying
  async function checkRequiredDocuments(entityId: string, country: string) {
    setCheckDocsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return true; // Allow through on error

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-required-docs`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ entity_id: entityId, country }),
        }
      );

      const result = await response.json();
      
      if (!result.valid && result.missing_docs?.length > 0) {
        setMissingDocs(result.missing_docs);
        setShowDocBlockModal(true);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking docs:', error);
      return true; // Allow through on error
    } finally {
      setCheckDocsLoading(false);
    }
  }

  // Get user's country from region_id
  useEffect(() => {
    async function getUserCountry() {
      if (!userId) return;
      
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('region_id')
        .eq('id', userId)
        .single();
      
      if (profile?.region_id) {
        // Map region_id to country code
        // 114 = Singapore, 115 = Indonesia, etc.
        const sgRegions = [1, 114]; // Singapore
        const idRegions = [2, 115, 116, 117]; // Indonesia
        
        if (sgRegions.includes(profile.region_id)) {
          setUserCountry('SGP');
        } else if (idRegions.includes(profile.region_id)) {
          setUserCountry('IDN');
        } else {
          setUserCountry('SGP'); // Default to Singapore
        }
      }
    }
    getUserCountry();
  }, [userId]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      const user = session?.user as any;
      const uid = user?.id || '';
      setUserId(uid);

      // Get region_id from user_profiles table
      if (uid) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('region_id')
          .eq('id', uid)
          .single();
        setUserRegionId(profile?.region_id ?? null);
      }
    });
  }, []);

  const {
    hasConsented,
    showConsentDialog,
    selectedPolicy,
    checkConsent,
    openConsentDialog,
    closeConsentDialog,
    handleConsentGiven: recordConsentOnly,
  } = useConsent(userId, userRegionId);

  // Override: after consent is recorded, immediately open the apply modal
  const handleConsentGiven = async () => {
    await recordConsentOnly();
    // recordConsentOnly already calls setHasConsented(true) and closeConsentDialog()
    // Now open the apply modal
    setShowApplyModal(true);
  };

  useEffect(() => {
    fetchAllData();
    if (!userId) return;
    checkConsent();
    // Set up realtime subscription
    const channel = supabase
      .channel('financing-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'repayment_events'
      }, () => fetchRepaymentEvents())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'application_risk_scores'
      }, () => fetchRiskScores())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'financing_applications'
      }, () => fetchApplications())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function fetchAllData() {
    setLoading(true);
    await Promise.all([
      fetchApplications(),
      fetchRepaymentEvents(),
      fetchRiskScores(),
    ]);
    setLoading(false);
  }

  async function fetchApplications() {
    const { data } = await supabase
      .from('financing_applications')
      .select('*, outlet:outlet_id(name, code)')
      .order('created_at', { ascending: false });
    setApplications(data || []);
  }

  async function fetchRepaymentEvents() {
    const { data } = await supabase
      .from('repayment_events')
      .select('*')
      .order('received_at', { ascending: false })
      .limit(50);
    setRepaymentEvents(data || []);
  }

  async function fetchRiskScores() {
    const { data } = await supabase
      .from('application_risk_scores')
      .select('*')
      .order('computed_at', { ascending: false });
    setRiskScores(data || []);
  }

  async function fetchRepaymentSchedule(applicationId: string) {
    const { data } = await supabase
      .from('repayment_schedule')
      .select('*')
      .eq('application_id', applicationId)
      .order('emi_number', { ascending: true });
    setRepaymentSchedule(data || []);
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
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error('You are not logged in. Please refresh the page and log in again.');
      }

      const response = await fetch(`${EDGE_FUNCTIONS_URL}/lender-bridge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
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
  const highRiskCount = riskScores.filter(r => ['HIGH', 'CRITICAL'].includes(r.risk_level)).length;

  // Tab navigation
  const tabs = [
    { id: 'applications' as const, label: 'Applications', icon: Landmark },
    { id: 'repayments' as const, label: 'Repayments', icon: RefreshCw },
    { id: 'risk' as const, label: 'Risk Scores', icon: Shield },
    { id: 'documents' as const, label: 'Document Vault', icon: FileText },
    { id: 'cashflow' as const, label: 'Cash Flow', icon: Wallet },
    { id: 'financial' as const, label: 'Financial Docs', icon: FileSpreadsheet },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Franchisee Bridge Financing</h2>
          <p className="text-sm text-slate-500 mt-1">
            Manage bridge loans with real-time repayment tracking and risk monitoring.
          </p>
        </div>
        {activeTab === 'applications' && (
          <button
            onClick={async () => {
              if (!hasConsented) {
                // Always await openConsentDialog() — it sets showConsentDialog=true AFTER loadPolicy sets selectedPolicy
                await openConsentDialog();
                // Dialog is now open. User interacts, ConsentDialog calls handleConsentGiven
                // which records consent and opens the apply modal.
              } else {
                // Check required docs first before opening apply modal
                const hasDocs = await checkRequiredDocuments(userId, userCountry);
                if (hasDocs) {
                  setShowApplyModal(true);
                }
              }
            }}
            disabled={checkDocsLoading}
            className="rounded-md px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium transition-all flex items-center gap-2 shadow-sm"
          >
            {checkDocsLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Checking...
              </>
            ) : (
              <>
                <PlusCircle className="w-4 h-4" /> Apply for Bridge Loan
              </>
            )}
          </button>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.id === 'risk' && highRiskCount > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">{highRiskCount}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Applications Tab */}
      {activeTab === 'applications' && (
        <div>
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
                    <th className="px-6 py-3">Outlet</th>
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
                        <td className="px-6 py-4 text-slate-700">
                          {app.outlet?.name ? `${app.outlet.name} (${app.outlet.code})` : '—'}
                        </td>
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
        </div>
      )}

      {/* Repayments Tab */}
      {activeTab === 'repayments' && (
        <div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium text-slate-500">Total Repayment Events</p>
              <p className="text-2xl font-semibold text-slate-900 mt-2">{repaymentEvents.length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium text-slate-500">Recent Payments</p>
              <p className="text-2xl font-semibold text-slate-900 mt-2">
                {repaymentEvents.filter(e => ['EMI_PAID', 'PARTIAL_PAYMENT'].includes(e.event_type)).length}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium text-slate-500">Overdue Events</p>
              <p className="text-2xl font-semibold text-red-600 mt-2">
                {repaymentEvents.filter(e => ['EMI_OVERDUE', 'DELINQUENCY_STARTED'].includes(e.event_type)).length}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-purple-600" />
              <h3 className="text-sm font-semibold text-slate-900">Recent Repayment Events</h3>
            </div>
            {repaymentEvents.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <RefreshCw className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-sm">No repayment events yet.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <th className="px-6 py-3">Event Type</th>
                    <th className="px-6 py-3">Amount</th>
                    <th className="px-6 py-3">EMI #</th>
                    <th className="px-6 py-3">Days Overdue</th>
                    <th className="px-6 py-3">Received</th>
                  </tr>
                </thead>
                <tbody>
                  {repaymentEvents.slice(0, 20).map((event) => (
                    <tr key={event.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-medium uppercase tracking-wider ${
                          ['EMI_OVERDUE', 'DELINQUENCY_STARTED', 'DEFAULT_NOTICE'].includes(event.event_type)
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : ['EMI_PAID', 'PARTIAL_PAYMENT'].includes(event.event_type)
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}>
                          {event.event_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-700">
                        {event.amount ? `${event.currency} ${Number(event.amount).toLocaleString()}` : '—'}
                      </td>
                      <td className="px-6 py-4 text-slate-500">{event.emi_number || '—'}</td>
                      <td className="px-6 py-4">
                        {event.days_overdue > 0 ? (
                          <span className="text-red-600 font-medium">{event.days_overdue} days</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-xs">
                        {new Date(event.received_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Risk Scores Tab */}
      {activeTab === 'risk' && (
        <div>
          <div className="grid sm:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium text-slate-500">Total Scores</p>
              <p className="text-2xl font-semibold text-slate-900 mt-2">{riskScores.length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium text-slate-500">High Risk</p>
              <p className="text-2xl font-semibold text-red-600 mt-2">
                {riskScores.filter(r => r.risk_level === 'HIGH' || r.risk_level === 'CRITICAL').length}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium text-slate-500">Medium Risk</p>
              <p className="text-2xl font-semibold text-orange-600 mt-2">
                {riskScores.filter(r => r.risk_level === 'MEDIUM').length}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium text-slate-500">Low Risk</p>
              <p className="text-2xl font-semibold text-green-600 mt-2">
                {riskScores.filter(r => r.risk_level === 'LOW').length}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-slate-900">Risk Score History</h3>
            </div>
            {riskScores.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Shield className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-sm">No risk scores computed yet.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <th className="px-6 py-3">Application</th>
                    <th className="px-6 py-3">Risk Level</th>
                    <th className="px-6 py-3">Overall Score</th>
                    <th className="px-6 py-3">Payment Timing</th>
                    <th className="px-6 py-3">Delinquency</th>
                    <th className="px-6 py-3">Computed</th>
                  </tr>
                </thead>
                <tbody>
                  {riskScores.slice(0, 20).map((score) => (
                    <tr key={score.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-6 py-4 font-mono text-xs text-slate-500">{score.application_id.slice(0, 8)}...</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-medium uppercase tracking-wider ${
                          score.risk_level === 'CRITICAL' ? 'bg-red-100 text-red-700 border-red-200' :
                          score.risk_level === 'HIGH' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                          score.risk_level === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                          'bg-green-50 text-green-700 border-green-200'
                        }`}>
                          <AlertTriangle className="w-3 h-3" />
                          {score.risk_level}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-900">{score.overall_risk_score.toFixed(1)}</td>
                      <td className="px-6 py-4 text-slate-500">{score.payment_timing_score.toFixed(1)}%</td>
                      <td className="px-6 py-4 text-slate-500">{score.delinquency_score.toFixed(1)}%</td>
                      <td className="px-6 py-4 text-slate-500 text-xs">
                        {new Date(score.computed_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Documents Tab */}
      {activeTab === 'documents' && (
        <div>
          <DocumentVault />
        </div>
      )}

      {/* Cash Flow Tab */}
      {activeTab === 'cashflow' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Bank Cash Flow</h3>
            <p className="text-sm text-slate-500 mt-1">
              Track your income and expenses from bank statements.
            </p>
          </div>
          
          <div className="bg-white rounded-xl border p-6">
            {/* Toggle between CSV and PDF */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setUploadMode('csv')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  uploadMode === 'csv' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                CSV Template
              </button>
              <button
                onClick={() => setUploadMode('pdf')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  uploadMode === 'pdf' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Bank Statement PDF
              </button>
            </div>
            
            {/* CSV Upload */}
            {uploadMode === 'csv' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-medium">Upload CSV Template</h4>
                    <p className="text-sm text-slate-500">Use our template for manual data entry</p>
                  </div>
                  <CashFlowTemplateDownload />
                </div>
                <CashFlowUpload userId={userId} onUploadComplete={() => {}} />
              </div>
            )}
            
            {/* PDF Upload */}
            {uploadMode === 'pdf' && (
              <div className="space-y-4">
                <div className="mb-4">
                  <h4 className="font-medium">Upload Bank Statement</h4>
                  <p className="text-sm text-slate-500">Automatically extract transactions from PDF statements</p>
                </div>
                <BankStatementUpload userId={userId} onUploadComplete={() => {}} />
              </div>
            )}
          </div>
          
          <CashFlowDashboard userId={userId} />
        </div>
      )}

      {/* Financial Docs Tab */}
      {activeTab === 'financial' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Financial Documents</h3>
            <p className="text-sm text-slate-500 mt-1">
              Upload and manage financial statements for credit assessment.
            </p>
          </div>
          
          <div className="bg-white rounded-xl border p-6">
            <FinancialStatementUpload userId={userId} onUploadComplete={() => {}} />
          </div>
        </div>
      )}

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

      {/* Document Block Modal */}
      {showDocBlockModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Documents Required</h3>
                  <p className="text-sm text-slate-500">Cannot proceed with application</p>
                </div>
              </div>
              
              <p className="text-slate-600 mb-4">
                Your franchisor has not uploaded the required regulatory documents yet. 
                Financing application is blocked until all required documents are submitted.
              </p>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <h4 className="font-medium text-red-800 mb-2 flex items-center gap-2">
                  <X className="w-4 h-4" />
                  Missing Documents ({missingDocs.length})
                </h4>
                <ul className="space-y-1">
                  {missingDocs.map((doc, i) => (
                    <li key={i} className="text-sm text-red-700 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                      {doc.replace(/_/g, ' ')}
                    </li>
                  ))}
                </ul>
              </div>

              <p className="text-sm text-slate-500 mb-4">
                Please contact your franchisor to upload these required documents before applying for financing.
              </p>

              <button
                onClick={() => setShowDocBlockModal(false)}
                className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDPA Consent Dialog */}
      {showConsentDialog && selectedPolicy && (
        <ConsentDialog
          isOpen={showConsentDialog}
          onClose={closeConsentDialog}
          onConsent={handleConsentGiven}
          policyTitle={selectedPolicy.title}
          policyContent={selectedPolicy.content}
          regionLabel={selectedPolicy.regionLabel}
        />
      )}
    </div>
  );
}
