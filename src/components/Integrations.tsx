import React, { useState, useEffect } from 'react';
import { Server, Plug, Database, RefreshCw, Webhook, CheckCircle2, AlertCircle, HardDrive, TerminalSquare, Send, Activity, Info, Zap, Heart, XCircle } from 'lucide-react';
import { Role } from '@/src/types';
import { supabase, EDGE_FUNCTIONS_URL } from '@/src/lib/supabase';

type IntegrationType = 'MCP' | 'Webhook' | 'Kafka' | 'PostgreSQL' | 'VectorDB';

interface Integration {
  id: number;
  name: string;
  type: IntegrationType;
  url: string;
  status: 'Connected' | 'Live' | 'Synced' | 'Degraded' | 'Offline';
  last_sync: string;
  details: string;
  config?: any;
}

export function Integrations({ activeRole }: { activeRole: Role }) {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'simulator'>('overview');
  
  // Add modal form state
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<IntegrationType>('MCP');
  const [newUrl, setNewUrl] = useState('');
  const [newTools, setNewTools] = useState('');
  const [newDetails, setNewDetails] = useState('');

  // Simulator state
  const [simLogs, setSimLogs] = useState<string[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);

  // Health check state
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [showHealthModal, setShowHealthModal] = useState(false);

  useEffect(() => {
    fetchIntegrations();
  }, []);

  async function fetchIntegrations() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .order('name');
      
      if (error) throw error;
      
      const transformed = (data || []).map((i: any) => ({
        ...i,
        last_sync: i.last_sync ? new Date(i.last_sync).toLocaleString() : 'Never'
      }));
      setIntegrations(transformed);
    } catch (err) {
      console.error('Error fetching integrations:', err);
      setIntegrations([]);
    } finally {
      setLoading(false);
    }
  }

  const handleAddIntegration = async (e: React.FormEvent) => {
    e.preventDefault();
    const newIntegration = {
      name: newName,
      type: newType,
      url: newUrl,
      status: 'Connected' as const,
      details: newDetails || 'Newly added integration',
      config: newType === 'MCP' && newTools ? { tools: newTools.split(',').map(t => t.trim()).filter(t => t) } : {}
    };
    
    try {
      const { error } = await supabase.from('integrations').insert(newIntegration);
      if (!error) {
        await fetchIntegrations();
        setShowAddModal(false);
        setNewName('');
        setNewUrl('');
        setNewTools('');
        setNewDetails('');
        setNewType('MCP');
      }
    } catch (err) {
      console.error('Error adding integration:', err);
    }
  };

  const handleSimulateWebhook = (type: 'pos' | 'inventory') => {
    setIsSimulating(true);
    const newLogs = [
      `[${new Date().toLocaleTimeString()}] INFO: Triggering ${type.toUpperCase()} Webhook...`,
      `[${new Date().toLocaleTimeString()}] HTTP POST /api/v1/webhooks/${type}`
    ];
    setSimLogs(prev => [...prev, ...newLogs]);

    setTimeout(() => {
      setSimLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] SUCCESS: Payload validated by Ingestion Service.`,
        `[${new Date().toLocaleTimeString()}] INFO: Pushing to Kafka Topic '${type}.events.live'...`
      ]);
    }, 800);

    setTimeout(() => {
      setSimLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] SUCCESS: Data persisted to PostgreSQL ODS (table: ${type === 'pos' ? 'sales_transactions' : 'inventory_snapshots'}).`,
        `[${new Date().toLocaleTimeString()}] INFO: Updating Materialized Views (sales_hourly_agg, ml_features)...`,
        `[${new Date().toLocaleTimeString()}] DONE: Pipeline execution completed.`
      ]);
      setIsSimulating(false);
    }, 2000);
  };

  // Health check all connectors
  const handleHealthCheck = async () => {
    setIsCheckingHealth(true);
    setShowHealthModal(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const response = await fetch(`${EDGE_FUNCTIONS_URL}/connector-test`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setHealthStatus(data);
      } else {
        setHealthStatus({
          overall: "error",
          summary: { total: 0, healthy: 0, degraded: 0, offline: 0 },
          connectors: [],
          error: `HTTP ${response.status}`
        });
      }
    } catch (err) {
      console.error('Health check error:', err);
      setHealthStatus({
        overall: "error",
        summary: { total: 0, healthy: 0, degraded: 0, offline: 0 },
        connectors: [],
        error: err.message
      });
    } finally {
      setIsCheckingHealth(false);
    }
  };

  const mcpIntegrations = integrations.filter(i => i.type === 'MCP');
  const dataIntegrations = integrations.filter(i => i.type !== 'MCP');

  if (activeRole === "Franchisee") {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <Plug className="w-12 h-12 text-slate-300 mb-4" />
        <h2 className="text-lg font-semibold text-slate-900 mb-2">System Integrations</h2>
        <p className="text-sm text-slate-500 max-w-sm">
          System integration management is restricted to Regional or HQ administrators.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-3 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  const getIconForType = (type: IntegrationType) => {
    switch (type) {
      case 'MCP': return <Server className="w-5 h-5" />;
      case 'Webhook': return <Webhook className="w-5 h-5" />;
      case 'Kafka': return <RefreshCw className="w-5 h-5" />;
      case 'PostgreSQL': return <Database className="w-5 h-5" />;
      case 'VectorDB': return <HardDrive className="w-5 h-5" />;
      default: return <Server className="w-5 h-5" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Connected':
      case 'Live':
      case 'Synced':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'Degraded':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">System Integrations</h2>
          <p className="text-sm text-slate-500 mt-1">Manage external systems, data pipelines, and MCP servers</p>
        </div>
        <div className="flex items-center gap-3">
           <div className="flex bg-slate-100 p-1 rounded-lg">
             <button
               onClick={() => setActiveTab('overview')}
               className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === 'overview' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
             >
               Overview ({integrations.length})
             </button>
             <button
               onClick={() => setActiveTab('simulator')}
               className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${activeTab === 'simulator' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
             >
               <TerminalSquare className="w-3.5 h-3.5" /> Ingestion Simulator
             </button>
           </div>
           <button
             onClick={handleHealthCheck}
             disabled={isCheckingHealth}
             className="rounded-md px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-medium transition-all flex items-center gap-2 shadow-sm"
           >
             <Heart className="w-4 h-4" /> {isCheckingHealth ? 'Checking...' : 'Health Check'}
           </button>
           <button
             onClick={() => setShowAddModal(true)}
             className="rounded-md px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-all flex items-center gap-2 shadow-sm"
           >
             <Plug className="w-4 h-4" /> Add Integration
           </button>
        </div>
      </div>

      {activeTab === 'overview' ? (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* MCP Servers */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Server className="w-4 h-4 text-blue-600" /> Model Context Protocol (MCP) Servers
              </h3>
              <span className="text-xs font-medium text-slate-500">{mcpIntegrations.length} Active</span>
            </div>

            <div className="space-y-4 flex-1 overflow-y-auto max-h-[600px] pr-2">
              {mcpIntegrations.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Server className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm">No MCP servers configured</p>
                </div>
              ) : (
                mcpIntegrations.map((mcp) => (
                  <div key={mcp.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 relative overflow-hidden group">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700">
                          <Server className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-slate-900 text-sm">{mcp.name}</h4>
                          <p className="text-xs text-slate-500">{mcp.details}</p>
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-medium uppercase tracking-wider ${getStatusColor(mcp.status)}`}>
                        {mcp.status === 'Connected' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />} {mcp.status}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Endpoint URL</span>
                        <span className="text-blue-600 font-mono bg-blue-50 px-2 py-0.5 rounded truncate max-w-[200px]">{mcp.url}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Last Sync</span>
                        <span className="text-slate-700 font-medium">{mcp.last_sync}</span>
                      </div>
                      {mcp.config?.tools && mcp.config.tools.length > 0 && (
                        <div className="flex flex-col gap-1 mt-3 pt-3 border-t border-slate-200">
                          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Exposed Tools</span>
                          <div className="flex flex-wrap gap-1.5">
                            {mcp.config.tools.map((tool: string, idx: number) => (
                              <span key={idx} className="text-[10px] font-mono text-slate-600 bg-white px-2 py-1 rounded-md border border-slate-200">{tool}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Core Data Platform */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Database className="w-4 h-4 text-blue-600" /> Core Data & Ingestion Pipelines
              </h3>
              <span className="text-xs font-medium text-slate-500">{dataIntegrations.length} Pipelines</span>
            </div>
            
            <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px] pr-2">
              {dataIntegrations.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Database className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm">No data pipelines configured</p>
                </div>
              ) : (
                dataIntegrations.map((integration) => (
                  <div key={integration.id} className={`flex items-center justify-between p-4 rounded-xl border ${integration.status === 'Degraded' ? 'border-orange-200 bg-orange-50/30' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${integration.status === 'Degraded' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                        {getIconForType(integration.type)}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">{integration.name}</h4>
                        <p className="text-xs text-slate-500">{integration.type}: <span className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200 ml-1 truncate max-w-[150px] inline-block align-bottom">{integration.url}</span></p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-medium uppercase tracking-wider mb-1 ${getStatusColor(integration.status)}`}>
                        {integration.status}
                      </span>
                      <p className={`text-[10px] ${integration.status === 'Degraded' ? 'text-orange-600' : 'text-slate-500'}`}>{integration.details}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
           <div className="space-y-6">
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                 <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <Webhook className="w-4 h-4 text-blue-600" /> Near Real-time Webhooks (POS)
                 </h3>
                 <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                    Source systems like Point of Sales (POS) push transactional data to the platform in near real-time via REST Webhooks.
                 </p>
                 <div className="mt-4 flex justify-end">
                    <button 
                       onClick={() => handleSimulateWebhook('pos')}
                       disabled={isSimulating}
                       className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-medium rounded-md flex items-center gap-2"
                    >
                       <Send className="w-3.5 h-3.5" /> Send Mock POS Payload
                    </button>
                 </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                 <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-blue-600" /> Batch Processing (Inventory)
                 </h3>
                 <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                    Heavy operations like daily inventory snapshots are pulled or received via batch ingestion jobs.
                 </p>
                 <div className="mt-4 flex justify-end">
                    <button 
                       onClick={() => handleSimulateWebhook('inventory')}
                       disabled={isSimulating}
                       className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-medium rounded-md flex items-center gap-2"
                    >
                       <Send className="w-3.5 h-3.5" /> Trigger Inventory Batch
                    </button>
                 </div>
              </div>
           </div>

           <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-xl flex flex-col h-[700px]">
              <div className="flex items-center justify-between mb-4 border-b border-slate-700 pb-4">
                 <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                    <TerminalSquare className="w-4 h-4 text-green-400" /> Ingestion Pipeline Logs
                 </h3>
                 {isSimulating && <Activity className="w-4 h-4 text-green-400 animate-pulse" />}
              </div>
              <div className="flex-1 overflow-y-auto font-mono text-[11px] text-slate-300 space-y-1.5 custom-scrollbar">
                 {simLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-50 space-y-3">
                       <Database className="w-8 h-8" />
                       <p>Waiting for incoming data streams...</p>
                    </div>
                 ) : (
                    simLogs.map((log, idx) => (
                       <div key={idx} className={`${log.includes('SUCCESS') ? 'text-green-400' : log.includes('ERROR') ? 'text-red-400' : 'text-slate-300'}`}>
                          {log}
                       </div>
                    ))
                 )}
              </div>
           </div>
        </div>
      )}

      {/* Health Check Modal */}
      {showHealthModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${healthStatus?.overall === 'healthy' ? 'bg-green-500 animate-pulse' : healthStatus?.overall === 'degraded' ? 'bg-orange-500' : 'bg-red-500'}`}></div>
                <h3 className="text-lg font-semibold text-slate-900">Connector Health Check</h3>
                {healthStatus?.overall && (
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    healthStatus.overall === 'healthy' ? 'bg-green-100 text-green-700' :
                    healthStatus.overall === 'degraded' ? 'bg-orange-100 text-orange-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {healthStatus.overall.toUpperCase()}
                  </span>
                )}
              </div>
              <button onClick={() => setShowHealthModal(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {isCheckingHealth ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mb-4"></div>
                  <p className="text-slate-600">Checking all connectors...</p>
                </div>
              ) : healthStatus?.error ? (
                <div className="text-center py-8 text-red-600">
                  <XCircle className="w-12 h-12 mx-auto mb-4" />
                  <p className="font-medium">Connection Failed</p>
                  <p className="text-sm text-red-500 mt-2">{healthStatus.error}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {healthStatus?.connectors?.map((connector: any, idx: number) => (
                    <div key={idx} className={`p-4 rounded-lg border ${
                      connector.status === 'healthy' ? 'border-green-200 bg-green-50/50' :
                      connector.status === 'degraded' ? 'border-orange-200 bg-orange-50/50' :
                      'border-red-200 bg-red-50/50'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          {connector.status === 'healthy' ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                          ) : connector.status === 'degraded' ? (
                            <AlertCircle className="w-5 h-5 text-orange-600" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-600" />
                          )}
                          <div>
                            <p className="font-medium text-slate-900 text-sm">{connector.name}</p>
                            <p className="text-xs text-slate-500">{connector.type}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs font-medium ${
                            connector.status === 'healthy' ? 'text-green-600' :
                            connector.status === 'degraded' ? 'text-orange-600' :
                            'text-red-600'
                          }`}>
                            {connector.status.toUpperCase()}
                          </span>
                          <p className="text-xs text-slate-400 mt-1">{connector.latency_ms}ms</p>
                        </div>
                      </div>
                      <p className="text-sm text-slate-600 pl-8">{connector.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-green-500" /> {healthStatus?.summary?.healthy || 0} Healthy
                </span>
                <span className="flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-orange-500" /> {healthStatus?.summary?.degraded || 0} Degraded
                </span>
                <span className="flex items-center gap-1.5">
                  <XCircle className="w-4 h-4 text-red-500" /> {healthStatus?.summary?.offline || 0} Offline
                </span>
              </div>
              <button
                onClick={handleHealthCheck}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-md flex items-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Integration Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Add Integration</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
            </div>
            <form onSubmit={handleAddIntegration} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Integration Name</label>
                <input 
                  type="text" 
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g. Regional POS System"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Integration Type</label>
                <select 
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as IntegrationType)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                >
                  <option value="MCP">Model Context Protocol (MCP)</option>
                  <option value="Webhook">Webhook Endpoint</option>
                  <option value="Kafka">Kafka Topic</option>
                  <option value="PostgreSQL">PostgreSQL DB</option>
                  <option value="VectorDB">Vector Database</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Connection URL / URI</label>
                <input 
                  type="text" 
                  required
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono"
                  placeholder="https://..."
                />
              </div>
              {newType === 'MCP' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Exposed Tools (Comma separated)</label>
                  <input 
                    type="text" 
                    value={newTools}
                    onChange={(e) => setNewTools(e.target.value)}
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono"
                    placeholder="e.g. get_inventory, update_price"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <input 
                  type="text" 
                  value={newDetails}
                  onChange={(e) => setNewDetails(e.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="Brief description of this integration"
                />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md shadow-sm"
                >
                  Save Integration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
