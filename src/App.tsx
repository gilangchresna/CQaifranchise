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
import RoyaltyAgreements from "@/src/components/RoyaltyAgreements";
import RoyaltySimulationExport from "@/src/components/RoyaltySimulationExport";
import { LiveTransactionFeed } from "@/src/components/LiveTransactionFeed";
import { FloatingChat } from "@/src/components/FloatingChat";
import Login from "@/src/components/Login";
import { Underwriter } from "@/src/components/Underwriter";
import { RepaymentsPanel } from "@/src/components/RepaymentsPanel";
import { RoyaltyReconciliationPanel } from "@/src/components/RoyaltyReconciliationPanel";
import { FinancierSelector } from "@/src/components/FinancierSelector";
import { ComplianceFlags } from "@/src/components/ComplianceFlags";
import { AgentInsightsFeed } from "@/src/components/AgentInsightsFeed";
import { Role } from "@/src/types";

export type Tab =
  | "Dashboard" | "Outlets" | "Workforce" | "Workflows" | "Agents" | "Risk" | "Knowledge" | "Peer" | "Approval" | "Integrations" | "Models" | "Settings" | "Access" | "Financing" | "Cases" | "Royalty" | "RoyaltySettings"
  | "Underwriter" | "Repayments" | "RoyaltyReconciliation" | "Financiers" | "Compliance";

export default function App() {
  const [activeRole, setActiveRole] = useState<Role | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("Dashboard");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userRegionId, setUserRegionId] = useState<number | null>(null);
  const [userOutletId, setUserOutletId] = useState<number | null>(null);

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

      // Resolve the franchisee's own outlet for components that need a
      // concrete outlet_id (Financiers tab). HQ/Regional users acting on
      // behalf of a specific franchisee still need a proper outlet-picker —
      // not built here since outlet-selection state doesn't exist elsewhere
      // in this app yet; this only resolves the logged-in franchisee's own outlet.
      const { data: outlet } = await supabase
        .from('outlets')
        .select('id')
        .eq('franchisee_id', session.user.id)
        .limit(1)
        .maybeSingle();
      setUserOutletId(outlet?.id ?? null);
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
      case "underwriter":
        return <Underwriter />;
      case "repayments":
        return <RepaymentsPanel />;
      case "royaltyreconciliation":
        return <RoyaltyReconciliationPanel />;
      case "compliance":
        return <ComplianceFlags />;
      case "financiers":
        return userOutletId ? (
          <FinancierSelector activeRole={activeRole} outletId={userOutletId} market="SG" />
        ) : (
          <div className="p-6 text-slate-500">No outlet resolved for this account yet — Financiers requires an assigned outlet.</div>
        );
      case "royalty":
        return activeRole === "Franchisee" ? <MyRoyalty /> : <RoyaltyDashboard />;
      case "royaltysettings":
        return <RoyaltySettings />;
      case "royaltyagreements":
        return <RoyaltyAgreements />;
      case "royaltysimulation":
        return <RoyaltySimulationExport />;
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
