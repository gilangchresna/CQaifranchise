import { useState, useEffect } from 'react';
import { supabase } from "@/src/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Progress } from '@/components/ui/Progress';
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

    // Get current user
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      setLoading(false);
      return;
    }

    const userId = session.user.id;

    // Get latest calculation
    const { data: calc } = await supabase
      .from('royalty_calculations')
      .select('*')
      .eq('franchisee_id', userId)
      .order('period_month', { ascending: false })
      .limit(1)
      .single();

    // Get recent payments
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
      if (royalty.breakdown.score < 80) {
        tips.push('💡 Improve your risk score by maintaining on-time payments and healthy cash flow');
      }
      if (royalty.breakdown.yoy_growth < 10) {
        tips.push('📈 Grow your revenue by 10%+ YoY to earn a growth bonus');
      }
      if (royalty.breakdown.compliance < 85) {
        tips.push('✅ Complete compliance tasks to earn a compliance bonus');
      }
      if (tips.length === 0) {
        tips.push('🎉 Keep up the great work! Your performance is excellent.');
      }
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
          <p className="text-gray-500 mb-6">
            Your royalty will be calculated at the end of the month based on your performance.
          </p>
          <Button onClick={fetchMyRoyalty}>Refresh</Button>
        </div>
      </div>
    );
  }

  const rateStatus = getRateStatus(royalty.effective_rate);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Royalty</h1>
        <p className="text-gray-500">Track your performance-based royalty and payments</p>
      </div>

      {/* Current Rate Card */}
      <Card className={rateStatus.bgColor}>
        <CardContent className="pt-6">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">Your Current Effective Rate</p>
            <div className="flex items-center justify-center gap-3 mb-4">
              <span className="text-5xl font-bold text-gray-900">
                {royalty.effective_rate.toFixed(1)}%
              </span>
              <Badge className={rateStatus.bgColor} variant="secondary">
                {rateStatus.label}
              </Badge>
            </div>
            
            {royalty.savings > 0 ? (
              <div className="flex items-center justify-center gap-2 text-green-600">
                <TrendingDown className="h-5 w-5" />
                <span className="font-semibold">
                  You're saving {formatCurrency(royalty.savings)}/month vs flat 6%
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 text-gray-600">
                <Info className="h-5 w-5" />
                <span>
                  Compared to flat 6%: {formatCurrency(Math.abs(royalty.savings))}/month
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Breakdown Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Award className="h-5 w-5 text-blue-600" />
              How Your Rate is Calculated
            </span>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setExpandedBreakdown(!expandedBreakdown)}
            >
              {expandedBreakdown ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Quick View */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Base Rate</span>
              <span className="font-medium">{royalty.current_rate.toFixed(1)}%</span>
            </div>
            
            <div className="border-t pt-4">
              {expandedBreakdown ? (
                <div className="space-y-3">
                  {/* Score Multiplier */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-purple-600" />
                      <span className="text-gray-600">Score Multiplier</span>
                    </div>
                    <div className="text-right">
                      <span className={`font-medium ${
                        royalty.adjustments.score_adjustment < 0 ? 'text-green-600' : 
                        royalty.adjustments.score_adjustment > 0 ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {royalty.adjustments.score_adjustment > 0 ? '+' : ''}
                        {royalty.adjustments.score_adjustment.toFixed(1)}%
                      </span>
                      <p className="text-xs text-gray-500">
                        Score {royalty.breakdown.score} → {royalty.adjustments.score_multiplier}x
                      </p>
                    </div>
                  </div>

                  {/* Tier Adjustment */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-blue-600" />
                      <span className="text-gray-600">Revenue Tier</span>
                    </div>
                    <div className="text-right">
                      <span className={`font-medium ${
                        royalty.adjustments.tier_adjustment < 0 ? 'text-green-600' : 
                        royalty.adjustments.tier_adjustment > 0 ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {royalty.adjustments.tier_adjustment > 0 ? '+' : ''}
                        {royalty.adjustments.tier_adjustment.toFixed(1)}%
                      </span>
                      <p className="text-xs text-gray-500">{royalty.breakdown.revenue_tier}</p>
                    </div>
                  </div>

                  {/* growth Modifier */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      <span className="text-gray-600">Growth Bonus</span>
                    </div>
                    <div className="text-right">
                      <span className={`font-medium ${
                        royalty.adjustments.growth_modifier < 0 ? 'text-green-600' : 
                        royalty.adjustments.growth_modifier > 0 ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {royalty.adjustments.growth_modifier > 0 ? '+' : ''}
                        {royalty.adjustments.growth_modifier.toFixed(1)}%
                      </span>
                      <p className="text-xs text-gray-500">
                        {royalty.breakdown.yoy_growth.toFixed(0)}% YoY growth
                      </p>
                    </div>
                  </div>

                  {/* Compliance Adjustment */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-teal-600" />
                      <span className="text-gray-600">Compliance Bonus</span>
                    </div>
                    <div className="text-right">
                      <span className={`font-medium ${
                        royalty.adjustments.compliance_adjustment < 0 ? 'text-green-600' : 
                        royalty.adjustments.compliance_adjustment > 0 ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {royalty.adjustments.compliance_adjustment > 0 ? '+' : ''}
                        {royalty.adjustments.compliance_adjustment.toFixed(1)}%
                      </span>
                      <p className="text-xs text-gray-500">
                        {royalty.breakdown.compliance.toFixed(0)}% compliance
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">
                      Score: {royalty.breakdown.score} | Growth: {royalty.breakdown.yoy_growth.toFixed(0)}% | Compliance: {royalty.breakdown.compliance.toFixed(0)}%
                    </span>
                    <span className="font-medium text-gray-900">
                      = {royalty.effective_rate.toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={(1 - royalty.effective_rate / 6) * 100} className="h-2" />
                </div>
              )}
            </div>

            <div className="border-t pt-4 flex justify-between font-semibold">
              <span>EFFECTIVE RATE</span>
              <span className={rateStatus.color}>{royalty.effective_rate.toFixed(1)}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* How to Improve Card */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            How to Keep Your Discount
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {getImprovementTips().map((tip, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">{'>'}</span>
                <span className="text-gray-700">{tip.replace(/^[^\s]+\s/, '')}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Monthly Amount */}
      <Card>
        <CardHeader>
          <CardTitle>This Month's Royalty</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 mb-1">Your Royalty</p>
              <p className="text-2xl font-bold">{formatCurrency(royalty.monthly_royalty)}</p>
              <p className="text-sm text-gray-500">at {royalty.effective_rate.toFixed(1)}%</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 mb-1">Flat Rate (6%)</p>
              <p className="text-2xl font-bold text-gray-400">{formatCurrency(royalty.flat_royalty)}</p>
              <p className="text-sm text-gray-500">vs flat rate</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-gray-600" />
            Payment History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {royalty.recent_payments.length > 0 ? (
            <div className="space-y-3">
              {royalty.recent_payments.map((payment) => (
                <div 
                  key={payment.id} 
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle className={`h-5 w-5 ${
                      payment.status === 'PAID' ? 'text-green-600' : 'text-yellow-600'
                    }`} />
                    <div>
                      <p className="font-medium">{payment.period}</p>
                      <p className="text-sm text-gray-500">
                        Paid: {payment.paid_date || 'Pending'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatCurrency(payment.amount)}</p>
                    <Badge variant={payment.status === 'PAID' ? 'success' : 'warning'}>
                      {payment.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No payment history yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
