"use client";
import React, { useState, useEffect } from "react";
import { Role } from "@/src/types";
import {
  FileText, Clock, CheckCircle2, AlertTriangle, ChevronDown,
  User, Building2, Filter, RefreshCw, X, MessageSquare, ArrowUp
} from "lucide-react";
import { cn } from "@/src/lib/utils";
import { supabase, EDGE_FUNCTIONS_URL } from "@/src/lib/supabase";

interface Case {
  id: number;
  title: string;
  description?: string;
  type?: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
  sla_deadline?: string;
  resolved_at?: string;
  assigned_to_id?: string;
  outlet_id?: number;
  source_alert_id?: number;
  assignee?: { id: string; full_name: string; role: string };
  alert?: { id: number; type: string; severity: string };
  outlet?: { id: number; name: string; code: string };
}

interface CaseStats {
  NEW: number;
  IN_PROGRESS: number;
  RESOLVED: number;
  CLOSED: number;
}

interface CasesListProps {
  activeRole: Role;
}

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: "bg-red-100 text-red-800 border-red-200",
  HIGH: "bg-orange-100 text-orange-800 border-orange-200",
  MEDIUM: "bg-yellow-100 text-yellow-800 border-yellow-200",
  LOW: "bg-green-100 text-green-800 border-green-200",
};

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-purple-100 text-purple-800",
  ACKNOWLEDGED: "bg-indigo-100 text-indigo-800",
  RESOLVED: "bg-green-100 text-green-800",
  CLOSED: "bg-slate-100 text-slate-600",
};

const PRIORITY_ORDER = ["URGENT", "HIGH", "MEDIUM", "LOW"];
const STATUS_ORDER = ["NEW", "IN_PROGRESS", "ACKNOWLEDGED", "RESOLVED", "CLOSED"];

function getSlaStatus(slaDeadline: string | undefined, status: string): { label: string; color: string; urgent: boolean } {
  if (!slaDeadline || status === "RESOLVED" || status === "CLOSED") {
    return { label: "—", color: "text-slate-400", urgent: false };
  }
  const now = Date.now();
  const deadline = new Date(slaDeadline).getTime();
  const remaining = deadline - now;
  if (remaining < 0) {
    return { label: "OVERDUE", color: "text-red-600 font-bold", urgent: true };
  }
  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  if (hours < 1) {
    return { label: `${minutes}m left`, color: "text-red-500 font-semibold", urgent: true };
  }
  if (hours < 4) {
    return { label: `${hours}h ${minutes}m left`, color: "text-orange-500", urgent: false };
  }
  return { label: `${hours}h left`, color: "text-slate-600", urgent: false };
}

export function CasesList({ activeRole }: CasesListProps) {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [expandedCase, setExpandedCase] = useState<number | null>(null);
  const [stats, setStats] = useState<CaseStats>({ NEW: 0, IN_PROGRESS: 0, RESOLVED: 0, CLOSED: 0 });

  async function fetchCases() {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || "";

      const params = new URLSearchParams({ limit: "100" });
      if (statusFilter) params.set("status", statusFilter);
      if (priorityFilter) params.set("priority", priorityFilter);

      const res = await fetch(`${EDGE_FUNCTIONS_URL}/cases-list?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to load cases");
      const json = await res.json();
      setCases(json.data || []);
      setStats(json.counts || { NEW: 0, IN_PROGRESS: 0, RESOLVED: 0, CLOSED: 0 });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchCases(); }, [statusFilter, priorityFilter]);

  async function updateStatus(caseId: number, newStatus: string) {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || "";

    // Use direct DB update via edge function call or simple fetch
    const res = await fetch(`${EDGE_FUNCTIONS_URL}/case-update`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ case_id: caseId, status: newStatus }),
    });

    if (res.ok) {
      setCases(prev => prev.map(c => c.id === caseId ? { ...c, status: newStatus } : c));
      setExpandedCase(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-500">
        <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
        <p className="text-sm">{error}</p>
        <button onClick={fetchCases} className="mt-2 text-sm text-blue-600 hover:underline">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header + Filters */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Case Management</h2>
          <p className="text-sm text-slate-500">{cases.length} cases</p>
        </div>
        <button
          onClick={fetchCases}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setStatusFilter("")}
          className={cn("px-3 py-1.5 text-sm rounded-lg border transition-colors",
            !statusFilter ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          )}
        >
          All ({Object.values(stats).reduce((a, b) => a + b, 0)})
        </button>
        {STATUS_ORDER.map(s => stats[s] > 0 && (
          <button
            key={s}
            onClick={() => setStatusFilter(statusFilter === s ? "" : s)}
            className={cn("px-3 py-1.5 text-sm rounded-lg border transition-colors flex items-center gap-1.5",
              statusFilter === s ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            )}
          >
            {s === "NEW" && <span className="w-2 h-2 rounded-full bg-blue-500" />}
            {s === "IN_PROGRESS" && <span className="w-2 h-2 rounded-full bg-purple-500" />}
            {s === "RESOLVED" && <span className="w-2 h-2 rounded-full bg-green-500" />}
            {s.replace("_", " ")} ({stats[s] || 0})
          </button>
        ))}
      </div>

      {/* Priority Filter */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-slate-400" />
        <span className="text-sm text-slate-500">Priority:</span>
        {PRIORITY_ORDER.map(p => (
          <button
            key={p}
            onClick={() => setPriorityFilter(priorityFilter === p ? "" : p)}
            className={cn("px-2 py-0.5 text-xs rounded border transition-colors",
              priorityFilter === p
                ? "bg-slate-800 text-white border-slate-800"
                : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
            )}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Cases List */}
      {cases.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <FileText className="w-10 h-10 mx-auto mb-2" />
          <p className="text-sm">No cases found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {cases.map((c) => {
            const sla = getSlaStatus(c.sla_deadline, c.status);
            const isExpanded = expandedCase === c.id;
            return (
              <div
                key={c.id}
                className={cn("rounded-xl border bg-white shadow-sm overflow-hidden transition-all",
                  sla.urgent && c.status !== "RESOLVED" && c.status !== "CLOSED"
                    ? "border-red-200 ring-1 ring-red-100"
                    : "border-slate-200"
                )}
              >
                {/* Case Header */}
                <button
                  className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-slate-50 transition-colors"
                  onClick={() => setExpandedCase(isExpanded ? null : c.id)}
                >
                  {/* Priority indicator */}
                  <div className={cn("w-1 rounded-full self-stretch shrink-0",
                    c.priority === "URGENT" ? "bg-red-500" :
                    c.priority === "HIGH" ? "bg-orange-500" :
                    c.priority === "MEDIUM" ? "bg-yellow-500" : "bg-green-500"
                  )} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("px-2 py-0.5 text-xs rounded-full border font-medium",
                        PRIORITY_COLORS[c.priority] || PRIORITY_COLORS.LOW
                      )}>
                        {c.priority}
                      </span>
                      <span className={cn("px-2 py-0.5 text-xs rounded-full font-medium",
                        STATUS_COLORS[c.status] || "bg-slate-100 text-slate-600"
                      )}>
                        {c.status.replace("_", " ")}
                      </span>
                      {c.alert?.severity && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600">
                          {c.alert.severity}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-slate-900 mt-1 truncate">{c.title}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                      {c.outlet && (
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {c.outlet.code || c.outlet.name}
                        </span>
                      )}
                      {c.assignee && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {c.assignee.full_name}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(c.created_at).toLocaleDateString()}
                      </span>
                      <span className={cn("flex items-center gap-1 font-medium", sla.color)}>
                        <ArrowUp className="w-3 h-3" />
                        SLA: {sla.label}
                      </span>
                    </div>
                  </div>

                  <ChevronDown className={cn("w-4 h-4 text-slate-400 shrink-0 transition-transform", isExpanded && "rotate-180")} />
                </button>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">
                    {c.description && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Description</p>
                        <p className="text-sm text-slate-700">{c.description}</p>
                      </div>
                    )}

                    {c.alert && (
                      <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg text-xs">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        <span>Source alert: <strong>{c.alert.type}</strong> ({c.alert.severity})</span>
                      </div>
                    )}

                    {c.sla_deadline && (
                      <div className="text-xs text-slate-500">
                        SLA deadline: <strong>{new Date(c.sla_deadline).toLocaleString()}</strong>
                        <span className={cn(" ml-2 font-semibold", sla.color)}>({sla.label})</span>
                      </div>
                    )}

                    {/* Actions */}
                    {c.status !== "RESOLVED" && c.status !== "CLOSED" && (
                      <div className="flex gap-2 pt-1">
                        {c.status === "NEW" && (
                          <button
                            onClick={() => updateStatus(c.id, "IN_PROGRESS")}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                          >
                            <ArrowUp className="w-3 h-3" />
                            Start Working
                          </button>
                        )}
                        {(c.status === "IN_PROGRESS" || c.status === "ACKNOWLEDGED") && (
                          <button
                            onClick={() => updateStatus(c.id, "RESOLVED")}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            Mark Resolved
                          </button>
                        )}
                        <button
                          onClick={() => updateStatus(c.id, "CLOSED")}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                        >
                          Close
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
