import React, { useEffect, useState } from 'react';
import { X, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';

interface ConsentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConsent: () => void;
  policyTitle: string;
  policyContent: string;
  regionLabel: string;
  isLoading?: boolean;
}

export function ConsentDialog({
  isOpen,
  onClose,
  onConsent,
  policyTitle,
  policyContent,
  regionLabel,
  isLoading = false,
}: ConsentDialogProps) {
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAccepted(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-white">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 20.54a12.02 12.02 0 007-8.57 8.57 0 003-4.07 4.07z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">{policyTitle}</h2>
                <div className="flex items-center gap-3 mt-2">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                    {regionLabel}
                  </span>
                  <span className="text-xs text-slate-500">Personal Data Protection Notice</span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors flex-shrink-0"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          
          {/* Warning Banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-amber-800 mb-1">Legal Review Pending</h4>
                <p className="text-xs text-amber-700 leading-relaxed">This notice is under legal review. The content may be updated before production launch.</p>
              </div>
            </div>
          </div>

          {/* Policy Content */}
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Privacy Notice
            </h4>
            <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
              {policyContent}
            </div>
          </div>

          {/* Consent Checkbox */}
          <div className="bg-blue-50 rounded-xl p-5 border border-blue-100">
            <label className="flex items-start gap-4 cursor-pointer">
              <div className="flex-shrink-0 mt-0.5">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  className="w-5 h-5 rounded border-blue-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </div>
              <div>
                <span className="text-sm font-semibold text-slate-800 block mb-1.5">
                  I agree to the data processing terms
                </span>
                <span className="text-xs text-slate-600 leading-relaxed">
                  By checking this box, I confirm that I have read, understood, and agree to the privacy notice above. I consent to the collection, use, and disclosure of my personal data as described, for the purpose of processing my financing application.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConsent}
            disabled={!accepted || isLoading}
            className={`px-6 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${
              accepted && !isLoading
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                I Agree — Continue
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// useConsent hook
interface UseConsentReturn {
  hasConsented: boolean;
  isLoading: boolean;
  showConsentDialog: boolean;
  selectedPolicy: { title: string; content: string; regionLabel: string } | null;
  checkConsent: () => Promise<boolean>;
  recordConsent: (policyId: string, regionId: number | null) => Promise<void>;
  openConsentDialog: () => Promise<boolean>;
  closeConsentDialog: () => void;
  handleConsentGiven: () => Promise<void>;
}

export function useConsent(
  userId: string,
  regionId: number | null
): UseConsentReturn {
  const [hasConsented, setHasConsented] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<{
    title: string;
    content: string;
    regionLabel: string;
  } | null>(null);
  const [policyId, setPolicyId] = useState<string | null>(null);

  const checkConsent = async (): Promise<boolean> => {
    if (!userId) return false;
    setIsLoading(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_consents?user_id=eq.${userId}&policy_type=eq.pdpa&is_active=eq.true&select=id`,
        {
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );
      const data = await response.json();
      const consented = Array.isArray(data) && data.length > 0;
      setHasConsented(consented);
      return consented;
    } catch {
      setHasConsented(false);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const loadPolicy = async (): Promise<boolean> => {
    try {
      const session = (await supabase.auth.getSession()).data.session;
      let url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/knowledge_policies?policy_type=eq.pdpa&is_active=eq.true&select=id,title,content&limit=1`;
      
      // Try region-specific first, then global fallback
      if (regionId) {
        const regionUrl = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/knowledge_policies?policy_type=eq.pdpa&region_id=eq.${regionId}&is_active=eq.true&select=id,title,content&limit=1`;
        const regionResp = await fetch(regionUrl, {
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
            Authorization: `Bearer ${session?.access_token}`,
          },
        });
        const regionPolicies = await regionResp.json();
        if (Array.isArray(regionPolicies) && regionPolicies.length > 0) {
          const p = regionPolicies[0];
          setPolicyId(p.id);
          const regionLabel = regionId === 1 || regionId === 114 ? 'Singapore' 
            : regionId === 2 || regionId === 115 ? 'Indonesia'
            : regionId === 116 ? 'Bandung'
            : regionId === 117 ? 'Surabaya'
            : regionId === 118 ? 'Bangkok'
            : regionId === 119 ? 'Kuala Lumpur'
            : 'Malaysia';
          setSelectedPolicy({ title: p.title, content: p.content, regionLabel });
          return true;
        }
      }

      const response = await fetch(url, {
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
          Authorization: `Bearer ${session?.access_token}`,
        },
      });
      const policies = await response.json();

      if (Array.isArray(policies) && policies.length > 0) {
        const p = policies[0];
        setPolicyId(p.id);
        setSelectedPolicy({
          title: p.title,
          content: p.content,
          regionLabel: regionId ? 'Singapore' : 'Malaysia',
        });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const openConsentDialog = async (): Promise<boolean> => {
    const hasPolicy = await loadPolicy();
    if (hasPolicy) {
      setShowConsentDialog(true);
    }
    return hasPolicy;
  };

  const closeConsentDialog = () => {
    setShowConsentDialog(false);
    setSelectedPolicy(null);
    setPolicyId(null);
  };

  const recordConsent = async (pid: string, rid: number | null) => {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) throw new Error('Not authenticated');

    await supabase.from('user_consents').upsert(
      {
        user_id: userId,
        policy_id: pid,
        policy_type: 'pdpa',
        region_id: rid,
        consented_at: new Date().toISOString(),
        is_active: true,
      },
      { onConflict: 'user_id,policy_type,region_id' }
    );

    setHasConsented(true);
  };

  const handleConsentGiven = async () => {
    if (policyId) {
      await recordConsent(policyId, regionId);
      closeConsentDialog();
    }
  };

  return {
    hasConsented,
    isLoading,
    showConsentDialog,
    selectedPolicy,
    checkConsent,
    recordConsent,
    openConsentDialog,
    closeConsentDialog,
    handleConsentGiven,
  };
}
