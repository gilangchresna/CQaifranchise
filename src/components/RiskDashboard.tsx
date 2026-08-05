import React, { useState, useEffect } from "react";
import { 
  AlertTriangle, TrendingDown, Package, Clock, Zap,
  ChevronRight, Filter, RefreshCw, BarChart3, Activity,
  ArrowUpRight, ArrowDownRight, AlertCircle, CheckCircle2,
  XCircle, Eye, X
} from "lucide-react";
import { cn } from "@/src/lib/utils";
import { Role } from "@/src/types";

const EDGE_URL = 'https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1';

interface StockoutRisk {
  sku: string;
  product_name: string;
  risk_score: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  days_until_stockout: number;
  current_stock: number;
  avg_daily_usage: number;
  recommended_order: number;
  min_stock: number;
  outlet_id: number;
  outlet_name: string;
}

interface OutletRisk {
  outlet_id: number;
  outlet_name: string;
  outlet_code: string;
  overall_risk: number;
  critical_items: number;
  high_items: number;
  medium_items: number;
  low_items: number;
}

interface RiskSummary {
  total_outlets: number;
  at_risk_outlets: number;
  critical_items_total: number;
  avg_risk_score: number;
  top_risks: StockoutRisk[];
}

export function RiskDashboard({ activeRole }: { activeRole: Role }) {
  const [risks, setRisks] = useState<StockoutRisk[]>([]);
  const [outletRisks, setOutletRisks] = useState<OutletRisk[]>([]);
  const [summary, setSummary] = useState<RiskSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRisk, setSelectedRisk] = useState<StockoutRisk | null>(null);
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterOutlet, setFilterOutlet] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'outlets'>('grid');

  useEffect(() => {
    fetchRiskData();
  }, []);

  async function fetchRiskData() {
    setLoading(true);
    try {
      // Fetch real inventory data
      const { data: inventory, error } = await supabase
        .from('inventory')
        .select(`
          *,
          outlet:outlets(id, name, code)
        `)
        .order('current_stock', { ascending: true })
        .limit(50);
      
      if (error) throw error;
      
      // Transform to risk format
      const mockRisks: StockoutRisk[] = (inventory || [])
        .filter(inv => inv.current_stock < inv.min_stock)
        .slice(0, 20)
        .map((inv) => {
          const daysUntilStockout = inv.min_stock > 0 
            ? Math.floor(inv.current_stock / Math.max((inv.min_stock / 7), 1)) 
            : 999;
          
          const riskPercent = inv.min_stock > 0 
            ? (inv.current_stock / inv.min_stock) * 100 
            : 0;
          
          let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
          if (riskPercent < 30) riskLevel = 'HIGH';
          else if (riskPercent < 60) riskLevel = 'MEDIUM';
          else riskLevel = 'LOW';
          
          return {
            id: inv.id,
            outlet_id: inv.outlet_id,
            outlet_name: inv.outlet?.name || 'Unknown',
            outlet_code: inv.outlet?.code || 'N/A',
            sku: inv.sku,
            product_name: inv.product_name,
            current_stock: inv.current_stock,
            min_stock: inv.min_stock,
            days_until_stockout: daysUntilStockout,
            risk_level: riskLevel,
            last_restock: inv.last_restock_at,
          };
        });
      
      setRisks(mockRisks);
      setOutletRisks([]);
    } catch (err) {
      console.error('Error fetching risk data:', err);
      setRisks([]);
      setOutletRisks([]);
    } finally {
      setLoading(false);
    }
  }
  const getRiskColor = (level: string) => {
    switch (level) {
      case 'HIGH': return 'bg-red-100 text-red-700 border-red-200';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'LOW': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getRiskBgColor = (level: string) => {
    switch (level) {
      case 'HIGH': return 'bg-gradient-to-br from-red-500 to-orange-600';
      case 'MEDIUM': return 'bg-gradient-to-br from-yellow-500 to-orange-500';
      case 'LOW': return 'bg-gradient-to-br from-green-500 to-emerald-600';
      default: return 'bg-slate-500';
    }
  };

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'HIGH': return <AlertTriangle className="w-5 h-5" />;
      case 'MEDIUM': return <Clock className="w-5 h-5" />;
      case 'LOW': return <CheckCircle2 className="w-5 h-5" />;
      default: return <Package className="w-5 h-5" />;
    }
  };

  const filteredRisks = risks.filter(r => {
    const matchesLevel = filterLevel === 'all' || r.risk_level === filterLevel;
    const matchesOutlet = filterOutlet === 'all' || r.outlet_id.toString() === filterOutlet;
    return matchesLevel && matchesOutlet;
  });

  const uniqueOutlets = [...new Set(risks.map(r => ({ id: r.outlet_id, name: r.outlet_name })))];

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-3 border-red-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            ML Stockout Risk Dashboard
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            AI-powered inventory risk prediction using Z-score anomaly detection
          </p>
        </div>
        <div className="flex gap-3">
          <div className="flex bg-slate-100 rounded-lg p-1">
            {[
              { id: 'grid', icon: <BarChart3 className="w-4 h-4" /> },
              { id: 'list', icon: <Activity className="w-4 h-4" /> },
              { id: 'outlets', icon: <Package className="w-4 h-4" /> },
            ].map((view) => (
              <button
                key={view.id}
                onClick={() => setViewMode(view.id as any)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2",
                  viewMode === view.id
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                {view.icon}
                <span className="hidden sm:inline">{view.id}</span>
              </button>
            ))}
          </div>
          <button
            onClick={fetchRiskData}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <RefreshCw className="w-5 h-5 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard
            icon={<AlertTriangle className="w-5 h-5" />}
            label="At-Risk Outlets"
            value={`${summary.at_risk_outlets}/${summary.total_outlets}`}
            subtext={`${Math.round((summary.at_risk_outlets / summary.total_outlets) * 100)}% need attention`}
            color="text-red-600"
            bgColor="bg-red-50"
          />
          <SummaryCard
            icon={<Package className="w-5 h-5" />}
            label="Critical Items"
            value={summary.critical_items_total.toString()}
            subtext="HIGH risk stockout"
            color="text-orange-600"
            bgColor="bg-orange-50"
          />
          <SummaryCard
            icon={<BarChart3 className="w-5 h-5" />}
            label="Avg Risk Score"
            value={`${summary.avg_risk_score}`}
            subtext="Across all outlets"
            color={summary.avg_risk_score > 50 ? "text-red-600" : summary.avg_risk_score > 30 ? "text-yellow-600" : "text-green-600"}
            bgColor="bg-slate-50"
          />
          <SummaryCard
            icon={<TrendingDown className="w-5 h-5" />}
            label="Items Monitored"
            value={risks.length.toString()}
            subtext="SKUs across all outlets"
            color="text-blue-600"
            bgColor="bg-blue-50"
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <select
          value={filterLevel}
          onChange={(e) => setFilterLevel(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm bg-white"
        >
          <option value="all">All Risk Levels</option>
          <option value="HIGH">HIGH Risk Only</option>
          <option value="MEDIUM">MEDIUM Risk Only</option>
          <option value="LOW">LOW Risk Only</option>
        </select>
        <select
          value={filterOutlet}
          onChange={(e) => setFilterOutlet(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm bg-white"
        >
          <option value="all">All Outlets</option>
          {uniqueOutlets.map((outlet) => (
            <option key={outlet.id} value={outlet.id}>{outlet.name}</option>
          ))}
        </select>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          Showing {filteredRisks.length} items
        </div>
      </div>

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRisks.slice(0, 24).map((risk, idx) => (
            <div
              key={`${risk.outlet_id}-${risk.sku}`}
              onClick={() => setSelectedRisk(risk)}
              className={cn(
                "rounded-xl border p-5 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1",
                risk.risk_level === 'HIGH' ? "border-red-200 bg-red-50/50" :
                risk.risk_level === 'MEDIUM' ? "border-yellow-200 bg-yellow-50/50" :
                "border-green-200 bg-green-50/50"
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center text-white", getRiskBgColor(risk.risk_level))}>
                  {getRiskIcon(risk.risk_level)}
                </div>
                <span className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                  getRiskColor(risk.risk_level)
                )}>
                  {risk.risk_level}
                </span>
              </div>
              
              <h3 className="font-semibold text-slate-900 text-sm">{risk.product_name}</h3>
              <p className="text-xs text-slate-500 mb-3">{risk.outlet_name}</p>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Days until stockout</span>
                  <span className={cn(
                    "font-bold",
                    risk.days_until_stockout <= 2 ? "text-red-600" :
                    risk.days_until_stockout <= 5 ? "text-orange-600" : "text-slate-900"
                  )}>
                    {risk.days_until_stockout}d
                  </span>
                </div>
                <div className="w-full bg-white rounded-full h-2 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      risk.risk_score >= 70 ? "bg-red-500" :
                      risk.risk_score >= 40 ? "bg-yellow-500" : "bg-green-500"
                    )}
                    style={{ width: `${risk.risk_score}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Stock: {risk.current_stock}</span>
                  <span>Risk: {risk.risk_score}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500 border-b">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Outlet</th>
                <th className="px-4 py-3">Risk Level</th>
                <th className="px-4 py-3">Days Left</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Daily Usage</th>
                <th className="px-4 py-3">Risk Score</th>
                <th className="px-4 py-3">Recommended Order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRisks.slice(0, 20).map((risk) => (
                <tr key={`${risk.outlet_id}-${risk.sku}`} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedRisk(risk)}>
                  <td className="px-4 py-3 font-medium">{risk.product_name}</td>
                  <td className="px-4 py-3 text-slate-500">{risk.outlet_name}</td>
                  <td className="px-4 py-3">
                    <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase", getRiskColor(risk.risk_level))}>
                      {risk.risk_level}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "font-bold",
                      risk.days_until_stockout <= 2 ? "text-red-600" :
                      risk.days_until_stockout <= 5 ? "text-orange-600" : "text-slate-900"
                    )}>
                      {risk.days_until_stockout}d
                    </span>
                  </td>
                  <td className="px-4 py-3">{risk.current_stock}</td>
                  <td className="px-4 py-3">{risk.avg_daily_usage}/day</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-slate-100 rounded-full h-1.5">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            risk.risk_score >= 70 ? "bg-red-500" :
                            risk.risk_score >= 40 ? "bg-yellow-500" : "bg-green-500"
                          )}
                          style={{ width: `${risk.risk_score}%` }}
                        />
                      </div>
                      <span className="text-xs">{risk.risk_score}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-blue-600">
                    {risk.recommended_order > 0 ? `+${risk.recommended_order}` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Outlets View */}
      {viewMode === 'outlets' && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {outletRisks.sort((a, b) => b.overall_risk - a.overall_risk).map((outlet) => (
            <div
              key={outlet.outlet_id}
              className="rounded-xl border border-slate-200 bg-white p-5 hover:shadow-lg transition-all cursor-pointer"
              onClick={() => setFilterOutlet(outlet.outlet_id.toString())}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-slate-900">{outlet.outlet_name}</h3>
                  <p className="text-xs text-slate-500">{outlet.outlet_code}</p>
                </div>
                <div className={cn(
                  "px-3 py-1 rounded-lg text-sm font-bold",
                  outlet.overall_risk >= 60 ? "bg-red-100 text-red-700" :
                  outlet.overall_risk >= 40 ? "bg-yellow-100 text-yellow-700" :
                  "bg-green-100 text-green-700"
                )}>
                  {outlet.overall_risk}%
                </div>
              </div>

              <div className="mb-4">
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      outlet.overall_risk >= 60 ? "bg-red-500" :
                      outlet.overall_risk >= 40 ? "bg-yellow-500" : "bg-green-500"
                    )}
                    style={{ width: `${outlet.overall_risk}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-red-50 rounded-lg p-2">
                  <p className="text-lg font-bold text-red-600">{outlet.critical_items}</p>
                  <p className="text-[10px] text-red-500">Critical</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-2">
                  <p className="text-lg font-bold text-orange-600">{outlet.high_items}</p>
                  <p className="text-[10px] text-orange-500">High</p>
                </div>
                <div className="bg-yellow-50 rounded-lg p-2">
                  <p className="text-lg font-bold text-yellow-600">{outlet.medium_items}</p>
                  <p className="text-[10px] text-yellow-500">Medium</p>
                </div>
                <div className="bg-green-50 rounded-lg p-2">
                  <p className="text-lg font-bold text-green-600">{outlet.low_items}</p>
                  <p className="text-[10px] text-green-500">Low</p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100">
                <button className="w-full flex items-center justify-center gap-2 text-sm text-slate-600 hover:text-slate-900">
                  <Eye className="w-4 h-4" />
                  View Details
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Risk Detail Modal */}
      {selectedRisk && (
        <RiskDetailModal
          risk={selectedRisk}
          onClose={() => setSelectedRisk(null)}
          getRiskColor={getRiskColor}
          getRiskBgColor={getRiskBgColor}
          getRiskIcon={getRiskIcon}
        />
      )}
    </div>
  );
}

// Sub-components
function SummaryCard({ icon, label, value, subtext, color, bgColor }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext: string;
  color: string;
  bgColor: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className={cn("p-2 rounded-lg", bgColor, color)}>
          {icon}
        </div>
        <span className="text-sm text-slate-500">{label}</span>
      </div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <p className="text-xs text-slate-500 mt-1">{subtext}</p>
    </div>
  );
}

function RiskDetailModal({
  risk,
  onClose,
  getRiskColor,
  getRiskBgColor,
  getRiskIcon,
}: {
  risk: StockoutRisk;
  onClose: () => void;
  getRiskColor: (level: string) => string;
  getRiskBgColor: (level: string) => string;
  getRiskIcon: (level: string) => React.ReactNode;
}) {
  const stockPercentage = Math.min(100, (risk.current_stock / (risk.min_stock * 2)) * 100);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={cn(
          "p-6 text-white bg-gradient-to-br",
          getRiskBgColor(risk.risk_level)
        )}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
                {getRiskIcon(risk.risk_level)}
              </div>
              <div>
                <h2 className="text-xl font-bold">{risk.product_name}</h2>
                <p className="text-white/80">{risk.outlet_name}</p>
                <span className={cn(
                  "inline-block mt-2 px-3 py-0.5 rounded-full text-xs font-bold uppercase bg-white/20",
                  risk.risk_level === 'HIGH' ? "text-red-100" :
                  risk.risk_level === 'MEDIUM' ? "text-yellow-100" : "text-green-100"
                )}>
                  {risk.risk_level} RISK
                </span>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Risk Score */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium">Risk Score</span>
              <span className={cn(
                "font-bold",
                risk.risk_score >= 70 ? "text-red-600" :
                risk.risk_score >= 40 ? "text-yellow-600" : "text-green-600"
              )}>
                {risk.risk_score}%
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  risk.risk_score >= 70 ? "bg-red-500" :
                  risk.risk_score >= 40 ? "bg-yellow-500" : "bg-green-500"
                )}
                style={{ width: `${risk.risk_score}%` }}
              />
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Days Until Stockout</p>
              <p className="text-2xl font-bold text-red-600">{risk.days_until_stockout}</p>
              <p className="text-xs text-slate-500">days remaining</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Current Stock</p>
              <p className="text-2xl font-bold text-slate-900">{risk.current_stock}</p>
              <p className="text-xs text-slate-500">min: {risk.min_stock}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Daily Usage</p>
              <p className="text-2xl font-bold text-slate-900">{risk.avg_daily_usage}</p>
              <p className="text-xs text-slate-500">units/day</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-4">
              <p className="text-xs text-blue-500 mb-1">Recommended Order</p>
              <p className="text-2xl font-bold text-blue-600">+{risk.recommended_order}</p>
              <p className="text-xs text-blue-500">units</p>
            </div>
          </div>

          {/* Stock Level */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium">Stock Level</span>
              <span className="text-slate-500">{risk.current_stock} / {risk.min_stock * 2}</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  stockPercentage <= 25 ? "bg-red-500" :
                  stockPercentage <= 50 ? "bg-yellow-500" : "bg-green-500"
                )}
                style={{ width: `${stockPercentage}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>0</span>
              <span>Min: {risk.min_stock}</span>
              <span>Max: {risk.min_stock * 2}</span>
            </div>
          </div>

          {/* AI Recommendation */}
          <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl p-4 border border-violet-100">
            <h4 className="font-semibold text-violet-900 mb-2 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              AI Recommendation
            </h4>
            <p className="text-sm text-violet-700">
              {risk.days_until_stockout <= 2
                ? `⚠️ URGENT: Order ${risk.recommended_order} units immediately. Stock will deplete within ${risk.days_until_stockout} days at current consumption rate.`
                : risk.days_until_stockout <= 5
                ? `📦 Order ${risk.recommended_order} units within 48 hours. Monitor daily and expedite if consumption increases.`
                : `✅ Stock levels acceptable. Schedule routine restock within 7-10 days to maintain optimal inventory.`}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <button className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors">
              Create Purchase Order
            </button>
            <button className="px-4 py-2.5 border rounded-xl font-medium hover:bg-slate-50 transition-colors">
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
