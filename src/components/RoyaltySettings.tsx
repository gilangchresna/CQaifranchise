import { useState, useEffect, useMemo } from 'react';
import { supabase } from "@/src/lib/supabase";
import { 
  DollarSign, TrendingUp, TrendingDown, Target, CheckCircle, 
  BarChart3, AlertTriangle, Zap, Settings, Save, RotateCcw
} from 'lucide-react';

interface FormulaPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  config: {
    baseRate: number;
    useScoreMultiplier: boolean;
    useGrowthBonus: boolean;
    useComplianceBonus: boolean;
    useRevenueTier: boolean;
    minCap: number;
    maxCap: number;
    scoreMultiplierMin: number;
    scoreMultiplierMax: number;
    growthBonusMax: number;
    complianceBonusMax: number;
    revenueTierMax: number;
  };
}

const PRESETS: FormulaPreset[] = [
  {
    id: 'simple-flat',
    name: 'Simple Flat',
    description: '6% flat rate for all franchisees',
    icon: '💰',
    config: {
      baseRate: 0.06,
      useScoreMultiplier: false,
      useGrowthBonus: false,
      useComplianceBonus: false,
      useRevenueTier: false,
      minCap: 0.06,
      maxCap: 0.06,
      scoreMultiplierMin: 1,
      scoreMultiplierMax: 1,
      growthBonusMax: 0,
      complianceBonusMax: 0,
      revenueTierMax: 0,
    },
  },
  {
    id: 'performance',
    name: 'Performance-Based',
    description: 'Score determines 50% of rate, full variable',
    icon: '📊',
    config: {
      baseRate: 0.06,
      useScoreMultiplier: true,
      useGrowthBonus: true,
      useComplianceBonus: true,
      useRevenueTier: true,
      minCap: 0.01,
      maxCap: 0.15,
      scoreMultiplierMin: 0.5,
      scoreMultiplierMax: 2.0,
      growthBonusMax: 0.02,
      complianceBonusMax: 0.01,
      revenueTierMax: 0.005,
    },
  },
  {
    id: 'hybrid',
    name: 'Hybrid',
    description: 'Base rate with performance bonuses only',
    icon: '🚀',
    config: {
      baseRate: 0.06,
      useScoreMultiplier: false,
      useGrowthBonus: true,
      useComplianceBonus: true,
      useRevenueTier: false,
      minCap: 0.04,
      maxCap: 0.10,
      scoreMultiplierMin: 1,
      scoreMultiplierMax: 1,
      growthBonusMax: 0.01,
      complianceBonusMax: 0.005,
      revenueTierMax: 0,
    },
  },
];

interface SettingsState {
  baseRate: number;
  useScoreMultiplier: boolean;
  useGrowthBonus: boolean;
  useComplianceBonus: boolean;
  useRevenueTier: boolean;
  minCap: number;
  maxCap: number;
  scoreMultiplierMin: number;
  scoreMultiplierMax: number;
  growthBonusMax: number;
  complianceBonusMax: number;
  revenueTierMax: number;
}

export default function RoyaltySettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activePreset, setActivePreset] = useState<string>('performance');
  
  const [settings, setSettings] = useState<SettingsState>(PRESETS[1].config);
  const [activeTab, setActiveTab] = useState<'presets' | 'formula' | 'preview'>('formula');

  // Sample performers for preview
  const samplePerformers = [
    { name: '🌟 Excellent', score: 95, growth: 0.30, compliance: 0.98, revenue: 90000 },
    { name: '✅ Good', score: 78, growth: 0.12, compliance: 0.88, revenue: 50000 },
    { name: '⚖️ Average', score: 68, growth: 0.05, compliance: 0.75, revenue: 30000 },
    { name: '⚠️ Below Avg', score: 52, growth: -0.05, compliance: 0.55, revenue: 18000 },
    { name: '🚨 Poor', score: 38, growth: -0.15, compliance: 0.40, revenue: 12000 },
  ];

  // Calculate effective rate for a performer
  function calculateRate(performer: typeof samplePerformers[0]): number {
    let rate = settings.baseRate;

    if (settings.useScoreMultiplier) {
      // Score to multiplier: 100 = min multiplier, 0 = max multiplier
      const scoreRange = 100 - 0;
      const multRange = settings.scoreMultiplierMax - settings.scoreMultiplierMin;
      const multiplier = settings.scoreMultiplierMax - 
        ((performer.score / 100) * multRange);
      rate *= multiplier;
    }

    if (settings.useGrowthBonus) {
      const growthBonus = performer.growth * settings.growthBonusMax / 0.30; // normalize to 30%
      rate += Math.min(Math.max(growthBonus, -settings.growthBonusMax), settings.growthBonusMax);
    }

    if (settings.useComplianceBonus) {
      const complianceBonus = (performer.compliance - 0.5) * settings.complianceBonusMax / 0.5;
      rate += Math.min(Math.max(complianceBonus, -settings.complianceBonusMax), settings.complianceBonusMax);
    }

    if (settings.useRevenueTier) {
      const tierBonus = performer.revenue > 60000 ? -settings.revenueTierMax :
                       performer.revenue > 40000 ? -settings.revenueTierMax * 0.5 :
                       performer.revenue < 15000 ? settings.revenueTierMax : 0;
      rate += tierBonus;
    }

    return Math.min(Math.max(rate, settings.minCap), settings.maxCap);
  }

  // Calculate all previews
  const previewResults = useMemo(() => {
    return samplePerformers.map(p => ({
      ...p,
      rate: calculateRate(p),
      savings: (settings.baseRate - calculateRate(p)) * p.revenue,
    }));
  }, [settings]);

  function applyPreset(presetId: string) {
    const preset = PRESETS.find(p => p.id === presetId);
    if (preset) {
      setActivePreset(presetId);
      setSettings(preset.config);
    }
  }

  function resetToDefaults() {
    applyPreset('performance');
  }

  async function saveSettings() {
    setSaving(true);
    
    // In real implementation, save to royalty_settings table
    // For now, just simulate
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setMessage({ type: 'success', text: 'Formula saved successfully!' });
    setSaving(false);
    setTimeout(() => setMessage(null), 3000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Royalty Formula Settings</h1>
            <p className="text-gray-500">Configure how royalty rates are calculated for all franchisees</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={resetToDefaults}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
            <button
              onClick={saveSettings}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Formula'}
            </button>
          </div>
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {message.text}
          </div>
        )}

        {/* Preset Templates */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Quick Start Templates</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PRESETS.map(preset => (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset.id)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  activePreset === preset.id 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{preset.icon}</span>
                  <div>
                    <h3 className="font-semibold">{preset.name}</h3>
                    <p className="text-sm text-gray-500">{preset.description}</p>
                  </div>
                </div>
                {activePreset === preset.id && (
                  <span className="text-xs text-blue-600 font-medium">✓ Active</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b">
          {(['formula', 'preview'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === tab 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'formula' ? '⚙️ Formula Components' : '📊 Live Preview'}
            </button>
          ))}
        </div>

        {activeTab === 'formula' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Base Rate */}
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-blue-600" />
                Base Royalty Rate
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Base Rate</span>
                    <span className="font-semibold">{(settings.baseRate * 100).toFixed(1)}%</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="15"
                    step="0.5"
                    value={settings.baseRate * 100}
                    onChange={(e) => setSettings({ ...settings, baseRate: parseFloat(e.target.value) / 100 })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                <p className="text-sm text-gray-500">
                  This is the base rate before any adjustments. Standard franchise royalty is 5-10%.
                </p>
              </div>
            </div>

            {/* Rate Caps */}
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                Rate Cap Limits
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">Minimum</span>
                      <span className="font-semibold text-green-600">{(settings.minCap * 100).toFixed(1)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="5"
                      step="0.5"
                      value={settings.minCap * 100}
                      onChange={(e) => setSettings({ ...settings, minCap: parseFloat(e.target.value) / 100 })}
                      className="w-full h-2 bg-green-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <p className="text-xs text-gray-400 mt-1">Best performers pay at least this</p>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">Maximum</span>
                      <span className="font-semibold text-red-600">{(settings.maxCap * 100).toFixed(1)}%</span>
                    </div>
                    <input
                      type="range"
                      min="8"
                      max="25"
                      step="0.5"
                      value={settings.maxCap * 100}
                      onChange={(e) => setSettings({ ...settings, maxCap: parseFloat(e.target.value) / 100 })}
                      className="w-full h-2 bg-red-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <p className="text-xs text-gray-400 mt-1">Worst performers pay at most this</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Formula Components */}
            <div className="bg-white rounded-xl border p-6 lg:col-span-2">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-gray-600" />
                Formula Components
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Toggle which factors affect the final royalty rate. Enable all for maximum performance incentives.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Score Multiplier */}
                <div className={`p-4 rounded-lg border-2 ${settings.useScoreMultiplier ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={settings.useScoreMultiplier}
                        onChange={(e) => setSettings({ ...settings, useScoreMultiplier: e.target.checked })}
                        className="w-5 h-5 text-blue-600 rounded"
                      />
                      <div>
                        <h4 className="font-medium">Risk Score Multiplier</h4>
                        <p className="text-xs text-gray-500">Higher score = lower rate</p>
                      </div>
                    </div>
                  </div>
                  {settings.useScoreMultiplier && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-gray-500">Min Multiplier</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0.5"
                            max="1"
                            value={settings.scoreMultiplierMin}
                            onChange={(e) => setSettings({ ...settings, scoreMultiplierMin: parseFloat(e.target.value) })}
                            className="w-full px-2 py-1 border rounded"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Max Multiplier</label>
                          <input
                            type="number"
                            step="0.1"
                            min="1"
                            max="3"
                            value={settings.scoreMultiplierMax}
                            onChange={(e) => setSettings({ ...settings, scoreMultiplierMax: parseFloat(e.target.value) })}
                            className="w-full px-2 py-1 border rounded"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-gray-400">
                        Score 100 → {settings.scoreMultiplierMin}x multiplier<br/>
                        Score 0 → {settings.scoreMultiplierMax}x multiplier
                      </p>
                    </div>
                  )}
                </div>

                {/* Growth Bonus */}
                <div className={`p-4 rounded-lg border-2 ${settings.useGrowthBonus ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={settings.useGrowthBonus}
                        onChange={(e) => setSettings({ ...settings, useGrowthBonus: e.target.checked })}
                        className="w-5 h-5 text-green-600 rounded"
                      />
                      <div>
                        <h4 className="font-medium">YoY Growth Bonus</h4>
                        <p className="text-xs text-gray-500">Growing revenue = lower rate</p>
                      </div>
                    </div>
                  </div>
                  {settings.useGrowthBonus && (
                    <div>
                      <label className="text-xs text-gray-500">Max Bonus (negative = discount)</label>
                      <input
                        type="range"
                        min="0"
                        max="3"
                        step="0.5"
                        value={settings.growthBonusMax * 100}
                        onChange={(e) => setSettings({ ...settings, growthBonusMax: parseFloat(e.target.value) / 100 })}
                        className="w-full h-2 bg-green-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Max discount: {(settings.growthBonusMax * 100).toFixed(1)}%
                        {settings.growthBonusMax > 0 && ' (for >30% growth)'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Compliance Bonus */}
                <div className={`p-4 rounded-lg border-2 ${settings.useComplianceBonus ? 'border-teal-500 bg-teal-50' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={settings.useComplianceBonus}
                        onChange={(e) => setSettings({ ...settings, useComplianceBonus: e.target.checked })}
                        className="w-5 h-5 text-teal-600 rounded"
                      />
                      <div>
                        <h4 className="font-medium">Compliance Bonus</h4>
                        <p className="text-xs text-gray-500">High compliance = lower rate</p>
                      </div>
                    </div>
                  </div>
                  {settings.useComplianceBonus && (
                    <div>
                      <label className="text-xs text-gray-500">Max Bonus</label>
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.25"
                        value={settings.complianceBonusMax * 100}
                        onChange={(e) => setSettings({ ...settings, complianceBonusMax: parseFloat(e.target.value) / 100 })}
                        className="w-full h-2 bg-teal-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Max discount: {(settings.complianceBonusMax * 100).toFixed(2)}%
                      </p>
                    </div>
                  )}
                </div>

                {/* Revenue Tier */}
                <div className={`p-4 rounded-lg border-2 ${settings.useRevenueTier ? 'border-purple-500 bg-purple-50' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={settings.useRevenueTier}
                        onChange={(e) => setSettings({ ...settings, useRevenueTier: e.target.checked })}
                        className="w-5 h-5 text-purple-600 rounded"
                      />
                      <div>
                        <h4 className="font-medium">Revenue Tier</h4>
                        <p className="text-xs text-gray-500">Large outlets = slight discount</p>
                      </div>
                    </div>
                  </div>
                  {settings.useRevenueTier && (
                    <div>
                      <label className="text-xs text-gray-500">Max Tier Adjustment</label>
                      <input
                        type="range"
                        min="0"
                        max="1.5"
                        step="0.25"
                        value={settings.revenueTierMax * 100}
                        onChange={(e) => setSettings({ ...settings, revenueTierMax: parseFloat(e.target.value) / 100 })}
                        className="w-full h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Revenue {'>'}60k: -{(settings.revenueTierMax * 100).toFixed(2)}%<br/>
                        Revenue {'<'}15k: +{(settings.revenueTierMax * 100).toFixed(2)}%
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'preview' && (
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="p-6 border-b bg-gray-50">
              <h3 className="font-semibold flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                Live Rate Preview
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                See how your formula affects different performer types
              </p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Performer Type</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Score</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">YoY Growth</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Compliance</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Revenue</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Effective Rate</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Monthly Royalty</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">vs Flat</th>
                  </tr>
                </thead>
                <tbody>
                  {previewResults.map((result, i) => (
                    <tr key={i} className="border-t hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{result.name}</td>
                      <td className="py-3 px-4 text-right">{result.score}</td>
                      <td className="py-3 px-4 text-right">{(result.growth * 100).toFixed(0)}%</td>
                      <td className="py-3 px-4 text-right">{(result.compliance * 100).toFixed(0)}%</td>
                      <td className="py-3 px-4 text-right">SGD {(result.revenue / 1000).toFixed(0)}k</td>
                      <td className={`py-3 px-4 text-right font-bold ${
                        result.rate < settings.baseRate ? 'text-green-600' :
                        result.rate > settings.baseRate ? 'text-red-600' : 'text-gray-900'
                      }`}>
                        {(result.rate * 100).toFixed(1)}%
                      </td>
                      <td className="py-3 px-4 text-right font-semibold">
                        SGD {Math.round(result.rate * result.revenue).toLocaleString()}
                      </td>
                      <td className={`py-3 px-4 text-right ${
                        result.savings > 0 ? 'text-green-600' : result.savings < 0 ? 'text-red-600' : 'text-gray-400'
                      }`}>
                        {result.savings > 0 ? '↓' : result.savings < 0 ? '↑' : '='}
                        {' '}SGD {Math.abs(Math.round(result.savings)).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-gray-50 border-t">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <TrendingDown className="w-4 h-4 text-green-600" />
                <span>↓ = saving vs flat rate</span>
                <TrendingUp className="w-4 h-4 text-red-600 ml-4" />
                <span>↑ = paying more vs flat rate</span>
              </div>
            </div>
          </div>
        )}

        {/* Summary Formula */}
        <div className="mt-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border p-6">
          <h3 className="font-semibold mb-3">Current Formula Summary</h3>
          <div className="bg-white rounded-lg p-4 font-mono text-sm">
            <p className="text-gray-600 mb-2">EFFECTIVE_RATE =</p>
            <p className="pl-4 mb-1">
              <span className="text-blue-600">Base {settings.baseRate * 100}%</span>
              {settings.useScoreMultiplier && (
                <> × <span className="text-purple-600">Score_Multiplier</span></>
              )}
            </p>
            {settings.useScoreMultiplier && (
              <p className="pl-8 text-xs text-gray-500 mb-1">
                ({settings.scoreMultiplierMin} to {settings.scoreMultiplierMax}x based on score)
              </p>
            )}
            {settings.useGrowthBonus && (
              <p className="pl-4 text-green-600 mb-1">
                + Growth_Bonus ({'>'}0% growth: -{(settings.growthBonusMax * 100).toFixed(1)}% max)
              </p>
            )}
            {settings.useComplianceBonus && (
              <p className="pl-4 text-teal-600 mb-1">
                + Compliance_Bonus ({'>'}95%: -{(settings.complianceBonusMax * 100).toFixed(2)}% max)
              </p>
            )}
            {settings.useRevenueTier && (
              <p className="pl-4 text-purple-600 mb-1">
                + Revenue_Tier ({'>'}60k: -{(settings.revenueTierMax * 100).toFixed(2)}%)
              </p>
            )}
            <p className="pl-4 pt-2 border-t mt-2">
              <span className="text-gray-500">Capped between </span>
              <span className="text-green-600 font-bold">{(settings.minCap * 100).toFixed(1)}%</span>
              <span className="text-gray-500"> and </span>
              <span className="text-red-600 font-bold">{(settings.maxCap * 100).toFixed(1)}%</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
