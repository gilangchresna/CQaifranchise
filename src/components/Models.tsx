import React, { useState, useEffect } from 'react';
import { BrainCircuit, Database, Plus, Search, CheckCircle2, AlertCircle, X, Network, TerminalSquare, Play, Activity, TrendingDown } from 'lucide-react';
import { Role } from '@/src/types';
import { supabase } from '@/src/lib/supabase';

interface ModelsProps {
  activeRole: Role;
}

type ModelType = 'LLM' | 'Prediction' | 'Classification' | 'Embedding';
type ModelStatus = 'Production' | 'Evaluation' | 'Sandbox' | 'Offline';

interface Model {
  id: number;
  model_name: string;
  version: string;
  model_type: string;
  description: string;
  metrics: { accuracy?: number; precision?: number; recall?: number; mape?: number } | null;
  is_production: boolean;
  trained_at: string;
}

function mapModelStatus(isProduction: boolean): ModelStatus {
  return isProduction ? 'Production' : 'Evaluation';
}

function mapModelType(type: string): ModelType {
  switch (type) {
    case 'ANOMALY_DETECTION': return 'Prediction';
    case 'STOCKOUT_PREDICTION': return 'Prediction';
    case 'DEMAND_FORECASTING': return 'Prediction';
    case 'CHURN_PREDICTION': return 'Classification';
    default: return 'LLM';
  }
}

function formatMetrics(metrics: { accuracy?: number; precision?: number; recall?: number; mape?: number } | null): string {
  if (!metrics) return 'N/A';
  if (metrics.accuracy) return `Accuracy: ${(metrics.accuracy * 100).toFixed(0)}%`;
  if (metrics.precision) return `Precision: ${(metrics.precision * 100).toFixed(0)}%`;
  if (metrics.recall) return `Recall: ${(metrics.recall * 100).toFixed(0)}%`;
  if (metrics.mape) return `MAPE: ${(metrics.mape * 100).toFixed(1)}%`;
  return 'N/A';
}

export function Models({ activeRole }: ModelsProps) {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<'registry' | 'simulator'>('registry');
  
  // Form state
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<ModelType>('Prediction');
  const [newVersion, setNewVersion] = useState('');
  const [newProvider, setNewProvider] = useState('');

  // Simulator state
  const [simLogs, setSimLogs] = useState<string[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);

  useEffect(() => {
    fetchModels();
  }, []);

  async function fetchModels() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ml_model_versions')
        .select('*')
        .order('model_name');
      
      if (error) throw error;
      
      // Map data to UI format
      const mappedModels: Model[] = (data || []).map(m => ({
        id: m.id,
        model_name: m.model_name,
        version: m.version,
        model_type: m.model_type,
        description: m.description || '',
        metrics: m.metrics,
        is_production: m.is_production,
        trained_at: m.trained_at,
      }));
      
      setModels(mappedModels);
    } catch (err) {
      console.error('Error fetching models:', err);
      setModels([]);
    } finally {
      setLoading(false);
    }
  }

  if (activeRole === "Franchisee") {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <BrainCircuit className="w-12 h-12 text-slate-300 mb-4" />
        <h2 className="text-lg font-semibold text-slate-900 mb-2">ML Model Management Restricted</h2>
        <p className="text-sm text-slate-500 max-w-sm">
          You do not have permission to manage the global ML model registry.
        </p>
      </div>
    );
  }

  const handleAddModel = async () => {
    if (!newName || !newVersion) return;
    
    const newModel = {
      name: newName,
      type: newType,
      version: newVersion,
      provider: newProvider || 'Custom / Internal',
      status: 'Sandbox',
      metrics: 'Pending Eval'
    };
    
    try {
      const { error } = await supabase.from('ml_models').insert(newModel);
      if (!error) {
        await fetchModels();
        setShowAddModal(false);
        setNewName('');
        setNewVersion('');
        setNewProvider('');
        setNewType('Prediction');
      }
    } catch (err) {
      console.error('Error adding model:', err);
    }
  };

  const handleSimulateModel = (modelId: number) => {
    setIsSimulating(true);
    const model = models.find(m => m.id === modelId);
    
    if (modelId === 1 || modelId === 2) {
      const newLogs = [
        `[${new Date().toLocaleTimeString()}] INFO: Starting Inference [${model?.model_name}]`,
        `[${new Date().toLocaleTimeString()}] Fetching recent 1hr sales window from Feature Store...`,
      ];
      setSimLogs(prev => [...prev, ...newLogs]);

      setTimeout(() => {
        setSimLogs(prev => [
          ...prev, 
          `[${new Date().toLocaleTimeString()}] Analyzing Outlet "Surabaya Central (089)"...`,
          `[${new Date().toLocaleTimeString()}] Expected: $1,200 | Actual: $1,050`,
          `[${new Date().toLocaleTimeString()}] WARN: Deviation detected (-12.5%). Threshold: 10%.`,
        ]);
      }, 1000);

      setTimeout(() => {
        setSimLogs(prev => [
          ...prev, 
          `[${new Date().toLocaleTimeString()}] ALERT GENERATED: type="SALES_ANOMALY" severity="Medium"`,
          `[${new Date().toLocaleTimeString()}] Dispatching to Workflow Engine (Layer 6)...`,
          `[${new Date().toLocaleTimeString()}] DONE: Inference complete.`
        ]);
        setIsSimulating(false);
      }, 2500);
    }
  };

  const filteredModels = models.filter(m =>
    (m.model_name ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (m.model_type ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: ModelStatus) => {
    switch (status) {
      case 'Production': return 'bg-green-50 text-green-700 border-green-200';
      case 'Evaluation': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Sandbox': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'Offline': return 'bg-slate-50 text-slate-700 border-slate-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getTypeIcon = (type: ModelType) => {
    switch (type) {
      case 'LLM': return <BrainCircuit className="w-5 h-5" />;
      case 'Prediction': return <Network className="w-5 h-5" />;
      case 'Classification': return <Database className="w-5 h-5" />;
      case 'Embedding': return <Network className="w-5 h-5" />;
      default: return <BrainCircuit className="w-5 h-5" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-3 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">ML Model Registry</h2>
          <p className="text-sm text-slate-500 mt-1">Manage AI/ML models, LLM providers, and predictions</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-lg">
             <button
               onClick={() => setActiveTab('registry')}
               className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === 'registry' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
             >
               Registry
             </button>
             <button
               onClick={() => setActiveTab('simulator')}
               className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${activeTab === 'simulator' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
             >
               <TerminalSquare className="w-3.5 h-3.5" /> Inference Simulator
             </button>
           </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="rounded-md px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-all flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Register Model
          </button>
        </div>
      </div>

      {activeTab === 'registry' ? (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search models..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-64 rounded-md border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all shadow-sm"
              />
            </div>
            <span className="text-sm text-slate-500">{filteredModels.length} models</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-semibold">Model Name</th>
                  <th className="px-6 py-4 font-semibold">Type</th>
                  <th className="px-6 py-4 font-semibold">Provider / Backend</th>
                  <th className="px-6 py-4 font-semibold">Version & Metrics</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredModels.map((model) => (
                  <tr key={model.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${mapModelType(model.model_type) === 'LLM' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                          {getTypeIcon(mapModelType(model.model_type))}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{model.model_name}</p>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">ID: {model.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200 uppercase tracking-wider">
                        {mapModelType(model.model_type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-600">
                      {model.description || 'Internal'}
                    </td>
                    <td className="px-6 py-4">
                       <p className="text-xs font-semibold text-slate-800">{model.version}</p>
                       <p className="text-[10px] text-slate-500">{formatMetrics(model.metrics)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-medium uppercase tracking-wider ${getStatusColor(mapModelStatus(model.is_production))}`}>
                        {mapModelStatus(model.is_production) === 'Production' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />} {mapModelStatus(model.is_production)}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredModels.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500 text-sm">
                      No models found matching "{searchQuery}"
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
           <div className="space-y-6">
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                 <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-orange-600" /> Sales Anomaly Detection
                 </h3>
                 <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                    This predictive model analyzes real-time POS data streams from the ODS against historical baselines. It runs constantly, evaluating 1-hour tumbling windows to detect statistically significant sales drop-offs.
                 </p>
                 <div className="mt-4 flex justify-end">
                    <button 
                       onClick={() => handleSimulateModel(1)}
                       disabled={isSimulating}
                       className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-medium rounded-md flex items-center gap-2"
                    >
                       <Play className="w-3.5 h-3.5" /> Trigger Inference Job
                    </button>
                 </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                 <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <Database className="w-4 h-4 text-red-600" /> Stockout Predictor
                 </h3>
                 <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                    Evaluates current inventory levels against dynamic burn rates to predict imminent stockouts before they happen. Critical predictions automatically generate alerts and can optionally trigger MCP automated replenishments.
                 </p>
                 <div className="mt-4 flex justify-end">
                    <button 
                       onClick={() => handleSimulateModel(2)}
                       disabled={isSimulating}
                       className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-medium rounded-md flex items-center gap-2"
                    >
                       <Play className="w-3.5 h-3.5" /> Run Stockout Evaluation
                    </button>
                 </div>
              </div>
           </div>

           {/* Live Terminal Log */}
           <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-xl flex flex-col h-[700px]">
              <div className="flex items-center justify-between mb-4 border-b border-slate-700 pb-4">
                 <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                    <TerminalSquare className="w-4 h-4 text-blue-400" /> Inference Engine Logs
                 </h3>
                 {isSimulating && <Activity className="w-4 h-4 text-blue-400 animate-pulse" />}
              </div>
              <div className="flex-1 overflow-y-auto font-mono text-[11px] text-slate-300 space-y-1.5 custom-scrollbar">
                 {simLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-50 space-y-3">
                       <BrainCircuit className="w-8 h-8" />
                       <p>Ready to run predictive models...</p>
                    </div>
                 ) : (
                    simLogs.map((log, idx) => (
                       <div key={idx} className={`${log.includes('CRITICAL') || log.includes('WARN') ? 'text-orange-400' : log.includes('ALERT') ? 'text-red-400' : log.includes('DONE') ? 'text-green-400' : 'text-slate-300'}`}>
                          {log}
                       </div>
                    ))
                 )}
              </div>
           </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-semibold text-slate-900">Register New Model</h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">Model Use Case / Name</label>
                <input 
                  type="text" 
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Churn Predictor"
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none shadow-sm transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">Model Type</label>
                <select 
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as ModelType)}
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none shadow-sm transition-all"
                >
                  <option value="Prediction">Prediction (Regression / Time Series)</option>
                  <option value="Classification">Classification</option>
                  <option value="LLM">Large Language Model (LLM)</option>
                  <option value="Embedding">Embeddings Model</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">Provider / Framework</label>
                <input 
                  type="text" 
                  value={newProvider}
                  onChange={(e) => setNewProvider(e.target.value)}
                  placeholder="e.g. Vertex AI, PyTorch, Ollama"
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none shadow-sm transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">Version Tag</label>
                <input 
                  type="text" 
                  value={newVersion}
                  onChange={(e) => setNewVersion(e.target.value)}
                  placeholder="e.g. v1.0.0 or gpt-4o"
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none shadow-sm transition-all font-mono"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
              <button 
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleAddModel}
                disabled={!newName || !newVersion}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors shadow-sm"
              >
                Register Model
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
