"use client";
import React, { useState, useEffect, useMemo } from "react";
import { Users, AlertTriangle, TrendingUp, Building2, RefreshCw, ChevronDown, Search, Trophy, TrendingDown } from "lucide-react";
import { supabase } from "@/src/lib/supabase";

interface OutletStaffing {
  outlet_id: number;
  outlet_name: string;
  total_staff: number;
  managers: number;
  cashiers: number;
  cooks: number;
  other: number;
  revenue_7d: number;
  revenue_30d: number;
  revenue_per_staff: number;
  risk_score: number;
  anomaly_score: number;
}

interface StaffPerformance {
  staff_id: string;
  staff_name: string;
  outlet_id: number;
  outlet_name: string;
  transactions: number;
  total_sales: number;
  avg_ticket: number;
  rank: number;
}

interface RegionalStats {
  total_outlets: number;
  total_staff: number;
  avg_staff_per_outlet: number;
  total_weekly_revenue: number;
  avg_revenue_per_staff: number;
  understaffed_outlets: number;
  total_transactions: number;
  avg_ticket_size: number;
}

const STAFFING_THRESHOLD = 5; // Alert if < 5 staff

export function Workforce({ activeRole }: { activeRole: any }) {
  const [outletStaffing, setOutletStaffing] = useState<OutletStaffing[]>([]);
  const [staffPerformance, setStaffPerformance] = useState<StaffPerformance[]>([]);
  const [regionalStats, setRegionalStats] = useState<RegionalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "staff" | "revenue">("revenue");
  const [expandedOutlet, setExpandedOutlet] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"outlets" | "staff">("outlets");

  useEffect(() => {
    fetchAllData();
  }, []);

  async function fetchAllData() {
    setLoading(true);
    setError(null);
    try {
      // Fetch staffing per outlet
      const { data: staffingData, error: staffingError } = await supabase
        .from('outlets')
        .select(`
          id,
          name,
          staff:staff(
            id,
            role
          )
        `)
        .eq('region_id', 114);

      if (staffingError) throw staffingError;

      // Fetch outlet features (sales data)
      const { data: featuresData, error: featuresError } = await supabase
        .from('outlet_features')
        .select(`
          outlet_id,
          revenue_7d_avg,
          revenue_30d_avg,
          staff_productivity,
          risk_score,
          anomaly_score
        `)
        .gt('revenue_7d_avg', 0);

      if (featuresError) console.warn('Features error:', featuresError);

      // Process and combine data
      const featuresMap = new Map(
        (featuresData || []).map(f => [f.outlet_id, f])
      );

      const processedData: OutletStaffing[] = (staffingData || [])
        .map((outlet: any) => {
          const staff = outlet.staff || [];
          const features = featuresMap.get(outlet.id) || {};
          
          const managers = staff.filter((s: any) => 
            s.role?.toLowerCase().includes('manager')
          ).length;
          const cashiers = staff.filter((s: any) => 
            s.role?.toLowerCase().includes('cashier')
          ).length;
          const cooks = staff.filter((s: any) => 
            s.role?.toLowerCase().includes('cook')
          ).length;
          const other = staff.length - managers - cashiers - cooks;

          const totalStaff = staff.length;
          const revenue7d = parseFloat(features.revenue_7d_avg) || 0;
          const revenuePerStaff = totalStaff > 0 ? revenue7d / totalStaff : 0;

          return {
            outlet_id: outlet.id,
            outlet_name: outlet.name,
            total_staff: totalStaff,
            managers,
            cashiers,
            cooks,
            other,
            revenue_7d: revenue7d,
            revenue_30d: parseFloat(features.revenue_30d_avg) || 0,
            revenue_per_staff: revenuePerStaff,
            risk_score: parseFloat(features.risk_score) || 0,
            anomaly_score: parseFloat(features.anomaly_score) || 0,
          };
        })
        .filter((o: OutletStaffing) => o.total_staff > 0 || o.revenue_7d > 0)
        .sort((a: OutletStaffing, b: OutletStaffing) => b.revenue_7d - a.revenue_7d);

      setOutletStaffing(processedData);

      // Calculate regional stats
      const totalStaff = processedData.reduce((sum, o) => sum + o.total_staff, 0);
      const totalRevenue = processedData.reduce((sum, o) => sum + o.revenue_7d, 0);
      const understaffed = processedData.filter(o => o.total_staff < STAFFING_THRESHOLD).length;

      setRegionalStats({
        total_outlets: processedData.length,
        total_staff: totalStaff,
        avg_staff_per_outlet: processedData.length > 0 ? totalStaff / processedData.length : 0,
        total_weekly_revenue: totalRevenue,
        avg_revenue_per_staff: totalStaff > 0 ? totalRevenue / totalStaff : 0,
        understaffed_outlets: understaffed,
        total_transactions: 0,
        avg_ticket_size: 0,
      });

      // Fetch staff performance from POS - use simpler query
      const { data: posData, error: posError } = await supabase
        .from('sales_transactions')
        .select(`
          staff_id,
          amount,
          outlet_id
        `)
        .in('outlet_id', [164, 165, 167, 168, 169, 170, 171, 200, 201, 202])
        .order('created_at', { ascending: false })
        .limit(5000);

      if (!posError && posData) {
        // Process staff performance
        const staffMap = new Map<string, any>();
        
        // Create outlet name lookup
        const outletNameMap = new Map<number, string>();
        processedData.forEach(o => outletNameMap.set(o.outlet_id, o.outlet_name));
        
        posData.forEach((tx: any) => {
          const staffId = tx.staff_id || 'UNASSIGNED';
          if (!staffMap.has(staffId)) {
            staffMap.set(staffId, {
              staff_id: staffId,
              staff_name: staffId === 'UNASSIGNED' ? 'Unassigned' : staffId,
              outlet_id: tx.outlet_id,
              outlet_name: outletNameMap.get(tx.outlet_id) || 'Unknown',
              transactions: 0,
              total_sales: 0,
            });
          }
          const staff = staffMap.get(staffId);
          staff.transactions++;
          staff.total_sales += parseFloat(tx.amount) || 0;
        });

        // Convert to array and calculate metrics
        const staffList: StaffPerformance[] = Array.from(staffMap.values())
          .map(s => ({
            ...s,
            avg_ticket: s.transactions > 0 ? s.total_sales / s.transactions : 0,
          }))
          .sort((a, b) => b.total_sales - a.total_sales)
          .map((s, i) => ({ ...s, rank: i + 1 }));

        setStaffPerformance(staffList);

        // Update regional stats with POS data
        const totalTx = staffList.reduce((sum, s) => sum + s.transactions, 0);
        const totalSales = staffList.reduce((sum, s) => sum + s.total_sales, 0);
        
        setRegionalStats(prev => prev ? {
          ...prev,
          total_transactions: totalTx,
          avg_ticket_size: totalTx > 0 ? totalSales / totalTx : 0,
        } : null);
      }
    } catch (err: any) {
      console.error('Error fetching staffing:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Filter and sort
  const filteredOutlets = useMemo(() => {
    let filtered = outletStaffing.filter(o =>
      o.outlet_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    switch (sortBy) {
      case "name":
        filtered.sort((a, b) => a.outlet_name.localeCompare(b.outlet_name));
        break;
      case "staff":
        filtered.sort((a, b) => b.total_staff - a.total_staff);
        break;
      case "revenue":
      default:
        filtered.sort((a, b) => b.revenue_7d - a.revenue_7d);
    }

    return filtered;
  }, [outletStaffing, searchTerm, sortBy]);

  // Get understaffed outlets
  const understaffedOutlets = useMemo(() => 
    outletStaffing.filter(o => o.total_staff < STAFFING_THRESHOLD),
    [outletStaffing]
  );

  // Get top/bottom performers
  const topPerformer = useMemo(() => 
    outletStaffing.length > 0 
      ? outletStaffing.reduce((best, o) => 
          o.revenue_per_staff > best.revenue_per_staff ? o : best
        )
      : null,
    [outletStaffing]
  );

  const lowestPerformer = useMemo(() => 
    outletStaffing.length > 0 
      ? outletStaffing.reduce((worst, o) => 
          o.revenue_per_staff < worst.revenue_per_staff ? o : worst
        )
      : null,
    [outletStaffing]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-500">
        <p className="text-sm">{error}</p>
        <button onClick={fetchAllData} className="mt-2 text-sm text-blue-600 hover:underline">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Workforce Management</h1>
          <p className="text-sm text-slate-500">Real-time staffing & performance metrics</p>
        </div>
        <button
          onClick={fetchAllData}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab("outlets")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "outlets"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Building2 className="w-4 h-4 inline mr-2" />
          Outlet Staffing
        </button>
        <button
          onClick={() => setActiveTab("staff")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "staff"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Users className="w-4 h-4 inline mr-2" />
          Staff Performance
          {staffPerformance.length > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-600 rounded-full">
              {staffPerformance.length}
            </span>
          )}
        </button>
      </div>

      {/* Regional Stats Cards */}
      {regionalStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard
            icon={<Users className="w-5 h-5" />}
            label="Total Staff"
            value={regionalStats.total_staff.toString()}
            sublabel={`${regionalStats.total_outlets} outlets`}
            color="blue"
          />
          <StatCard
            icon={<Building2 className="w-5 h-5" />}
            label="Avg Staff/Outlet"
            value={regionalStats.avg_staff_per_outlet.toFixed(1)}
            sublabel="per outlet"
            color="purple"
          />
          <StatCard
            icon={<TrendingUp className="w-5 h-5" />}
            label="Weekly Revenue"
            value={`$${(regionalStats.total_weekly_revenue / 1000).toFixed(1)}K`}
            sublabel="total"
            color="green"
          />
          <StatCard
            icon={<TrendingUp className="w-5 h-5" />}
            label="Revenue/Staff"
            value={`$${regionalStats.avg_revenue_per_staff.toFixed(0)}`}
            sublabel="per week"
            color="emerald"
          />
          <StatCard
            icon={<AlertTriangle className="w-5 h-5" />}
            label="Understaffed"
            value={regionalStats.understaffed_outlets.toString()}
            sublabel="< 5 staff"
            color={regionalStats.understaffed_outlets > 0 ? "red" : "gray"}
          />
        </div>
      )}

      {/* Performance Highlights */}
      {topPerformer && lowestPerformer && topPerformer.outlet_id !== lowestPerformer.outlet_id && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-green-600">🏆</span>
              <span className="text-sm font-medium text-green-800">Top Performer</span>
            </div>
            <p className="text-lg font-semibold text-green-900">{topPerformer.outlet_name}</p>
            <p className="text-2xl font-bold text-green-700">
              ${topPerformer.revenue_per_staff.toFixed(0)}/staff
            </p>
          </div>
          <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-orange-600">📉</span>
              <span className="text-sm font-medium text-orange-800">Needs Improvement</span>
            </div>
            <p className="text-lg font-semibold text-orange-900">{lowestPerformer.outlet_name}</p>
            <p className="text-2xl font-bold text-orange-700">
              ${lowestPerformer.revenue_per_staff.toFixed(0)}/staff
            </p>
          </div>
        </div>
      )}

      {/* Understaffing Alerts */}
      {understaffedOutlets.length > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-red-800">Staffing Alerts</h3>
          </div>
          <div className="space-y-2">
            {understaffedOutlets.map(outlet => (
              <div key={outlet.outlet_id} className="flex items-center justify-between p-2 bg-white rounded-lg">
                <div>
                  <span className="font-medium text-red-900">{outlet.outlet_name}</span>
                  <span className="text-sm text-red-600 ml-2">
                    ({outlet.total_staff} staff - need {STAFFING_THRESHOLD - outlet.total_staff} more)
                  </span>
                </div>
                <button className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200">
                  Create Case
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search & Sort */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search outlets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="revenue">Sort by Revenue</option>
          <option value="staff">Sort by Staff Count</option>
          <option value="name">Sort by Name</option>
        </select>
      </div>

      {/* Outlet Staffing Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs font-semibold text-slate-500">
              <th className="px-6 py-4">Outlet</th>
              <th className="px-6 py-4 text-center">Staff Count</th>
              <th className="px-6 py-4 text-center">Role Mix</th>
              <th className="px-6 py-4 text-right">Weekly Revenue</th>
              <th className="px-6 py-4 text-right">Rev/Staff</th>
              <th className="px-6 py-4 text-center">Risk</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredOutlets.map((outlet) => (
              <React.Fragment key={outlet.outlet_id}>
                <tr className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{outlet.outlet_name}</div>
                    <div className="text-xs text-slate-500">ID: {outlet.outlet_id}</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className={`text-lg font-bold ${outlet.total_staff < STAFFING_THRESHOLD ? 'text-red-600' : 'text-slate-900'}`}>
                      {outlet.total_staff}
                    </div>
                    {outlet.total_staff < STAFFING_THRESHOLD && (
                      <div className="text-xs text-red-500">Understaffed</div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2 text-xs">
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded">
                        {outlet.managers} Mgr
                      </span>
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                        {outlet.cashiers} Cash
                      </span>
                      <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded">
                        {outlet.cooks} Cook
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="font-semibold text-slate-900">
                      ${outlet.revenue_7d.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                    <div className="text-xs text-slate-500">7-day avg</div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className={`font-bold ${outlet.revenue_per_staff > 1000 ? 'text-green-600' : outlet.revenue_per_staff > 500 ? 'text-yellow-600' : 'text-red-600'}`}>
                      ${outlet.revenue_per_staff.toFixed(0)}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      outlet.risk_score > 0.5 ? 'bg-red-100 text-red-700' :
                      outlet.risk_score > 0.3 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {(outlet.risk_score * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => setExpandedOutlet(expandedOutlet === outlet.outlet_id ? null : outlet.outlet_id)}
                      className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <ChevronDown className={`w-4 h-4 transition-transform ${expandedOutlet === outlet.outlet_id ? 'rotate-180' : ''}`} />
                    </button>
                  </td>
                </tr>
                {expandedOutlet === outlet.outlet_id && (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 bg-slate-50">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <div className="text-xs text-slate-500">Monthly Revenue</div>
                          <div className="font-semibold">${outlet.revenue_30d.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500">Anomaly Score</div>
                          <div className="font-semibold">{(outlet.anomaly_score * 100).toFixed(1)}%</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500">Other Staff</div>
                          <div className="font-semibold">{outlet.other}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500">Benchmark</div>
                          <div className="font-semibold">
                            {outlet.revenue_per_staff > (regionalStats?.avg_revenue_per_staff || 0) ? '↑ Above Avg' : '↓ Below Avg'}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        {filteredOutlets.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <Users className="w-10 h-10 mx-auto mb-2" />
            <p>No outlets found</p>
          </div>
        )}
      </div>

      {/* Staff Performance Table - only show when tab is "staff" */}
      {activeTab === "staff" && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h3 className="font-semibold text-slate-900">Staff Performance (Last 7 Days)</h3>
            <p className="text-sm text-slate-500">Ranked by total sales from POS transactions</p>
          </div>
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold text-slate-500">
                <th className="px-6 py-4">Rank</th>
                <th className="px-6 py-4">Staff ID</th>
                <th className="px-6 py-4">Outlet</th>
                <th className="px-6 py-4 text-right">Transactions</th>
                <th className="px-6 py-4 text-right">Total Sales</th>
                <th className="px-6 py-4 text-right">Avg Ticket</th>
                <th className="px-6 py-4 text-right">Performance</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {staffPerformance.length > 0 ? (
                staffPerformance.slice(0, 50).map((staff, index) => {
                  const avgTicket = regionalStats?.avg_ticket_size || 1;
                  const perfPercent = ((staff.avg_ticket / avgTicket - 1) * 100).toFixed(1);
                  const isAboveAvg = staff.avg_ticket > avgTicket;
                  
                  return (
                    <tr key={staff.staff_id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        {index < 3 ? (
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                            index === 0 ? "bg-yellow-100 text-yellow-700" :
                            index === 1 ? "bg-slate-200 text-slate-600" :
                            index === 2 ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-600"
                          }`}>
                            {index + 1}
                          </span>
                        ) : (
                          <span className="text-sm text-slate-500">{index + 1}</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{staff.staff_name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-slate-700">{staff.outlet_name}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="font-medium text-slate-900">{staff.transactions}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="font-semibold text-slate-900">${staff.total_sales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="font-medium text-slate-700">${staff.avg_ticket.toFixed(2)}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                          isAboveAvg ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        }`}>
                          {isAboveAvg ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {isAboveAvg ? "+" : ""}{perfPercent}%
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <Users className="w-10 h-10 mx-auto mb-2" />
                    <p>No POS transaction data available</p>
                    <p className="text-sm">Run POS simulator to generate data</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, sublabel, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel: string;
  color: "blue" | "purple" | "green" | "emerald" | "red" | "gray";
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-600 border-blue-200",
    purple: "bg-purple-50 text-purple-600 border-purple-200",
    green: "bg-green-50 text-green-600 border-green-200",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-200",
    red: "bg-red-50 text-red-600 border-red-200",
    gray: "bg-slate-50 text-slate-600 border-slate-200",
  };

  return (
    <div className={`p-4 rounded-xl border ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-medium opacity-75">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs opacity-75">{sublabel}</div>
    </div>
  );
}
