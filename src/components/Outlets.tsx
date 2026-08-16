import React, { useState, useEffect, useRef } from "react";
import { Store, TrendingUp, TrendingDown, AlertTriangle, Bot, ArrowLeft, Sparkles, MessageSquare, Package, RefreshCw, BarChart3, Clock, ShoppingCart, X, ChevronRight } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { Role } from "@/src/types";
import { supabase, EDGE_FUNCTIONS_URL } from "@/src/lib/supabase";

// Format SGD (Singapore Dollar)
const formatSGD = (num: number) => {
  return 'S$ ' + num.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

// Animated counter hook
function useAnimatedNumber(target: number, duration = 500) {
  const [value, setValue] = useState(target);
  const prevTarget = useRef(target);
  
  useEffect(() => {
    const start = prevTarget.current;
    const diff = target - start;
    const startTime = performance.now();
    
    if (diff === 0) return;
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      setValue(Math.round(start + diff * easeOut));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
    prevTarget.current = target;
  }, [target, duration]);
  
  return value;
}

interface Outlet {
  id: number;
  name: string;
  code: string;
  status: string;
  region?: { id: number; name: string; code: string };
  sales?: number;
  sales_trend?: number;
  stockout_risk?: number;
  transaction_count?: number;
  low_stock_items?: number;
  total_products?: number;
}

interface LowStockItem {
  sku: string;
  product_name: string;
  current_stock: number;
  min_stock: number;
  max_stock: number;
  risk_level: string;
}

interface RecentTransaction {
  transaction_id: string;
  amount: number;
  item_count: number;
  created_at: string;
  items?: { sku: string; name: string; quantity: number; subtotal: number; unit_price: number }[];
}

interface OutletDetail {
  name: string;
  code: string;
  sales: number;
  transaction_count: number;
  avg_transaction: number;
  stock_risk_percent: number;
  low_stock_items: LowStockItem[];
  total_products: number;
  recent_transactions: RecentTransaction[];
  hourly_sales: Record<string, number>;
  comparison: {
    yesterday: number;
    yesterday_change: number;
    last_week: number;
    last_week_change: number;
  };
}

interface Alert {
  id: number;
  type: string;
  severity: string;
  status: string;
  title: string;
  description: string;
  outlet?: { name: string; code: string };
}

// Outlet Card Component
function OutletCard({ outlet, onClick, index }: { outlet: Outlet; onClick: () => void; index: number }) {
  const [isNew, setIsNew] = useState(false);
  const prevSales = useRef(outlet.sales || 0);
  const animatedSales = useAnimatedNumber(outlet.sales || 0);
  
  useEffect(() => {
    if ((outlet.sales || 0) > prevSales.current) {
      setIsNew(true);
      setTimeout(() => setIsNew(false), 2000);
    }
    prevSales.current = outlet.sales || 0;
  }, [outlet.sales]);

  const stockRisk = outlet.stockout_risk || 0;
  
  const getRiskStyle = () => {
    if (stockRisk > 80) return { bg: "bg-gradient-to-br from-red-50 to-orange-50", border: "border-red-200", badge: "bg-red-100 text-red-700" };
    if (stockRisk > 50) return { bg: "bg-gradient-to-br from-orange-50 to-yellow-50", border: "border-orange-200", badge: "bg-orange-100 text-orange-700" };
    return { bg: "bg-gradient-to-br from-slate-50 to-white", border: "border-slate-200", badge: "bg-green-100 text-green-700" };
  };
  
  const riskStyle = getRiskStyle();

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-2xl border p-5 cursor-pointer transition-all duration-300",
        "hover:shadow-lg hover:-translate-y-1 hover:scale-[1.02]",
        riskStyle.bg,
        riskStyle.border,
        isNew && "ring-2 ring-green-400 ring-opacity-50"
      )}
      style={{ animationDelay: `${index * 50}ms`, animation: 'fadeSlideIn 0.5s ease-out forwards', opacity: 0 }}
    >
      {isNew && (
        <div className="absolute top-3 right-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
        </div>
      )}

      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm border border-slate-100">
            <Store className="h-6 w-6 text-slate-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-sm leading-tight">{outlet.name}</h3>
            <p className="text-xs text-slate-500">{outlet.code}</p>
          </div>
        </div>
        <span className="px-2 py-1 bg-white/80 rounded-lg text-[10px] font-medium text-slate-600 border border-slate-100">
          {outlet.region?.code || 'N/A'}
        </span>
      </div>

      <div className="space-y-3">
        <div className="bg-white/80 backdrop-blur rounded-xl p-3 border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium mb-0.5">Revenue Today</p>
              <p className={cn("text-lg font-bold transition-all duration-300", isNew ? "text-green-600" : "text-slate-900")}>
                {formatSGD(animatedSales)}
              </p>
            </div>
            <div className={cn("flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium", (outlet.sales_trend || 0) >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
              {(outlet.sales_trend || 0) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(outlet.sales_trend || 0) === 0 && outlet.sales === 0 ? '-' : Math.abs(outlet.sales_trend || 0) + '%'}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="flex-1 bg-white/80 backdrop-blur rounded-xl p-3 border border-slate-100">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium mb-1">Stock Risk</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all duration-500", stockRisk > 80 ? "bg-red-500" : stockRisk > 50 ? "bg-orange-500" : "bg-green-500")} style={{ width: `${stockRisk}%` }} />
              </div>
              <span className={cn("text-sm font-bold", stockRisk > 80 ? "text-red-600" : stockRisk > 50 ? "text-orange-600" : "text-slate-700")}>{stockRisk}%</span>
            </div>
          </div>
          <div className="w-20 bg-white/80 backdrop-blur rounded-xl p-3 border border-slate-100 text-center">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium mb-0.5">Txns</p>
            <p className="text-lg font-bold text-slate-900">{outlet.transaction_count || 0}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100/50">
        <div className="flex items-center justify-between">
          <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider", outlet.status === 'ACTIVE' ? "bg-green-100 text-green-700" : outlet.status === 'PILOT' ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600")}>
            {outlet.status}
          </span>
          {stockRisk > 50 && (
            <span className="flex items-center gap-1 text-[10px] text-orange-600 font-medium">
              <Bot className="w-3 h-3" /> AI Monitoring
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function Outlets({ activeRole }: { activeRole: Role }) {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOutletId, setSelectedOutletId] = useState<number | null>(null);
  const [outletDetail, setOutletDetail] = useState<OutletDetail | null>(null);
  const [isAskingAI, setIsAskingAI] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('7d');
  const [totalSales, setTotalSales] = useState(0);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [periodLabel, setPeriodLabel] = useState('Last 7 Days');
  const [selectedTransaction, setSelectedTransaction] = useState<RecentTransaction | null>(null);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 5000);
    return () => clearInterval(interval);
  }, [activeRole, selectedOutletId]);

  async function fetchData(silent = false) {
    if (!silent) setLoading(true);
    setIsRefreshing(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const dashboardRes = await fetch(`${EDGE_FUNCTIONS_URL}/dashboard-api`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${session?.access_token || ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          period: selectedPeriod,
          ...(selectedOutletId && { outlet_id: selectedOutletId })
        }),
      });
      
      const dashboardData = await dashboardRes.json();
      
      if (dashboardData.totals) {
        setTotalSales(dashboardData.totals.total_revenue);
        setTotalTransactions(dashboardData.totals.total_transactions);
      }
      if (dashboardData.period_label) {
        setPeriodLabel(dashboardData.period_label);
      }
      
      const transformedOutlets: Outlet[] = (dashboardData.outlets || []).map((o: any) => ({
        id: o.id,
        name: o.name,
        code: o.code,
        status: o.status,
        region: o.region,
        sales: o.sales || 0,
        sales_trend: o.sales_trend || 0,
        stockout_risk: o.stock_risk_percent || 0,
        transaction_count: o.transaction_count || 0,
        low_stock_items: o.low_stock_items || 0,
        total_products: o.total_products || 0,
      }));
      
      setOutlets(transformedOutlets);
      
      if (selectedOutletId && dashboardData.outlet_detail) {
        setOutletDetail(dashboardData.outlet_detail);
      }
      
      // Fetch alerts separately
      const alertsRes = await fetch(`${EDGE_FUNCTIONS_URL}/alerts-list`, {
        headers: { 'Authorization': `Bearer ${session?.access_token || ''}` },
      });
      const alertsData = await alertsRes.json();
      const alertsList = alertsData?.data || [];
      const transformedAlerts: Alert[] = alertsList.slice(0, 10).map((a: any) => ({
        id: a.id,
        outlet_id: a.outlet_id,
        outlet_name: a.outlet_name || `Outlet ${a.outlet_id}`,
        alert_type: a.alert_type || a.type,
        message: a.message || a.description,
        severity: a.severity || 'medium',
        created_at: a.created_at,
        is_read: a.is_read,
      }));
      setAlerts(transformedAlerts);
      
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching outlets:', err);
    } finally {
      if (!silent) setLoading(false);
      setIsRefreshing(false);
    }
  }

  const selectedOutlet = outlets.find(o => o.id === selectedOutletId);
  const animatedTotalSales = useAnimatedNumber(totalSales, 800);
  const animatedTotalTxns = useAnimatedNumber(totalTransactions, 400);

  // Outlet Detail View
  if (selectedOutletId && selectedOutlet) {
    if (!outletDetail) {
      return (
        <div className="space-y-6 max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <button onClick={() => { setSelectedOutletId(null); setAiExplanation(null); setOutletDetail(null); }} className="p-2 rounded-xl hover:bg-slate-100">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold">{selectedOutlet.name}</h2>
          </div>
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        </div>
      );
    }
    
    const stockRisk = outletDetail.stock_risk_percent || 0;
    const lowStockCount = Array.isArray(outletDetail.low_stock_items) ? outletDetail.low_stock_items.length : 0;
    const recentTxns = Array.isArray(outletDetail.recent_transactions) ? outletDetail.recent_transactions : [];
    const hourlyData = outletDetail.hourly_sales || {};
    
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Back Button */}
        <div className="flex items-center gap-4">
          <button onClick={() => { setSelectedOutletId(null); setAiExplanation(null); setOutletDetail(null); }} className="p-2 rounded-xl hover:bg-slate-100">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2"><Store className="w-5 h-5" /> {selectedOutlet.name}</h2>
            <p className="text-sm text-slate-500">{selectedOutlet.code} • {selectedOutlet.region?.name || 'Unknown Region'}</p>
          </div>
          <span className={cn("ml-auto px-3 py-1 rounded-full text-xs font-medium uppercase", selectedOutlet.status === 'ACTIVE' ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700")}>
            {selectedOutlet.status}
          </span>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-5 text-white">
            <p className="text-xs opacity-80">Today's Revenue</p>
            <p className="text-2xl font-bold">{formatSGD(outletDetail.sales || 0)}</p>
            <p className="text-xs opacity-70 mt-1">{outletDetail.transaction_count || 0} transactions</p>
          </div>
          <div className="bg-white border rounded-2xl p-5">
            <p className="text-xs text-slate-500">Avg/Transaction</p>
            <p className="text-2xl font-bold">{formatSGD(outletDetail.avg_transaction || 0)}</p>
          </div>
          <div className={cn("rounded-2xl p-5", stockRisk > 70 ? "bg-gradient-to-br from-red-500 to-orange-500 text-white" : "bg-white border")}>
            <p className={cn("text-xs", stockRisk > 70 ? "opacity-80" : "text-slate-500")}>Stock Risk</p>
            <p className="text-2xl font-bold">{stockRisk}%</p>
          </div>
          <div className="bg-white border rounded-2xl p-5">
            <p className="text-xs text-slate-500">Low Stock</p>
            <p className="text-2xl font-bold text-amber-600">{lowStockCount}</p>
            <p className="text-xs text-slate-400">of {outletDetail.total_products || 0} products</p>
          </div>
        </div>

        {/* Comparison Row */}
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-white border rounded-2xl p-5">
            <div className="flex justify-between mb-2">
              <span className="text-xs text-slate-500">vs Yesterday</span>
              <span className="text-xs text-green-600">+{outletDetail.comparison?.yesterday_change || 0}%</span>
            </div>
            <p className="text-xl font-bold">{formatSGD(outletDetail.comparison?.yesterday || 0)}</p>
          </div>
          <div className="bg-white border rounded-2xl p-5">
            <div className="flex justify-between mb-2">
              <span className="text-xs text-slate-500">vs Last Week</span>
              <span className="text-xs text-green-600">+{outletDetail.comparison?.last_week_change || 0}%</span>
            </div>
            <p className="text-xl font-bold">{formatSGD(outletDetail.comparison?.last_week || 0)}</p>
          </div>
          <div className="bg-white border rounded-2xl p-5">
            <span className="text-xs text-slate-500">Active Alerts</span>
            <p className="text-xl font-bold">{alerts.filter(a => a.status !== 'RESOLVED').length}</p>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Recent Transactions */}
          <div className="bg-white border rounded-2xl p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Clock className="w-5 h-5 text-blue-500" /> Recent Transactions</h3>
            {recentTxns.length > 0 ? (
              <div className="space-y-3">
                {recentTxns.map((txn) => (
                  <div key={String(txn.transaction_id)} onClick={() => setSelectedTransaction(txn)} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-blue-50 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <ShoppingCart className="w-5 h-5 text-slate-500" />
                      <div>
                        <p className="font-medium">{formatSGD(txn.amount)}</p>
                        <p className="text-xs text-slate-500">{txn.item_count} items</p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-400">{new Date(txn.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-slate-400 py-8">No transactions yet today</p>
            )}
          </div>

          {/* Low Stock Alerts */}
          <div className="bg-white border rounded-2xl p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-500" /> Low Stock Alerts</h3>
            {lowStockCount > 0 ? (
              <div className="space-y-3">
                {outletDetail.low_stock_items.map((item) => (
                  <div key={String(item.sku)} className={cn("p-3 rounded-xl", item.risk_level === 'critical' ? "bg-red-50 border border-red-200" : "bg-amber-50 border border-amber-200")}>
                    <p className="font-medium">{item.product_name}</p>
                    <p className="text-xs text-slate-500">Min: {item.min_stock} | Current: {item.current_stock}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Package className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-slate-600">All products adequately stocked</p>
              </div>
            )}
          </div>
        </div>

        {/* Hourly Chart */}
        <div className="bg-white border rounded-2xl p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-indigo-500" /> Hourly Sales Trend</h3>
          {Object.keys(hourlyData).length > 0 ? (
            <div className="h-40 flex items-end gap-2">
              {['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'].map((hour) => {
                const value = hourlyData[hour] || 0;
                const values = Object.values(hourlyData) as number[];
                const max = Math.max(...values, 1);
                const height = max > 0 ? (value / max) * 100 : 0;
                return (
                  <div key={hour} className="flex-1 flex flex-col items-center">
                    <div className="w-full h-32 flex items-end justify-center">
                      {value > 0 && <div className="w-full bg-indigo-500 rounded-t" style={{ height: `${height}%` }} />}
                    </div>
                    <span className="text-xs text-slate-400 mt-2">{hour.split(':')[0]}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-slate-400 py-8">No hourly data available</p>
          )}
        </div>

        {/* Transaction Detail Modal */}
        {selectedTransaction && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedTransaction(null)}>
            <div className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold">Transaction Detail</h3>
                  <p className="text-xs text-slate-500">{selectedTransaction.transaction_id}</p>
                </div>
                <button onClick={() => setSelectedTransaction(null)} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6">
                <div className="flex justify-between items-center mb-4 p-4 bg-slate-50 rounded-xl">
                  <div>
                    <p className="text-xs text-slate-500">Total Amount</p>
                    <p className="text-2xl font-bold text-green-600">{formatSGD(selectedTransaction.amount || 0)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Time</p>
                    <p className="text-sm">{new Date(selectedTransaction.created_at).toLocaleString('id-ID')}</p>
                  </div>
                </div>
                <h4 className="text-sm font-semibold mb-3">Items ({selectedTransaction.item_count || 0})</h4>
                {selectedTransaction.items?.length ? (
                  <div className="space-y-2">
                    {selectedTransaction.items.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between py-2 border-b">
                        <div>
                          <p className="text-sm">{item.name || 'Unknown'}</p>
                          <p className="text-xs text-slate-500">x{item.quantity || 0} × {formatSGD(item.unit_price || 0)}</p>
                        </div>
                        <p className="font-semibold">{formatSGD(item.subtotal || 0)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400">No item details</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* AI Panel */}
        <div className="rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 p-6 text-white">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2"><Sparkles className="w-5 h-5" /> Athena AI Insights</h3>
            {aiExplanation && <span className="text-xs bg-white/20 px-3 py-1 rounded-full">Analyzed</span>}
          </div>
          {!aiExplanation ? (
            <div className="text-center py-8">
              <p className="text-white/80 mb-4">Ask Athena to analyze this outlet using AI.</p>
              <button 
                onClick={async () => { 
                  setIsAskingAI(true);
                  try {
                    const { data: { session } } = await supabase.auth.getSession();
                    const response = await fetch(`${EDGE_FUNCTIONS_URL}/athena-insights`, {
                      method: 'POST',
                      headers: { 
                        'Authorization': `Bearer ${session?.access_token || ''}`,
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        outlet_id: selectedOutletId,
                        outlet_name: selectedOutlet.name,
                        outlet_code: selectedOutlet.code,
                        sales: outletDetail.sales || 0,
                        transaction_count: outletDetail.transaction_count || 0,
                        avg_transaction: outletDetail.avg_transaction || 0,
                        stock_risk_percent: stockRisk,
                        low_stock_items: outletDetail.low_stock_items || [],
                        comparison: outletDetail.comparison,
                        hourly_sales: outletDetail.hourly_sales || {},
                      }),
                    });
                    const data = await response.json();
                    
                    // Format insights into readable text
                    let formattedInsights = `📊 **${selectedOutlet.name}**\n\n`;
                    formattedInsights += `**Summary:** ${data.summary || 'Analysis complete'}\n\n`;
                    
                    if (data.key_findings?.length > 0) {
                      formattedInsights += `**Key Findings:**\n`;
                      data.key_findings.forEach((finding: string) => {
                        formattedInsights += `${finding}\n`;
                      });
                      formattedInsights += `\n`;
                    }
                    
                    if (data.recommendations?.length > 0) {
                      formattedInsights += `**Recommendations:**\n`;
                      data.recommendations.forEach((rec: any) => {
                        const emoji = rec.priority === 'HIGH' ? '🔴' : rec.priority === 'MEDIUM' ? '🟡' : '🟢';
                        formattedInsights += `${emoji} [${rec.priority}] ${rec.action}\n`;
                      });
                      formattedInsights += `\n`;
                    }
                    
                    if (data.alerts?.length > 0) {
                      formattedInsights += `**Alerts:**\n`;
                      data.alerts.forEach((alert: string) => {
                        formattedInsights += `${alert}\n`;
                      });
                    }
                    
                    if (data.forecast) {
                      const trendEmoji = data.forecast.trend === 'up' ? '📈' : data.forecast.trend === 'down' ? '📉' : '➡️';
                      formattedInsights += `\n**Tomorrow's Forecast:** ${trendEmoji} ${data.forecast.tomorrow} (${data.forecast.confidence} confidence)`;
                    }
                    
                    setAiExplanation(formattedInsights);
                  } catch (err) {
                    console.error('Athena insights error:', err);
                    setAiExplanation(`Based on ${outletDetail.transaction_count || 0} transactions totaling ${formatSGD(outletDetail.sales || 0)}, stock risk is ${stockRisk}%. ${lowStockCount} items need attention.\n\n⚠️ AI analysis unavailable - showing basic summary.`);
                  }
                  setIsAskingAI(false);
                }} 
                disabled={isAskingAI} 
                className="px-6 py-3 bg-white text-indigo-600 font-semibold rounded-xl flex items-center gap-2 mx-auto hover:bg-indigo-50 transition-colors"
              >
                {isAskingAI ? <><RefreshCw className="w-4 h-4 animate-spin" /> Analyzing...</> : <><Sparkles className="w-4 h-4" /> Generate AI Analysis</>}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white/10 rounded-xl p-4">
                <div className="whitespace-pre-wrap text-sm leading-relaxed">{aiExplanation}</div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setAiExplanation(null)} className="px-4 py-2 bg-white/20 rounded-lg text-sm hover:bg-white/30 transition-colors">Analyze Again</button>
                <button className="px-4 py-2 bg-white text-indigo-600 rounded-lg text-sm flex items-center gap-2 hover:bg-indigo-50 transition-colors"><MessageSquare className="w-4 h-4" /> Create Action</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Outlet Directory View
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 text-white">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2"><Store className="w-6 h-6" /> Outlet Directory</h2>
            <p className="text-slate-400 text-sm">{outlets.length} outlets monitored</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex gap-1 bg-white/10 p-1 rounded-lg">
              {[
                { key: 'today', label: 'Today' },
                { key: '7d', label: '7D' },
                { key: '30d', label: '30D' },
                { key: 'month', label: 'Month' },
                { key: 'ytd', label: 'YTD' },
              ].map((p) => (
                <button
                  key={p.key}
                  onClick={() => setSelectedPeriod(p.key)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    selectedPeriod === p.key
                      ? 'bg-white text-slate-900'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <span className="flex items-center gap-2 text-xs text-slate-400">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span>
              {periodLabel}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-sm text-slate-400">Total Revenue</p>
            <p className="text-2xl font-bold">{formatSGD(animatedTotalSales)}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-sm text-slate-400">Transactions</p>
            <p className="text-2xl font-bold">{animatedTotalTxns}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-sm text-slate-400">Active Alerts</p>
            <p className="text-2xl font-bold">{alerts.filter(a => a.status !== 'RESOLVED').length}</p>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-3 text-right">Last updated: {lastUpdated.toLocaleTimeString('id-ID')}</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-64 bg-slate-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {outlets.map((outlet, index) => (
            <OutletCard key={outlet.id} outlet={outlet} index={index} onClick={() => setSelectedOutletId(outlet.id)} />
          ))}
        </div>
      )}

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
