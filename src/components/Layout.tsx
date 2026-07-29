import React, { useState } from "react";
import { Role } from "@/src/types";
import UserMenu from "./UserMenu";
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
} from "lucide-react";
import { cn } from "@/src/lib/utils";

interface LayoutProps {
  children: React.ReactNode;
  activeRole: Role;
  onRoleChange: (role: Role) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const NAV_ITEMS: Record<Role, { icon: React.ElementType; label: string; id: string }[]> = {
  HQ: [
    { icon: LayoutDashboard, label: "Global Dashboard", id: "Dashboard" },
    { icon: Store, label: "Network Directory", id: "Outlets" },
    { icon: Users, label: "Global Workforce", id: "Workforce" },
    { icon: ActivitySquare, label: "Enterprise Workflows", id: "Workflows" },
    { icon: Bot, label: "Agent Orchestration", id: "Agents" },
    { icon: AlertTriangle, label: "Stockout Risk", id: "Risk" },
    { icon: BookOpen, label: "Knowledge Base", id: "Knowledge" },
    { icon: Server, label: "System Integrations", id: "Integrations" },
    { icon: BrainCircuit, label: "ML Models", id: "Models" },
    { icon: ShieldCheck, label: "Access Control", id: "Access" },
    { icon: Settings, label: "Platform Settings", id: "Settings" },
  ],
  Regional: [
    { icon: LayoutDashboard, label: "Regional Dashboard", id: "Dashboard" },
    { icon: Store, label: "Area Outlets", id: "Outlets" },
    { icon: Users, label: "Area Staff", id: "Workforce" },
    { icon: ActivitySquare, label: "Active Escalations", id: "Workflows" },
    { icon: Bot, label: "Agent Orchestration", id: "Agents" },
    { icon: AlertTriangle, label: "Stockout Risk", id: "Risk" },
    { icon: BookOpen, label: "Knowledge Base", id: "Knowledge" },
    { icon: TrendingUp, label: "Peer Benchmark", id: "Peer" },
    { icon: CheckCircle, label: "Approvals", id: "Approval" },
    { icon: Server, label: "Area Integrations", id: "Integrations" },
    { icon: BrainCircuit, label: "ML Models", id: "Models" },
    { icon: ShieldCheck, label: "Access Control", id: "Access" },
    { icon: Settings, label: "Regional Settings", id: "Settings" },
  ],
  Franchisee: [
    { icon: LayoutDashboard, label: "My Store", id: "Dashboard" },
    { icon: Users, label: "My Team", id: "Workforce" },
    { icon: ActivitySquare, label: "My Tasks", id: "Workflows" },
    { icon: Settings, label: "Store Preferences", id: "Settings" },
  ],
};

export function Layout({ children, activeRole, onRoleChange, activeTab, onTabChange }: LayoutProps) {
  const navItems = NAV_ITEMS[activeRole] || NAV_ITEMS.Franchisee;
  const [notifCount] = useState(3);

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-900 font-sans">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col border-r border-slate-200 bg-white z-10">
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-200">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
            <ActivitySquare className="w-4 h-4" />
          </div>
          <span className="text-sm font-semibold">CyberQuote</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-6">
          <p className="px-2 pb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Menu</p>
          <div className="space-y-1">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  activeTab === item.id ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Role Switcher */}
        <div className="border-t border-slate-200 p-4">
          <p className="text-xs text-slate-400 font-semibold mb-2">Active Role</p>
          <div className="flex gap-1">
            {(["HQ", "Regional", "Franchisee"] as Role[]).map(role => (
              <button
                key={role}
                onClick={() => onRoleChange(role)}
                className={cn(
                  "flex-1 px-2 py-1 rounded-md text-xs font-medium transition-colors",
                  activeRole === role ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-50"
                )}
              >
                {role}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-50">
        {/* Header */}
        <header className="h-16 flex items-center justify-between border-b border-slate-200 bg-white px-8">
          <div className="flex items-center gap-4">
            <h1 className="text-base font-semibold text-slate-900">{activeRole} Dashboard</h1>
            <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-green-50 border border-green-100">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-xs font-medium text-green-700">Live</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search..."
                className="h-9 pl-10 pr-4 rounded-md border border-slate-200 bg-white text-sm focus:ring-1 focus:border-blue-500 outline-none"
              />
            </div>

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
