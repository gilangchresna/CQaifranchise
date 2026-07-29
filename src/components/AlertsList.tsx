import React, { useState } from "react";
import { Role } from "@/src/types";
import {
  AlertTriangle,
  TrendingDown,
  PackageMinus,
  Users,
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
} from "lucide-react";
import { cn } from "@/src/lib/utils";
import { supabase, EDGE_FUNCTIONS_URL } from "@/src/lib/supabase";

interface Alert {
  id: number;
  type: string;
  severity: string;
  status: string;
  title: string;
  description: string;
  created_at?: string;
  triggered_at?: string;
  outlet?: {
    name: string;
    code: string;
    region?: { name: string; code: string };
  };
}

interface AlertsListProps {
  activeRole: Role;
  alerts?: Alert[]; // Optional prop - if provided, use it; otherwise use empty array
}

export function AlertsList({ activeRole, alerts = [] }: AlertsListProps) {
  const [approvedAlerts, setApprovedAlerts] = useState<Record<number, 'pending' | 'loading' | 'approved' | 'error'>>({});
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<number>>(new Set());

  const handleApprove = async (alertId: number) => {
    setApprovedAlerts(prev => ({ ...prev, [alertId]: 'loading' }));
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      // Call case-create edge function
      const alert = alerts.find(a => a.id === alertId);
      const response = await fetch(`${EDGE_FUNCTIONS_URL}/case-create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          alert_id: alertId,
          title: `Action Required: ${alert?.title || 'Alert #' + alertId}`,
          description: alert?.description,
          priority: alert?.severity,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setApprovedAlerts(prev => ({ ...prev, [alertId]: 'approved' }));
        // Optionally refresh alerts after a short delay
        setTimeout(() => {
          setApprovedAlerts(prev => {
            const next = { ...prev };
            delete next[alertId];
            return next;
          });
        }, 3000);
      } else {
        console.error('Case creation failed:', result);
        setApprovedAlerts(prev => ({ ...prev, [alertId]: 'error' }));
        setTimeout(() => {
          setApprovedAlerts(prev => {
            const next = { ...prev };
            delete next[alertId];
            return next;
          });
        }, 3000);
      }
    } catch (err) {
      console.error('Error creating case:', err);
      setApprovedAlerts(prev => ({ ...prev, [alertId]: 'error' }));
      setTimeout(() => {
        setApprovedAlerts(prev => {
          const next = { ...prev };
          delete next[alertId];
          return next;
        });
      }, 3000);
    }
  };

  const handleDismiss = (alertId: number) => {
    setDismissedAlerts(prev => new Set([...prev, alertId]));
  };

  const filteredAlerts = alerts.filter((a) => {
    // Exclude dismissed alerts
    if (dismissedAlerts.has(a.id)) return false;
    // Filter based on role if outlet info available
    if (activeRole === "Franchisee" && a.outlet) {
      return a.outlet.name.includes("089") || a.outlet.code.includes("089");
    }
    return true; // HQ sees all
  });

  const getIcon = (type: string) => {
    switch (type) {
      case "SALES_ANOMALY":
        return TrendingDown;
      case "STOCKOUT_RISK":
        return PackageMinus;
      case "STAFFING":
        return Users;
      default:
        return AlertTriangle;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "P0_CRITICAL":
      case "high":
        return "bg-red-50 text-red-700 border-red-200";
      case "P1_HIGH":
      case "medium":
        return "bg-orange-50 text-orange-700 border-orange-200";
      case "P2_MEDIUM":
      case "low":
        return "bg-yellow-50 text-yellow-700 border-yellow-200";
      default:
        return "bg-blue-50 text-blue-700 border-blue-200";
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "P0_CRITICAL":
        return "bg-red-100 text-red-700";
      case "P1_HIGH":
        return "bg-orange-100 text-orange-700";
      case "P2_MEDIUM":
        return "bg-yellow-100 text-yellow-700";
      default:
        return "bg-blue-100 text-blue-700";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "NEW":
        return "bg-red-50 text-red-700 border-red-200";
      case "ACKNOWLEDGED":
        return "bg-orange-50 text-orange-700 border-orange-200";
      case "IN_PROGRESS":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "RESOLVED":
        return "bg-green-50 text-green-700 border-green-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col h-full relative">
      <div className="border-b border-slate-200 px-6 py-4 flex justify-between items-center bg-white z-10">
        <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-blue-600" /> Actionable Alerts
        </h2>
        <span className="inline-flex items-center rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
          {filteredAlerts.filter((a) => a.status === "NEW" || a.status === "open").length} Open
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 z-10 relative">
        {filteredAlerts.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">No alerts found</p>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const Icon = getIcon(alert.type);
            const approvalStatus = approvedAlerts[alert.id] || 'pending';
            
            return (
              <div
                key={alert.id}
                className={cn(
                  "rounded-lg border p-4 transition-all duration-300",
                  approvalStatus === 'approved' ? "opacity-50 grayscale" : "",
                  getSeverityColor(alert.severity),
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase", getSeverityBadge(alert.severity))}>
                          {alert.severity.replace('P0_', '').replace('P1_', '').replace('P2_', '')}
                        </span>
                        <p className="font-medium text-sm text-slate-900">
                          {alert.outlet?.name || 'Unknown Outlet'}
                        </p>
                        <span className="text-xs text-slate-400">
                          ({alert.outlet?.code || 'N/A'})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn("px-2 py-0.5 rounded text-[10px] font-medium border", getStatusBadge(alert.status))}>
                          {alert.status.replace('_', ' ')}
                        </span>
                        <span className="text-xs flex items-center gap-1 text-slate-500">
                          <Clock className="h-3 w-3" />
                          {formatTimeAgo(alert.created_at || alert.triggered_at || new Date().toISOString())}
                        </span>
                      </div>
                    </div>
                    
                    <p className="text-sm font-semibold text-slate-800">{alert.title}</p>
                    <p className="text-sm text-slate-600">{alert.description}</p>

                    {alert.outlet?.region && (
                      <p className="text-xs text-slate-500">
                        📍 {alert.outlet.region.name} ({alert.outlet.region.code})
                      </p>
                    )}

                    <div className="mt-4 rounded-md bg-blue-50 border border-blue-100 p-4 text-sm relative overflow-hidden">
                      <p className="flex items-center gap-2 mb-2 text-blue-700 text-xs font-semibold">
                        System Recommendation
                      </p>
                      <p className="text-slate-700 leading-relaxed text-sm">
                        {alert.type === 'SALES_ANOMALY' 
                          ? 'Investigate sales drop cause. Recommended: Check staffing, inventory, and promotional calendar. Consider emergency restocking if inventory-related.'
                          : alert.type === 'STOCKOUT_RISK'
                          ? 'Initiate emergency stock transfer from regional hub. Recommended: Expedite delivery and alert franchisee about potential stockout window.'
                          : 'Review staffing schedule and cross-train backup staff. Consider temporary reallocation from nearby outlets.'
                        }
                      </p>
                      <div className="mt-4 flex gap-3">
                        {approvalStatus === 'pending' && (
                          <>
                            <button 
                              onClick={() => handleApprove(alert.id)} 
                              className="rounded-md px-4 py-2 bg-blue-100 hover:bg-blue-200 border border-blue-200 text-blue-700 text-xs font-medium transition-colors"
                            >
                              Approve Action
                            </button>
                            <button 
                              onClick={() => handleDismiss(alert.id)}
                              className="rounded-md px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium transition-colors"
                            >
                              Dismiss
                            </button>
                          </>
                        )}
                        {approvalStatus === 'loading' && (
                          <div className="flex items-center gap-2 text-blue-700 text-xs font-medium px-2 py-2">
                            <Loader2 className="w-3 h-3 animate-spin" /> Routing to Workflow Engine...
                          </div>
                        )}
                        {approvalStatus === 'approved' && (
                          <div className="flex items-center gap-2 text-green-700 text-xs font-medium px-2 py-2 bg-green-100 rounded-md border border-green-200">
                            <CheckCircle2 className="w-4 h-4" /> Case Created & Escalated
                          </div>
                        )}
                        {approvalStatus === 'error' && (
                          <div className="flex items-center gap-2 text-red-700 text-xs font-medium px-2 py-2 bg-red-100 rounded-md border border-red-200">
                            <XCircle className="w-4 h-4" /> Failed - Try Again
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
