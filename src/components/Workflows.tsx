import React, { useState, useEffect, useRef } from "react";
import { 
  ActivitySquare, ArrowRight, CheckCircle2, Circle, AlertTriangle, 
  Clock, User, Building2, X, Sparkles, RefreshCw, MessageSquare,
  Filter, Plus, ChevronDown, AlertCircle, Check, ArrowUpRight
} from "lucide-react";
import { cn } from "@/src/lib/utils";
import { Role } from "@/src/types";
import { supabase, EDGE_FUNCTIONS_URL } from "@/src/lib/supabase";


interface WorkflowAlert {
  id: number;
  type: string;
  severity: string;
  status: string;
  title: string;
  description: string;
  triggered_at: string;
  outlet: {
    id?: number;
    name: string;
    code: string;
    region?: { name: string; code: string };
  };
}

interface Case {
  id: number;
  alert_id: number;
  status: string;
  priority: string;
  title: string;
  description?: string;
  assigned_to_id?: number;
  assigned_to?: { full_name: string; role: string };
  created_at: string;
  sla_deadline?: string;
  resolved_at?: string;
  resolved_by?: string;
  notes?: string;
  outlet?: {
    id?: number;
    name: string;
    code: string;
    region?: { name: string };
  };
}

interface TriageResult {
  category: string;
  subcategory: string;
  confidence: number;
  suggested_priority: string;
  suggested_sla_hours: number;
  suggested_assignee_role: string;
  suggestions: { action: string; priority: string; estimated_time: string }[];
  ai_summary: string;
}

export function Workflows({ activeRole }: { activeRole: Role }) {
  const [alerts, setAlerts] = useState<WorkflowAlert[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [triageResult, setTriageResult] = useState<TriageResult | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [caseNotes, setCaseNotes] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      // Fetch alerts via edge function (includes auth headers)
      const alertsRes = await fetch(`${EDGE_FUNCTIONS_URL}/alerts-list?limit=100`, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: token ? token : '',
        },
      });
      if (!alertsRes.ok) {
        console.warn('alerts-list returned', alertsRes.status, await alertsRes.text());
      } else {
        const alertsData = await alertsRes.json();
        setAlerts(alertsData.data || []);
      }

      // Fetch cases via edge function
      const casesRes = await fetch(`${EDGE_FUNCTIONS_URL}/cases-list?limit=100`, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: token ? token : '',
        },
      });
      if (!casesRes.ok) {
        console.warn('cases-list returned', casesRes.status, await casesRes.text());
        setCases([]);
      } else {
        const casesData = await casesRes.json();
        setCases(casesData.data || []);
      }

    } catch (err) {
      console.error('Error fetching workflows:', err);
    } finally {
      setLoading(false);
    }
  }

  // Filter cases
  const filteredCases = cases.filter(c => {
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'active' && c.status !== 'RESOLVED' && c.status !== 'CLOSED') ||
      (filterStatus === 'resolved' && c.status === 'RESOLVED') ||
      (filterStatus === 'closed' && c.status === 'CLOSED');
    const matchesPriority = filterPriority === 'all' || c.priority === filterPriority;
    return matchesStatus && matchesPriority;
  });

  const activeCases = filteredCases.filter(c => c.status !== 'RESOLVED' && c.status !== 'CLOSED');
  const resolvedCases = filteredCases.filter(c => c.status === 'RESOLVED' || c.status === 'CLOSED');

  const getSeveritySteps = (severity: string) => {
    if (severity === 'P0_CRITICAL' || severity === 'high') {
      return [
        { name: "Detect", status: "completed" as const },
        { name: "Alert", status: "completed" as const },
        { name: "Investigate", status: "current" as const },
        { name: "Resolve", status: "pending" as const },
      ];
    }
    return [
      { name: "Detect", status: "completed" as const },
      { name: "Alert", status: "current" as const },
      { name: "Review", status: "pending" as const },
      { name: "Close", status: "pending" as const },
    ];
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': case 'P0_CRITICAL': return 'bg-red-100 text-red-700 border-red-200';
      case 'HIGH': case 'P1_HIGH': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'MEDIUM': case 'P2_MEDIUM': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'NEW': return 'bg-red-50 text-red-700 border-red-200';
      case 'IN_PROGRESS': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'RESOLVED': return 'bg-green-50 text-green-700 border-green-200';
      case 'CLOSED': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'ESCALATED': return 'bg-purple-50 text-purple-700 border-purple-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return `${Math.floor(diffHours / 24)}d ago`;
    } catch {
      return 'N/A';
    }
  };

  const getSLATimeRemaining = (deadline: string) => {
    try {
      const deadlineDate = new Date(deadline);
      const now = new Date();
      const diffMs = deadlineDate.getTime() - now.getTime();
      if (diffMs < 0) return { text: 'OVERDUE', color: 'text-red-600', urgent: true };
      const hours = Math.floor(diffMs / 3600000);
      if (hours < 4) return { text: `${hours}h left`, color: 'text-red-600', urgent: true };
      if (hours < 24) return { text: `${hours}h left`, color: 'text-orange-600', urgent: false };
      return { text: `${Math.floor(hours / 24)}d left`, color: 'text-green-600', urgent: false };
    } catch {
      return { text: 'N/A', color: 'text-slate-400', urgent: false };
    }
  };

  async function analyzeCaseWithAI(caseData: Case) {
    setIsAnalyzing(true);
    setTriageResult(null);
    try {
      const response = await fetch(`${EDGE_FUNCTIONS_URL}/athena-case-triage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: caseData.id,
          title: caseData.title,
          description: caseData.description || '',
          outlet_id: caseData.outlet?.id,
          severity: caseData.priority,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setTriageResult(data.triage);
      }
    } catch (err) {
      console.error('AI analysis error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function updateCaseStatus(caseId: number, newStatus: string) {
    setIsUpdating(true);
    try {
      const response = await fetch(`${EDGE_FUNCTIONS_URL}/case-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: caseId,
          status: newStatus,
          notes: caseNotes,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      await fetchData();
      setSelectedCase(null);
      setCaseNotes("");
    } catch (err) {
      console.error('Update error:', err);
      alert('Failed to update case');
    } finally {
      setIsUpdating(false);
    }
  }

  async function createCaseFromAlert(alert: WorkflowAlert) {
    setIsUpdating(true);
    try {
      const response = await fetch(`${EDGE_FUNCTIONS_URL}/case-create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alert_id: alert.id,
          title: alert.title,
          description: alert.description,
          priority: alert.severity,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      await fetchData();
    } catch (err) {
      console.error('Create case error:', err);
      alert('Failed to create case');
    } finally {
      setIsUpdating(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-3 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <ActivitySquare className="w-5 h-5" /> 
            Active Workflows & Escalations
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {activeCases.length} active cases • {resolvedCases.length} resolved
          </p>
        </div>
        <div className="flex gap-3">
          {/* Status Filter */}
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm bg-white"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          {/* Priority Filter */}
          <select 
            value={filterPriority} 
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm bg-white"
          >
            <option value="all">All Priority</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      </div>

      {/* Active Cases Grid */}
      {activeCases.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900">All Clear</h3>
          <p className="text-sm text-slate-500 mt-2">No active cases requiring attention</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {activeCases.map((caseItem) => {
            const sla = caseItem.sla_deadline ? getSLATimeRemaining(caseItem.sla_deadline) : null;
            return (
              <div
                key={caseItem.id}
                onClick={() => { setSelectedCase(caseItem); setTriageResult(null); }}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getPriorityColor(caseItem.priority)}`}>
                        {caseItem.priority}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${getStatusColor(caseItem.status)}`}>
                        {caseItem.status.replace('_', ' ')}
                      </span>
                      {sla && (
                        <span className={`flex items-center gap-1 text-xs ${sla.color}`}>
                          <Clock className="w-3 h-3" />
                          {sla.text}
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-orange-600" />
                      Case #{caseItem.id}: {caseItem.title}
                    </h3>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                      {caseItem.outlet && (
                        <>
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {caseItem.outlet.name}
                          </span>
                          <span>•</span>
                        </>
                      )}
                      {caseItem.assigned_to && (
                        <>
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {caseItem.assigned_to.full_name}
                          </span>
                          <span>•</span>
                        </>
                      )}
                      <span>Created {formatTime(caseItem.created_at)}</span>
                    </div>
                  </div>
                  <ArrowUpRight className="w-5 h-5 text-slate-400" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Resolved Cases Section */}
      {resolvedCases.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-slate-500 mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Resolved Cases ({resolvedCases.length})
          </h3>
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500 border-b">
                <tr>
                  <th className="px-6 py-3">Case</th>
                  <th className="px-6 py-3">Priority</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Resolved</th>
                  <th className="px-6 py-3">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {resolvedCases.slice(0, 10).map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium">#{c.id} {c.title}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getPriorityColor(c.priority)}`}>
                        {c.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${getStatusColor(c.status)}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">{c.resolved_at ? formatTime(c.resolved_at) : '-'}</td>
                    <td className="px-6 py-4 text-slate-500">{c.resolved_by || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Case Detail Modal */}
      {selectedCase && (
        <CaseDetailModal 
          caseData={selectedCase}
          triageResult={triageResult}
          isAnalyzing={isAnalyzing}
          isUpdating={isUpdating}
          caseNotes={caseNotes}
          setCaseNotes={setCaseNotes}
          onClose={() => { setSelectedCase(null); setTriageResult(null); setCaseNotes(""); }}
          onAnalyze={() => analyzeCaseWithAI(selectedCase)}
          onUpdateStatus={updateCaseStatus}
          getPriorityColor={getPriorityColor}
          getStatusColor={getStatusColor}
          getSLATimeRemaining={getSLATimeRemaining}
          formatTime={formatTime}
        />
      )}
    </div>
  );
}

// Case Detail Modal Component
function CaseDetailModal({
  caseData,
  triageResult,
  isAnalyzing,
  isUpdating,
  caseNotes,
  setCaseNotes,
  onClose,
  onAnalyze,
  onUpdateStatus,
  getPriorityColor,
  getStatusColor,
  getSLATimeRemaining,
  formatTime,
}: {
  caseData: Case;
  triageResult: TriageResult | null;
  isAnalyzing: boolean;
  isUpdating: boolean;
  caseNotes: string;
  setCaseNotes: (v: string) => void;
  onClose: () => void;
  onAnalyze: () => void;
  onUpdateStatus: (id: number, status: string) => void;
  getPriorityColor: (p: string) => string;
  getStatusColor: (s: string) => string;
  getSLATimeRemaining: (d: string) => { text: string; color: string; urgent: boolean };
  formatTime: (d: string) => string;
}) {
  const [showNotes, setShowNotes] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border mr-2 ${getPriorityColor(caseData.priority)}`}>
              {caseData.priority}
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${getStatusColor(caseData.status)}`}>
              {caseData.status.replace('_', ' ')}
            </span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Case Info */}
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">
              Case #{caseData.id}: {caseData.title}
            </h2>
            <p className="text-slate-600">{caseData.description || 'No description provided.'}</p>
          </div>

          {/* Meta Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            {caseData.outlet && (
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">Outlet</p>
                <p className="font-medium">{caseData.outlet.name}</p>
                <p className="text-xs text-slate-400">{caseData.outlet.region?.name}</p>
              </div>
            )}
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1">Assignee</p>
              <p className="font-medium">{caseData.assigned_to?.full_name || 'Unassigned'}</p>
              <p className="text-xs text-slate-400">{caseData.assigned_to?.role || '-'}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1">Created</p>
              <p className="font-medium">{formatTime(caseData.created_at)}</p>
            </div>
            {caseData.sla_deadline && (
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">SLA Deadline</p>
                <p className={`font-medium ${getSLATimeRemaining(caseData.sla_deadline).color}`}>
                  {getSLATimeRemaining(caseData.sla_deadline).text}
                </p>
              </div>
            )}
          </div>

          {/* AI Analysis Section */}
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-5 text-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Athena AI Analysis
              </h3>
              <button
                onClick={onAnalyze}
                disabled={isAnalyzing}
                className="px-3 py-1.5 bg-white/20 rounded-lg text-sm hover:bg-white/30 transition-colors flex items-center gap-2"
              >
                {isAnalyzing ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Analyzing...</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Analyze</>
                )}
              </button>
            </div>

            {triageResult ? (
              <div className="space-y-4">
                <div className="bg-white/10 rounded-lg p-4">
                  <p className="text-xs opacity-70 mb-1">Category</p>
                  <p className="font-semibold">{triageResult.category} → {triageResult.subcategory}</p>
                  <p className="text-xs opacity-70 mt-1">Confidence: {(triageResult.confidence * 100).toFixed(0)}%</p>
                </div>
                
                <div className="bg-white/10 rounded-lg p-4">
                  <p className="text-xs opacity-70 mb-1">AI Summary</p>
                  <p className="text-sm">{triageResult.ai_summary}</p>
                </div>

                <div className="bg-white/10 rounded-lg p-4">
                  <p className="text-xs opacity-70 mb-2">Recommended Actions</p>
                  <div className="space-y-2">
                    {triageResult.suggestions.slice(0, 3).map((s, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          s.priority === 'IMMEDIATE' ? 'bg-red-500/50' : 
                          s.priority === 'URGENT' ? 'bg-orange-500/50' : 'bg-white/20'
                        }`}>
                          {s.priority}
                        </span>
                        <span>{s.action}</span>
                        <span className="text-xs opacity-70 ml-auto">({s.estimated_time})</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs opacity-70">
                  <span>Suggested Assignee: {triageResult.suggested_assignee_role}</span>
                  <span>SLA: {triageResult.suggested_sla_hours}h</span>
                </div>
              </div>
            ) : (
              <p className="text-sm opacity-80 text-center py-4">
                Click "Analyze" to get AI-powered case triage and resolution suggestions.
              </p>
            )}
          </div>

          {/* Notes Section */}
          <div>
            <button
              onClick={() => setShowNotes(!showNotes)}
              className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
            >
              <MessageSquare className="w-4 h-4" />
              Case Notes
              <ChevronDown className={cn("w-4 h-4 transition-transform", showNotes && "rotate-180")} />
            </button>
            {showNotes && (
              <div className="mt-3">
                <textarea
                  value={caseNotes}
                  onChange={(e) => setCaseNotes(e.target.value)}
                  placeholder="Add notes about this case..."
                  className="w-full p-3 border rounded-lg text-sm h-24 resize-none"
                />
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {caseData.status !== 'RESOLVED' && caseData.status !== 'CLOSED' && (
            <div className="flex gap-3 pt-4 border-t">
              <button
                onClick={() => onUpdateStatus(caseData.id, 'IN_PROGRESS')}
                disabled={isUpdating}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                {isUpdating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                Mark In Progress
              </button>
              <button
                onClick={() => onUpdateStatus(caseData.id, 'RESOLVED')}
                disabled={isUpdating}
                className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Resolve Case
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
