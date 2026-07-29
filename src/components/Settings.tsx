import React from "react";
import {
  Settings as SettingsIcon,
  Save,
  Server,
  Shield,
  BrainCircuit,
  Database,
  Lock,
} from "lucide-react";

export function Settings() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Platform Settings & Governance</h2>
        <button className="rounded-md px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-all flex items-center gap-2">
          <Save className="w-3 h-3" /> Save Changes
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Agentic AI Config */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-6">
            <BrainCircuit className="w-4 h-4 text-blue-600" /> Agentic AI
            Configuration
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-2">
                Operation Mode
              </label>
              <select defaultValue="Assist (Draft Actions, Require Approval)" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500/50 shadow-sm">
                <option>Inform (Monitoring & Alerts Only)</option>
                <option>
                  Assist (Draft Actions, Require Approval)
                </option>
                <option>Automate (Execute Low-Risk Actions)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-2">
                Action Approval Threshold
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="0"
                  max="100"
                  defaultValue="80"
                  className="flex-1 accent-blue-600"
                />
                <span className="text-sm font-medium text-blue-600">80%</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Actions with AI confidence below this threshold require human
                approval.
              </p>
            </div>
          </div>
        </div>

        {/* Workflow & SLA Settings */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-6">
            <SettingsIcon className="w-4 h-4 text-blue-600" /> Operational Thresholds & SLAs
          </h3>
          <div className="space-y-4">
             <div>
               <label className="text-xs font-semibold text-slate-500 block mb-2">
                 Sales Anomaly Threshold
               </label>
               <div className="flex items-center gap-4">
                 <input
                   type="range"
                   min="0"
                   max="100"
                   defaultValue="15"
                   className="flex-1 accent-blue-600"
                 />
                 <span className="text-sm font-medium text-blue-600">15% Deviation</span>
               </div>
             </div>
             
             <div>
               <label className="text-xs font-semibold text-slate-500 block mb-2">
                 Stockout Risk Threshold
               </label>
               <div className="flex items-center gap-4">
                 <input
                   type="range"
                   min="0"
                   max="100"
                   defaultValue="70"
                   className="flex-1 accent-blue-600"
                 />
                 <span className="text-sm font-medium text-blue-600">&gt; 70% Probability</span>
               </div>
             </div>

             <div className="pt-4 border-t border-slate-200">
                <label className="text-xs font-semibold text-slate-500 block mb-3">
                  SLA Mapping by Severity
                </label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">HIGH Severity (e.g. Critical Stockout)</span>
                    <select className="bg-white border border-slate-200 rounded px-2 py-1 text-xs outline-none focus:border-blue-500">
                      <option>1 Hour</option>
                      <option>4 Hours</option>
                      <option>24 Hours</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">MEDIUM Severity (e.g. Sales Drop)</span>
                    <select defaultValue="24 Hours" className="bg-white border border-slate-200 rounded px-2 py-1 text-xs outline-none focus:border-blue-500">
                      <option>4 Hours</option>
                      <option>24 Hours</option>
                      <option>48 Hours</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">LOW Severity (e.g. Trend Alert)</span>
                    <select defaultValue="72 Hours" className="bg-white border border-slate-200 rounded px-2 py-1 text-xs outline-none focus:border-blue-500">
                      <option>24 Hours</option>
                      <option>48 Hours</option>
                      <option>72 Hours</option>
                    </select>
                  </div>
                </div>
             </div>
          </div>
        </div>

        {/* LLM Gateway Configuration */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-6">
            <BrainCircuit className="w-4 h-4 text-blue-600" /> LLM Gateway & Provider
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-2">
                Primary Model Provider
              </label>
              <select defaultValue="google" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500/50 shadow-sm">
                <option value="google">Google (Gemini 1.5 Pro)</option>
                <option value="openai">OpenAI (GPT-4o)</option>
                <option value="anthropic">Anthropic (Claude 3.5 Sonnet)</option>
                <option value="custom">Custom Endpoint (Ollama / Local)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-2">
                Fallback Strategy
              </label>
              <select defaultValue="auto" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500/50 shadow-sm">
                <option value="auto">Auto-route on Rate Limit (Recommended)</option>
                <option value="strict">Strict (Fail if primary is down)</option>
              </select>
            </div>
             <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <div>
                   <p className="text-sm font-medium text-slate-900">Semantic Caching</p>
                   <p className="text-xs text-slate-500">Cache similar queries to reduce latency & cost.</p>
                </div>
                <div className="w-10 h-5 bg-blue-600 rounded-full relative cursor-pointer">
                   <div className="w-4 h-4 bg-white rounded-full absolute right-0.5 top-0.5 shadow-sm"></div>
                </div>
             </div>
          </div>
        </div>

        {/* Security & Governance */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-6">
            <Shield className="w-4 h-4 text-blue-600" /> Security Guardrails
          </h3>
          <div className="space-y-4">
             <div className="flex items-center justify-between">
                <div>
                   <p className="text-sm font-medium text-slate-900">Agent Action Allowlist</p>
                   <p className="text-xs text-slate-500">Only permitted API paths are executed.</p>
                </div>
                <div className="w-10 h-5 bg-blue-600 rounded-full relative cursor-pointer">
                   <div className="w-4 h-4 bg-white rounded-full absolute right-0.5 top-0.5 shadow-sm"></div>
                </div>
             </div>
             <div className="flex items-center justify-between">
                <div>
                   <p className="text-sm font-medium text-slate-900">Prompt Injection Filter</p>
                   <p className="text-xs text-slate-500">LLM Gateway content safety screening.</p>
                </div>
                <div className="w-10 h-5 bg-blue-600 rounded-full relative cursor-pointer">
                   <div className="w-4 h-4 bg-white rounded-full absolute right-0.5 top-0.5 shadow-sm"></div>
                </div>
             </div>
             <div className="flex items-center justify-between">
                <div>
                   <p className="text-sm font-medium text-slate-900">Immutable Audit Logging</p>
                   <p className="text-xs text-slate-500">Store agent traces in compliance vault.</p>
                </div>
                <div className="w-10 h-5 bg-blue-600 rounded-full relative cursor-pointer">
                   <div className="w-4 h-4 bg-white rounded-full absolute right-0.5 top-0.5 shadow-sm"></div>
                </div>
             </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-6">
            <Lock className="w-4 h-4 text-blue-600" /> Role-Based Access Control (RBAC)
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div>
                <p className="text-sm font-medium text-slate-900">Platform Admin</p>
                <p className="text-xs text-slate-500">Full system & settings access</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-purple-50 border border-purple-200 px-2 py-1 text-[10px] font-medium text-purple-700 uppercase tracking-wider">
                Full Access
              </span>
            </div>
            
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div>
                <p className="text-sm font-medium text-slate-900">Regional Manager</p>
                <p className="text-xs text-slate-500">Cross-outlet analytics & overrides</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 border border-blue-200 px-2 py-1 text-[10px] font-medium text-blue-700 uppercase tracking-wider">
                Regional Scoped
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div>
                <p className="text-sm font-medium text-slate-900">Franchisee</p>
                <p className="text-xs text-slate-500">Single-outlet operations only</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-green-50 border border-green-200 px-2 py-1 text-[10px] font-medium text-green-700 uppercase tracking-wider">
                Outlet Scoped
              </span>
            </div>
            
            <div className="mt-4 pt-4 border-t border-slate-200">
              <p className="text-xs text-slate-500 leading-relaxed">
                RBAC is currently active. The active role restricts data visibility (e.g., Franchisees cannot see network-wide anomalies or manager workflows). You can simulate these permissions using the profile switcher in the sidebar.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
