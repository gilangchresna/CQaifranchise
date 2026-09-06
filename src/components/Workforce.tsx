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

interface StaffInsight {
  summary: string;
  performance_analysis: string;
  recommendations: string[];
  alerts: string[];
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
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('7d');
  const [attendanceDate, setAttendanceDate] = useState<Date>(new Date());
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, string>>({});

  // Helper function to get start date based on range
  function getStartDate(): string | null {
    if (dateRange === 'all') return null;
    
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString();
  }

  // Attendance date helpers
  function isToday(date: Date): boolean {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  function formatAttendanceDate(date: Date): string {
    if (isToday(date)) return 'Today';
    return date.toLocaleDateString('en-SG', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short' 
    });
  }

  // Fetch attendance records for selected date
  async function fetchAttendanceRecords(date: Date) {
    const dateStr = date.toISOString().split('T')[0];
    
    const { data: records } = await supabase
      .from('staff_attendance')
      .select('staff_id, status')
      .eq('date', dateStr);
    
    if (records) {
      const recordMap: Record<string, string> = {};
      records.forEach(r => {
        recordMap[r.staff_id] = r.status;
      });
      setAttendanceRecords(recordMap);
    }
  }

  useEffect(() => {
    fetchAllData();
    fetchAttendanceRecords(attendanceDate);
  }, [dateRange, attendanceDate]);

  async function fetchAllData() {
    setLoading(true);
    try {
      let outletIds: number[] = [];
      
      // Get outlet IDs based on user role
      if (activeRole === 'Franchisee') {
        // Get outlets from user_outlets table (Franchisee specific)
        const { data: userOutlets } = await supabase
          .from('user_outlets')
          .select('outlet_id')
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id);
        
        outletIds = userOutlets?.map(uo => uo.outlet_id) || [];
        console.log('FRANCHISEE - Outlets from user_outlets:', outletIds);
        
      } else if (activeRole === 'Regional' && userRegionId !== null) {
        // Get outlets by region
        const { data: outlets } = await supabase
          .from('outlets')
          .select('id')
          .eq('region_id', userRegionId);
        
        outletIds = outlets?.map(o => o.id) || [];
        console.log('REGIONAL - Outlets by region:', outletIds);
        
      } else {
        // HQ: Get all outlets
        const { data: outlets } = await supabase.from('outlets').select('id');
        outletIds = outlets?.map(o => o.id) || [];
        console.log('HQ - All outlets:', outletIds);
      }
      
      // Get outlet details for display
      const { data: outlets } = await supabase
        .from('outlets')
        .select('id, name, code, region:regions(name)')
        .in('id', outletIds);
      
      console.log('Outlet details:', outlets?.length);
      
      // Fetch staff for these outlets
      const { data, error } = await supabase
        .from('staff')
        .select(`*, outlet:outlets(id, name, code, region:regions(name))`)
        .in('outlet_id', outletIds)
        .order('name');
      
      console.log('Staff fetched:', data?.length, error);
      
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

      // Build query with date filter
      const startDate = getStartDate();
      let query = supabase
        .from('sales_transactions')
        .select('staff_id, amount, outlet_id')
        .in('outlet_id', outletIds)
        .order('created_at', { ascending: false })
        .limit(100000);

      // Add date filter if not "all"
      if (startDate) {
        query = query.gte('created_at', startDate);
      }

      const { data: posData } = await query;

      if (posData) {
        const staffMap = new Map<string, any>();
        const outletNameMap = new Map<number, string>();
        staffData.forEach((s: any) => {
          if (s.outlet) outletNameMap.set(s.outlet_id, s.outlet.name);
        });

        posData.forEach((tx: any) => {
          const staffId = String(tx.staff_id || 'UNASSIGNED');
          if (!staffMap.has(staffId)) {
            let realName = 'Unassigned';
            let outletName = 'Unknown';
            let outletId = tx.outlet_id;

            // Try multiple matching formats:
            // 1. Match numeric staff_id like "664", "665"
            const numericId = parseInt(staffId);
            // 2. Match "STF001" format
            const staffIdMatch = staffId.match(/^STF(\d+)$/);
            
            if (!isNaN(numericId) && numericId > 0 && numericId < 10000) {
              // Match by staff.id (numeric)
              const staffMember = staffData.find(s => s.id === numericId);
              if (staffMember) {
                realName = staffMember.name;
                outletId = staffMember.outlet_id;
                outletName = staffMember.outlet?.name || 'Unknown';
              }
            } else if (staffIdMatch) {
              // Match STF### format
              const staffNum = parseInt(staffIdMatch[1]);
              const staffMember = staffData.find(s => s.id === staffNum);
              if (staffMember) {
                realName = staffMember.name;
                outletId = staffMember.outlet_id;
                outletName = staffMember.outlet?.name || 'Unknown';
              }
            }

            staffMap.set(staffId, {
              staff_id: staffId,
              staff_name: realName,
              outlet_id: outletId,
              outlet_name: outletName,
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

  // Calculate stats - use attendance records from DB
  const totalStaff = filteredStaff.length;
  
  // Get attendance status from records (fallback to staff.status)
  const getAttendanceStatus = (staffId: number): string => {
    return attendanceRecords[staffId] || filteredStaff.find(s => s.id === staffId)?.status || 'present';
  };
  
  const presentCount = filteredStaff.filter(s => {
    const status = getAttendanceStatus(s.id);
    return status === 'present';
  }).length;
  const absentCount = filteredStaff.filter(s => {
    const status = getAttendanceStatus(s.id);
    return status === 'absent' || status === 'off_duty';
  }).length;
  const lateCount = filteredStaff.filter(s => {
    const status = getAttendanceStatus(s.id);
    return status === 'late' || status === 'on_leave';
  }).length;
  const coverageRate = totalStaff > 0 ? Math.round((presentCount / totalStaff) * 100) : 0;
  const avgPerformance = totalStaff > 0 ? Math.round(filteredStaff.reduce((acc, s) => acc + (s.performance_score || 0), 0) / totalStaff) : 0;

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
      <div className="min-h-[400px] flex items-center justify-center">
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

      {/* Date Picker Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">
            {formatAttendanceDate(attendanceDate)}
          </span>
        </div>
        <div className="flex gap-2">
          <input
            type="date"
            value={attendanceDate.toISOString().split('T')[0]}
            onChange={(e) => setAttendanceDate(new Date(e.target.value + 'T00:00:00'))}
            className="border border-gray-200 rounded px-3 py-1.5 text-sm"
          />
          <button
            onClick={() => setAttendanceDate(new Date())}
            className={`px-3 py-1.5 text-xs rounded font-medium transition-colors ${
              isToday(attendanceDate) 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => {
              const d = new Date();
              d.setDate(d.getDate() - 1);
              setAttendanceDate(d);
            }}
            className="px-3 py-1.5 text-xs rounded bg-gray-100 text-gray-600 hover:bg-gray-200 font-medium"
          >
            Yesterday
          </button>
        </div>
      </div>

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
            <div className="h-10 w-10 rounded-lg bg-purple-50 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Avg Performance</p>
              <p className={`text-xl font-semibold ${getPerformanceColor(avgPerformance)}`}>{avgPerformance}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div>
          <label className="text-xs text-slate-500 block mb-1">Status</label>
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
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Role</label>
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
        </div>
      </div>

      {/* Staff Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm text-slate-700">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-500 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 font-semibold">Employee</th>
              <th className="px-6 py-4 font-semibold">Role</th>
              <th className="px-6 py-4 font-semibold">Outlet</th>
              <th className="px-6 py-4 font-semibold">Shift</th>
              <th className="px-6 py-4 font-semibold">Performance</th>
              <th className="px-6 py-4 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredStaff.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                  No staff found matching filters
                </td>
              </tr>
            ) : (
              filteredStaff.map((emp) => (
                <tr 
                  key={emp.id} 
                  onClick={() => setSelectedStaff(emp)}
                  className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-medium">
                        {emp.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{emp.name}</p>
                        <p className="text-xs text-slate-400">EMP-{String(emp.id).padStart(3, '0')}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-slate-100 px-2 py-1 rounded text-xs">{emp.role}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-slate-900">{emp.outlet?.name || 'N/A'}</p>
                      <p className="text-xs text-slate-400">{emp.outlet?.region?.name || emp.outlet?.code || ''}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs">
                    {emp.shift_start} - {emp.shift_end}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${(emp.performance_score || 0) >= 85 ? 'bg-green-500' : (emp.performance_score || 0) >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${emp.performance_score || 0}%` }}
                        />
                      </div>
                      <span className={`text-xs font-medium ${getPerformanceColor(emp.performance_score || 0)}`}>
                        {emp.performance_score || 0}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium capitalize ${getStatusColor(getAttendanceStatus(emp.id))}`}>
                      {getStatusIcon(getAttendanceStatus(emp.id))}
                      {getAttendanceStatus(emp.id)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
                  <p className="text-xl font-semibold text-green-600">
                    ${staffPerformance.reduce((sum, s) => sum + s.total_sales, 0).toFixed(0)}
                  </p>
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
                  <p className="text-xl font-semibold text-purple-600">
                    {staffPerformance.reduce((sum, s) => sum + s.transactions, 0)}
                  </p>
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
                  <p className="text-xl font-semibold text-orange-600">
                    ${staffPerformance.length > 0 
                      ? (staffPerformance.reduce((sum, s) => sum + s.avg_ticket, 0) / staffPerformance.length).toFixed(2)
                      : '0.00'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Performance Table */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <h3 className="font-semibold text-slate-900">Staff Performance</h3>
                  <p className="text-sm text-slate-500">Ranked by total sales from POS transactions</p>
                </div>
                {/* Date Range Filter */}
                <div className="flex gap-1">
                  {[
                    { label: '7D', value: '7d' as const },
                    { label: '30D', value: '30d' as const },
                    { label: '90D', value: '90d' as const },
                    { label: 'All', value: 'all' as const },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setDateRange(opt.value)}
                      className={`px-3 py-1 text-xs rounded ${
                        dateRange === opt.value 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
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
                      const avgTicket = staffPerformance.length > 0 
                        ? staffPerformance.reduce((sum, s) => sum + s.avg_ticket, 0) / staffPerformance.length 
                        : 0;
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
                            <div className="font-semibold text-slate-900">
                              ${s.total_sales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
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
interface StaffPerformanceDetail {
  total_sales: number;
  transactions: number;
  avg_ticket: number;
  rank: number;
  percentile: number;
  badge: 'top' | 'good' | 'average' | 'needs_training';
}

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
  const [posPerformance, setPosPerformance] = useState<StaffPerformanceDetail | null>(null);
  const [loadingPos, setLoadingPos] = useState(true);
  const [totalStaffAtOutlet, setTotalStaffAtOutlet] = useState(0);

  useEffect(() => {
    fetchPosPerformance();
  }, [staff.id, staff.outlet_id]);

  async function fetchPosPerformance() {
    setLoadingPos(true);
    try {
      const staffIdStr = String(staff.id);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { data: allTx } = await supabase
        .from('sales_transactions')
        .select('staff_id, amount')
        .eq('outlet_id', staff.outlet_id)
        .gte('created_at', sevenDaysAgo.toISOString());

      const staffTx = allTx?.filter(tx => {
        if (!tx.staff_id) return false;
        const sid = String(tx.staff_id);
        // Match both formats: "STF001", "1", "EMP-001"
        return (
          sid === String(staff.id) ||  // Match "35" to id=35
          sid === `STF${String(staff.id).padStart(3, '0')}` ||  // Match "STF035" to id=35
          sid.includes(String(staff.id))  // Partial match
        );
      }) || [];

      const total_sales = staffTx.reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);
      const transactions = staffTx.length;
      const avg_ticket = transactions > 0 ? total_sales / transactions : 0;

      const staffSalesMap = new Map<string, number>();
      allTx?.forEach(tx => {
        const sid = tx.staff_id || 'UNKNOWN';
        staffSalesMap.set(sid, (staffSalesMap.get(sid) || 0) + (parseFloat(tx.amount) || 0));
      });

      const sortedStaff = Array.from(staffSalesMap.entries())
        .sort((a, b) => b[1] - a[1]);
      
      const rank = sortedStaff.findIndex(([sid]) => {
        const sidStr = String(sid);
        return (
          sidStr === String(staff.id) ||
          sidStr === `STF${String(staff.id).padStart(3, '0')}` ||
          sidStr.includes(String(staff.id))
        );
      }) + 1;
      
      const percentile = sortedStaff.length > 0 
        ? Math.round((1 - (rank - 1) / sortedStaff.length) * 100) 
        : 0;

      let badge: StaffPerformanceDetail['badge'] = 'average';
      if (percentile >= 90) badge = 'top';
      else if (percentile >= 75) badge = 'good';
      else if (percentile >= 50) badge = 'average';
      else badge = 'needs_training';

      setPosPerformance({ total_sales, transactions, avg_ticket, rank, percentile, badge });
      setTotalStaffAtOutlet(sortedStaff.length);
    } catch (err) {
      console.error('Error fetching POS performance:', err);
    } finally {
      setLoadingPos(false);
    }
  }

  function calculateTenure(hireDate: string | undefined): string {
    if (!hireDate) return 'N/A';
    const hire = new Date(hireDate);
    const now = new Date();
    const years = now.getFullYear() - hire.getFullYear();
    const months = now.getMonth() - hire.getMonth();
    if (years > 0) return `${years}y ${months > 0 ? `${months}m` : ''}`;
    if (months > 0) return `${months} month${months > 1 ? 's' : ''}`;
    return 'Just joined';
  }

  function getBadgeInfo(badge: StaffPerformanceDetail['badge']) {
    switch (badge) {
      case 'top': return { label: '⭐ Top Performer', color: 'bg-yellow-100 text-yellow-700' };
      case 'good': return { label: '✓ Good', color: 'bg-green-100 text-green-700' };
      case 'average': return { label: '○ Average', color: 'bg-slate-100 text-slate-700' };
      case 'needs_training': return { label: '⚠️ Needs Training', color: 'bg-red-100 text-red-700' };
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'present': return 'bg-green-100 text-green-700';
      case 'absent': return 'bg-red-100 text-red-700';
      case 'late': return 'bg-orange-100 text-orange-700';
      case 'off_duty': return 'bg-slate-100 text-slate-700';
      case 'active': return 'bg-blue-100 text-blue-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  }

  function getPerformanceColor(score: number) {
    if (score >= 85) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  }

  async function generateAIInsights() {
    setIsAskingAI(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Call athena-chat for staff insights
      const response = await fetch(`${EDGE_FUNCTIONS_URL}/athena-chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `Analyze staff member ${staff.name} (${staff.role}) at ${staff.outlet?.name || 'Unknown outlet'}. Performance: ${staff.performance_score || 0}%, Attendance: ${staff.attendance_rate || 0}%, Sales handled: S$${(staff.sales_handled || 0).toLocaleString()}. Provide insights about their performance, potential issues, and recommendations.`,
          context: {
            user_id: session?.user?.id,
            role: 'HQ_ADMIN'
          }
        }),
      });
      
      const data = await response.json();
      
      setStaffInsight({
        summary: data.response || 'Analysis complete',
        performance_analysis: `Performance Score: ${staff.performance_score || 0}% | Attendance Rate: ${staff.attendance_rate || 0}% | Sales Handled: S$${(staff.sales_handled || 0).toLocaleString()}`,
        recommendations: data.suggestions || ['Continue monitoring performance'],
        alerts: []
      });
    } catch (err) {
      console.error('AI insights error:', err);
      // Fallback
      const insights = generateMockInsights(staff);
      setStaffInsight(insights);
    }
    setIsAskingAI(false);
  }

  function generateMockInsights(staff: Staff): StaffInsight {
    const alerts: string[] = [];
    const recommendations: string[] = [];

    if ((staff.attendance_rate || 0) < 90) {
      alerts.push('⚠️ Attendance rate below 90% - needs attention');
      recommendations.push('Schedule attendance review meeting');
    }

    if ((staff.performance_score || 0) < 70) {
      alerts.push('🚨 Performance score below target');
      recommendations.push('Provide additional training');
    }

    if (staff.status === 'absent') {
      alerts.push('📋 Currently absent - coverage needed');
    }

    if ((staff.performance_score || 0) >= 85) {
      recommendations.push('🌟 High performer - consider for promotion');
    }

    return {
      summary: `${staff.name} is a ${staff.role} at ${staff.outlet?.name || 'Unknown'}. ${(staff.performance_score || 0) >= 80 ? 'Showing strong performance with good attendance.' : 'Performance could be improved with some adjustments.'}`,
      performance_analysis: `Score: ${staff.performance_score || 0}% | Attendance: ${staff.attendance_rate || 0}% | Sales: S$${(staff.sales_handled || 0).toLocaleString()}`,
      recommendations: recommendations.length > 0 ? recommendations : ['Continue current performance management'],
      alerts
    };
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Staff List
      </button>

      {/* Staff Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 text-white">
        <div className="flex items-start gap-6">
          <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-2xl font-bold">
            {staff.name.split(' ').map(n => n[0]).join('')}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-bold">{staff.name}</h2>
              <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(staff.status)}`}>
                {staff.status}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div>
                <p className="text-slate-400 text-xs">Employee ID</p>
                <p className="font-medium">EMP-{String(staff.id).padStart(3, '0')}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">Role</p>
                <p className="font-medium">{staff.role}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">Contact</p>
                <p className="font-medium flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {staff.contact}
                </p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">Hire Date</p>
                <p className="font-medium flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {staff.hire_date ? new Date(staff.hire_date).toLocaleDateString('id-ID') : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Basic Info | Performance */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Basic Info Card */}
        <div className="bg-white border rounded-2xl p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            📋 Basic Information
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Role</span>
              <span className="font-medium">{staff.role}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Outlet</span>
              <span className="font-medium">{staff.outlet?.name || 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Region</span>
              <span className="font-medium">{staff.outlet?.region?.name || 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Hire Date</span>
              <span className="font-medium">
                {staff.hire_date ? new Date(staff.hire_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Tenure</span>
              <span className="font-medium">{calculateTenure(staff.hire_date)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Shift</span>
              <span className="font-medium">
                {staff.shift_start ? `${staff.shift_start.slice(0, 5)} - ${staff.shift_end?.slice(0, 5) || 'N/A'}` : 'Not set'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Phone</span>
              <span className="font-medium">{staff.contact || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* POS Performance Card */}
        <div className="bg-white border rounded-2xl p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            📊 POS Performance (7 Days)
          </h3>
          
          {loadingPos ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
            </div>
          ) : posPerformance && posPerformance.transactions > 0 ? (
            <div className="space-y-4">
              {/* Performance Badge */}
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Status</span>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getBadgeInfo(posPerformance.badge).color}`}>
                  {getBadgeInfo(posPerformance.badge).label}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Total Sales</span>
                <span className="font-bold text-green-600">${posPerformance.total_sales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Transactions</span>
                <span className="font-medium">{posPerformance.transactions}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Avg Ticket</span>
                <span className="font-medium">${posPerformance.avg_ticket.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Rank</span>
                <span className="font-medium">#{posPerformance.rank} / {totalStaffAtOutlet}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Percentile</span>
                <span className="font-medium">{posPerformance.percentile}th percentile</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No POS transaction data</p>
              <p className="text-sm">Run POS simulator to generate data</p>
            </div>
          )}
        </div>
      </div>

      {/* AI Insights */}
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Athena AI Staff Analysis
          </h3>
          {staffInsight && <span className="text-xs bg-white/20 px-3 py-1 rounded-full">Analyzed</span>}
        </div>

        {!staffInsight ? (
          <div className="text-center py-8">
            <p className="text-white/80 mb-4">Get AI-powered insights about {staff.name}'s performance.</p>
            <button
              onClick={generateAIInsights}
              disabled={isAskingAI}
              className="px-6 py-3 bg-white text-indigo-600 font-semibold rounded-xl flex items-center gap-2 mx-auto hover:bg-indigo-50 transition-colors"
            >
              {isAskingAI ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Analyzing...</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Generate AI Analysis</>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-sm font-medium mb-2 opacity-80">Summary</p>
              <p className="leading-relaxed">{staffInsight.summary}</p>
            </div>

            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-sm font-medium mb-2 opacity-80">Performance Details</p>
              <p className="text-sm">{staffInsight.performance_analysis}</p>
            </div>

            {staffInsight.alerts.length > 0 && (
              <div className="bg-red-500/20 rounded-xl p-4">
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Alerts
                </p>
                {staffInsight.alerts.map((alert, idx) => (
                  <p key={idx} className="text-sm">{alert}</p>
                ))}
              </div>
            )}

            {staffInsight.recommendations.length > 0 && (
              <div className="bg-white/10 rounded-xl p-4">
                <p className="text-sm font-medium mb-2 opacity-80">Recommendations</p>
                <ul className="space-y-1">
                  {staffInsight.recommendations.map((rec, idx) => (
                    <li key={idx} className="text-sm flex items-start gap-2">
                      <span className="text-indigo-300">•</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={generateAIInsights}
              disabled={isAskingAI}
              className="px-4 py-2 bg-white/20 rounded-lg text-sm hover:bg-white/30 transition-colors"
            >
              Refresh Analysis
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
