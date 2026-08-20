// src/components/FilingLinksEdit.tsx
import React, { useState } from 'react';
import { ExternalLink, Check, AlertCircle, Globe, Save } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';

interface FilingLinksEditProps {
  userId: string;
  regionId?: number;
  initialData?: {
    filing_links?: any;
    filing_status?: string;
    filing_links_verified_at?: string;
  };
  onSave?: () => void;
}

interface FilingLink {
  acra_bizfile?: string;
  acra_xbrl?: string;
  ahu_annual?: string;
  oss_lkpm?: string;
  djp_spt?: string;
}

const FILING_PLATFORMS = {
  sg: [
    { key: 'acra_bizfile', label: 'ACRA BizFile+', url: 'https://bizfile.gov.sg', description: 'Singapore company annual return filed via BizFile+' },
    { key: 'acra_xbrl', label: 'ACRA XBRL Financials', url: 'https://bizfile.gov.sg', description: 'XBRL formatted financial statements' },
  ],
  id: [
    { key: 'ahu_annual', label: 'AHU Annual Report', url: 'https://ahu.go.id', description: 'Indonesia annual company report (Laporan Tahunan)' },
    { key: 'oss_lkpm', label: 'BKPM OSS (LKPM)', url: 'https://oss.go.id', description: 'Investment realization report (quarterly)' },
    { key: 'djp_spt', label: 'DJP SPT Tahunan', url: 'https://pajak.go.id', description: 'Annual tax return (SPT Badan)' },
  ],
};

export function FilingLinksEdit({ userId, regionId, initialData, onSave }: FilingLinksEditProps) {
  // Auto-select tab based on region_id
  // 114 = Singapore, 115-117 = Indonesia
  const getInitialTab = (): 'sg' | 'id' => {
    if (regionId === 114) return 'sg';
    if (regionId && [115, 116, 117].includes(regionId)) return 'id';
    return 'sg'; // default
  };
  
  const [links, setLinks] = useState<FilingLink>(() => {
    // Parse initial links from either flat structure or nested
    const initial = initialData?.filing_links || {};
    // Support both flat keys and nested structure
    return {
      acra_bizfile: initial.acra_bizfile || initial.sg?.acra_bizfile,
      acra_xbrl: initial.acra_xbrl || initial.sg?.acra_xbrl,
      ahu_annual: initial.ahu_annual || initial.id?.ahu_annual,
      oss_lkpm: initial.oss_lkpm || initial.id?.oss_lkpm,
      djp_spt: initial.djp_spt || initial.id?.djp_spt,
    };
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'sg' | 'id'>(getInitialTab());

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      // Determine filing status based on links
      const sgLinks = links.acra_bizfile || links.acra_xbrl;
      const idLinks = links.ahu_annual || links.oss_lkpm || links.djp_spt;
      const filingStatus = (sgLinks || idLinks) ? 'FILED' : 'PENDING';

      // Store as nested structure
      const filingLinksToSave = {
        sg: {
          acra_bizfile: links.acra_bizfile || null,
          acra_xbrl: links.acra_xbrl || null,
        },
        id: {
          ahu_annual: links.ahu_annual || null,
          oss_lkpm: links.oss_lkpm || null,
          djp_spt: links.djp_spt || null,
        },
      };

      const { error } = await supabase
        .from('user_profiles')
        .update({
          filing_links: filingLinksToSave,
          filing_status: filingStatus,
          filing_links_verified_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) throw error;

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onSave?.();

    } catch (err: any) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function updateLink(key: keyof FilingLink, value: string) {
    setLinks(prev => ({ ...prev, [key]: value || undefined }));
  }

  // Check if any links are filled
  const hasAnyLink = Object.values(links).some(v => typeof v === 'string' && v.trim().length > 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Regulatory Filing Links
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Links to official government platforms for regulatory filings
            </p>
          </div>
          
          {/* Filing Status Badge */}
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            hasAnyLink 
              ? 'bg-green-100 text-green-700' 
              : 'bg-yellow-100 text-yellow-700'
          }`}>
            {hasAnyLink ? (
              <span className="flex items-center gap-1">
                <Check className="w-4 h-4" /> Filed
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <AlertCircle className="w-4 h-4" /> Pending
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Country Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('sg')}
          className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'sg'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          🇸🇬 Singapore
        </button>
        <button
          onClick={() => setActiveTab('id')}
          className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'id'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          🇮🇩 Indonesia
        </button>
      </div>

      {/* Filing Links Form */}
      <div className="p-6 space-y-4">
        {activeTab === 'sg' && FILING_PLATFORMS.sg.map(platform => (
          <div key={platform.key} className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">
                {platform.label}
              </label>
              <a
                href={platform.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                {platform.url.replace('https://', '')} <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <input
              type="url"
              value={links[platform.key as keyof FilingLink] || ''}
              onChange={(e) => updateLink(platform.key as keyof FilingLink, e.target.value)}
              placeholder={`https://bizfile.gov.sg/...`}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-400">{platform.description}</p>
          </div>
        ))}

        {activeTab === 'id' && FILING_PLATFORMS.id.map(platform => (
          <div key={platform.key} className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">
                {platform.label}
              </label>
              <a
                href={platform.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                {platform.url.replace('https://', '')} <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <input
              type="url"
              value={links[platform.key as keyof FilingLink] || ''}
              onChange={(e) => updateLink(platform.key as keyof FilingLink, e.target.value)}
              placeholder={`https://...`}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-400">{platform.description}</p>
          </div>
        ))}
      </div>

      {/* Save Button */}
      <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Last verified: {initialData?.filing_links_verified_at 
              ? new Date(initialData.filing_links_verified_at).toLocaleDateString() 
              : 'Never'}
          </p>
          
          <div className="flex items-center gap-2">
            {error && (
              <span className="text-sm text-red-600">{error}</span>
            )}
            {saved && (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <Check className="w-4 h-4" /> Saved!
              </span>
            )}
            
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Links
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
