import React, { useEffect, useState } from 'react';
import { X, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{policyTitle}</h2>
              <p className="text-xs text-slate-500">Jurisdiction: {regionLabel}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            <p className="text-xs text-amber-800">
              <strong>Note:</strong> This policy is under legal review. Content may be updated before production launch.
            </p>
          </div>

          <div className="prose prose-sm max-w-none text-slate-600 whitespace-pre-line">
            {policyContent}
          </div>

          {/* Consent checkbox */}
          <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700">
                I have read and understood the privacy notice above. I consent to the collection,
                use, and disclosure of my personal data as described, for the purpose of
                processing my financing application.
              </span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConsent}
            disabled={!accepted || isLoading}
            className={`px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${
              accepted && !isLoading
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
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
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_consents?user_id=eq.${userId}&policy_type=eq.pdpa&is_active=eq.true&select=id`,
        {
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
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

  const loadPolicy = async () => {
    try {
      // Try region-specific policy first
      let url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/knowledge_policies?policy_type=eq.pdpa&is_active=eq.true&select=id,title,content&limit=1`;
      if (regionId) {
        url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/knowledge_policies?policy_type=eq.pdpa&region_id=eq.${regionId}&is_active=eq.true&select=id,title,content&limit=1`;
      }

      const response = await fetch(url, {
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });
      const policies = await response.json();

      if (Array.isArray(policies) && policies.length > 0) {
        const p = policies[0];
        setPolicyId(p.id);
        setSelectedPolicy({
          title: p.title,
          content: p.content,
          regionLabel: regionId === 1 ? 'Singapore' : regionId === 2 ? 'Indonesia' : 'Malaysia',
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
      return true;
    }
    return false;
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
