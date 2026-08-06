import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import {
  Settings as SettingsIcon,
  Save,
  Server,
  Shield,
  BrainCircuit,
  Database,
  Lock,
  Mail,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

const EDGE_FUNCTIONS_URL = "https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1";

export function Settings() {
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [loading, setLoading] = useState(true);

  // SMTP Settings state
  const [smtp, setSmtp] = useState({
    smtp_host: "mail.cyberquote.co.id",
    smtp_port: "465",
    smtp_user: "stefanus.gilang@cyberquote.co.id",
    smtp_pass: "",
    smtp_from: "CyberQuote Alerts <stefanus.gilang@cyberquote.co.id>",
  });

  // Notification Settings state
  const [notifications, setNotifications] = useState({
    email_enabled: true,
    whatsapp_enabled: false,
  });

  // Threshold Settings state
  const [thresholds, setThresholds] = useState({
    anomaly_threshold: 15,
    stockout_threshold: 70,
    sla_warning: 50,
    sla_escalation: 75,
  });

  // AI Settings state
  const [aiSettings, setAiSettings] = useState({
    operation_mode: "assist",
    action_threshold: 80,
    semantic_caching: true,
  });

  // Security Settings state
  const [security, setSecurity] = useState({
    agent_allowlist: true,
    prompt_injection_filter: true,
    audit_logging: true,
  });

  // SLA severity mapping
  const [slaMapping, setSlaMapping] = useState({
    sla_high: "1",
    sla_medium: "24",
    sla_low: "72",
  });

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      const res = await fetch(`${EDGE_FUNCTIONS_URL}/settings-get`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;

      const data = await res.json();
      const s = data.settings || {};

      setSmtp({
        smtp_host: s.smtp_host || "mail.cyberquote.co.id",
        smtp_port: s.smtp_port || "465",
        smtp_user: s.smtp_user || "stefanus.gilang@cyberquote.co.id",
        smtp_pass: "", // never expose password
        smtp_from: s.smtp_from || "CyberQuote Alerts <stefanus.gilang@cyberquote.co.id>",
      });

      setNotifications({
        email_enabled: s.email_notifications_enabled !== "false",
        whatsapp_enabled: s.whatsapp_notifications_enabled === "true",
      });

      setThresholds({
        anomaly_threshold: Math.round((parseFloat(s.anomaly_threshold || "0.15") * 100)),
        stockout_threshold: Math.round((parseFloat(s.stockout_threshold || "0.7") * 100)),
        sla_warning: parseInt(s.sla_warning_threshold || "50"),
        sla_escalation: parseInt(s.sla_escalation_threshold || "75"),
      });
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveStatus("idle");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const settingsToSave: Record<string, string> = {
        smtp_host: smtp.smtp_host,
        smtp_port: smtp.smtp_port,
        smtp_user: smtp.smtp_user,
        smtp_from: smtp.smtp_from,
        email_notifications_enabled: String(notifications.email_enabled),
        whatsapp_notifications_enabled: String(notifications.whatsapp_enabled),
        anomaly_threshold: String(thresholds.anomaly_threshold / 100),
        stockout_threshold: String(thresholds.stockout_threshold / 100),
        sla_warning_threshold: String(thresholds.sla_warning),
        sla_escalation_threshold: String(thresholds.sla_escalation),
      };

      // Only include password if changed
      if (smtp.smtp_pass.trim() !== "") {
        settingsToSave.smtp_pass = smtp.smtp_pass;
      }

      const res = await fetch(`${EDGE_FUNCTIONS_URL}/settings-save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ settings: settingsToSave }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Save failed: ${res.status}`);
      }

      setSaveStatus("success");
      setSmtp((prev) => ({ ...prev, smtp_pass: "" })); // clear password field after save
    } catch (err: any) {
      console.error("Settings save error:", err);
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Platform Settings & Governance</h2>
        <div className="flex items-center gap-3">
          {saveStatus === "success" && (
            <span className="flex items-center gap-1 text-sm text-green-600">
              <CheckCircle className="w-4 h-4" /> Saved
            </span>
          )}
          {saveStatus === "error" && (
            <span className="flex items-center gap-1 text-sm text-red-600">
              <AlertCircle className="w-4 h-4" /> Save failed — see error in console
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium transition-all flex items-center gap-2"
          >
            <Save className="w-3 h-3" />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">

        {/* SMTP / Email Configuration */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-6">
            <Mail className="w-4 h-4 text-blue-600" /> Email / SMTP Configuration
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1.5">SMTP Host</label>
              <input
                type="text"
                value={smtp.smtp_host}
                onChange={(e) => setSmtp((p) => ({ ...p, smtp_host: e.target.value }))}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500/50 shadow-sm"
                placeholder="smtp.example.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1.5">Port</label>
                <input
                  type="text"
                  value={smtp.smtp_port}
                  onChange={(e) => setSmtp((p) => ({ ...p, smtp_port: e.target.value }))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500/50 shadow-sm"
                  placeholder="465"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1.5">Username</label>
                <input
                  type="text"
                  value={smtp.smtp_user}
                  onChange={(e) => setSmtp((p) => ({ ...p, smtp_user: e.target.value }))}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500/50 shadow-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1.5">
                Password <span className="text-slate-400 font-normal">(leave blank to keep current)</span>
              </label>
              <input
                type="password"
                value={smtp.smtp_pass}
                onChange={(e) => setSmtp((p) => ({ ...p, smtp_pass: e.target.value }))}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500/50 shadow-sm"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1.5">From Address</label>
              <input
                type="text"
                value={smtp.smtp_from}
                onChange={(e) => setSmtp((p) => ({ ...p, smtp_from: e.target.value }))}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500/50 shadow-sm"
                placeholder="CyberQuote Alerts <alerts@example.com>"
              />
            </div>
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifications.email_enabled}
                    onChange={(e) => setNotifications((p) => ({ ...p, email_enabled: e.target.checked }))}
                    className="accent-blue-600"
                  />
                  <span className="text-slate-700">Email Notifications</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifications.whatsapp_enabled}
                    onChange={(e) => setNotifications((p) => ({ ...p, whatsapp_enabled: e.target.checked }))}
                    className="accent-blue-600"
                  />
                  <span className="text-slate-700">WhatsApp</span>
                </label>
              </div>
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
                   min="1"
                   max="50"
                   value={thresholds.anomaly_threshold}
                   onChange={(e) => setThresholds((p) => ({ ...p, anomaly_threshold: parseInt(e.target.value) }))}
                   className="flex-1 accent-blue-600"
                 />
                 <span className="text-sm font-medium text-blue-600 w-24 text-right">{thresholds.anomaly_threshold}% Deviation</span>
               </div>
             </div>

             <div>
               <label className="text-xs font-semibold text-slate-500 block mb-2">
                 Stockout Risk Threshold
               </label>
               <div className="flex items-center gap-4">
                 <input
                   type="range"
                   min="10"
                   max="100"
                   value={thresholds.stockout_threshold}
                   onChange={(e) => setThresholds((p) => ({ ...p, stockout_threshold: parseInt(e.target.value) }))}
                   className="flex-1 accent-blue-600"
                 />
                 <span className="text-sm font-medium text-blue-600 w-24 text-right">&gt; {thresholds.stockout_threshold}% Prob</span>
               </div>
            </div>

            <div className="pt-4 border-t border-slate-200">
               <label className="text-xs font-semibold text-slate-500 block mb-3">
                 SLA Mapping by Severity
               </label>
               <div className="space-y-2">
                 <div className="flex items-center justify-between text-sm">
                   <span className="text-slate-700">HIGH Severity</span>
                   <select
                     value={slaMapping.sla_high}
                     onChange={(e) => setSlaMapping((p) => ({ ...p, sla_high: e.target.value }))}
                     className="bg-white border border-slate-200 rounded px-2 py-1 text-xs outline-none focus:border-blue-500"
                   >
                     <option value="1">1 Hour</option>
                     <option value="4">4 Hours</option>
                     <option value="24">24 Hours</option>
                   </select>
                 </div>
                 <div className="flex items-center justify-between text-sm">
                   <span className="text-slate-700">MEDIUM Severity</span>
                   <select
                     value={slaMapping.sla_medium}
                     onChange={(e) => setSlaMapping((p) => ({ ...p, sla_medium: e.target.value }))}
                     className="bg-white border border-slate-200 rounded px-2 py-1 text-xs outline-none focus:border-blue-500"
                   >
                     <option value="4">4 Hours</option>
                     <option value="24">24 Hours</option>
                     <option value="48">48 Hours</option>
                   </select>
                 </div>
                 <div className="flex items-center justify-between text-sm">
                   <span className="text-slate-700">LOW Severity</span>
                   <select
                     value={slaMapping.sla_low}
                     onChange={(e) => setSlaMapping((p) => ({ ...p, sla_low: e.target.value }))}
                     className="bg-white border border-slate-200 rounded px-2 py-1 text-xs outline-none focus:border-blue-500"
                   >
                     <option value="24">24 Hours</option>
                     <option value="48">48 Hours</option>
                     <option value="72">72 Hours</option>
                   </select>
                 </div>
               </div>
            </div>

            <div className="pt-4 border-t border-slate-200 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-2">
                  SLA Warning Threshold ({thresholds.sla_warning}% elapsed)
                </label>
                <input
                  type="range"
                  min="10"
                  max="90"
                  value={thresholds.sla_warning}
                  onChange={(e) => setThresholds((p) => ({ ...p, sla_warning: parseInt(e.target.value) }))}
                  className="w-full accent-blue-600"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-2">
                  SLA Escalation Threshold ({thresholds.sla_escalation}% elapsed)
                </label>
                <input
                  type="range"
                  min="20"
                  max="99"
                  value={thresholds.sla_escalation}
                  onChange={(e) => setThresholds((p) => ({ ...p, sla_escalation: parseInt(e.target.value) }))}
                  className="w-full accent-blue-600"
                />
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
              <select
                value={aiSettings.operation_mode}
                onChange={(e) => setAiSettings((p) => ({ ...p, operation_mode: e.target.value }))}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500/50 shadow-sm"
              >
                <option value="inform">Inform (Monitoring & Alerts Only)</option>
                <option value="assist">Assist (Draft Actions, Require Approval)</option>
                <option value="automate">Automate (Execute Low-Risk Actions)</option>
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
                  value={aiSettings.action_threshold}
                  onChange={(e) => setAiSettings((p) => ({ ...p, action_threshold: parseInt(e.target.value) }))}
                  className="flex-1 accent-blue-600"
                />
                <span className="text-sm font-medium text-blue-600">{aiSettings.action_threshold}%</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Actions with AI confidence below this threshold require human approval.
              </p>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <div>
                   <p className="text-sm font-medium text-slate-900">Semantic Caching</p>
                   <p className="text-xs text-slate-500">Cache similar queries to reduce latency & cost.</p>
                </div>
                <button
                  onClick={() => setAiSettings((p) => ({ ...p, semantic_caching: !p.semantic_caching }))}
                  className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${
                    aiSettings.semantic_caching ? "bg-blue-600" : "bg-slate-300"
                  }`}
                >
                   <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 shadow-sm transition-all ${
                    aiSettings.semantic_caching ? "right-0.5" : "right-4"
                  }`} />
                </button>
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
                <button
                  onClick={() => setSecurity((p) => ({ ...p, agent_allowlist: !p.agent_allowlist }))}
                  className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${
                    security.agent_allowlist ? "bg-blue-600" : "bg-slate-300"
                  }`}
                >
                   <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 shadow-sm transition-all ${
                    security.agent_allowlist ? "right-0.5" : "right-4"
                  }`} />
                </button>
             </div>
             <div className="flex items-center justify-between">
                <div>
                   <p className="text-sm font-medium text-slate-900">Prompt Injection Filter</p>
                   <p className="text-xs text-slate-500">LLM Gateway content safety screening.</p>
                </div>
                <button
                  onClick={() => setSecurity((p) => ({ ...p, prompt_injection_filter: !p.prompt_injection_filter }))}
                  className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${
                    security.prompt_injection_filter ? "bg-blue-600" : "bg-slate-300"
                  }`}
                >
                   <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 shadow-sm transition-all ${
                    security.prompt_injection_filter ? "right-0.5" : "right-4"
                  }`} />
                </button>
             </div>
             <div className="flex items-center justify-between">
                <div>
                   <p className="text-sm font-medium text-slate-900">Immutable Audit Logging</p>
                   <p className="text-xs text-slate-500">Store agent traces in compliance vault.</p>
                </div>
                <button
                  onClick={() => setSecurity((p) => ({ ...p, audit_logging: !p.audit_logging }))}
                  className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${
                    security.audit_logging ? "bg-blue-600" : "bg-slate-300"
                  }`}
                >
                   <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 shadow-sm transition-all ${
                    security.audit_logging ? "right-0.5" : "right-4"
                  }`} />
                </button>
             </div>
          </div>
        </div>

        {/* RBAC */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-6">
            <Lock className="w-4 h-4 text-blue-600" /> Role-Based Access Control (RBAC)
          </h3>
          <div className="space-y-3">
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
