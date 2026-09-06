/**
 * Approval Workflows Component
 * Human-in-the-loop approval for AI agent actions
 */

import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, XCircle, Clock, AlertTriangle, 
  ChevronDown, ChevronUp, User, Bot, RefreshCw,
  FileText, ArrowUpCircle, MessageSquare, History
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface ApprovalRequest {
  id: string;
  request_type: string;
  trigger_source: string;
  related_entity_type?: string;
  related_entity_code?: string;
  request_payload: any;
  reasoning: string;
  priority: string;
  status: string;
  approver_role: string;
  created_at: string;
  expires_at: string;
  outlet_id?: number;
}

interface ApprovalSummary {
  pending: number;
  by_type: Record<string, number>;
  by_priority: Record<string, number>;
}

const EDGE_FUNCTIONS_URL = 'https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1';

export function ApprovalWorkflows() {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [summary, setSummary] = useState<ApprovalSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [comment, setComment] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchApprovals();
  }, []);

  const fetchApprovals = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${EDGE_FUNCTIONS_URL}/approvals?status=PENDING`, {
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        setApprovals(data.approvals || []);
        setSummary(data.summary);
      } else {
        // Use mock data if API fails
        setApprovals(getMockApprovals());
      }
    } catch (error) {
      console.error('Error fetching approvals:', error);
      setApprovals(getMockApprovals());
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (approval: ApprovalRequest) => {
    setSelectedApproval(approval);
    setActionType('approve');
    setShowModal(true);
  };

  const handleReject = async (approval: ApprovalRequest) => {
    setSelectedApproval(approval);
    setActionType('reject');
    setShowModal(true);
  };

  const submitAction = async () => {
    if (!selectedApproval) return;
    
    setProcessing(true);
    try {
      const endpoint = actionType === 'approve' ? 'approve' : 'reject';
      const response = await fetch(`${EDGE_FUNCTIONS_URL}/approvals/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: selectedApproval.id,
          comment: comment,
          approver_role: 'REGIONAL_MANAGER',
          approver_name: 'Current User'
        })
      });

      if (response.ok) {
        // Remove from list
        setApprovals(prev => prev.filter(a => a.id !== selectedApproval.id));
        setShowModal(false);
        setComment('');
        setSelectedApproval(null);
        alert(actionType === 'approve' ? '✅ Request approved!' : '❌ Request rejected');
      } else {
        alert('Failed to process request');
      }
    } catch (error) {
      console.error('Error processing approval:', error);
      alert('Error processing request');
    } finally {
      setProcessing(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'CASE_CREATE': return <FileText className="w-4 h-4" />;
      case 'ESCALATE': return <ArrowUpCircle className="w-4 h-4" />;
      case 'ALERT_BULK': return <AlertTriangle className="w-4 h-4" />;
      case 'AUTO_RESOLVE': return <CheckCircle className="w-4 h-4" />;
      default: return <MessageSquare className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'CASE_CREATE': return 'Create Case';
      case 'ESCALATE': return 'Escalate to HQ';
      case 'ALERT_BULK': return 'Bulk Alert';
      case 'AUTO_RESOLVE': return 'Auto-Resolve';
      default: return type;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return 'bg-red-100 text-red-800 border-red-200';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'LOW': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSourceIcon = (source: string) => {
    return source === 'AI_AGENT' ? <Bot className="w-4 h-4 text-violet-500" /> : <User className="w-4 h-4 text-blue-500" />;
  };

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    
    if (diff < 0) return 'Expired';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Approval Workflows</h1>
          <p className="text-gray-500 text-sm">Review and approve AI agent actions</p>
        </div>
        <button 
          onClick={fetchApprovals}
          className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-2xl font-bold">{summary?.pending || approvals.length}</p>
            </div>
          </div>
        </div>

        {summary?.by_type && Object.entries(summary.by_type).map(([type, count]) => (
          <div key={type} className="bg-white p-4 rounded-xl border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-100 rounded-lg text-violet-600">
                {getTypeIcon(type)}
              </div>
              <div>
                <p className="text-sm text-gray-500">{getTypeLabel(type)}</p>
                <p className="text-2xl font-bold">{count as number}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pending Approvals List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold">Pending Approvals</h2>
        </div>

        {approvals.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">All caught up!</p>
            <p className="text-gray-400 text-sm">No pending approval requests</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {approvals.map((approval) => (
              <div key={approval.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "p-2 rounded-lg",
                      approval.request_type === 'CASE_CREATE' ? "bg-blue-100 text-blue-600" :
                      approval.request_type === 'ESCALATE' ? "bg-orange-100 text-orange-600" :
                      "bg-violet-100 text-violet-600"
                    )}>
                      {getTypeIcon(approval.request_type)}
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{getTypeLabel(approval.request_type)}</h3>
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium border", getPriorityColor(approval.priority))}>
                          {approval.priority}
                        </span>
                        {approval.related_entity_code && (
                          <span className="text-sm text-gray-500">• {approval.related_entity_code}</span>
                        )}
                      </div>
                      
                      <p className="text-sm text-gray-600 max-w-xl">{approval.reasoning}</p>
                      
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          {getSourceIcon(approval.trigger_source)}
                          {approval.trigger_source.replace('_', ' ')}
                        </span>
                        <span>•</span>
                        <span>Approver: {approval.approver_role.replace('_', ' ')}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Expires in: {getTimeRemaining(approval.expires_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleReject(approval)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Reject"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleApprove(approval)}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="Approve"
                    >
                      <CheckCircle className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Payload Preview */}
                <div className="mt-3 ml-12 bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Request Details:</p>
                  <pre className="text-xs text-gray-700 overflow-x-auto">
                    {JSON.stringify(approval.request_payload, null, 2)}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Approval/Reject Modal */}
      {showModal && selectedApproval && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className={cn(
              "px-6 py-4 rounded-t-xl border-b",
              actionType === 'approve' ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
            )}>
              <h3 className="text-lg font-semibold">
                {actionType === 'approve' ? 'Approve Request' : 'Reject Request'}
              </h3>
              <p className="text-sm text-gray-500">{getTypeLabel(selectedApproval.request_type)}</p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {actionType === 'approve' ? 'Approval Comment (optional)' : 'Rejection Reason (required)'}
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={actionType === 'approve' ? 'Add a comment...' : 'Why are you rejecting this request?'}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                  rows={3}
                />
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Reasoning from AI:</p>
                <p className="text-sm text-gray-700">{selectedApproval.reasoning}</p>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 rounded-b-xl flex items-center justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={processing}
              >
                Cancel
              </button>
              <button
                onClick={submitAction}
                disabled={processing || (actionType === 'reject' && !comment.trim())}
                className={cn(
                  "px-4 py-2 text-white rounded-lg transition-colors flex items-center gap-2",
                  actionType === 'approve' 
                    ? "bg-green-600 hover:bg-green-700 disabled:bg-green-300" 
                    : "bg-red-600 hover:bg-red-700 disabled:bg-red-300"
                )}
              >
                {processing && <RefreshCw className="w-4 h-4 animate-spin" />}
                {actionType === 'approve' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Mock data for demo
function getMockApprovals(): ApprovalRequest[] {
  return [
    {
      id: '1',
      request_type: 'CASE_CREATE',
      trigger_source: 'AI_AGENT',
      related_entity_type: 'alert',
      related_entity_code: 'ALERT-101',
      request_payload: { alert_id: 101, title: 'Critical Stockout Risk - WKN-001', severity: 'P1_CRITICAL' },
      reasoning: 'Stock risk score reached 92% at WKN-001. 3 items critical. Immediate action required.',
      priority: 'HIGH',
      status: 'PENDING',
      approver_role: 'REGIONAL_MANAGER',
      created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      outlet_id: 1
    },
    {
      id: '2',
      request_type: 'ESCALATE',
      trigger_source: 'ML_MODEL',
      related_entity_type: 'outlet',
      related_entity_code: 'JKT-004',
      request_payload: { outlet_id: 4, action: 'ESCALATE_TO_HQ', reason: 'Sustained underperformance' },
      reasoning: 'JKT-004 has been below peer average by >20% for 7 consecutive days.',
      priority: 'MEDIUM',
      status: 'PENDING',
      approver_role: 'HQ_ADMIN',
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      outlet_id: 4
    },
    {
      id: '3',
      request_type: 'AUTO_RESOLVE',
      trigger_source: 'SYSTEM',
      related_entity_type: 'case',
      related_entity_code: 'CASE-45',
      request_payload: { case_id: 45, confidence: 0.87 },
      reasoning: 'AI suggests closing case #45 as sales have returned to normal. Confidence: 87%.',
      priority: 'LOW',
      status: 'PENDING',
      approver_role: 'REGIONAL_MANAGER',
      created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      expires_at: new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString(),
      outlet_id: 2
    }
  ];
}

export default ApprovalWorkflows;
