import React, { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";

interface RiskScore {
  id: string;
  outlet_id: number;
  score_type: string;
  score_value: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  factors: Record<string, number>;
  recommendation: string;
  assessed_at: string;
}

interface LoanRecommendation {
  id: string;
  franchisee_id: string;
  outlet_id: number;
  requested_amount: number;
  recommended_amount: number;
  approved_amount: number;
  interest_rate_bps: number;
  term_months: number;
  dscr_min: number;
  monthly_payment: number;
  status: string;
  created_at: string;
}

const RISK_COLORS: Record<string, string> = {
  LOW: "text-green-600 bg-green-50",
  MEDIUM: "text-amber-600 bg-amber-50",
  HIGH: "text-orange-600 bg-orange-50",
  CRITICAL: "text-red-600 bg-red-50",
};

export function Underwriter() {
  const [riskScores, setRiskScores] = useState<RiskScore[]>([]);
  const [recommendations, setRecommendations] = useState<LoanRecommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      
      // Fetch risk scores
      const { data: risks } = await supabase
        .from("risk_scores")
        .select("*")
        .order("assessed_at", { ascending: false })
        .limit(20);

      // Fetch loan recommendations
      const { data: loans } = await supabase
        .from("loan_sizing_recommendations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      setRiskScores(risks || []);
      setRecommendations(loans || []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div className="p-6 text-center text-slate-500">Loading underwriting data...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Underwriter</h1>
        <p className="text-sm text-slate-500">Credit risk assessment and loan sizing recommendations</p>
      </div>

      {/* Risk Scores Summary */}
      <div className="grid grid-cols-4 gap-4">
        {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((level) => {
          const count = riskScores.filter((r) => r.risk_level === level).length;
          return (
            <div key={level} className="bg-white rounded-lg border border-slate-200 p-4">
              <div className={`text-2xl font-bold ${RISK_COLORS[level].split(" ")[0]}`}>{count}</div>
              <div className={`text-xs font-medium ${RISK_COLORS[level].split(" ")[1]}`}>{level} Risk</div>
            </div>
          );
        })}
      </div>

      {/* Loan Recommendations */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h2 className="font-semibold text-slate-800">Loan Sizing Recommendations</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Outlet</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Requested</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Recommended</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Approved</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Rate</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Term</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recommendations.map((loan) => (
                <tr key={loan.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium">Outlet #{loan.outlet_id}</td>
                  <td className="px-4 py-2">SGD {loan.requested_amount?.toLocaleString()}</td>
                  <td className="px-4 py-2 font-medium">SGD {loan.recommended_amount?.toLocaleString()}</td>
                  <td className="px-4 py-2 text-green-600">SGD {loan.approved_amount?.toLocaleString()}</td>
                  <td className="px-4 py-2">{(loan.interest_rate_bps / 100).toFixed(2)}%</td>
                  <td className="px-4 py-2">{loan.term_months} mo</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      loan.status === "approved" ? "bg-green-100 text-green-700" :
                      loan.status === "rejected" ? "bg-red-100 text-red-700" :
                      "bg-amber-100 text-amber-700"
                    }`}>
                      {loan.status}
                    </span>
                  </td>
                </tr>
              ))}
              {recommendations.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No loan recommendations yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Risk Scores Detail */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h2 className="font-semibold text-slate-800">Risk Score Details</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {riskScores.map((risk) => (
            <div key={risk.id} className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">Outlet #{risk.outlet_id}</span>
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${RISK_COLORS[risk.risk_level]}`}>
                    {risk.risk_level}
                  </span>
                </div>
                <div className="text-sm text-slate-500">
                  Score: {risk.score_value?.toFixed(1)} | {new Date(risk.assessed_at).toLocaleDateString()}
                </div>
              </div>
              <p className="mt-1 text-sm text-slate-600">{risk.recommendation}</p>
            </div>
          ))}
          {riskScores.length === 0 && (
            <div className="px-6 py-8 text-center text-slate-400">No risk scores yet</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Underwriter;
