import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import {
  Mail,
  Bell,
  BrainCircuit,
  Shield,
  CheckCircle,
  AlertCircle,
  Save,
} from "lucide-react";

type Tab = "notifications" | "thresholds" | "ai-security";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export function Settings() {
  const [activeTab, setActiveTab] = useState<Tab>("notifications");
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // Email Provider
  const [emailProvider, setEmailProvider] = useState<"smtp" | "sendgrid" | "gmail">("smtp");

  // SMTP
  const [smtp, setSmtp] = useState({
    smtp_host: "mail.cyberquote.co.id",
    smtp_port: "465",
    smtp_user: "stefanus.gilang@cyberquote.co.id",
    smtp_pass: "",
    smtp_from: "stefanus.gilang@cyberquote.co.id",
  });

  // SendGrid
  const [sendgrid, setSendgrid] = useState({
    api_key: "",
    from_email: "stefanus.gilang@cyberquote.co.id",
  });

  // Notification toggles
  const [notif, setNotif] = useState({ email: true, whatsapp: false });

  // Thresholds
  const [thresholds, setThresholds] = useState({
    anomaly: 15,
    stockout: 70,
    slaWarning: 50,
    slaEscalation: 75,
    slaHigh: "1",
    slaMedium: "24",
    slaLow: "72",
  });

  // AI
  const [ai, setAi] = useState({
    mode: "assist",
    threshold: 80,
    caching: true,
  });

  // Security toggles
  const [security, setSecurity] = useState({
    allowlist: true,
    injectionFilter: true,
    auditLog: true,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const res = await fetch(`${SUPABASE_URL}/rest/v1/settings`, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) return;

      const rows = await res.json();
      const s: Record<string, string> = {};
      for (const r of rows || []) s[r.key] = r.value || "";

      // Email provider
      setEmailProvider((s.email_provider as "smtp" | "sendgrid" | "gmail") || "smtp");

      setSmtp({
        smtp_host: s.smtp_host || "mail.cyberquote.co.id",
        smtp_port: s.smtp_port || "465",
        smtp_user: s.smtp_user || "stefanus.gilang@cyberquote.co.id",
        smtp_pass: "",
        smtp_from: s.smtp_from || "stefanus.gilang@cyberquote.co.id",
      });

      setSendgrid({
        api_key: "",
        from_email: s.sendgrid_from_email || s.smtp_user || "stefanus.gilang@cyberquote.co.id",
      });

      setNotif({
        email: s.email_notifications_enabled !== "false",
        whatsapp: s.whatsapp_notifications_enabled === "true",
      });

      setThresholds({
        anomaly: Math.round((parseFloat(s.anomaly_threshold || "0.15") * 100)),
        stockout: Math.round((parseFloat(s.stockout_threshold || "0.7") * 100)),
        slaWarning: parseInt(s.sla_warning_threshold || "50"),
        slaEscalation: parseInt(s.sla_escalation_threshold || "75"),
        slaHigh: s.sla_high || "1",
        slaMedium: s.sla_medium || "24",
        slaLow: s.sla_low || "72",
      });

      setAi({
        mode: s.ai_mode || "assist",
        threshold: Math.round(parseFloat(s.ai_threshold || "0.8") * 100),
        caching: s.ai_caching !== "false",
      });

      setSecurity({
        allowlist: s.sec_allowlist !== "false",
        injectionFilter: s.sec_injection_filter !== "false",
        auditLog: s.sec_audit_log !== "false",
      });
    } catch (err) {
      console.error("Load settings error:", err);
    } finally {
      setLoading(false);
    }
  }

  const [testingEmail, setTestingEmail] = useState(false);
  const [testResult, setTestResult] = useState<{success: boolean; message: string} | null>(null);
  const [testEmail, setTestEmail] = useState("");

  async function handleTestEmail() {
    if (!testEmail.trim()) {
      setTestResult({ success: false, message: "❌ Enter recipient email address" });
      return;
    }

    setTestingEmail(true);
    setTestResult(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const emailApiUrl = import.meta.env.VITE_EMAIL_API_URL || `${supabaseUrl.replace('supabase.co', 'functions-edge.supabase.co')}`;

      const res = await fetch(`${emailApiUrl}/email/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testEmail }),
      });

      const data = await res.json();
      if (data.success) {
        setTestResult({ success: true, message: `✅ Test email sent to ${testEmail}!` });
      } else {
        setTestResult({ success: false, message: `❌ ${data.error || 'Failed to send'}` });
      }
    } catch (err) {
      setTestResult({ success: false, message: "❌ Failed to send test email." });
    } finally {
      setTestingEmail(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveStatus("idle");
    setErrorMsg("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setSaveStatus("error");
        setErrorMsg("Not authenticated");
        return;
      }

      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const restUrl = `${SUPABASE_URL}/rest/v1`;

      const settingsToUpsert: Record<string, string> = {
        email_provider: emailProvider,
        smtp_host: smtp.smtp_host,
        smtp_port: smtp.smtp_port,
        smtp_user: smtp.smtp_user,
        smtp_from: smtp.smtp_from,
        sendgrid_api_key: sendgrid.api_key,
        sendgrid_from_email: sendgrid.from_email,
        email_notifications_enabled: String(notif.email),
        whatsapp_notifications_enabled: String(notif.whatsapp),
        anomaly_threshold: String(thresholds.anomaly / 100),
        stockout_threshold: String(thresholds.stockout / 100),
        sla_warning_threshold: String(thresholds.slaWarning),
        sla_escalation_threshold: String(thresholds.slaEscalation),
        sla_high: thresholds.slaHigh,
        sla_medium: thresholds.slaMedium,
        sla_low: thresholds.slaLow,
        ai_mode: ai.mode,
        ai_threshold: String(ai.threshold / 100),
        ai_caching: String(ai.caching),
        sec_allowlist: String(security.allowlist),
        sec_injection_filter: String(security.injectionFilter),
        sec_audit_log: String(security.auditLog),
      };

      if (smtp.smtp_pass.trim() !== "") {
        settingsToUpsert.smtp_pass = smtp.smtp_pass;
      }

      const errors: string[] = [];

      for (const [key, value] of Object.entries(settingsToUpsert)) {
        // Check if exists
        const checkRes = await fetch(
          `${restUrl}/settings?key=eq.${encodeURIComponent(key)}`,
          {
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );
        const existing = await checkRes.json();

        if (existing?.length > 0) {
          const r = await fetch(
            `${restUrl}/settings?key=eq.${encodeURIComponent(key)}`,
            {
              method: "PATCH",
              headers: {
                apikey: anonKey,
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                Prefer: "return=minimal",
              },
              body: JSON.stringify({
                value,
                updated_at: new Date().toISOString(),
              }),
            }
          );
          if (!r.ok) errors.push(`Update ${key} failed`);
        } else {
          const r = await fetch(`${restUrl}/settings`, {
            method: "POST",
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify({
              key,
              value,
              category: "config",
              updated_at: new Date().toISOString(),
            }),
          });
          if (!r.ok) errors.push(`Insert ${key} failed`);
        }
      }

      if (errors.length > 0) throw new Error(errors.join("; "));

      setSaveStatus("success");
      setSmtp((p) => ({ ...p, smtp_pass: "" }));
    } catch (err: any) {
      console.error("Settings save error:", err);
      setSaveStatus("error");
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "notifications", label: "Notifications", icon: <Bell className="w-4 h-4" /> },
    { id: "thresholds", label: "Thresholds & SLA", icon: <AlertCircle className="w-4 h-4" /> },
    { id: "ai-security", label: "AI & Security", icon: <Shield className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Settings</h2>
        <div className="flex items-center gap-3">
          {saveStatus === "success" && (
            <span className="flex items-center gap-1 text-sm text-green-600">
              <CheckCircle className="w-4 h-4" /> Saved
            </span>
          )}
          {saveStatus === "error" && (
            <span className="flex items-center gap-1 text-sm text-red-600">
              <AlertCircle className="w-4 h-4" /> {errorMsg || "Save failed"}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="rounded-md px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium transition-all flex items-center gap-2"
          >
            <Save className="w-3 h-3" />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
              activeTab === tab.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "notifications" && (
        <div className="grid gap-5 md:grid-cols-2">
          {/* Email Provider Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-4">
              <Mail className="w-4 h-4 text-blue-600" />
              Email Provider
            </h3>
            <div className="space-y-4">
              {/* Provider Selection */}
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">
                  Provider
                </label>
                <select
                  value={emailProvider}
                  onChange={(e) => setEmailProvider(e.target.value as "smtp" | "sendgrid" | "gmail")}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm"
                >
                  <option value="smtp">SMTP Direct (mail.cyberquote.co.id)</option>
                  <option value="sendgrid">SendGrid</option>
                  <option value="gmail">Gmail SMTP</option>
                </select>
              </div>

              {/* SMTP Fields */}
              {emailProvider === "smtp" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 block mb-1">Host</label>
                      <input
                        type="text"
                        value={smtp.smtp_host}
                        onChange={(e) => setSmtp((p) => ({ ...p, smtp_host: e.target.value }))}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm"
                        placeholder="mail.domain.com"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 block mb-1">Port</label>
                      <select
                        value={smtp.smtp_port}
                        onChange={(e) => setSmtp((p) => ({ ...p, smtp_port: e.target.value }))}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm"
                      >
                        <option value="465">465 (SSL)</option>
                        <option value="587">587 (TLS)</option>
                        <option value="25">25</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Username / Email</label>
                    <input
                      type="text"
                      value={smtp.smtp_user}
                      onChange={(e) => setSmtp((p) => ({ ...p, smtp_user: e.target.value }))}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">
                      Password / App Password
                      <span className="font-normal text-slate-400"> (leave blank to keep)</span>
                    </label>
                    <input
                      type="password"
                      value={smtp.smtp_pass}
                      onChange={(e) => setSmtp((p) => ({ ...p, smtp_pass: e.target.value }))}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm"
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">From Address</label>
                    <input
                      type="text"
                      value={smtp.smtp_from}
                      onChange={(e) => setSmtp((p) => ({ ...p, smtp_from: e.target.value }))}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm"
                      placeholder="alerts@company.com"
                    />
                  </div>
                </>
              )}

              {/* SendGrid Fields */}
              {emailProvider === "sendgrid" && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">API Key</label>
                    <input
                      type="password"
                      value={sendgrid.api_key}
                      onChange={(e) => setSendgrid((p) => ({ ...p, api_key: e.target.value }))}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm"
                      placeholder="SG.xxxxxx..."
                    />
                    <p className="text-xs text-slate-400 mt-1">Get from sendgrid.com → API Keys</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">From Email</label>
                    <input
                      type="text"
                      value={sendgrid.from_email}
                      onChange={(e) => setSendgrid((p) => ({ ...p, from_email: e.target.value }))}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm"
                      placeholder="alerts@company.com"
                    />
                  </div>
                </>
              )}

              {/* Gmail Fields */}
              {emailProvider === "gmail" && (
                <>
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-800">
                      ⚠️ Gmail requires <strong>App Password</strong>, not your regular password.
                      Enable 2FA first, then create App Password at myaccount.google.com/apppasswords
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Gmail Address</label>
                    <input
                      type="email"
                      value={smtp.smtp_user}
                      onChange={(e) => setSmtp((p) => ({ ...p, smtp_user: e.target.value }))}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm"
                      placeholder="you@gmail.com"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">App Password</label>
                    <input
                      type="password"
                      value={smtp.smtp_pass}
                      onChange={(e) => setSmtp((p) => ({ ...p, smtp_pass: e.target.value }))}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm"
                      placeholder="xxxx xxxx xxxx xxxx"
                    />
                  </div>
                </>
              )}

              {/* Test Button */}
              <div className="pt-3 border-t border-slate-200">
                <div className="mb-3">
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Test Recipient Email</label>
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="test@example.com"
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleTestEmail}
                  disabled={testingEmail}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg text-sm font-medium text-slate-700 transition-colors"
                >
                  {testingEmail ? (
                    <>⏳ Sending...</>
                  ) : (
                    <>🧪 Send Test Email</>
                  )}
                </button>
                {testResult && (
                  <p className={`text-xs mt-2 ${testResult.success ? "text-green-600" : "text-red-600"}`}>
                    {testResult.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Notification Channels Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-4">
              <Bell className="w-4 h-4 text-blue-600" />
              Notification Channels
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div>
                  <p className="text-sm font-medium text-slate-900">Email Notifications</p>
                  <p className="text-xs text-slate-500">Send alerts via SMTP email</p>
                </div>
                <button
                  onClick={() => setNotif((p) => ({ ...p, email: !p.email }))}
                  className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${
                    notif.email ? "bg-blue-600" : "bg-slate-300"
                  }`}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full absolute top-0.5 shadow-sm transition-all ${
                      notif.email ? "right-0.5" : "right-4"
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div>
                  <p className="text-sm font-medium text-slate-900">WhatsApp</p>
                  <p className="text-xs text-slate-500">Send alerts via WhatsApp</p>
                </div>
                <button
                  onClick={() => setNotif((p) => ({ ...p, whatsapp: !p.whatsapp }))}
                  className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${
                    notif.whatsapp ? "bg-blue-600" : "bg-slate-300"
                  }`}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full absolute top-0.5 shadow-sm transition-all ${
                      notif.whatsapp ? "right-0.5" : "right-4"
                    }`}
                  />
                </button>
              </div>

              <div className="pt-3 border-t border-slate-200">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Email uses SMTP server configured on the left. WhatsApp requires Twilio credentials (coming soon).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "thresholds" && (
        <div className="grid gap-5 md:grid-cols-2">
          {/* Alert Thresholds */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">
              Alert Thresholds
            </h3>
            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-500">
                    Sales Anomaly Deviation
                  </label>
                  <span className="text-sm font-medium text-blue-600">
                    {thresholds.anomaly}%
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={thresholds.anomaly}
                  onChange={(e) =>
                    setThresholds((p) => ({
                      ...p,
                      anomaly: parseInt(e.target.value),
                    }))
                  }
                  className="w-full accent-blue-600"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Alert when daily revenue deviates {thresholds.anomaly}%+ from average
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-500">
                    Stockout Risk Probability
                  </label>
                  <span className="text-sm font-medium text-blue-600">
                    &gt;{thresholds.stockout}%
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={thresholds.stockout}
                  onChange={(e) =>
                    setThresholds((p) => ({
                      ...p,
                      stockout: parseInt(e.target.value),
                    }))
                  }
                  className="w-full accent-blue-600"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Alert when predicted stockout probability exceeds {thresholds.stockout}%
                </p>
              </div>
            </div>
          </div>

          {/* SLA Config */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">
              SLA & Escalation
            </h3>
            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-500">
                    Warning at
                  </label>
                  <span className="text-sm font-medium text-amber-600">
                    {thresholds.slaWarning}% elapsed
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="90"
                  value={thresholds.slaWarning}
                  onChange={(e) =>
                    setThresholds((p) => ({
                      ...p,
                      slaWarning: parseInt(e.target.value),
                    }))
                  }
                  className="w-full accent-amber-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-500">
                    Escalate at
                  </label>
                  <span className="text-sm font-medium text-red-600">
                    {thresholds.slaEscalation}% elapsed
                  </span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="99"
                  value={thresholds.slaEscalation}
                  onChange={(e) =>
                    setThresholds((p) => ({
                      ...p,
                      slaEscalation: parseInt(e.target.value),
                    }))
                  }
                  className="w-full accent-red-600"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 space-y-2">
                <label className="text-xs font-semibold text-slate-500 block">
                  Response Time by Severity
                </label>
                {[
                  { key: "slaHigh", label: "HIGH / P0" },
                  { key: "slaMedium", label: "MEDIUM / P1" },
                  { key: "slaLow", label: "LOW / P2" },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-sm text-slate-700">{label}</span>
                    <select
                      value={thresholds[key as keyof typeof thresholds] as string}
                      onChange={(e) =>
                        setThresholds((p) => ({
                          ...p,
                          [key]: e.target.value,
                        }))
                      }
                      className="bg-white border border-slate-200 rounded px-2 py-1 text-xs outline-none focus:border-blue-500"
                    >
                      <option value="1">1 Hour</option>
                      <option value="4">4 Hours</option>
                      <option value="24">24 Hours</option>
                      <option value="48">48 Hours</option>
                      <option value="72">72 Hours</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "ai-security" && (
        <div className="grid gap-5 md:grid-cols-2">
          {/* AI Model */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-4">
              <BrainCircuit className="w-4 h-4 text-blue-600" />
              AI Copilot
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-2">
                  Operation Mode
                </label>
                <select
                  value={ai.mode}
                  onChange={(e) => setAi((p) => ({ ...p, mode: e.target.value }))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm"
                >
                  <option value="inform">Inform — Alerts & Monitoring only</option>
                  <option value="assist">
                    Assist — Draft actions, require approval
                  </option>
                  <option value="automate">
                    Automate — Execute low-risk actions
                  </option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-500">
                    Approval Threshold
                  </label>
                  <span className="text-sm font-medium text-blue-600">{ai.threshold}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={ai.threshold}
                  onChange={(e) =>
                    setAi((p) => ({ ...p, threshold: parseInt(e.target.value) }))
                  }
                  className="w-full accent-blue-600"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Actions below {ai.threshold}% AI confidence need human approval
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <div>
                  <p className="text-sm font-medium text-slate-900">Semantic Caching</p>
                  <p className="text-xs text-slate-500">Cache similar queries</p>
                </div>
                <button
                  onClick={() => setAi((p) => ({ ...p, caching: !p.caching }))}
                  className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${
                    ai.caching ? "bg-blue-600" : "bg-slate-300"
                  }`}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full absolute top-0.5 shadow-sm transition-all ${
                      ai.caching ? "right-0.5" : "right-4"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Security */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-blue-600" />
              Security Guardrails
            </h3>
            <div className="space-y-3">
              {[
                {
                  key: "allowlist" as const,
                  label: "Agent Action Allowlist",
                  desc: "Only permit configured API paths",
                },
                {
                  key: "injectionFilter" as const,
                  label: "Prompt Injection Filter",
                  desc: "Screen input for injection attacks",
                },
                {
                  key: "auditLog" as const,
                  label: "Immutable Audit Log",
                  desc: "Store all agent actions for compliance",
                },
              ].map(({ key, label, desc }) => (
                <div
                  key={key}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">{label}</p>
                    <p className="text-xs text-slate-500">{desc}</p>
                  </div>
                  <button
                    onClick={() =>
                      setSecurity((p) => ({ ...p, [key]: !p[key] }))
                    }
                    className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors flex-shrink-0 ${
                      security[key] ? "bg-blue-600" : "bg-slate-300"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 bg-white rounded-full absolute top-0.5 shadow-sm transition-all ${
                        security[key] ? "right-0.5" : "right-4"
                      }`}
                    />
                  </button>
                </div>
              ))}

              <div className="pt-3 border-t border-slate-200">
                <p className="text-xs text-slate-500 leading-relaxed">
                  RBAC is enforced at the database level. Roles: HQ_ADMIN (full access), REGIONAL_MANAGER (scoped to region), FRANCHISEE_OWNER (single outlet).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
