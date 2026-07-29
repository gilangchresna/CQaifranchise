import React, { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import { Layout } from "@/src/components/Layout";
import { Dashboard } from "@/src/components/Dashboard";
import { Outlets } from "@/src/components/Outlets";
import { Workforce } from "@/src/components/Workforce";
import { Workflows } from "@/src/components/Workflows";
import { Integrations } from "@/src/components/Integrations";
import { Models } from "@/src/components/Models";
import { Agents } from "@/src/components/Agents";
import { Settings } from "@/src/components/Settings";
import { ChatPanel } from "@/src/components/ChatPanel";
import { RiskDashboard } from "@/src/components/RiskDashboard";
import { AccessManagement } from "@/src/components/AccessManagement";
import { PeerBenchmark } from "@/src/components/PeerBenchmark";
import { ApprovalWorkflows } from "@/src/components/ApprovalWorkflows";
import KnowledgeBaseAdmin from "@/src/components/KnowledgeBaseAdmin";
import Login from "@/src/components/Login";
import { Role } from "@/src/types";

export type Tab =
  | "Dashboard" | "Outlets" | "Workforce" | "Workflows" | "Agents" | "Risk" | "Knowledge" | "Peer" | "Approval" | "Integrations" | "Models" | "Settings" | "Access";

export default function App() {
  const [activeRole, setActiveRole] = useState<Role>("Regional");
  const [activeTab, setActiveTab] = useState<Tab>("Dashboard");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Check auth on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Show loading while checking auth
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  // No auth - show login (keeps design)
  if (!isAuthenticated) {
    return <Login />;
  }

  // Authenticated - show full app

  const renderContent = () => {
    switch (activeTab) {
      case "Dashboard":
        return <Dashboard activeRole={activeRole} />;
      case "Outlets":
        return <Outlets activeRole={activeRole} />;
      case "Workforce":
        return <Workforce activeRole={activeRole} />;
      case "Workflows":
        return <Workflows activeRole={activeRole} />;
      case "Agents":
        return <Agents activeRole={activeRole} />;
      case "Risk":
        return <RiskDashboard activeRole={activeRole} />;
      case "Knowledge":
        return <KnowledgeBaseAdmin />;
      case "Peer":
        return <PeerBenchmark />;
      case "Approval":
        return <ApprovalWorkflows />;
      case "Integrations":
        return <Integrations activeRole={activeRole} />;
      case "Models":
        return <Models activeRole={activeRole} />;
      case "Access":
        return <AccessManagement activeRole={activeRole} />;
      case "Settings":
        return <Settings />;
      default:
        return <Dashboard activeRole={activeRole} />;
    }
  };

  const handleRoleChange = (role: Role) => {
    setActiveRole(role);
    setActiveTab("Dashboard");
  };

  return (
    <Layout
      activeRole={activeRole}
      onRoleChange={handleRoleChange}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {renderContent()}
      <ChatPanel />
    </Layout>
  );
}
