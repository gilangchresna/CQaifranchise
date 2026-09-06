import { useState } from 'react';
import { Download, FileSpreadsheet, TrendingUp, TrendingDown } from 'lucide-react';

// Formula calculation functions (same as edge function)
function getScoreMultiplier(score: number): number {
  if (score >= 90) return 0.70;
  if (score >= 80) return 0.85;
  if (score >= 70) return 1.00;
  if (score >= 60) return 1.15;
  if (score >= 50) return 1.30;
  return 1.50;
}

function getTierAdjustment(revenue: number): number {
  if (revenue > 60000) return -0.005;
  if (revenue > 40000) return -0.003;
  if (revenue > 20000) return 0;
  return 0.003;
}

function getGrowthModifier(growth: number): number {
  if (growth >= 30) return -0.02;
  if (growth >= 20) return -0.01;
  if (growth >= 10) return -0.005;
  if (growth >= 0) return 0;
  if (growth >= -10) return 0.005;
  return 0.01;
}

function getComplianceAdjustment(compliance: number): number {
  if (compliance >= 98) return -0.01;
  if (compliance >= 95) return -0.005;
  if (compliance >= 90) return 0;
  if (compliance >= 85) return 0.005;
  return 0.01;
}

function calculateEffectiveRate(
  baseRate: number,
  score: number,
  revenue: number,
  growth: number,
  compliance: number,
  formulaType: string,
  useScore: boolean,
  useGrowth: boolean,
  useCompliance: boolean,
  useTier: boolean
): number {
  const scoreMultiplier = getScoreMultiplier(score);
  const tierAdj = useTier ? getTierAdjustment(revenue) : 0;
  const growthMod = useGrowth ? getGrowthModifier(growth) : 0;
  const complianceAdj = useCompliance ? getComplianceAdjustment(compliance) : 0;
  const scoreAdjustment = (baseRate * scoreMultiplier) - baseRate;

  let effectiveRate = baseRate;

  if (formulaType === 'SIMPLE') {
    effectiveRate = baseRate;
  } else if (formulaType === 'PERFORMANCE') {
    effectiveRate = baseRate * scoreMultiplier;
    if (useTier) effectiveRate += tierAdj;
    if (useGrowth) effectiveRate += growthMod;
    if (useCompliance) effectiveRate += complianceAdj;
  } else if (formulaType === 'HYBRID') {
    effectiveRate = baseRate;
    if (useGrowth) effectiveRate += growthMod;
    if (useCompliance) effectiveRate += complianceAdj;
    if (useTier) effectiveRate += tierAdj;
  } else {
    effectiveRate = baseRate;
    if (useScore) effectiveRate += scoreAdjustment;
    if (useTier) effectiveRate += tierAdj;
    if (useGrowth) effectiveRate += growthMod;
    if (useCompliance) effectiveRate += complianceAdj;
  }

  return Math.max(0.01, Math.min(0.15, effectiveRate));
}

export default function RoyaltySimulationExport() {
  const [exporting, setExporting] = useState(false);
  const [formulaType, setFormulaType] = useState('COMBINED');
  const [baseRate, setBaseRate] = useState(6);

  const formulaTypes = [
    { id: 'SIMPLE', name: 'Simple Flat', desc: '6% flat rate' },
    { id: 'PERFORMANCE', name: 'Performance-Based', desc: 'Score × Base + adjustments' },
    { id: 'HYBRID', name: 'Hybrid', desc: 'Base + bonuses only' },
    { id: 'COMBINED', name: 'Combined', desc: 'Full customization' },
  ];

  function generateCSV() {
    const rows: string[][] = [];
    
    // Header
    rows.push([
      'Royalty Formula Simulation Export',
      `Formula Type: ${formulaType}`,
      `Base Rate: ${baseRate}%`,
      '',
      '',
      '',
      '',
      '',
      ''
    ]);
    
    rows.push([]); // Empty row
    
    // Column headers
    rows.push([
      'Score',
      'Revenue (SGD)',
      'YoY Growth %',
      'Compliance %',
      'Score Multiplier',
      'Score Adj %',
      'Growth Adj %',
      'Compliance Adj %',
      'Tier Adj %',
      'Effective Rate %',
      'Royalty Amount'
    ]);
    
    // Calculate for different scenarios
    const scores = [95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40];
    const revenues = [85000, 60000, 45000, 30000, 15000];
    const growths = [35, 25, 15, 5, -5, -15];
    const compliances = [99, 96, 92, 88, 85];
    
    // Generate scenarios
    for (const score of scores) {
      for (const revenue of revenues.slice(0, 2)) { // Top 2 revenues
        for (const growth of growths.slice(0, 3)) { // Top 3 growths
          for (const compliance of compliances.slice(0, 2)) { // Top 2 compliance
            const scoreMult = getScoreMultiplier(score);
            const scoreAdj = (baseRate * scoreMult / 100) - (baseRate / 100);
            const tierAdj = getTierAdjustment(revenue);
            const growthMod = getGrowthModifier(growth);
            const complianceAdj = getComplianceAdjustment(compliance);
            
            const effectiveRate = calculateEffectiveRate(
              baseRate / 100,
              score,
              revenue,
              growth,
              compliance / 100,
              formulaType,
              true, true, true, true
            );
            
            const royaltyAmount = Math.round(revenue * effectiveRate);
            
            rows.push([
              score.toString(),
              revenue.toString(),
              growth.toString(),
              compliance.toString(),
              scoreMult.toFixed(2),
              (scoreAdj * 100).toFixed(3),
              (growthMod * 100).toFixed(2),
              (complianceAdj * 100).toFixed(2),
              (tierAdj * 100).toFixed(2),
              (effectiveRate * 100).toFixed(2),
              royaltyAmount.toString()
            ]);
          }
        }
      }
    }
    
    rows.push([]);
    rows.push([]);
    
    // Summary section
    rows.push(['=== SUMMARY BY SCORE TIER ===']);
    rows.push(['Score Range', 'Avg Rate', 'Description']);
    rows.push(['90-100', '~4.2%', 'Excellent performers']);
    rows.push(['80-89', '~5.1%', 'Good performers']);
    rows.push(['70-79', '~6.0%', 'Average performers']);
    rows.push(['60-69', '~6.9%', 'Below average']);
    rows.push(['50-59', '~7.8%', 'Struggling']);
    rows.push(['<50', '~9.0%', 'At risk']);
    
    rows.push([]);
    rows.push(['=== BONUS/MALUS ADJUSTMENTS ===']);
    rows.push(['Factor', 'Condition', 'Adjustment']);
    rows.push(['YoY Growth', '≥30%', '-2.0%']);
    rows.push(['YoY Growth', '≥20%', '-1.0%']);
    rows.push(['YoY Growth', '≥10%', '-0.5%']);
    rows.push(['Compliance', '≥98%', '-1.0%']);
    rows.push(['Compliance', '≥95%', '-0.5%']);
    rows.push(['Revenue', '>SGD 60k', '-0.5%']);
    rows.push(['Revenue', '>SGD 40k', '-0.3%']);
    rows.push(['Revenue', '<SGD 20k', '+0.3%']);
    
    rows.push([]);
    rows.push(['Generated:', new Date().toISOString()]);
    rows.push(['Formula Type:', formulaType]);
    rows.push(['Base Rate:', `${baseRate}%`]);
    
    return rows;
  }

  function downloadCSV() {
    setExporting(true);
    
    const rows = generateCSV();
    const csvContent = rows.map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `royalty_formula_simulation_${formulaType.toLowerCase()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    setTimeout(() => setExporting(false), 1000);
  }

  return (
    <div className="bg-white rounded-xl border p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <FileSpreadsheet className="w-5 h-5 text-green-600" />
        Excel/CSV Simulation Export
      </h3>
      
      <p className="text-sm text-gray-600 mb-4">
        Download formula simulation to test different scenarios in Excel
      </p>
      
      {/* Formula Type */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Formula Type
        </label>
        <select
          value={formulaType}
          onChange={(e) => setFormulaType(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        >
          {formulaTypes.map(ft => (
            <option key={ft.id} value={ft.id}>
              {ft.name} - {ft.desc}
            </option>
          ))}
        </select>
      </div>
      
      {/* Base Rate */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Base Rate (%)
        </label>
        <input
          type="number"
          value={baseRate}
          onChange={(e) => setBaseRate(Number(e.target.value))}
          min="1"
          max="15"
          step="0.5"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        />
      </div>
      
      {/* Preview */}
      <div className="bg-gray-50 rounded-lg p-4 mb-4 text-sm">
        <p className="font-medium mb-2">Preview - Sample Calculations:</p>
        <div className="space-y-1 text-gray-600">
          <p>• Score 95, Growth 25%, Compliance 97%, Revenue 85k → {(calculateEffectiveRate(baseRate/100, 95, 85000, 25, 0.97, formulaType, true, true, true, true) * 100).toFixed(2)}%</p>
          <p>• Score 70, Growth 5%, Compliance 90%, Revenue 30k → {(calculateEffectiveRate(baseRate/100, 70, 30000, 5, 0.90, formulaType, true, true, true, true) * 100).toFixed(2)}%</p>
          <p>• Score 45, Growth -10%, Compliance 85%, Revenue 15k → {(calculateEffectiveRate(baseRate/100, 45, 15000, -10, 0.85, formulaType, true, true, true, true) * 100).toFixed(2)}%</p>
        </div>
      </div>
      
      {/* Download Button */}
      <button
        onClick={downloadCSV}
        disabled={exporting}
        className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
      >
        {exporting ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
            Generating...
          </>
        ) : (
          <>
            <Download className="w-5 h-5" />
            Download CSV Simulation
          </>
        )}
      </button>
      
      <p className="text-xs text-gray-500 mt-2 text-center">
        Opens in Excel / Google Sheets
      </p>
    </div>
  );
}
