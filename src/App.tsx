import React, { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import { I18nProvider } from "./i18n/I18nContext";
import { Layout } from "@/src/components/Layout";
import { Dashboard } from "@/src/components/Dashboard";
import { Outlets } from "@/src/components/Outlets";
import { Workforce } from "@/src/components/Workforce";
import { Workflows } from "@/src/components/Workflows";
import { Integrations } from "@/src/components/Integrations";
import { Models } from "@/src/components/Models";
import { Agents } from "@/src/components/Agents";
import { Settings } from "@/src/components/Settings";
import { RiskDashboard } from "@/src/components/RiskDashboard";
import { AccessManagement } from "@/src/components/AccessManagement";
import { PeerBenchmark } from "@/src/components/PeerBenchmark";
import { ApprovalWorkflows } from "@/src/components/ApprovalWorkflows";
import KnowledgeBaseAdmin from "@/src/components/KnowledgeBaseAdmin";
import { Financing } from "@/src/components/Financing";
import { CasesList } from "@/src/components/CasesList";
import RoyaltyDashboard from "@/src/components/RoyaltyDashboard";
import MyRoyalty from "@/src/components/MyRoyalty";
import RoyaltySettings from "@/src/components/RoyaltySettings";
import { LiveTransactionFeed } from "@/src/components/LiveTransactionFeed";
import { FloatingChat } from "@/src/components/FloatingChat";
import Login from "@/src/components/Login";
import { Role } from "@/src/types";

export type Tab =
  | "Dashboard" | "Outlets" | "Workforce" | "Workflows" | "Agents" | "Risk" | "Knowledge" | "Peer" | "Approval" | "Integrations" | "Models" | "Settings" | "Access" | "Financing" | "Cases" | "Royalty" | "RoyaltySettings";

export default function App() {
  const [activeRole, setActiveRole] = useState<Role | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("Dashboard");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userRegionId, setUserRegionId] = useState<number | null>(null);

  // Fetch user role AND region_id from user_profiles on auth change
  useEffect(() => {
    async function fetchUserRole() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;

      // Map DB role to UI role + get region_id
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role, region_id')
        .eq('id', session.user.id)
        .single();

      if (profile?.role) {
        const roleMap: Record<string, Role> = {
          'HQ_ADMIN': 'HQ',
          'REGIONAL_MANAGER': 'Regional',
          'FRANCHISEE_OWNER': 'Franchisee',
          'FRANCHISEE_STAFF': 'Franchisee',
        };
        const uiRole = roleMap[profile.role] || 'Regional';
        setActiveRole(uiRole);
        setUserRegionId(profile.region_id ?? null);
      }
    }

    fetchUserRole();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setIsAuthenticated(!!session);
      if (session?.user?.id) {
        fetchUserRole();
      }
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
    switch (activeTab.toLowerCase()) {
      case "dashboard":
      case "franchise":
        return <Dashboard activeRole={activeRole} />;
      case "outlets":
        return <Outlets activeRole={activeRole} />;
      case "workforce":
        return <Workforce activeRole={activeRole} userRegionId={userRegionId} />;
      case "workflows":
        return <Workflows activeRole={activeRole} />;
      case "agents":
        return <Agents activeRole={activeRole} userRegionId={userRegionId} />;
      case "risk":
        return <RiskDashboard activeRole={activeRole} />;
      case "knowledge":
        return <KnowledgeBaseAdmin />;
      case "peer":
        return <PeerBenchmark />;
      case "approval":
        return <ApprovalWorkflows />;
      case "integrations":
        return <Integrations activeRole={activeRole} />;
      case "models":
        return <Models activeRole={activeRole} />;
      case "access":
        return <AccessManagement activeRole={activeRole} />;
      case "settings":
        return <Settings />;
      case "financing":
        return <Financing activeRole={activeRole} />;
      case "cases":
        return <CasesList activeRole={activeRole} />;
      case "royalty":
        return activeRole === "Franchisee" ? <MyRoyalty /> : <RoyaltyDashboard />;
      case "royaltysettings":
        return <RoyaltySettings />;
      default:
        return <Dashboard activeRole={activeRole} />;
    }
  };

  const handleRoleChange = (role: Role) => {
    setActiveRole(role);
    setActiveTab("Dashboard");
  };

  return (
    <I18nProvider>
      <Layout
        activeRole={activeRole}
        onRoleChange={handleRoleChange}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      >
        {renderContent()}
        <FloatingChat />
      </Layout>
    </I18nProvider>
  );
}
