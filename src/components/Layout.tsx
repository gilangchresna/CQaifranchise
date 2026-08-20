import React, { useState, useEffect } from 'react';
import { Role } from '@/src/types';
import UserMenu from "./UserMenu";
import Logo from '../../Images/cyberquote-icon-fullcolor.png';
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useI18n } from "@/src/i18n/I18nContext";
import {
  LayoutDashboard,
  Store,
  Users,
  Settings,
  Bell,
  ActivitySquare,
  AlertTriangle,
  BrainCircuit,
  Bot,
  BookOpen,
  TrendingUp,
  CheckCircle,
  Server,
  ShieldCheck,
  Search,
  Landmark,
  PanelLeftClose,
  PanelLeft,
  FileText,
} from "lucide-react";
import { cn } from "@/src/lib/utils";

interface LayoutProps {
  children: React.ReactNode;
  activeRole: Role;
  onRoleChange: (role: Role) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function Layout({ children, activeRole, onRoleChange, activeTab, onTabChange }: LayoutProps) {
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState(false);
  const [posLiveStatus, setPosLiveStatus] = useState<'live' | 'stale' | 'offline'>('offline');
  const [lastTxnAt, setLastTxnAt] = useState<string | null>(null);

  // ── POS Live Polling (Option B) ─────────────────────────────────────────────
  // Poll system_status.last_txn_at every 10s — visible on ALL pages via header
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;

    async function checkPosStatus() {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const res = await fetch(
          `${supabaseUrl}/rest/v1/system_status?select=last_txn_at&id=eq.1`,
          {
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${anonKey}`,
            },
          }
        );
        if (!res.ok) return;
        const rows = await res.json();
        if (!rows || rows.length === 0) return;

        const lastTx: string = rows[0].last_txn_at;
        setLastTxnAt(lastTx);

        const lastMs = new Date(lastTx).getTime();
        const ageSec = (Date.now() - lastMs) / 1000;

        if (ageSec <= 60) {
          setPosLiveStatus('live');
        } else if (ageSec <= 300) {
          setPosLiveStatus('stale');     // >1min, <5min
        } else {
          setPosLiveStatus('offline');    // >5min
        }
      } catch {
        // Network error — stay in whatever state
      }
    }

    checkPosStatus();
    intervalId = setInterval(checkPosStatus, 10_000);

    return () => clearInterval(intervalId);
  }, []);

  const navItems = (() => {
    switch (activeRole) {
      case "HQ":
        return [
          { icon: LayoutDashboard, label: t.nav.globalDashboard, id: "Dashboard" },
          { icon: Store, label: t.nav.networkDirectory, id: "Outlets" },
          { icon: Users, label: t.nav.globalWorkforce, id: "Workforce" },
          { icon: ActivitySquare, label: t.nav.enterpriseWorkflows, id: "Workflows" },
          { icon: FileText, label: t.nav.caseManagement, id: "Cases" },
          { icon: Bot, label: t.nav.agentOrchestration, id: "Agents" },
          { icon: AlertTriangle, label: t.nav.stockoutRisk, id: "Risk" },
          { icon: BookOpen, label: t.nav.knowledgeBase, id: "Knowledge" },
          { icon: Server, label: t.nav.systemIntegrations, id: "Integrations" },
          { icon: Landmark, label: t.nav.bridgeFinancing, id: "Financing" },
          { icon: BrainCircuit, label: t.nav.mlModels, id: "Models" },
          { icon: ShieldCheck, label: t.nav.accessControl, id: "Access" },
          { icon: Settings, label: t.nav.platformSettings, id: "Settings" },
        ];
      case "Regional":
        return [
          { icon: LayoutDashboard, label: t.nav.regionalTitle, id: "Dashboard" },
          { icon: Store, label: t.nav.areaOutlets, id: "Outlets" },
          { icon: Users, label: t.nav.areaStaff, id: "Workforce" },
          { icon: ActivitySquare, label: t.nav.activeEscalations, id: "Workflows" },
          { icon: FileText, label: t.nav.caseManagement, id: "Cases" },
          { icon: Bot, label: t.nav.agentOrchestration, id: "Agents" },
          { icon: AlertTriangle, label: t.nav.stockoutRisk, id: "Risk" },
          { icon: BookOpen, label: t.nav.knowledgeBase, id: "Knowledge" },
          { icon: TrendingUp, label: t.nav.peerBenchmark, id: "Peer" },
          { icon: CheckCircle, label: t.nav.approvals, id: "Approval" },
          { icon: Server, label: t.nav.areaIntegrations, id: "Integrations" },
          { icon: Landmark, label: t.nav.bridgeFinancing, id: "Financing" },
          { icon: BrainCircuit, label: t.nav.mlModels, id: "Models" },
          { icon: ShieldCheck, label: t.nav.accessControl, id: "Access" },
          { icon: Settings, label: t.nav.regionalSettings, id: "Settings" },
        ];
      case "Franchisee":
        return [
          { icon: LayoutDashboard, label: t.nav.myStore, id: "Dashboard" },
          { icon: Users, label: t.nav.myTeam, id: "Workforce" },
          { icon: ActivitySquare, label: t.nav.myTasks, id: "Workflows" },
          { icon: Landmark, label: t.nav.bridgeFinancing, id: "Financing" },
          { icon: Settings, label: t.nav.storePreferences, id: "Settings" },
        ];
      default:
        return [];
    }
  })();

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-900 font-sans">
      {/* Sidebar */}
      <aside className={cn("flex flex-col border-r border-slate-200 bg-white z-10 transition-all duration-200", collapsed ? "w-16" : "w-64")}>
        {/* Logo + Collapse Toggle */}
        <div className={cn("h-16 flex items-center gap-3 border-b border-slate-200", collapsed ? "justify-center px-2" : "px-4")}>
          {collapsed ? (
            <img src={Logo} alt="CyberQuote" className="w-8 h-8 rounded-lg shrink-0" />
          ) : (
            <>
              <img src={Logo} alt="CyberQuote" className="w-8 h-8 rounded-lg shrink-0" />
              <span className="text-sm font-semibold">CyberQuote</span>
            </>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            className={cn("ml-auto p-1.5 rounded-md hover:bg-slate-100 text-slate-400 shrink-0", collapsed && "mx-auto")}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 overflow-y-auto">
          <p className={cn("px-2 pb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider", collapsed && "sr-only")}>{t.nav.menu}</p>
          <div className="space-y-1">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={cn(
                  "flex items-center gap-3 py-2 rounded-md text-sm font-medium transition-colors w-full",
                  activeTab === item.id ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50",
                  collapsed ? "justify-center px-2" : "px-3"
                )}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            ))}
          </div>
        </nav>

        {/* Role Switcher - Only for HQ, others locked */}
        <div className="border-t border-slate-200 p-4">
          {!collapsed && <p className="px-2 pb-2 text-xs text-slate-400 font-semibold mb-2">{t.nav.activeRole}</p>}
          <div className={cn("flex gap-1", collapsed ? "flex-col" : "")}>
            {/* Show current role only, disable switching */}
            <div
              className={cn(
                "px-2 py-1 rounded-md text-xs font-medium transition-colors",
                "bg-blue-100 text-blue-700",
                collapsed ? "text-center" : ""
              )}
              title={collapsed ? activeRole : undefined}
            >
              {activeRole}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-50">
        {/* Header */}
        <header className="h-16 flex items-center justify-between border-b border-slate-200 bg-white px-8">
          <div className="flex items-center gap-4">
            <h1 className="text-base font-semibold text-slate-900">{activeRole} {t.dashboard.title}</h1>

            {/* ── POS Live/Offline Indicator (Option B — all pages) ── */}
            <div className="flex items-center gap-1.5 text-xs font-medium" title="POS transaction feed">
              {posLiveStatus === 'live' && (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  <span className="text-green-600">Live</span>
                </>
              )}
              {posLiveStatus === 'stale' && (
                <>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
                  <span className="text-yellow-600">Stale</span>
                </>
              )}
              {posLiveStatus === 'offline' && (
                <>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  <span className="text-red-600">Offline</span>
                </>
              )}
              {lastTxnAt && (
                <span className="text-slate-400 text-[10px]">
                  {(() => {
                    const ageSec = Math.round((Date.now() - new Date(lastTxnAt).getTime()) / 1000);
                    if (ageSec < 60) return `${ageSec}s ago`;
                    if (ageSec < 3600) return `${Math.round(ageSec / 60)}m ago`;
                    return `${Math.round(ageSec / 3600)}h ago`;
                  })()}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder={t.common.search}
                className="h-9 pl-10 pr-4 rounded-md border border-slate-200 bg-white text-sm focus:ring-1 focus:border-blue-500 outline-none"
              />
            </div>

            {/* Language Switcher */}
            <LanguageSwitcher />

            <button className="relative rounded-full p-2 hover:bg-slate-100">
              <Bell className="h-5 w-5 text-slate-500" />
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
            </button>

            {/* User Menu — TOP RIGHT */}
            <UserMenu />
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-8">{children}</div>
      </main>
    </div>
  );
}
