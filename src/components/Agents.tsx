import React, { useState, useEffect, useMemo } from "react";
import { 
  Bot, Activity, Clock, Zap, AlertCircle, CheckCircle2, XCircle,
  MessageSquare, ChevronRight, RefreshCw, Filter, Search, ArrowUpRight,
  Cpu, Network, Play, Pause, Settings, Eye, EyeOff, Download
} from "lucide-react";
import { cn } from "@/src/lib/utils";
import { Role } from "@/src/types";
import { supabase, EDGE_FUNCTIONS_URL } from "@/src/lib/supabase";

const EDGE_URL = EDGE_FUNCTIONS_URL;

interface Agent {
  id: string;
  name: string;
  role: string;
  status: "online" | "busy" | "offline" | "error";
  last_activity: string | null;
  tasks_completed_today: number;
  tasks_pending: number;
  tasks_running: number;
  tasks_failed: number;
  avg_response_time_ms: number;
  uptime_percent: number;
  description: string;
  capabilities?: string[];
}

interface AgentTask {
  id: string;
  agent_id: string;
  agent_name?: string;
  task_type: string;
  status: "pending" | "running" | "completed" | "failed";
  priority?: number;
  input_data?: any;
  output_data?: any;
  error_message?: string;
  started_at?: string | null;
  completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
  duration_ms?: number;
}

interface AgentLog {
  id: string;
  agent_id: string;
  agent_name: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  timestamp: string;
  metadata?: any;
}

interface Metrics {
  total_tasks_today: number;
  total_completed: number;
  total_failed: number;
  avg_uptime: number;
  coordinator_up: boolean;
}

const agentColors: Record<string, string> = {
  athena: "from-violet-500 to-purple-600",
  monitor: "from-green-500 to-emerald-600",
  analyst: "from-blue-500 to-cyan-600",
  coordinator: "from-orange-500 to-amber-600",
  triage: "from-pink-500 to-rose-600",
  executor: "from-slate-500 to-gray-600",
};

const agentIcons: Record<string, React.ReactNode> = {
  athena: <Bot className="w-6 h-6" />,
  monitor: <Activity className="w-6 h-6" />,
  analyst: <Cpu className="w-6 h-6" />,
  coordinator: <Network className="w-6 h-6" />,
  triage: <Filter className="w-6 h-6" />,
  executor: <Zap className="w-6 h-6" />,
};

const agentNames: Record<string, string> = {
  athena: 'Athena',
  monitor: 'Monitor',
  analyst: 'Analyst',
  coordinator: 'Coordinator',
  triage: 'Triage',
  executor: 'Executor',
};

const getAgentName = (agentId: string | undefined): string => {
  if (!agentId) return '-';
  return agentNames[agentId] || agentId.charAt(0).toUpperCase() + agentId.slice(1);
};

export function Agents({ activeRole, userRegionId }: { activeRole: Role; userRegionId: number | null }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [stats, setStats] = useState<{ total_tasks_today: number; total_completed: number; total_pending: number; total_failed: number; agentPendingCounts: Record<string, number> }>({ total_tasks_today: 0, total_completed: 0, total_pending: 0, total_failed: 0, agentPendingCounts: {} });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'logs'>('overview');
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [userOutlets, setUserOutlets] = useState<number[]>([]);

  // Calculate metrics from tasks directly (instead of relying on edge function)
  const calculatedMetrics = useMemo(() => {
    if (tasks.length === 0) {
      return {
        total_tasks_today: 0,
        total_completed: 0,
        total_failed: 0,
        avg_uptime: 100,
        coordinator_up: true
      };
    }
    
    const completed = tasks.filter(t => t.status === 'completed').length;
    const failed = tasks.filter(t => t.status === 'failed').length;
    const running = tasks.filter(t => t.status === 'running').length;
    
    return {
      total_tasks_today: tasks.length,
      total_completed: completed,
      total_failed: failed,
      avg_uptime: running > 0 ? 80 : 100, // If running tasks, slightly lower uptime
      coordinator_up: agents.find(a => a.id === 'coordinator')?.status !== 'offline'
    };
  }, [tasks, agents]);

  // Calculate per-agent task counts from real data
  const agentTaskCounts = useMemo(() => {
    const counts: Record<string, { today: number; completed: number; pending: number; running: number; failed: number }> = {};
    const todayStr = new Date().toISOString().slice(0, 10); // "2026-08-21"
    
    for (const task of tasks) {
      const agentId = task.agent_id;
      if (!counts[agentId]) {
        counts[agentId] = { today: 0, completed: 0, pending: 0, running: 0, failed: 0 };
      }
      
      // Only count tasks created today for "today" metric
      const taskDate = task.created_at?.slice(0, 10);
      if (taskDate === todayStr) {
        counts[agentId].today++;
      }
      
      if (task.status === 'completed') counts[agentId].completed++;
      if (task.status === 'pending') counts[agentId].pending++;
      if (task.status === 'running') counts[agentId].running++;
      if (task.status === 'failed') counts[agentId].failed++;
    }
    return counts;
  }, [tasks]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterAgent, setFilterAgent] = useState<string>('all');
  const [filterDateRange, setFilterDateRange] = useState<string>('30days');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [isCustomDate, setIsCustomDate] = useState<boolean>(false);
  const [showFullDate, setShowFullDate] = useState<boolean>(false);

  // Fetch user outlets for filtering
  useEffect(() => {
    async function fetchUserOutlets() {
      if (activeRole === 'Regional' && userRegionId !== null) {
        // Get outlets for this region
        const { data } = await supabase
          .from('outlets')
          .select('id')
          .eq('region_id', userRegionId);
        setUserOutlets(data?.map(o => o.id) || []);
      } else if (activeRole === 'Franchisee') {
        // Get outlets from user_outlets table
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase
            .from('user_outlets')
            .select('outlet_id')
            .eq('user_id', user.id);
          setUserOutlets(data?.map(uo => uo.outlet_id) || []);
        }
      } else {
        // HQ sees all
        setUserOutlets([]);
      }
    }
    fetchUserOutlets();
  }, [activeRole, userRegionId]);

  useEffect(() => {
    fetchAgentData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchAgentData, 30000);
    return () => clearInterval(interval);
  }, [userOutlets.length]);

  async function fetchAgentData() {
    try {
      // First fetch tasks to calculate real task counts
      await fetchTasksAndLogs();
      setLoading(false);
    } catch (err) {
      console.error('Error fetching agent data:', err);
      setLoading(false);
    }
  }

  // Separate function to update agents with real task counts
  useEffect(() => {
    if (tasks.length > 0) {
      updateAgentsWithTaskCounts();
    }
  }, [tasks]);

  async function updateAgentsWithTaskCounts() {
    try {
      // Try edge function first
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const response = await fetch(`${EDGE_URL}/agent-status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (data.success && data.agents && data.agents.length > 0) {
        const transformedAgents: Agent[] = data.agents.map((a: any) => ({
          id: a.agent_id,
          name: a.name,
          role: a.role,
          status: a.status,
          last_activity: a.last_activity,
          tasks_completed_today: agentTaskCounts[a.agent_id]?.today || 0,
          tasks_pending: agentTaskCounts[a.agent_id]?.pending || 0,
          tasks_running: agentTaskCounts[a.agent_id]?.running || 0,
          tasks_failed: agentTaskCounts[a.agent_id]?.failed || 0,
          avg_response_time_ms: a.avg_response_time_ms || 0,
          uptime_percent: a.uptime_percent || 100,
          description: a.description || '',
          capabilities: a.capabilities || [],
        }));
        setAgents(transformedAgents);
        setMetrics(data.summary || null);
      } else {
        // Fetch from database
        const { data: dbAgents } = await supabase
          .from('agents')
          .select('*')
          .in('id', ['athena', 'monitor', 'analyst', 'coordinator', 'triage', 'executor']);
        
        if (dbAgents && dbAgents.length > 0) {
          const fallbackAgents: Agent[] = dbAgents.map((a: any) => ({
            id: a.id,
            name: a.name,
            role: a.role,
            status: a.status || 'online',
            last_activity: a.last_active,
            tasks_completed_today: agentTaskCounts[a.id]?.today || 0,
            tasks_pending: agentTaskCounts[a.id]?.pending || 0,
            tasks_running: agentTaskCounts[a.id]?.running || 0,
            tasks_failed: agentTaskCounts[a.id]?.failed || 0,
            avg_response_time_ms: a.avg_response_time_ms || 0,
            uptime_percent: a.uptime_percentage || 100,
            description: a.description || '',
            capabilities: a.capabilities || [],
          }));
          setAgents(fallbackAgents);
        }
      }
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error updating agents:', err);
    }
  }

  async function fetchTasksAndLogs() {
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      
      // Fetch PENDING tasks (all)
      const { data: pendingData } = await supabase
        .from('agent_tasks')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      
      // Fetch COMPLETED tasks from today
      const { data: completedData } = await supabase
        .from('agent_tasks')
        .select('*')
        .eq('status', 'completed')
        .gte('created_at', todayStr + 'T00:00:00')
        .order('created_at', { ascending: false })
        .limit(100);
      
      // Get accurate counts from DB
      const { count: totalToday } = await supabase
        .from('agent_tasks')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', todayStr + 'T00:00:00');
      
      const { count: completedToday } = await supabase
        .from('agent_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('created_at', todayStr + 'T00:00:00');
      
      // Get per-agent pending counts (filter by outlet if needed)
      const { data: pendingByAgent } = await supabase
        .from('agent_tasks')
        .select('agent_id, input_data')
        .eq('status', 'pending');
      
      // Calculate per-agent pending counts
      const agentPendingCounts: Record<string, number> = {};
      for (const task of (pendingByAgent || [])) {
        // Filter by outlet if userOutlets is set
        if (userOutlets.length > 0) {
          const taskOutletId = task.input_data?.outlet_id;
          if (!userOutlets.includes(Number(taskOutletId))) continue;
        }
        const agentId = task.agent_id;
        agentPendingCounts[agentId] = (agentPendingCounts[agentId] || 0) + 1;
      }
      
      // Filter and combine tasks for display
      let allPending = (pendingData || []).filter((task: any) => {
        if (userOutlets.length === 0) return true;
        const taskOutletId = task.input_data?.outlet_id;
        return userOutlets.includes(Number(taskOutletId));
      });
      
      let allCompleted = (completedData || []).filter((task: any) => {
        if (userOutlets.length === 0) return true;
        const taskOutletId = task.input_data?.outlet_id;
        return userOutlets.includes(Number(taskOutletId));
      });
      
      const allTasks = [...allCompleted, ...allPending]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 200);

      // Update stats with accurate counts
      setStats({
        total_tasks_today: (totalToday || 0),
        total_completed: (completedToday || 0),
        total_pending: Object.values(agentPendingCounts).reduce((a, b) => a + b, 0),
        total_failed: 0,
        agentPendingCounts,
      });

      if (allTasks.length > 0) {
        const agentNames: Record<string, string> = {
          athena: 'Athena', monitor: 'Monitor', analyst: 'Analyst',
          triage: 'Triage', coordinator: 'Coordinator', executor: 'Executor'
        };

        const transformedTasks: AgentTask[] = allTasks.map((t: any) => ({
          id: t.id,
          agent_id: t.agent_id,
          agent_name: agentNames[t.agent_id] || t.agent_id,
          task_type: t.task_type.replace('_', ' '),
          description: t.task_type.replace(/_/g, ' '),
          status: t.status,
          started_at: t.started_at,
          completed_at: t.completed_at,
          created_at: t.created_at,
          duration_ms: t.completed_at && t.started_at
            ? new Date(t.completed_at).getTime() - new Date(t.started_at).getTime()
            : undefined,
        }));

        setTasks(transformedTasks);
      }

      // Build date filter based on filterDateRange
      let dateFilter = new Date();
      dateFilter.setHours(dateFilter.getHours() - 24); // default to last 24h

      if (filterDateRange === 'today') {
        dateFilter = new Date();
        dateFilter.setHours(0, 0, 0, 0);
      } else if (filterDateRange === '24hours') {
        dateFilter = new Date();
        dateFilter.setHours(dateFilter.getHours() - 24);
      } else if (filterDateRange === '7days') {
        dateFilter = new Date();
        dateFilter.setDate(dateFilter.getDate() - 7);
      } else if (filterDateRange === '30days') {
        dateFilter = new Date();
        dateFilter.setDate(dateFilter.getDate() - 30);
      } else if (dateFrom) {
        dateFilter = new Date(dateFrom);
      }

      // Build query with filters
      let logsQuery = supabase
        .from('agent_logs')
        .select('*')
        .gte('created_at', dateFilter.toISOString())
        .order('created_at', { ascending: false })
        .limit(200);

      // Add agent filter if not 'all'
      if (filterAgent !== 'all') {
        logsQuery = logsQuery.eq('agent_id', filterAgent);
      }

      // Add level filter if not 'all'
      if (filterLevel !== 'all') {
        logsQuery = logsQuery.or(`log_level.eq.${filterLevel},level.eq.${filterLevel}`);
      }

      const { data: logsData } = await logsQuery;

      if (logsData) {
        const agentNames: Record<string, string> = {
          athena: 'Athena', monitor: 'Monitor', analyst: 'Analyst',
          triage: 'Triage', coordinator: 'Coordinator', executor: 'Executor'
        };

        const transformedLogs: AgentLog[] = logsData.map((l: any) => ({
          id: l.id,
          agent_id: l.agent_id,
          agent_name: agentNames[l.agent_id] || l.agent_id,
          level: l.log_level,
          message: l.message,
          timestamp: l.created_at,
          metadata: l.metadata,
        }));

        setLogs(transformedLogs);
      }
    } catch (err) {
      console.error('Error fetching tasks/logs:', err);
    }
  }

  // Update last refresh after tasks are fetched
  useEffect(() => {
    if (tasks.length > 0 || logs.length > 0) {
      setLastRefresh(new Date());
    }
  }, [tasks, logs]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'online':
        return <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
          Online
        </span>;
      case 'busy':
        return <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-xs font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse"></span>
          Busy
        </span>;
      case 'error':
        return <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium">
          <XCircle className="w-3 h-3" /> Error
        </span>;
      default:
        return <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
          Offline
        </span>;
    }
  };

  const getTaskIcon = (type: string) => {
    switch (type) {
      case 'chat': return <MessageSquare className="w-4 h-4 text-violet-500" />;
      case 'alert': return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'analysis': return <Cpu className="w-4 h-4 text-blue-500" />;
      case 'triage': return <Filter className="w-4 h-4 text-pink-500" />;
      case 'route': return <Network className="w-4 h-4 text-orange-500" />;
      case 'execute': return <Zap className="w-4 h-4 text-amber-500" />;
      case 'summarize': return <Bot className="w-4 h-4 text-purple-500" />;
      case 'forecast': return <Activity className="w-4 h-4 text-cyan-500" />;
      default: return <Bot className="w-4 h-4 text-slate-400" />;
    }
  };

  const getTaskStatus = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'running': return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  const getLogLevelBadge = (level: string) => {
    switch (level) {
      case 'info': return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">INFO</span>;
      case 'warn': return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-100 text-yellow-700">WARN</span>;
      case 'error': return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700">ERROR</span>;
      case 'debug': return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">DEBUG</span>;
      default: return null;
    }
  };

  const formatTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDateTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    if (showFullDate) {
      return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    }
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const exportLogsToCSV = () => {
    const headers = ['Timestamp', 'Agent', 'Level', 'Message'];
    const rows = filteredLogs.map(log => [
      new Date(log.timestamp || log.created_at).toISOString(),
      log.agent_id || log.agent_name,
      log.level,
      log.message.replace(/"/g, '""') // Escape quotes
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredTasks = tasks.filter(t => filterStatus === 'all' || t.status === filterStatus);
  const filteredLogs = logs.filter(l => {
  // Level filter
  if (filterLevel !== 'all' && l.level !== filterLevel) return false;
  
  // Agent filter
  if (filterAgent !== 'all' && l.agent_id !== filterAgent) return false;
  
  // Date filter (client-side backup)
  if (dateFrom) {
    const logDate = new Date(l.timestamp || l.created_at);
    if (logDate < new Date(dateFrom)) return false;
  }
  if (dateTo) {
    const logDate = new Date(l.timestamp || l.created_at);
    if (logDate > new Date(dateTo)) return false;
  }
  
  return true;
});

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-3 border-violet-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Bot className="w-5 h-5 text-violet-600" />
            AI Agent Orchestration
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Monitor and manage CyberQuote AI agents
            <span className="ml-2 text-xs">Last updated: {formatTime(lastRefresh.toISOString())}</span>
          </p>
        </div>
        <button
          onClick={fetchAgentData}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <RefreshCw className="w-5 h-5 text-slate-500" />
        </button>
      </div>

      {/* Metrics Cards - Use stats from DB */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          icon={<Activity className="w-5 h-5" />}
          label="Tasks Today"
          value={(stats.total_tasks_today || 0).toLocaleString()}
          subtext={`${stats.total_completed || 0} completed`}
          color="text-violet-600"
        />
        <MetricCard
          icon={<Clock className="w-5 h-5" />}
          label="Avg Response"
          value={`${(calculatedMetrics?.avg_uptime || 100).toFixed(1)}%`}
          subtext="System uptime"
          color="text-blue-600"
        />
        <MetricCard
          icon={<Bot className="w-5 h-5" />}
          label="Coordinator"
          value={calculatedMetrics?.coordinator_up ? 'Online' : 'Offline'}
          subtext={`${(calculatedMetrics?.avg_uptime || 100).toFixed(1)}% uptime`}
          color={calculatedMetrics?.coordinator_up ? "text-green-600" : "text-red-600"}
        />
        <MetricCard
          icon={<AlertCircle className="w-5 h-5" />}
          label="Failed Tasks"
          value={(stats.total_failed || 0).toString()}
          subtext={`${stats.total_tasks_today > 0 ? ((stats.total_failed / stats.total_tasks_today) * 100).toFixed(1) : 0}% error rate`}
          color={stats.total_failed > 0 ? "text-red-600" : "text-slate-600"}
        />
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-6">
          {[
            { id: 'overview', label: 'Overview', icon: <Bot className="w-4 h-4" /> },
            { id: 'tasks', label: 'Task Pipeline', icon: <Activity className="w-4 h-4" /> },
            { id: 'logs', label: 'Logs', icon: <MessageSquare className="w-4 h-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors",
                activeTab === tab.id
                  ? "border-violet-600 text-violet-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Agent Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent) => {
              // Calculate agent stats from DB
              const agentTasks = tasks.filter(t => t.agent_id === agent.id);
              const agentCompleted = agentTasks.filter(t => t.status === 'completed').length;
              const agentRunning = agentTasks.filter(t => t.status === 'running').length;
              const agentPending = stats.agentPendingCounts[agent.id] || 0;
              const avgDuration = agentTasks
                .filter(t => t.duration_ms)
                .reduce((sum, t) => sum + (t.duration_ms || 0), 0) / (agentTasks.filter(t => t.duration_ms).length || 1);
              
              return (
              <div
                key={agent.id}
                onClick={() => setSelectedAgent(agent)}
                className={cn(
                  "rounded-xl border p-5 bg-gradient-to-br cursor-pointer transition-all hover:shadow-lg",
                  agent.status === 'online' || agent.status === 'busy'
                    ? "border-slate-200 hover:border-violet-300"
                    : "border-slate-200 opacity-60"
                )}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center text-white",
                    `bg-gradient-to-br ${agentColors[agent.id] || 'from-slate-500 to-slate-600'}`
                  )}>
                    {agentIcons[agent.id] || <Bot className="w-6 h-6" />}
                  </div>
                  {getStatusBadge(agent.status)}
                </div>
                
                <h3 className="font-semibold text-slate-900">{agent.name}</h3>
                <p className="text-xs text-slate-500 mb-3">{agent.role}</p>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tasks today</span>
                    <span className="font-medium">{agentCompleted}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Response time</span>
                    <span className="font-medium">{Math.round(avgDuration)}ms</span>
                  </div>
                  {agentPending > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Queue</span>
                      <span className="font-medium text-orange-600">{agentPending} pending</span>
                    </div>
                  )}
                  {agentRunning > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Running</span>
                      <span className="font-medium text-blue-600">{agentRunning} active</span>
                    </div>
                  )}
                </div>
              </div>
              );
            })}
          </div>

          {/* Quick Stats */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Recent Activity */}
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-green-500" />
                Recent Activity
              </h3>
              <div className="space-y-3">
                {tasks.slice(0, 5).map((task) => (
                  <div key={task.id} className="flex items-center gap-3 text-sm">
                    {getTaskIcon(task.task_type)}
                    <div className="flex-1 min-w-0">
                      <p className="truncate">{task.task_type} • {getAgentName(task.agent_id)}</p>
                      <p className="text-xs text-slate-500">{formatTime(task.created_at)}</p>
                    </div>
                    {getTaskStatus(task.status)}
                  </div>
                ))}
              </div>
            </div>

            {/* System Health */}
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                System Health
              </h3>
              <div className="space-y-4">
                <HealthBar label="API Response" value={98} />
                <HealthBar label="Database" value={99} />
                <HealthBar label="Edge Functions" value={100} />
                <HealthBar label="AI Models" value={97} />
                <HealthBar label="WebSocket" value={99} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tasks Tab */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4 items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search tasks..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm bg-white"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {/* Task Timeline */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500 border-b">
                  <tr>
                    <th className="px-4 py-3">Task</th>
                    <th className="px-4 py-3">Agent</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Started</th>
                    <th className="px-4 py-3">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTasks.map((task) => (
                    <tr key={task.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {getTaskIcon(task.task_type)}
                          <span className="font-medium">{task.task_type}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-xs font-medium",
                          task.agent_id === 'athena' ? "bg-violet-100 text-violet-700" :
                          task.agent_id === 'monitor' ? "bg-green-100 text-green-700" :
                          "bg-slate-100 text-slate-700"
                        )}>
                          {getAgentName(task.agent_id)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {getTaskStatus(task.status)}
                          <span className="capitalize">{task.status}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {task.started_at ? formatTime(task.started_at) : '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {task.duration_ms ? formatDuration(task.duration_ms) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-slate-50 rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h3 className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Filters
              </h3>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Date Range Filter */}
                <select
                  value={filterDateRange}
                  onChange={(e) => {
                    setFilterDateRange(e.target.value);
                    setIsCustomDate(e.target.value === 'custom');
                    if (e.target.value === 'today') {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      setDateFrom(today.toISOString());
                      setDateTo(new Date().toISOString());
                    } else if (e.target.value === '24hours') {
                      const day = new Date();
                      day.setHours(day.getHours() - 24);
                      setDateFrom(day.toISOString());
                      setDateTo(new Date().toISOString());
                    } else if (e.target.value === '7days') {
                                const week = new Date();
                                week.setDate(week.getDate() - 7);
                                setDateFrom(week.toISOString());
                                setDateTo(new Date().toISOString());
                              } else if (e.target.value === '30days') {
                                const month = new Date();
                                month.setDate(month.getDate() - 30);
                                setDateFrom(month.toISOString());
                                setDateTo(new Date().toISOString());
                              }
                  }}
                  className="text-xs px-2 py-1.5 border border-slate-200 rounded-md bg-white"
                >
                  <option value="today">Today</option>
                          <option value="24hours">Last 24 Hours</option>
                          <option value="7days">Last 7 Days</option>
                          <option value="30days" selected>Last 30 Days</option>
                          <option value="custom">Custom Range</option>
                </select>

                {/* Agent Filter */}
                <select
                  value={filterAgent}
                  onChange={(e) => setFilterAgent(e.target.value)}
                  className="text-xs px-2 py-1.5 border border-slate-200 rounded-md bg-white"
                >
                  <option value="all">All Agents</option>
                  <option value="monitor">Monitor</option>
                  <option value="analyst">Analyst</option>
                  <option value="coordinator">Coordinator</option>
                  <option value="triage">Triage</option>
                  <option value="executor">Executor</option>
                  <option value="athena">Athena</option>
                </select>

                {/* Level Filter */}
                <select
                  value={filterLevel}
                  onChange={(e) => setFilterLevel(e.target.value)}
                  className="text-xs px-2 py-1.5 border border-slate-200 rounded-md bg-white"
                >
                  <option value="all">All Levels</option>
                  <option value="info">INFO</option>
                  <option value="warn">WARN</option>
                  <option value="error">ERROR</option>
                  <option value="debug">DEBUG</option>
                </select>

                {/* Show Date Toggle */}
                <button
                  onClick={() => setShowFullDate(!showFullDate)}
                  className="text-xs px-2 py-1.5 border border-slate-200 rounded-md bg-white hover:bg-slate-50"
                  title={showFullDate ? "Hide full date" : "Show full date"}
                >
                  {showFullDate ? "Hide Date" : "Show Date"}
                </button>

                {/* Export CSV */}
                <button
                  onClick={exportLogsToCSV}
                  className="text-xs px-2 py-1.5 border border-slate-200 rounded-md bg-white hover:bg-slate-50 flex items-center gap-1"
                  title="Export filtered logs to CSV"
                >
                  <Download className="w-3 h-3" />
                  Export CSV
                </button>

                {/* Clear Filters */}
                {(filterAgent !== 'all' || filterLevel !== 'all' || filterDateRange !== 'today') && (
                  <button
                    onClick={() => {
                      setFilterAgent('all');
                      setFilterLevel('all');
                      setFilterDateRange('today');
                      setIsCustomDate(false);
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      setDateFrom(today.toISOString());
                      setDateTo(new Date().toISOString());
                    }}
                    className="text-xs px-2 py-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>

            {/* Custom Date Range Inputs */}
            {isCustomDate && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500">From:</label>
                <input
                  type="datetime-local"
                  value={dateFrom ? dateFrom.slice(0, 16) : ''}
                  onChange={(e) => setDateFrom(new Date(e.target.value).toISOString())}
                  className="text-xs px-2 py-1.5 border border-slate-200 rounded-md"
                />
                <label className="text-xs text-slate-500">To:</label>
                <input
                  type="datetime-local"
                  value={dateTo ? dateTo.slice(0, 16) : ''}
                  onChange={(e) => setDateTo(new Date(e.target.value).toISOString())}
                  className="text-xs px-2 py-1.5 border border-slate-200 rounded-md"
                />
              </div>
            )}
          </div>

          {/* Log Stream */}
          <div className="bg-slate-900 rounded-xl p-4 font-mono text-sm overflow-x-auto">
            <div className="space-y-2">
              {filteredLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 text-slate-300">
                  <span className="text-slate-500 shrink-0">{formatDateTime(log.timestamp)}</span>
                  <span className={cn(
                    "shrink-0",
                    log.level === 'error' ? 'text-red-400' :
                    log.level === 'warn' ? 'text-yellow-400' :
                    log.level === 'debug' ? 'text-slate-500' : 'text-blue-400'
                  )}>
                    {getLogLevelBadge(log.level)}
                  </span>
                  <span className={cn(
                    "shrink-0 px-1.5 py-0.5 rounded text-xs",
                    `bg-gradient-to-br ${agentColors[log.agent_id] || 'from-slate-500 to-slate-600'} text-white`
                  )}>
                    {log.agent_name}
                  </span>
                  <span className="text-slate-400">{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Agent Detail Modal */}
      {selectedAgent && (
        <AgentDetailModal
          agent={selectedAgent}
          tasks={tasks.filter(t => t.agent_id === selectedAgent.id)}
          onClose={() => setSelectedAgent(null)}
          getStatusBadge={getStatusBadge}
          getTaskIcon={getTaskIcon}
          getTaskStatus={getTaskStatus}
          formatTime={formatTime}
          formatDuration={formatDuration}
        />
      )}
    </div>
  );
}

// Sub-components
function MetricCard({ icon, label, value, subtext, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className={cn("p-2 rounded-lg bg-slate-100", color)}>
          {icon}
        </div>
        <span className="text-sm text-slate-500">{label}</span>
      </div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <p className="text-xs text-slate-500 mt-1">{subtext}</p>
    </div>
  );
}

function HealthBar({ label, value }: { label: string; value: number }) {
  const color = value >= 95 ? 'bg-green-500' : value >= 80 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium">{value}%</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${value}%` }}></div>
      </div>
    </div>
  );
}

function AgentDetailModal({
  agent,
  tasks,
  onClose,
  getStatusBadge,
  getTaskIcon,
  getTaskStatus,
  formatTime,
  formatDuration,
}: {
  agent: Agent;
  tasks: AgentTask[];
  onClose: () => void;
  getStatusBadge: (s: string) => React.ReactNode;
  getTaskIcon: (t: string) => React.ReactNode;
  getTaskStatus: (s: string) => React.ReactNode;
  formatTime: (d: string | null | undefined) => string;
  formatDuration: (ms: number) => string;
}) {
  // Calculate real stats from tasks
  const pendingCount = tasks.filter(t => t.status === 'pending').length;
  const runningCount = tasks.filter(t => t.status === 'running').length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const failedCount = tasks.filter(t => t.status === 'failed').length;
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={cn(
          "p-6 text-white bg-gradient-to-br",
          agentColors[agent.id] || 'from-slate-500 to-slate-600'
        )}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center">
                {agentIcons[agent.id] || <Bot className="w-8 h-8" />}
              </div>
              <div>
                <h2 className="text-xl font-bold">{agent.name}</h2>
                <p className="text-white/80">{agent.role}</p>
                <div className="mt-2">{getStatusBadge(agent.status)}</div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-slate-900">{tasks.length}</p>
              <p className="text-xs text-slate-500">Tasks Today</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-slate-900">{completedCount}</p>
              <p className="text-xs text-slate-500">Completed</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-slate-900">{pendingCount + runningCount}</p>
              <p className="text-xs text-slate-500">Pending/Running</p>
            </div>
          </div>

          {/* Description */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-2">Description</h3>
            <p className="text-sm text-slate-600">{agent.description}</p>
          </div>

          {/* Agent Stats */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-2">Performance</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-lg font-bold text-green-700">{agent.uptime_percent.toFixed(1)}%</p>
                <p className="text-xs text-green-600">Uptime (24h)</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3">
                <p className="text-lg font-bold text-red-700">{failedCount}</p>
                <p className="text-xs text-red-600">Failed Tasks</p>
              </div>
            </div>
          </div>

          {/* Capabilities */}
          {agent.capabilities && agent.capabilities.length > 0 && (
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Capabilities</h3>
              <div className="flex flex-wrap gap-2">
                {(agent.capabilities as string[]).map((cap: string, idx: number) => (
                  <span key={idx} className="px-3 py-1 bg-violet-100 text-violet-700 rounded-full text-xs font-medium">
                    {cap}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recent Tasks */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-3">Recent Tasks</h3>
            <div className="space-y-2">
              {tasks.slice(0, 10).map((task) => (
                <div key={task.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg text-sm">
                  {getTaskIcon(task.task_type)}
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">{task.task_type} • {getAgentName(task.agent_id)}</p>
                    <p className="text-xs text-slate-500">
                      {formatTime(task.created_at)}
                      {task.duration_ms && ` • ${formatDuration(task.duration_ms)}`}
                    </p>
                  </div>
                  {getTaskStatus(task.status)}
                </div>
              ))}
              {tasks.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">No recent tasks</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <button className="flex-1 px-4 py-2.5 bg-violet-600 text-white rounded-xl font-medium hover:bg-violet-700 transition-colors flex items-center justify-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Chat with Agent
            </button>
            <button className="px-4 py-2.5 border rounded-xl font-medium hover:bg-slate-50 transition-colors flex items-center gap-2">
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
