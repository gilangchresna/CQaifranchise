import React, { useState, useEffect } from "react";
import { Users, UserCheck, UserMinus, Clock, ArrowLeft, Sparkles, RefreshCw, MessageSquare, Phone, Building2, Calendar, TrendingUp, AlertTriangle } from "lucide-react";
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

export function Workforce({ activeRole }: { activeRole: Role }) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [isAskingAI, setIsAskingAI] = useState(false);
  const [staffInsight, setStaffInsight] = useState<StaffInsight | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<string>('all');

  useEffect(() => {
    fetchStaff();
  }, []);

  async function fetchStaff() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('staff')
        .select(`
          *,
          outlet:outlets(id, name, code, region:regions(name))
        `)
        .order('name');
      
      if (error) throw error;
      setStaff(data || []);
    } catch (err) {
      console.error('Error fetching staff:', err);
      // Show empty state - staff table may be empty
      setStaff([]);
    } finally {
      setLoading(false);
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
                    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium capitalize ${getStatusColor(emp.status)}`}>
                      {getStatusIcon(emp.status)}
                      {emp.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
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

  const getPerformanceColor = (score: number) => {
    if (score >= 85) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

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

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border rounded-2xl p-5">
          <p className="text-xs text-slate-500 mb-2">Performance Score</p>
          <p className={`text-3xl font-bold ${getPerformanceColor(staff.performance_score || 0)}`}>
            {staff.performance_score || 0}%
          </p>
          <div className="w-full h-2 bg-slate-200 rounded-full mt-2">
            <div 
              className={`h-full rounded-full ${(staff.performance_score || 0) >= 85 ? 'bg-green-500' : (staff.performance_score || 0) >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${staff.performance_score || 0}%` }}
            />
          </div>
        </div>

        <div className="bg-white border rounded-2xl p-5">
          <p className="text-xs text-slate-500 mb-2">Attendance Rate</p>
          <p className={`text-3xl font-bold ${(staff.attendance_rate || 0) >= 90 ? 'text-green-600' : 'text-orange-600'}`}>
            {staff.attendance_rate || 0}%
          </p>
          <p className="text-xs text-slate-400 mt-2">Last 30 days</p>
        </div>

        <div className="bg-white border rounded-2xl p-5">
          <p className="text-xs text-slate-500 mb-2">Sales Handled</p>
          <p className="text-3xl font-bold text-slate-900">
            S${(staff.sales_handled || 0).toLocaleString()}
          </p>
          <p className="text-xs text-slate-400 mt-2">This month</p>
        </div>

        <div className="bg-white border rounded-2xl p-5">
          <p className="text-xs text-slate-500 mb-2">Shift Hours</p>
          <p className="text-3xl font-bold text-slate-900">
            {staff.shift_start}
          </p>
          <p className="text-xs text-slate-400 mt-2">to {staff.shift_end}</p>
        </div>
      </div>

      {/* Outlet Info */}
      <div className="bg-white border rounded-2xl p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-slate-500" />
          Assigned Outlet
        </h3>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-slate-500">Outlet Name</p>
            <p className="font-medium">{staff.outlet?.name || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Outlet Code</p>
            <p className="font-medium">{staff.outlet?.code || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Region</p>
            <p className="font-medium">{staff.outlet?.region?.name || 'N/A'}</p>
          </div>
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
