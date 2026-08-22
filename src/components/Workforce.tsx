"use client";
import React, { useState, useEffect } from "react";
import { Users, UserCheck, UserMinus, Clock, ArrowLeft, Sparkles, RefreshCw, MessageSquare, Phone, Building2, Calendar, TrendingUp, AlertTriangle, BarChart3, TrendingDown } from "lucide-react";
import { Role } from "@/src/types";
import { supabase } from "@/src/lib/supabase";

const EDGE_FUNCTIONS_URL = 'https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1';

interface Staff {
  id: number;
  name: string;
  role: string;
  outlet_id: number;
  status: 'present' | 'absent' | 'late';
  shift_start: string;
  shift_end: string;
  contact: string;
  hire_date?: string;
  performance_score?: number;
  sales_handled?: number;
  attendance_rate?: number;
  outlet?: {
    id: number;
    name: string;
    code: string;
    region?: {
      name: string;
    };
  };
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

interface StaffInsight {
  summary: string;
  performance_analysis: string;
  recommendations: string[];
  alerts: string[];
}

export function Workforce({ activeRole, userRegionId }: { activeRole: Role; userRegionId: number | null }) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [staffPerformance, setStaffPerformance] = useState<StaffPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [isAskingAI, setIsAskingAI] = useState(false);
  const [staffInsight, setStaffInsight] = useState<StaffInsight | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'attendance' | 'performance'>('attendance');

  useEffect(() => {
    fetchAllData();
  }, []);

  async function fetchAllData() {
    setLoading(true);
    try {
      // Build query based on user role
      let query = supabase
        .from('staff')
        .select(`
          *,
          outlet:outlets(id, name, code, region_id, region:regions(name))
        `)
        .order('name');

      // Filter by region if not HQ
      if (userRegionId !== null) {
        query = query.eq('outlets.region_id', userRegionId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setStaff(data || []);

      // Fetch POS performance data
      if (data && data.length > 0) {
        await fetchStaffPerformance(data);
      }
    } catch (err) {
      console.error('Error fetching staff:', err);
      setStaff([]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchStaffPerformance(staffData: Staff[]) {
    try {
      // Create staff name lookup
      const staffNameMap = new Map<number, string>();
      const staffOutletMap = new Map<number, number>();
      staffData.forEach((s: any) => {
        staffNameMap.set(s.id, s.name);
        staffOutletMap.set(s.id, s.outlet_id);
      });

      // Get outlet IDs
      const outletIds = [...new Set(staffData.map(s => s.outlet_id))];

      // Fetch POS data
      const { data: posData } = await supabase
        .from('sales_transactions')
        .select('staff_id, amount, outlet_id')
        .in('outlet_id', outletIds)
        .order('created_at', { ascending: false })
        .limit(5000);

      if (posData) {
        const staffMap = new Map<string, any>();
        const outletNameMap = new Map<number, string>();
        staffData.forEach((s: any) => {
          if (s.outlet) outletNameMap.set(s.outlet_id, s.outlet.name);
        });

        posData.forEach((tx: any) => {
          const staffId = tx.staff_id || 'UNASSIGNED';
          if (!staffMap.has(staffId)) {
            let realName = 'Unassigned';
            let outletName = 'Unknown';
            let outletId = tx.outlet_id;

            const staffIdMatch = staffId.match(/^STF(\d+)$/);
            if (staffIdMatch) {
              const staffNum = parseInt(staffIdMatch[1]);
              if (staffNameMap.has(staffNum)) {
                realName = staffNameMap.get(staffNum)!;
                outletId = staffOutletMap.get(staffNum) || tx.outlet_id;
              }
            }

            staffMap.set(staffId, {
              staff_id: staffId,
              staff_name: realName,
              outlet_id: outletId,
              outlet_name: outletNameMap.get(outletId) || 'Unknown',
              transactions: 0,
              total_sales: 0,
            });
          }
          const staffMember = staffMap.get(staffId);
          staffMember.transactions++;
          staffMember.total_sales += parseFloat(tx.amount) || 0;
        });

        const staffList: StaffPerformance[] = Array.from(staffMap.values())
          .map((s, index) => ({
            ...s,
            avg_ticket: s.transactions > 0 ? s.total_sales / s.transactions : 0,
            rank: index + 1,
          }))
          .sort((a, b) => b.total_sales - a.total_sales)
          .map((s, index) => ({ ...s, rank: index + 1 }));

        setStaffPerformance(staffList);
      }
    } catch (err) {
      console.error('Error fetching performance:', err);
    }
  }

  // Get unique roles for filter
  const uniqueRoles = [...new Set(staff.map(s => s.role))];

  // Filter staff
  const filteredStaff = staff.filter((s) => {
    const matchesStatus = filterStatus === 'all' || s.status === filterStatus;
    const matchesRole = filterRole === 'all' || s.role === filterRole;
    return matchesStatus && matchesRole;
  });

  // Calculate stats
  const totalStaff = filteredStaff.length;
  const presentCount = filteredStaff.filter(s => s.status === 'present').length;
  const absentCount = filteredStaff.filter(s => s.status === 'absent').length;
  const lateCount = filteredStaff.filter(s => s.status === 'late').length;
  const coverageRate = totalStaff > 0 ? Math.round((presentCount / totalStaff) * 100) : 0;
  const avgPerformance = totalStaff > 0 ? Math.round(filteredStaff.reduce((acc, s) => acc + (s.performance_score || 0), 0) / totalStaff) : 0;

  // Calculate performance stats
  const avgTicket = staffPerformance.length > 0 
    ? staffPerformance.reduce((sum, s) => sum + s.avg_ticket, 0) / staffPerformance.length 
    : 0;
  const totalSales = staffPerformance.reduce((sum, s) => sum + s.total_sales, 0);
  const totalTransactions = staffPerformance.reduce((sum, s) => sum + s.transactions, 0);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present': return <UserCheck className="w-3 h-3" />;
      case 'absent': return <UserMinus className="w-3 h-3" />;
      case 'late': return <Clock className="w-3 h-3" />;
      default: return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-green-50 border-green-200 text-green-700';
      case 'absent': return 'bg-red-50 border-red-200 text-red-700';
      case 'late': return 'bg-orange-50 border-orange-200 text-orange-700';
      default: return 'bg-slate-50 border-slate-200 text-slate-700';
    }
  };

  const getPerformanceColor = (score: number) => {
    if (score >= 85) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Staff Detail View
  if (selectedStaff) {
    return (
      <StaffDetailView 
        staff={selectedStaff} 
        onBack={() => { setSelectedStaff(null); setStaffInsight(null); }}
        isAskingAI={isAskingAI}
        setIsAskingAI={setIsAskingAI}
        staffInsight={staffInsight}
        setStaffInsight={setStaffInsight}
      />
    );
  }

  // Main Staff List View
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-3 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <Users className="w-5 h-5" /> Workforce Management
        </h2>
        <span className="text-sm text-slate-500">{totalStaff} employees</span>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab("attendance")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "attendance"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <UserCheck className="w-4 h-4 inline mr-2" />
          Attendance
          {totalStaff > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-600 rounded-full">
              {presentCount} present
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("performance")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "performance"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <BarChart3 className="w-4 h-4 inline mr-2" />
          Staff Performance
          {staffPerformance.length > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-600 rounded-full">
              {staffPerformance.length}
            </span>
          )}
        </button>
      </div>

      {/* Attendance Tab */}
      {activeTab === "attendance" && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Total Staff</p>
                  <p className="text-xl font-semibold">{totalStaff}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center">
                  <UserCheck className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Present</p>
                  <p className="text-xl font-semibold text-green-600">{presentCount}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center">
                  <UserMinus className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Absent</p>
                  <p className="text-xl font-semibold text-red-600">{absentCount}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-orange-50 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Late</p>
                  <p className="text-xl font-semibold text-orange-600">{lateCount}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value="all">All Status</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="late">Late</option>
            </select>

            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value="all">All Roles</option>
              {uniqueRoles.map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>

            <button
              onClick={() => { setFilterStatus('all'); setFilterRole('all'); }}
              className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700"
            >
              Clear Filters
            </button>
          </div>

          {/* Staff List */}
          <div className="grid gap-4">
            {filteredStaff.map((s) => (
              <div
                key={s.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedStaff(s)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-semibold">
                      {s.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{s.name}</p>
                      <p className="text-sm text-slate-500">{s.role}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Building2 className="w-3 h-3 text-slate-400" />
                        <span className="text-xs text-slate-400">{s.outlet?.name || 'No outlet'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {s.performance_score && (
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Performance</p>
                        <p className={`text-sm font-semibold ${getPerformanceColor(s.performance_score)}`}>
                          {s.performance_score}%
                        </p>
                      </div>
                    )}

                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium ${getStatusColor(s.status)}`}>
                      {getStatusIcon(s.status)}
                      <span className="capitalize">{s.status}</span>
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-slate-500">Shift</p>
                      <p className="text-sm text-slate-700">
                        {s.shift_start ? `${s.shift_start.slice(0, 5)} - ${s.shift_end?.slice(0, 5) || 'N/A'}` : 'N/A'}
                      </p>
                    </div>

                    <Sparkles className="w-5 h-5 text-slate-400" />
                  </div>
                </div>
              </div>
            ))}

            {filteredStaff.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No staff found</p>
                <p className="text-sm">Try adjusting your filters</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Performance Tab */}
      {activeTab === "performance" && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Total Staff</p>
                  <p className="text-xl font-semibold">{staffPerformance.length}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Total Sales</p>
                  <p className="text-xl font-semibold text-green-600">${totalSales.toFixed(0)}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-purple-50 flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Transactions</p>
                  <p className="text-xl font-semibold text-purple-600">{totalTransactions}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-orange-50 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Avg Ticket</p>
                  <p className="text-xl font-semibold text-orange-600">${avgTicket.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Performance Table */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h3 className="font-semibold text-slate-900">Staff Performance</h3>
              <p className="text-sm text-slate-500">Ranked by total sales from POS transactions</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr className="text-left text-xs font-semibold text-slate-500 uppercase">
                    <th className="px-6 py-3">Rank</th>
                    <th className="px-6 py-3">Staff</th>
                    <th className="px-6 py-3">Outlet</th>
                    <th className="px-6 py-3 text-right">Transactions</th>
                    <th className="px-6 py-3 text-right">Total Sales</th>
                    <th className="px-6 py-3 text-right">Avg Ticket</th>
                    <th className="px-6 py-3 text-right">Performance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {staffPerformance.length > 0 ? (
                    staffPerformance.map((s, index) => {
                      const perfPercent = avgTicket > 0 ? ((s.avg_ticket / avgTicket - 1) * 100).toFixed(1) : "0";
                      const isAboveAvg = s.avg_ticket > avgTicket;
                      
                      return (
                        <tr key={s.staff_id} className="hover:bg-slate-50">
                          <td className="px-6 py-4">
                            {index < 3 ? (
                              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                                index === 0 ? "bg-yellow-100 text-yellow-700" :
                                index === 1 ? "bg-slate-200 text-slate-600" :
                                "bg-orange-100 text-orange-700"
                              }`}>
                                {index + 1}
                              </span>
                            ) : (
                              <span className="text-sm text-slate-500">{index + 1}</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-medium text-slate-900">{s.staff_name}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-slate-700">{s.outlet_name}</div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="font-medium text-slate-900">{s.transactions}</div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="font-semibold text-slate-900">${s.total_sales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="font-medium text-slate-700">${s.avg_ticket.toFixed(2)}</div>
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
                        <BarChart3 className="w-10 h-10 mx-auto mb-2" />
                        <p>No POS transaction data available</p>
                        <p className="text-sm">Run POS simulator to generate data</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Staff Detail View Component
function StaffDetailView({ 
  staff, 
  onBack, 
  isAskingAI, 
  setIsAskingAI, 
  staffInsight, 
  setStaffInsight 
}: { 
  staff: Staff; 
  onBack: () => void; 
  isAskingAI: boolean;
  setIsAskingAI: (v: boolean) => void;
  staffInsight: StaffInsight | null;
  setStaffInsight: (v: StaffInsight | null) => void;
}) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-green-100 text-green-700';
      case 'absent': return 'bg-red-100 text-red-700';
      case 'late': return 'bg-orange-100 text-orange-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const askAI = async () => {
    setIsAskingAI(true);
    try {
      const response = await fetch(`${EDGE_FUNCTIONS_URL}/athena-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `Analyze this staff member: ${staff.name}, Role: ${staff.role}, Status: ${staff.status}, Performance Score: ${staff.performance_score || 'N/A'}, Sales Handled: ${staff.sales_handled || 'N/A'}, Attendance Rate: ${staff.attendance_rate || 'N/A'}%. Provide summary, performance analysis, recommendations, and any alerts.`,
          context: 'staff_performance'
        })
      });
      const data = await response.json();
      setStaffInsight(data);
    } catch (err) {
      console.error('AI Error:', err);
    } finally {
      setIsAskingAI(false);
    }
  };

  return (
    <div className="space-y-6">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Staff List
      </button>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-6">
          <div className="h-20 w-20 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 text-2xl font-semibold">
            {staff.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-xl font-semibold text-slate-900">{staff.name}</h2>
              <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(staff.status)}`}>
                {staff.status}
              </span>
            </div>
            <p className="text-slate-500">{staff.role}</p>
            <div className="flex items-center gap-4 mt-3 text-sm text-slate-500">
              <div className="flex items-center gap-1">
                <Building2 className="w-4 h-4" />
                {staff.outlet?.name || 'No outlet'}
              </div>
              {staff.contact && (
                <div className="flex items-center gap-1">
                  <Phone className="w-4 h-4" />
                  {staff.contact}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={askAI}
            disabled={isAskingAI}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            {isAskingAI ? 'Analyzing...' : 'Ask AI'}
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t">
          <div>
            <p className="text-xs text-slate-500 mb-1">Shift</p>
            <p className="font-medium">
              {staff.shift_start ? `${staff.shift_start.slice(0, 5)} - ${staff.shift_end?.slice(0, 5) || 'N/A'}` : 'Not set'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Performance Score</p>
            <p className="font-medium">{staff.performance_score || 'N/A'}%</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Sales Handled</p>
            <p className="font-medium">{staff.sales_handled || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Attendance Rate</p>
            <p className="font-medium">{staff.attendance_rate || 'N/A'}%</p>
          </div>
        </div>

        {staffInsight && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              AI Analysis
            </h3>
            <p className="text-blue-800 text-sm mb-3">{staffInsight.summary}</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-blue-700 mb-1">Analysis</p>
                <p className="text-sm text-blue-800">{staffInsight.performance_analysis}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-blue-700 mb-1">Recommendations</p>
                <ul className="text-sm text-blue-800 list-disc list-inside">
                  {staffInsight.recommendations?.slice(0, 3).map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
