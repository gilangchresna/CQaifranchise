import { useState, useEffect } from 'react';
import { supabase } from "@/src/lib/supabase";

interface RoyaltySettings {
  id: string;
  default_base_rate: number;
  marketing_fund_rate: number;
  upfront_fee: number;
  min_rate_cap: number;
  max_rate_cap: number;
  score_multiplier_config: Record<string, { multiplier: number; label: string }>;
  growth_modifier_config: Record<string, { modifier: number; label: string }>;
  compliance_config: Record<string, { adjustment: number; label: string }>;
  revenue_tier_config: Record<string, { threshold?: number; adjustment: number; label: string }>;
}

export default function RoyaltySettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<RoyaltySettings | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    setLoading(true);
    const { data, error } = await supabase
      .from('royalty_settings')
      .select('*')
      .single();
    
    if (!error && data) {
      setSettings(data);
    }
    setLoading(false);
  }

  async function saveSettings() {
    if (!settings) return;
    setSaving(true);
    
    const { error } = await supabase
      .from('royalty_settings')
      .update({
        default_base_rate: settings.default_base_rate,
        marketing_fund_rate: settings.marketing_fund_rate,
        upfront_fee: settings.upfront_fee,
        min_rate_cap: settings.min_rate_cap,
        max_rate_cap: settings.max_rate_cap,
        score_multiplier_config: settings.score_multiplier_config,
        growth_modifier_config: settings.growth_modifier_config,
        compliance_config: settings.compliance_config,
        revenue_tier_config: settings.revenue_tier_config,
        updated_at: new Date().toISOString(),
      })
      .eq('id', settings.id);

    if (error) {
      setMessage({ type: 'error', text: 'Failed to save: ' + error.message });
    } else {
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
    }
    setSaving(false);
    setTimeout(() => setMessage(null), 3000);
  }

  function updateScoreBand(band: string, field: 'multiplier' | 'label', value: string | number) {
    if (!settings) return;
    const config = { ...settings.score_multiplier_config };
    if (!config[band]) config[band] = { multiplier: 1, label: band };
    config[band] = { ...config[band], [field]: field === 'multiplier' ? parseFloat(value as string) : value };
    setSettings({ ...settings, score_multiplier_config: config });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!settings) {
    return <div className="p-6 text-center text-gray-500">No settings found</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Royalty Settings</h1>
          <p className="text-gray-500">Configure master royalty parameters for all franchisees</p>
        </div>
        <button
          onClick={saveSettings}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {/* Base Rates */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-semibold mb-4">Base Rates</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Base Royalty Rate (%)</label>
            <input
              type="number"
              step="0.01"
              value={(settings.default_base_rate * 100).toFixed(2)}
              onChange={(e) => setSettings({ ...settings, default_base_rate: parseFloat(e.target.value) / 100 })}
              className="w-full px-3 py-2 border rounded-lg"
            />
            <p className="text-xs text-gray-500 mt-1">Standard rate for all franchisees</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Marketing Fund Rate (%)</label>
            <input
              type="number"
              step="0.01"
              value={(settings.marketing_fund_rate * 100).toFixed(2)}
              onChange={(e) => setSettings({ ...settings, marketing_fund_rate: parseFloat(e.target.value) / 100 })}
              className="w-full px-3 py-2 border rounded-lg"
            />
            <p className="text-xs text-gray-500 mt-1">Additional fund for marketing</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Upfront Fee (SGD)</label>
            <input
              type="number"
              value={settings.upfront_fee}
              onChange={(e) => setSettings({ ...settings, upfront_fee: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 border rounded-lg"
            />
            <p className="text-xs text-gray-500 mt-1">One-time joining fee</p>
          </div>
        </div>
      </div>

      {/* Rate Caps */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-semibold mb-4">Rate Caps</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Rate Cap (%)</label>
            <input
              type="number"
              step="0.1"
              value={(settings.min_rate_cap * 100).toFixed(1)}
              onChange={(e) => setSettings({ ...settings, min_rate_cap: parseFloat(e.target.value) / 100 })}
              className="w-full px-3 py-2 border rounded-lg"
            />
            <p className="text-xs text-gray-500 mt-1">Best performers pay at least this</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Maximum Rate Cap (%)</label>
            <input
              type="number"
              step="0.1"
              value={(settings.max_rate_cap * 100).toFixed(1)}
              onChange={(e) => setSettings({ ...settings, max_rate_cap: parseFloat(e.target.value) / 100 })}
              className="w-full px-3 py-2 border rounded-lg"
            />
            <p className="text-xs text-gray-500 mt-1">Worst performers pay at most this</p>
          </div>
        </div>
      </div>

      {/* Score Multipliers */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-semibold mb-4">Score Multipliers</h2>
        <p className="text-sm text-gray-500 mb-4">How risk score affects the base rate</p>
        <div className="space-y-3">
          {Object.entries(settings.score_multiplier_config).map(([band, config]) => (
            <div key={band} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
              <div className="w-32">
                <span className="font-medium">{band}</span>
                <p className="text-xs text-gray-500">{config.label}</p>
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500">Multiplier</label>
                <input
                  type="number"
                  step="0.05"
                  value={config.multiplier}
                  onChange={(e) => updateScoreBand(band, 'multiplier', e.target.value)}
                  className="w-full px-2 py-1 border rounded"
                />
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">= {(settings.default_base_rate * 100 * config.multiplier).toFixed(1)}%</p>
                <p className="text-xs text-gray-500">effective rate</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Growth Modifiers */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-semibold mb-4">Growth Modifiers</h2>
        <p className="text-sm text-gray-500 mb-4">YoY revenue growth bonuses/penalties</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(settings.growth_modifier_config).map(([band, config]) => (
            <div key={band} className="p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">{band}</span>
                <input
                  type="number"
                  step="0.001"
                  value={config.modifier}
                  onChange={(e) => {
                    const newConfig = { ...settings.growth_modifier_config };
                    newConfig[band] = { ...config, modifier: parseFloat(e.target.value) };
                    setSettings({ ...settings, growth_modifier_config: newConfig });
                  }}
                  className="w-20 px-2 py-1 border rounded text-right"
                />
              </div>
              <p className="text-xs text-gray-500">{config.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Compliance Adjustments */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-semibold mb-4">Compliance Adjustments</h2>
        <p className="text-sm text-gray-500 mb-4">Compliance score bonuses</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(settings.compliance_config).map(([band, config]) => (
            <div key={band} className="p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">{band}</span>
                <input
                  type="number"
                  step="0.001"
                  value={config.adjustment}
                  onChange={(e) => {
                    const newConfig = { ...settings.compliance_config };
                    newConfig[band] = { ...config, adjustment: parseFloat(e.target.value) };
                    setSettings({ ...settings, compliance_config: newConfig });
                  }}
                  className="w-20 px-2 py-1 border rounded text-right"
                />
              </div>
              <p className="text-xs text-gray-500">{config.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Revenue Tiers */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-semibold mb-4">Revenue Tiers</h2>
        <p className="text-sm text-gray-500 mb-4">Revenue-based adjustments (SGD/month)</p>
        <div className="space-y-3">
          {Object.entries(settings.revenue_tier_config).map(([tier, config]) => (
            <div key={tier} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
              <div className="w-40">
                <span className="font-medium">{tier.replace(/_/g, ' ')}</span>
                <p className="text-xs text-gray-500">{config.label}</p>
              </div>
              {config.threshold && (
                <div className="w-32">
                  <label className="text-xs text-gray-500">Threshold (SGD)</label>
                  <input
                    type="number"
                    value={config.threshold}
                    onChange={(e) => {
                      const newConfig = { ...settings.revenue_tier_config };
                      newConfig[tier] = { ...config, threshold: parseFloat(e.target.value) };
                      setSettings({ ...settings, revenue_tier_config: newConfig });
                    }}
                    className="w-full px-2 py-1 border rounded"
                  />
                </div>
              )}
              <div>
                <label className="text-xs text-gray-500">Adjustment</label>
                <input
                  type="number"
                  step="0.001"
                  value={config.adjustment}
                  onChange={(e) => {
                    const newConfig = { ...settings.revenue_tier_config };
                    newConfig[tier] = { ...config, adjustment: parseFloat(e.target.value) };
                    setSettings({ ...settings, revenue_tier_config: newConfig });
                  }}
                  className="w-24 px-2 py-1 border rounded"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
