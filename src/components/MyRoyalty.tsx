import { useState, useEffect } from 'react';
import { supabase } from "@/src/lib/supabase";
import { 
  DollarSign, TrendingUp, TrendingDown, CheckCircle, Clock,
  Target, Award, Info, ChevronDown, ChevronUp, Star
} from 'lucide-react';

interface MyRoyaltyData {
  current_rate: number;
  effective_rate: number;
  monthly_royalty: number;
  flat_royalty: number;
  savings: number;
  period: string;
  breakdown: {
    score: number;
    revenue_tier: string;
    yoy_growth: number;
    compliance: number;
  };
  adjustments: {
    score_multiplier: number;
    score_adjustment: number;
    tier_adjustment: number;
    growth_modifier: number;
    compliance_adjustment: number;
  };
  recent_payments: Payment[];
}

interface Payment {
  id: string;
  period: string;
  amount: number;
  paid_date: string;
  status: string;
}

export default function MyRoyalty() {
  const [loading, setLoading] = useState(true);
  const [royalty, setRoyalty] = useState<MyRoyaltyData | null>(null);
  const [expandedBreakdown, setExpandedBreakdown] = useState(false);

  useEffect(() => {
    fetchMyRoyalty();
  }, []);

  async function fetchMyRoyalty() {
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      setLoading(false);
      return;
    }

    const userId = session.user.id;

    const { data: calc } = await supabase
      .from('royalty_calculations')
      .select('*')
      .eq('franchisee_id', userId)
      .order('period_month', { ascending: false })
      .limit(1)
      .single();

    const { data: payments } = await supabase
      .from('royalty_payments')
      .select('*')
      .eq('franchisee_id', userId)
      .order('payment_date', { ascending: false })
      .limit(6);

    if (calc) {
      setRoyalty({
        current_rate: calc.base_rate_used * 100,
        effective_rate: calc.effective_rate * 100,
        monthly_royalty: calc.royalty_amount,
        flat_royalty: calc.flat_royalty_amount,
        savings: calc.savings_vs_flat,
        period: calc.period_month,
        breakdown: {
          score: calc.risk_score || 0,
          revenue_tier: calc.period_end ? 'Active' : 'New',
          yoy_growth: (calc.yoy_growth || 0) * 100,
          compliance: (calc.compliance_score || 0) * 100,
        },
        adjustments: {
          score_multiplier: calc.score_multiplier,
          score_adjustment: calc.score_adjustment * 100,
          tier_adjustment: calc.tier_adjustment * 100,
          growth_modifier: calc.growth_modifier * 100,
          compliance_adjustment: calc.compliance_adjustment * 100,
        },
        recent_payments: (payments || []).map(p => ({
          id: p.id,
          period: p.period_month,
          amount: p.amount,
          paid_date: p.payment_date,
          status: p.status,
        })),
      });
    }

    setLoading(false);
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency: 'SGD',
      minimumFractionDigits: 0,
    }).format(amount);
  }

  function getRateStatus(rate: number): { label: string; color: string; bgColor: string } {
    if (rate <= 4.2) return { label: '⭐ Excellent', color: 'text-green-600', bgColor: 'bg-green-100' };
    if (rate <= 5.1) return { label: '✅ Good', color: 'text-blue-600', bgColor: 'bg-blue-100' };
    if (rate <= 6.0) return { label: '⚖️ Average', color: 'text-yellow-600', bgColor: 'bg-yellow-100' };
    if (rate <= 7.8) return { label: '⚠️ Below Average', color: 'text-orange-600', bgColor: 'bg-orange-100' };
    if (rate <= 10) return { label: '🔶 Struggling', color: 'text-red-600', bgColor: 'bg-red-100' };
    return { label: '🚨 Watchlist', color: 'text-red-700', bgColor: 'bg-red-200' };
  }

  function getImprovementTips(): string[] {
    const tips: string[] = [];
    if (royalty) {
      if (royalty.breakdown.score < 80) tips.push('💡 Improve your risk score by maintaining on-time payments');
      if (royalty.breakdown.yoy_growth < 10) tips.push('📈 Grow revenue 10%+ YoY for growth bonus');
      if (royalty.breakdown.compliance < 85) tips.push('✅ Complete compliance tasks for compliance bonus');
      if (tips.length === 0) tips.push('🎉 Keep up the great work!');
    }
    return tips;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!royalty) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <DollarSign className="h-16 w-16 mx-auto mb-4 text-gray-400" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Royalty Data Yet</h2>
          <p className="text-gray-500 mb-6">Your royalty will be calculated at month end based on performance.</p>
        </div>
      </div>
    );
  }

  const rateStatus = getRateStatus(royalty.effective_rate);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Royalty</h1>
        <p className="text-gray-500">Track your performance-based royalty</p>
      </div>

      {/* Rate Card */}
      <div className={`rounded-xl border p-6 ${rateStatus.bgColor}`}>
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-2">Your Current Effective Rate</p>
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="text-5xl font-bold text-gray-900">{royalty.effective_rate.toFixed(1)}%</span>
            <span className={`px-3 py-1 rounded-full text-sm ${rateStatus.bgColor} ${rateStatus.color}`}>
              {rateStatus.label}
            </span>
          </div>
          {royalty.savings > 0 ? (
            <div className="flex items-center justify-center gap-2 text-green-600">
              <TrendingDown className="h-5 w-5" />
              <span className="font-semibold">Saving {formatCurrency(royalty.savings)}/mo vs flat 6%</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-gray-600">
              <Info className="h-5 w-5" />
              <span>Compared to flat 6%: {formatCurrency(Math.abs(royalty.savings))}/mo</span>
            </div>
          )}
        </div>
      </div>

      {/* Breakdown Card */}
      <div className="rounded-xl border bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="flex items-center gap-2 font-semibold">
            <Award className="h-5 w-5 text-blue-600" />
            How Your Rate is Calculated
          </h3>
          <button onClick={() => setExpandedBreakdown(!expandedBreakdown)} className="p-1 hover:bg-gray-100 rounded">
            {expandedBreakdown ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </div>
        
        <div className="space-y-4">
          <div className="flex justify-between">
            <span className="text-gray-600">Base Rate</span>
            <span className="font-medium">{royalty.current_rate.toFixed(1)}%</span>
          </div>
          
          <div className="border-t pt-4 space-y-3">
            {expandedBreakdown && (
              <>
                <div className="flex justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-purple-600" />
                    <span className="text-gray-600">Score Multiplier</span>
                  </div>
                  <span className={royalty.adjustments.score_adjustment < 0 ? 'text-green-600' : royalty.adjustments.score_adjustment > 0 ? 'text-red-600' : 'text-gray-600'}>
                    {royalty.adjustments.score_adjustment > 0 ? '+' : ''}{royalty.adjustments.score_adjustment.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                    <span className="text-gray-600">Revenue Tier</span>
                  </div>
                  <span className={royalty.adjustments.tier_adjustment < 0 ? 'text-green-600' : 'text-gray-600'}>
                    {royalty.adjustments.tier_adjustment > 0 ? '+' : ''}{royalty.adjustments.tier_adjustment.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <span className="text-gray-600">Growth Bonus</span>
                  </div>
                  <span className={royalty.adjustments.growth_modifier < 0 ? 'text-green-600' : 'text-gray-600'}>
                    {royalty.adjustments.growth_modifier > 0 ? '+' : ''}{royalty.adjustments.growth_modifier.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-teal-600" />
                    <span className="text-gray-600">Compliance Bonus</span>
                  </div>
                  <span className={royalty.adjustments.compliance_adjustment < 0 ? 'text-green-600' : 'text-gray-600'}>
                    {royalty.adjustments.compliance_adjustment > 0 ? '+' : ''}{royalty.adjustments.compliance_adjustment.toFixed(1)}%
                  </span>
                </div>
              </>
            )}
            {!expandedBreakdown && (
              <div className="text-sm text-gray-500">
                Score: {royalty.breakdown.score} | Growth: {royalty.breakdown.yoy_growth.toFixed(0)}% | Compliance: {royalty.breakdown.compliance.toFixed(0)}%
              </div>
            )}
          </div>
          
          <div className="border-t pt-4 flex justify-between font-semibold">
            <span>EFFECTIVE RATE</span>
            <span className={rateStatus.color}>{royalty.effective_rate.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Monthly Amount */}
      <div className="rounded-xl border bg-white p-6">
        <h3 className="font-semibold mb-4">This Month's Royalty</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500 mb-1">Your Royalty</p>
            <p className="text-2xl font-bold">{formatCurrency(royalty.monthly_royalty)}</p>
            <p className="text-sm text-gray-500">at {royalty.effective_rate.toFixed(1)}%</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500 mb-1">Flat Rate (6%)</p>
            <p className="text-2xl font-bold text-gray-400">{formatCurrency(royalty.flat_royalty)}</p>
          </div>
        </div>
      </div>

      {/* Payment History */}
      <div className="rounded-xl border bg-white p-6">
        <h3 className="flex items-center gap-2 font-semibold mb-4">
          <Clock className="h-5 w-5 text-gray-600" />
          Payment History
        </h3>
        {royalty.recent_payments.length > 0 ? (
          <div className="space-y-3">
            {royalty.recent_payments.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle className={payment.status === 'PAID' ? 'text-green-600' : 'text-yellow-600'} />
                  <div>
                    <p className="font-medium">{payment.period}</p>
                    <p className="text-sm text-gray-500">Paid: {payment.paid_date || 'Pending'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold">{formatCurrency(payment.amount)}</p>
                  <span className={`text-xs px-2 py-1 rounded ${payment.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {payment.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center py-8 text-gray-500">No payment history yet</p>
        )}
      </div>
    </div>
  );
}
